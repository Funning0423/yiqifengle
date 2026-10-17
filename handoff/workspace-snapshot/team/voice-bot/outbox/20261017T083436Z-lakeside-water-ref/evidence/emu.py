"""Voice Bot: Cocos 3.8.8 legacy-standard + lakeside-water.effect + LAYERED fog + ACES emulator on a Blender G-buffer.
Formulas from cocos-engine v3.8.8 sources (shading-standard-base.chunk, output-standard.chunk, pipeline-ubo.ts, fog-base / LayeredFog, light-component.ts)."""
import numpy as np, json
def s2l(c): c=np.asarray(c,float); return c*c   # Cocos gamma.chunk: SRGBToLinear = x*x
def s2l_true(c): c=np.asarray(c,float); return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def l2s(c): c=np.clip(np.asarray(c,float),0,1); return np.sqrt(c)   # Cocos gamma.chunk: LinearToSRGB = sqrt
def tex_byte(lin):
    c=np.clip(lin,0,1); return np.where(c<=0.0031308,c*12.92,1.055*c**(1/2.4)-0.055)
def lin_to_srgb8(c): return np.round(255*l2s(c)).astype(int)
def aces(c): c=np.minimum(c,8.0); return (c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14)
EXPOSURE=0.833333/2**np.log2(16*16/(1/125)*100/100)   # default Camera: F16, 1/125 s, ISO 100
def load(path):
    z=np.load(path); g=lambda k:np.stack([z[f'ViewLayer.{k}__ViewLayer.{k}.{c}'] for c in 'RGB'],-1)
    ids=json.load(open(path.replace('.npz','.exr.ids.json')))
    return dict(alb=g('alb'),vc=g('vc'),nrm=g('nrm'),pos=g('pos'),oid=np.rint(z['ViewLayer.Object Index__ViewLayer.Object Index.X']).astype(int),ids=ids)
