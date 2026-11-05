# char-polish 2026-11-05: in-place GLB edits (vertex counts, morph counts, names, anims unchanged)
import sys,io,numpy as np
from PIL import Image,ImageFilter,ImageDraw
from gltfio import G,scale_target
SRC,DST=sys.argv[1],sys.argv[2]
# round 2 defaults (2026-11-05): mitten-ish hands + back-of-hand lift, thigh slim under skirt, dress tucked under apron
P=dict(hand_len=0.85,hand_thick=1.3,hand_wide=1.1,hand_out=0.0,hand_lift=0.04,lift_w0=0.3,shape_w0=0.6,hand_squeeze=0.5,thigh_slim=0.75,apron_shell=0,dress_tuck=0.008,tuck_r=0.06,head_scale=1.12,hand_scale=1.0,apron_push_m=0.002,skirt_low_to_parent=float(sys.argv[3]) if len(sys.argv)>3 else 0.3,
       mustard=(226,170,46))
import os,json as _j; P.update(_j.loads(os.environ.get('POLISH_P','{}')))
g=G(SRC); j=g.j; sk=j['skins'][0]; jn=[j['nodes'][i]['name'] for i in sk['joints']]; JI={n:i for i,n in enumerate(jn)}
ibm=g.get(sk['inverseBindMatrices']).reshape(-1,4,4); JW={n:np.linalg.inv(ibm[i].T)[:3,3] for n,i in JI.items()}
def prims(name): return [p for m in j['meshes'] if m['name']==name for p in m['primitives']]
def jw(p,joint):
    J=g.get(p['attributes']['JOINTS_0']).astype(int); W=g.get(p['attributes']['WEIGHTS_0']); return (W*(J==JI[joint])).sum(1)
def scale_about(p,w,s,piv):
    f=(1+w*(s-1))[:,None]; pos=g.get(p['attributes']['POSITION']); g.put(p['attributes']['POSITION'],piv+(pos-piv)*f)
    for t in p.get('targets',[]):
        if 'POSITION' in t: scale_target(g,t['POSITION'],f)
# 1 head (+hair+hat, all head-weighted on BODY) bigger, pivot = head joint (skull base)
for p in prims('LOD0_G2_BODY'):
    scale_about(p,jw(p,'head'),P['head_scale'],JW['head'])
    for s in 'LR': scale_about(p,jw(p,'hand.'+s),P['hand_scale'],JW['hand.'+s])
# 2b hands: chunkier low-poly mitten read (shorter, thicker fingers drawn together), optional outward offset away from the skirt
if P['hand_lift'] or P['hand_len']!=1 or P['hand_thick']!=1 or P['hand_wide']!=1 or P['hand_out'] or P['hand_squeeze']:
    for p in prims('LOD0_G2_BODY'):
        pos=g.get(p['attributes']['POSITION']); new=pos.copy()
        for s_ in 'LR':
            w=jw(p,'hand.'+s_); m=w>0.05
            if not m.any(): continue
            o=JW['hand.'+s_]; Q=pos[m]-o
            tip=Q[(w[m]>0.9)]; ax=tip.mean(0); ax/=np.linalg.norm(ax)
            perp=Q-np.outer(Q@ax,ax); C=np.cov(perp[w[m]>0.9].T); ev,evec=np.linalg.eigh(C); wide=evec[:,2]; thick=evec[:,1]
            u=Q@ax; v=Q@wide; t=Q@thick
            fing=np.clip((u-0.05)/0.03,0,1)  # 0 palm .. 1 fingers
            vm=np.average(v[w[m]>0.9]); tm=np.average(t[w[m]>0.9])
            v2=vm+(v-vm)*P['hand_wide']; v2=v2+(vm-v2)*P['hand_squeeze']*fing
            t2=tm+(t-tm)*P['hand_thick']; u2=np.where(u>0.04,0.04+(u-0.04)*P['hand_len'],u)
            Q2=np.outer(u2,ax)+np.outer(v2,wide)+np.outer(t2,thick)+(Q-np.outer(u,ax)-np.outer(v,wide)-np.outer(t,thick))
            dors=thick*(1 if thick[0]*np.sign(o[0])>0 else -1)  # back of hand (palm faces the body at rest)
            out=np.array([np.sign(o[0]),0,0])*P['hand_out']+dors*P['hand_lift']
            r0=P.get('shape_w0',0.0); ww=np.clip((w[m]-r0)/(1-r0),0,1)[:,None]; wl=np.clip((w[m]-P.get('lift_w0',0.0))/(1-P.get('lift_w0',0.0)),0,1)[:,None]
            if P.get('lift_bend',1): wl=wl*np.clip(u/P.get('bend_len',0.09),0,1)[:,None]  # tilt the hand back from the wrist (no wrist step)
            new[m]=pos[m]+(o+Q2-pos[m])*ww+out*wl
        g.put(p['attributes']['POSITION'],new)
