"""clipfix: contact-masked temporal smoothing of the pass2c per-frame cloth knots (dress + apron).
For every one-hot knot frame f (m1_cNN used alone at frame NN): R_o = basis + delta(m1_cNN) (rest space), R_s = rest-space shape of the
Gaussian-smoothed schedule (sigma). New knot = R_o + m * (R_s - R_o), m = per-vertex contact mask: 0 within NEAR mm of the body / real chair
(original, collision-solved shape kept exactly), 1 beyond FAR mm (smoothed), smoothstep + mesh-Laplacian blur between. Apron mask also <= mask of
the nearest dress vertex (layers move together). Bones, timing, the schedule and the morph-target count are unchanged; bow tails untouched.
usage: blender -b --python fix_cloth.py -- <in.blend> <scripts_dir> <sidecar.json> <sigma> <near_mm> <far_mm> <out.blend> [frames]"""
import bpy, sys, json, math, numpy as np
a=sys.argv[sys.argv.index('--')+1:]; inb,sdir,side,SIG,NEAR,FAR,outb=a[:7]; SIG=float(SIG); NEAR=float(NEAR)/1000; FAR=float(FAR)/1000
sys.path.insert(0,sdir); import checker as C, clips
from mathutils import Vector
from mathutils.bvhtree import BVHTree
bpy.ops.wm.open_mainfile(filepath=inb); ck=C.Checker(); sc=bpy.context.scene
W={int(k):v for k,v in json.load(open(side))['cine_open_stand_weights'].items()}
def smooth(f):
    r=int(math.ceil(3*SIG)); acc={}; tot=0
    for j in range(f-r,f+r+1):
        if j not in W: continue
        g=math.exp(-0.5*((f-j)/SIG)**2); tot+=g
        for k,v in W[j].items(): acc[k]=acc.get(k,0)+g*v
    return {k:v/tot for k,v in acc.items()}
OB=[C.DRESS,C.APRON]
KB={};BASIS={};ADJ={}
for on in OB:
    me=bpy.data.objects[on].data; ks=me.shape_keys; n=len(me.vertices)
    def arr(kb): x=np.empty(n*3); kb.data.foreach_get('co',x); return x.reshape(-1,3)
    BASIS[on]=arr(ks.key_blocks[0]); KB[on]={kb.name:arr(kb)-BASIS[on] for kb in ks.key_blocks[1:]}
    adj=[[] for _ in range(n)]
    for e in me.edges: i,j=e.vertices; adj[i].append(j); adj[j].append(i)
    ADJ[on]=adj
def rest(on,Wd): R=BASIS[on].copy(); [R.__iadd__(v*KB[on][k]) for k,v in Wd.items() if k in KB[on]]; return R
ALPHAS=[1.0,0.75,0.5,0.3,0.15]
frames=[f for f in range(91) if list(W[f].keys())==[f'm1_c{f:02d}'] and abs(W[f][f'm1_c{f:02d}']-1)<1e-6]
if len(a)>7 and a[7]: frames=[f for f in frames if f in set(int(x) for x in a[7].split(','))]
clips.activate('cine_open_stand'); log={}
NEW={on:{} for on in OB}
def evalw(f,Wd):
    """world midsurface coords of dress/apron at frame f with the shape-key weights Wd (NLA muted for the evaluation)"""
    sc.frame_set(f); out={}
    for on in OB:
        k=bpy.data.objects[on].data.shape_keys; tr=[t for t in k.animation_data.nla_tracks]; mu=[t.mute for t in tr]
        for t in tr: t.mute=True
        for kb in k.key_blocks[1:]: kb.value=Wd.get(kb.name,0.0)
    bpy.context.view_layer.update()
    for on in OB: out[on]=ck.ev(on,False)[0]
    for on in OB:
        k=bpy.data.objects[on].data.shape_keys
        for t in k.animation_data.nla_tracks: t.mute=(t.name!='cine_open_stand')
    return out
for f in frames:
    Ws=smooth(f); Xo=evalw(f,W[f]); Xs=evalw(f,Ws)
    bc,bt=ck.ev(C.BODY); keep=bt[ck.parts['body_nobow']]; BT=BVHTree.FromPolygons([Vector(p) for p in bc],keep.tolist(),all_triangles=True)
    cco,ctri,CT,_=ck.chair
    M={}
    for on in OB:
        n=len(Xo[on]); d=np.empty(n)
        for i in range(n):
            dd=1.0
            for X in (Xo[on][i],Xs[on][i]):
                for T in (BT,CT):
                    cp,nn,fi,dist=T.find_nearest(Vector(X),FAR*2)
                    if cp is not None: dd=min(dd,dist)
            d[i]=dd
        m=np.clip((d-NEAR)/(FAR-NEAR),0,1); m=m*m*(3-2*m)
        for _ in range(4):
            m=np.array([0.5*m[i]+0.5*np.mean(m[ADJ[on][i]]) if ADJ[on][i] else m[i] for i in range(n)])
        m[d<NEAR]=0.0; M[on]=m
    # apron mask <= nearest dress vertex mask
    from mathutils.kdtree import KDTree
    kd=KDTree(len(Xo[C.DRESS])); [kd.insert(Vector(p),i) for i,p in enumerate(Xo[C.DRESS])]; kd.balance()
    M[C.APRON]=np.array([M[C.DRESS][kd.find(Vector(p))[1]] for p in Xo[C.APRON]])   # v2: apron uses exactly the dress mask underneath (layers blend together)
    def setk(alpha):
        for on in OB:
            Ro=rest(on,W[f]); Rs=rest(on,Ws); R=Ro+alpha*M[on][:,None]*(Rs-Ro); NEW[on][f]=R
            bpy.data.objects[on].data.shape_keys.key_blocks[f'm1_c{f:02d}'].data.foreach_set('co',R.ravel()); bpy.data.objects[on].data.update()
        sc.frame_set(f); bpy.context.view_layer.update()
    def score():
        r=ck.run(); out={}
        for k,v in r.items():
            if k.startswith(('info','proxy','self:legLxlegL_ctrl','env:')): continue
            for q in ('tri_pairs','verts_inside','verts_below'):
                if q in v: out[k+'.'+q]=v[q]
        return out
    setk(0.0); base=score(); chosen=0.0
    for alpha in ALPHAS:
        setk(alpha); sc_=score()
        if all(sc_[k]<=base.get(k,0) for k in sc_): chosen=alpha; break
    setk(chosen)
    log[f]={'alpha':chosen,**{on:{'mask_mean':round(float(M[on].mean()),3),'mask_zero_frac':round(float((M[on]==0).mean()),3),'max_shift_mm':round(float(np.linalg.norm((NEW[on][f]-rest(on,W[f])),axis=1).max())*1000,2)} for on in OB}}
    print('FC',f,log[f],flush=True)
for on in OB:
    ks=bpy.data.objects[on].data.shape_keys
    for f,R in NEW[on].items():
        kb=ks.key_blocks[f'm1_c{f:02d}']; kb.data.foreach_set('co',R.ravel())
    bpy.data.objects[on].data.update()
bpy.ops.wm.save_as_mainfile(filepath=outb); json.dump({'sigma':SIG,'near_mm':NEAR*1000,'far_mm':FAR*1000,'frames':log},open(outb+'.fixlog.json','w'),indent=0); print('FCDONE')