def shade(G,P):
    """P: sun_illum, sun_color_byte (what Color() gets), amb_illum, sky_byte, ground_byte, water dict, fog dict, use_vc, cam."""
    alb=s2l(tex_byte(G['alb']));  # Blender's image node returns linear; Cocos samples the sRGB byte and squares it
    vc=s2l(np.clip(G['vc'],0,1)) if P.get('vc_is_byte',True) else G['vc']
    N=G['nrm']; N=N/np.maximum(np.linalg.norm(N,axis=-1,keepdims=True),1e-6); pos=G['pos']; cam=np.array(P['cam'])
    V=cam-pos; V/=np.maximum(np.linalg.norm(V,axis=-1,keepdims=True),1e-6)
    if P.get('two_sided',True):  # doubleSided glTF materials: back faces flip the normal
        flip=(N*V).sum(-1)<0; N=np.where(flip[...,None],-N,N)
    Lf=np.array(P['sun_forward']); L=-Lf/np.linalg.norm(Lf)
    litw=P['sun_illum']*EXPOSURE; lit=np.array(P['sun_color_byte'])/255.0*litw
    ambw=P['amb_illum']*EXPOSURE; sky=np.array(P['sky_byte'])/255.0; gnd=np.array(P['ground_byte'])/255.0
    NL=np.clip((N*L).sum(-1),0,None)[...,None]
    fAmb=np.maximum(1e-4,0.5-N[...,1:2]*0.5); amb=(sky*(1-fAmb)+gnd*fAmb)*ambw
    base=alb*(vc if P.get('use_vc',True) else 1.0)
    diffuse=base
    # specular (legacy BRDFApprox + CalcSpecular, roughness 0.8, specularIntensity 0.5 -> F0 0.04)
    rough=P.get('roughness',0.8); H=L+V; H/=np.maximum(np.linalg.norm(H,axis=-1,keepdims=True),1e-6)
    NH=np.clip((N*H).sum(-1),0,None)[...,None]; NV=np.abs((N*V).sum(-1))[...,None]
    c0=np.array([-1,-0.0275,-0.572,0.022]); c1=np.array([1,0.0425,1.04,-0.04])
    r=rough*c0+c1; a004=np.minimum(r[0]*r[0],np.exp2(-9.28*NV))*r[0]+r[1]; AB=np.concatenate([a004*-1.04+r[2],a004*1.04+r[3]],-1)
    spec=0.04*AB[...,0:1]+AB[...,1:2]
    a2=(rough*rough)**2; d=NH*NH*(a2-1)+1; Dg=a2/(np.pi*d*d+1e-6)  # CalcSpecular ~ GGX D (normalized), approx
    col=lit*NL*(diffuse/np.pi + spec*Dg*P.get('spec_on',1.0)) + amb*diffuse
    oid=G['oid']; wid=G['ids'].get('LK_lake.glb',-1); W=P.get('water')
    if W is not None:
        m=(oid==wid)
        N0=N
        if W.get('waves'):  # lakeside-water.effect USE_WAVES: sin normal, optional distance fade (wf) and flat-normal sky lookup
            t=W.get('t',0.0)*W['wave_speed']; f=W['wave_freq']; px=pos[...,0]*f; pz=pos[...,2]*f
            dx=np.sin(px+t)+0.5*np.sin(1.7*pz-1.3*t); dz=np.cos(pz+0.8*t)+0.5*np.cos(1.3*px+1.1*t)
            dist=np.linalg.norm(pos-cam,axis=-1); fs,fe=W.get('wave_fade',(1e9,2e9))
            x=np.clip((dist-fs)/(fe-fs),0,1); wf=1-x*x*(3-2*x)
            Nw=N+np.stack([dx,np.zeros_like(dx),dz],-1)*(W['wave_tilt']*wf)[...,None]; Nw/=np.linalg.norm(Nw,axis=-1,keepdims=True)
            N=np.where(m[...,None],Nw,N)
        NV=np.clip((N*V).sum(-1),0,1)[...,None]; NL=np.clip((N*L).sum(-1),0,None)[...,None]
        H=L+V; H/=np.maximum(np.linalg.norm(H,axis=-1,keepdims=True),1e-6)
        vcw=np.clip(G['vc'],0,1) if W.get('vc_linear') else vc   # vc_linear: shader uses v_color as is (no SRGBToLinear)
        wa=np.array(W['tint'])*(vcw if W.get('use_vc',True) else 1.0)
        fAw=np.maximum(1e-4,0.5-N[...,1:2]*0.5); ambw_=(sky*(1-fAw)+gnd*fAw)*ambw
        wcol=wa*(lit*NL/np.pi*W.get('main',1.0)+ambw_*W.get('amb',1.0))
        F=W['F0']+(1-W['F0'])*(1-np.clip(NV,0,1))**W['power']
        Ns=N0 if W.get('flat_sky') else N; R=2*(Ns*V).sum(-1,keepdims=True)*Ns-V; e=R[...,1:2]
        ss=lambda a,b,x:np.clip((x-a)/(b-a),0,1)**2*(3-2*np.clip((x-a)/(b-a),0,1))
        skyc=np.array(W['horizon'])*(1-ss(0,0.16,e))+np.array(W['low'])*ss(0,0.16,e)
        t=ss(0.16,0.38,e); skyc=skyc*(1-t)+np.array(W['zenith'])*t
        skyc=skyc*ambw*W['sky_strength']*W.get('refl_scale',1.0)
        mix=np.clip(np.maximum(F,W['floor']),0,W['fmax'])
        wcol=wcol*(1-mix)+skyc*mix
        Hs=H; ex=W['spec_exp']; wcol=wcol+lit*np.clip((N*Hs).sum(-1,keepdims=True),0,None)**ex*W['spec_int']*F
        col=np.where(m[...,None],wcol,col)
    Fg=P.get('fog')
    if Fg:
        fc=s2l(np.array(Fg['color'])/255.0)
        if Fg['mode']=='layered':
            dY=np.maximum(Fg['top']-pos[...,1],0)*2/Fg['range']; dx=pos[...,0]-cam[0]; dz=pos[...,2]-cam[2]
            dD=np.sqrt(dx*dx+dz*dz)*2/Fg['atten']; dens=np.sqrt(dY*dY+dD*dD)*dY*0.5; f=1-np.exp(-dens)   # fog amount
        else:
            dist=np.linalg.norm(pos-cam,axis=-1); f=np.clip((dist-Fg['start'])/(Fg['end']-Fg['start']),0,1)
        col=col*(1-f[...,None])+fc*f[...,None]
    bg=(oid==0)
    out=l2s(aces(col)) if P.get('aces',True) else l2s(col)
    clr=np.array(P.get('clear_byte',(28,144,183)))/255.0
    out=np.where(bg[...,None],clr,out)
    return (np.clip(out,0,1)*255+0.5).astype(np.uint8)