# 2 apron off the dress (kills poke-through)
for p in prims('LOD0_G2_APRON'):
    pos=g.get(p['attributes']['POSITION']); n=g.get(p['attributes']['NORMAL']); g.put(p['attributes']['POSITION'],pos+n*P['apron_push_m'])
# 3 skirt weights: move part of each *.low weight to its upper bone -> softer hem swing / less seated flare
up={'skirt.front.low':'skirt.front','skirt.front.low.mid':'skirt.front.mid','skirt.left.low':'skirt.left','skirt.right.low':'skirt.right','skirt.back.low':'skirt.back'}
k=P['skirt_low_to_parent']
for mesh in ('LOD0_G2_DRESS','LOD0_G2_APRON'):
    for p in prims(mesh):
        J=g.get(p['attributes']['JOINTS_0']).astype(int); W=g.get(p['attributes']['WEIGHTS_0'])
        for lo,hi in up.items():
            for c in range(4):
                m=(J[:,c]==JI[lo])&(W[:,c]>0)
                if not m.any(): continue
                if k<=0: continue
                Jm=J[m]; Wm=W[m]; mv=Wm[:,c]*k
                for r in range(len(Jm)):
                    has=np.where((Jm[r]==JI[hi]))[0]
                    free=[s_ for s_ in range(4) if s_!=c and Wm[r,s_]<=1e-6]
                    if len(has): Wm[r,has[0]]+=mv[r]; Wm[r,c]-=mv[r]
                    elif free: Jm[r,free[0]]=JI[hi]; Wm[r,free[0]]=mv[r]; Wm[r,c]-=mv[r]
                J[m]=Jm; W[m]=Wm
        g.put(p['attributes']['JOINTS_0'],J); g.put(p['attributes']['WEIGHTS_0'],W)
# 3d slim the (always skirt-covered) thighs toward the bone axis: room for the dress when seated
if P['thigh_slim']<1:
    for p in prims('LOD0_G2_BODY'):
        pos=g.get(p['attributes']['POSITION']); f=np.ones(len(pos)); new=pos.copy()
        for s_ in 'LR':
            a=JW['thigh.'+s_]; b=JW['shin.'+s_]; ax=(b-a)/np.linalg.norm(b-a); w=jw(p,'thigh.'+s_)
            u=((pos-a)@ax); foot=a+u[:,None]*ax[None,:]; m=(w>0.3)&(pos[:,1]>0.58)
            fall=np.clip((pos[:,1]-0.58)/0.08,0,1)*np.clip(w,0,1)
            sc=1-(1-P['thigh_slim'])*fall
            new[m]=foot[m]+(pos[m]-foot[m])*sc[m][:,None]
        g.put(p['attributes']['POSITION'],new)
# 3c tuck the (hidden) dress surface under the apron inward, so the apron stays outside when both deform
if P['dress_tuck']>0:
    dp=prims('LOD0_G2_DRESS')[0]; ap=prims('LOD0_G2_APRON')[0]
    DP=g.get(dp['attributes']['POSITION']); DN=g.get(dp['attributes']['NORMAL']); AP=g.get(ap['attributes']['POSITION'])
    d2=((DP[:,None,:]-AP[None,:,:])**2).sum(2); nn=d2.argmin(1); dist=np.sqrt(d2[np.arange(len(DP)),nn])
    front=((AP[nn]-DP)*DN).sum(1)>-0.002  # apron is on the outer side
    f=np.clip(1-dist/P['tuck_r'],0,1)*front; f=np.minimum(f*2,1)
    g.put(dp['attributes']['POSITION'],DP-DN*(P['dress_tuck']*f)[:,None]); print('dress tuck verts',int((f>0).sum()))
# 3b apron follows dress: copy skin weights + shared morph deltas from nearest dress vertex (falloff), keep >= min offset outside dress
if P.get('apron_shell',1):
    dp=prims('LOD0_G2_DRESS')[0]; ap=prims('LOD0_G2_APRON')[0]
    DP=g.get(dp['attributes']['POSITION']); DN=g.get(dp['attributes']['NORMAL']); DJ=g.get(dp['attributes']['JOINTS_0']).astype(int); DW=g.get(dp['attributes']['WEIGHTS_0'])
    AP=g.get(ap['attributes']['POSITION']); AJ=g.get(ap['attributes']['JOINTS_0']).astype(int); AW=g.get(ap['attributes']['WEIGHTS_0'])
    d2=((AP[:,None,:]-DP[None,:,:])**2).sum(2); nn=d2.argmin(1); dist=np.sqrt(d2[np.arange(len(AP)),nn])
    r0,r1=P.get('shell_r0',0.02),P.get('shell_r1',0.045); t=np.clip((r1-dist)/(r1-r0),0,1)  # 1 = full transfer
    if P.get('shell_hips_only'):
        domj=AJ[np.arange(len(AJ)),AW.argmax(1)]; t=t*(domj==JI['hips'])*P.get('shell_amt',1.0)
    nJ=AJ.copy(); nW=AW.copy()
    for i in np.where(t>0)[0]:
        acc={}
        for jj,ww in zip(AJ[i],AW[i]): acc[jj]=acc.get(jj,0)+ww*(1-t[i])
        for jj,ww in zip(DJ[nn[i]],DW[nn[i]]): acc[jj]=acc.get(jj,0)+ww*t[i]
        top=sorted(acc.items(),key=lambda x:-x[1])[:4]; tot=sum(w for _,w in top)
        nJ[i]=[a for a,_ in top]+[0]*(4-len(top)); nW[i]=[w/tot for _,w in top]+[0]*(4-len(top))
    g.put(ap['attributes']['JOINTS_0'],nJ); g.put(ap['attributes']['WEIGHTS_0'],nW)
    an=[x for x in j['meshes'] if x['name']=='LOD0_G2_APRON'][0]['extras']['targetNames']; dn=[x for x in j['meshes'] if x['name']=='LOD0_G2_DRESS'][0]['extras']['targetNames']
    from gltfio import sparse_parts
    def dense(acc_i,n):
        a=j['accessors'][acc_i]; out=g.get(acc_i) if 'bufferView' in a else np.zeros((n,3))
        sp=sparse_parts(g,acc_i)
        if sp: idx,val,_=sp; out=out.copy(); out[idx]=val
        return out
    def write_dense(acc_i,arr):
        a=j['accessors'][acc_i]; sp=sparse_parts(g,acc_i)
        if sp:
            idx,val,_=sp; base=g.get(acc_i) if 'bufferView' in a else np.zeros_like(arr)
            # sparse can only change listed indices: write those, report residual
            val[...]=(arr[idx]-(base[idx] if 'bufferView' in a else 0)).astype(val.dtype)
            mask=np.ones(len(arr),bool); mask[idx]=False; res=np.abs(arr[mask]-(base[mask] if 'bufferView' in a else 0)).max() if mask.any() else 0
            a.pop('min',None); a.pop('max',None); return res
        g.put(acc_i,arr); return 0
    for ti,name in enumerate(an if P.get('shell_morph',1) else []):
        if name not in dn: continue
        di=dn.index(name); A=dense(ap['targets'][ti]['POSITION'],len(AP)); D=dense(dp['targets'][di]['POSITION'],len(DP))
        new=A*(1-t[:,None])+D[nn]*t[:,None]; res=write_dense(ap['targets'][ti]['POSITION'],new)
        if res>1e-4: print('WARN sparse residual',name,round(float(res),4))
    # rest offset: keep apron >= off outside dress along dress normal
    off=P.get('shell_off',0.004); s_=((AP-DP[nn])*DN[nn]).sum(1); m=(dist<r1)&(s_<off)
    AP2=AP.copy(); AP2[m]+=DN[nn][m]*(off-s_[m])[:,None]; g.put(ap['attributes']['POSITION'],AP2)
    print('apron shell: transfer',int((t>0).sum()),'full',int((t>=1).sum()),'pushed',int(m.sum()))
# 4/5 textures
def load(n): d,bv=g.image_bytes(n); return Image.open(io.BytesIO(d)).convert('RGB'),bv
def save(n,im,bv):
    b=io.BytesIO(); im.save(b,'JPEG',quality=92); g.replace_view(bv,b.getvalue())
def mustard(im):
    a=np.asarray(im).astype('f4'); r,gg,b=a[...,0],a[...,1],a[...,2]
    m=(r>120)&(gg>100)&(b<0.45*gg)&(gg>0.75*r)  # saturated yellow
    lum=(0.3*r+0.59*gg+0.11*b)/(0.3*252+0.59*235+0.11*40); M=np.array(P['mustard'],'f4')
    a[m]=np.clip(M[None,:]*lum[m][:,None],0,255); return Image.fromarray(a.astype('u1')),int(m.sum())
for n in ('T_G2_DRESS_1024','T_G2_BODY_1024'):
    im,bv=load(n); im,c=mustard(im); save(n,im,bv); print('mustard',n,c)
# face: bigger eyes, darker/thicker brows+lash, readable mouth & nose (main face = lower-left quadrant)
im,bv=load('T_G2_FACE_1024'); im,c=mustard(im); skin=np.array(im.getpixel((300,560)),'f4')
for box in ((80,680,205,815),(305,680,430,815)):
    cx,cy=(box[0]+box[2])/2,(box[1]+box[3])/2; cr=im.crop(box); s=1.22; w,h=cr.size
    big=cr.resize((int(w*s),int(h*s)),Image.LANCZOS)
    a=np.asarray(big).astype('f4'); d=np.abs(a-skin).sum(2); mask=Image.fromarray(((d>25)*255).astype('u1')).filter(ImageFilter.GaussianBlur(1.2))
    im.paste(big,(int(cx-big.size[0]/2),int(cy-big.size[1]/2-6)),mask)
def ink(region,col,grow,thr=30):
    x0,y0,x1,y1=region; cr=im.crop(region); a=np.asarray(cr).astype('f4'); d=np.abs(a-skin).sum(2)
    m=Image.fromarray(((d>thr)*255).astype('u1')).filter(ImageFilter.MaxFilter(grow)).filter(ImageFilter.GaussianBlur(0.8))
    im.paste(Image.new('RGB',cr.size,col),(x0,y0),m)
ink((80,645,215,679),(64,38,34),5)      # brows
ink((300,645,435,679),(64,38,34),5)
ink((225,900,290,935),(150,62,62),5)    # mouth
ink((240,835,275,865),(196,140,120),5,thr=15)  # nose tick
save('T_G2_FACE_1024',im,bv); im.save('/workspace/qifengle/char-polish/work/face_after.png')
g.save(DST); print('saved',DST,P)
