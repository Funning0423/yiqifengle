"""Per-frame SIGNED penetration depth (mm; >0 = penetration, <0 = clearance) for
   legs(L/R) x dress / apron (game midsurface + 0.8 mm visible shell) and legs/body parts x chair-back (col_int_chair_back proxy box + real backrest mesh).
Method (garments): exact tri-tri overlap (BVHTree.overlap) seeds; wrong-side vertices (signed distance along the nearest face normal, proper side by majority,
   nearest point on a garment BOUNDARY edge = outside the garment's extent, not counted) are region-grown over mesh adjacency from the seeds, both ways
   (leg verts outside the garment, garment verts inside the leg); depth = max distance in the grown region. No overlap -> depth = -min clearance (cap 60 mm).
usage: blender -b --python measure.py -- <blend> <checker_scripts_dir> <out.json> [frames spec e.g. cine_open_stand:0-90,cine_open_turn:0-45]"""
import bpy, sys, json, time, numpy as np, collections, os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out=a[:3]; spec=a[3] if len(a)>3 else 'cine_open_stand:0-90,cine_open_turn:0-45,cine_open_safe_end:0-0,cine_home_safe_end:0-0'
sys.path.insert(0,sdir); import checker as C, clips
bpy.ops.wm.open_mainfile(filepath=blend)
ck=C.Checker(); T=ck.T
CAP=0.060
def adj_from_tris(t,n):
    A=[[] for _ in range(n)]
    for a_,b_,c_ in t: A[a_]+= [b_,c_]; A[b_]+=[a_,c_]; A[c_]+=[a_,b_]
    return A
def boundary_edges(t):
    cnt=collections.Counter()
    for tri in t:
        for i in range(3):
            e=tuple(sorted((tri[i],tri[(i+1)%3]))); cnt[e]+=1
    return [e for e,c in cnt.items() if c==1]
def seg_dist(p,a_,b_):
    ab=b_-a_; tt=np.clip(np.dot(p-a_,ab)/max(np.dot(ab,ab),1e-18),0,1); return np.linalg.norm(p-(a_+tt*ab))
class Surf:
    """garment/body surface with boundary info (topology constant across frames)"""
    def __init__(s,t,nv):
        s.t=t; s.adj=adj_from_tris(t,nv); be=boundary_edges(t); s.fbe=collections.defaultdict(list)
        bv=set()
        for e in be: bv.update(e)
        S=set(be)
        for fi,tri in enumerate(t):
            for i in range(3):
                e=tuple(sorted((tri[i],tri[(i+1)%3])))
                if e in S: s.fbe[fi].append(e)
        s.nbe=len(be)
    def on_boundary(s,co,fi,cp,tol=2e-5):
        for e in s.fbe.get(fi,()):
            if seg_dist(np.array(cp),co[e[0]],co[e[1]])<tol: return True
        return False
SURF={}; SHELLB={}
def signed(Pco,idx,Gco,surf,GT,maxd=CAP):
    """signed distance of points Pco[idx] to surface G; returns arrays s (signed), d, valid(not boundary)"""
    S=np.full(len(idx),np.nan); D=np.full(len(idx),np.nan)
    for k,i in enumerate(idx):
        cp,n,fi,d=GT.find_nearest(Vector(Pco[i]),maxd)
        if cp is None: continue
        if surf is not None and surf.on_boundary(Gco,fi,cp): continue
        S[k]=(Vector(Pco[i])-cp).dot(n); D[k]=d
    return S,D
def grow(seeds,wrong,adj):
    seen=set(); st=[v for v in seeds if wrong.get(v)]; seen.update(st)
    while st:
        v=st.pop()
        for u in adj[v]:
            if u not in seen and wrong.get(u): seen.add(u); st.append(u)
    return seen
def pair_depth(bc,part_t,Gco,Gt,gname,mode,body_adj):
    key=(gname,mode)
    if key not in SURF: SURF[key]=Surf(Gt,len(Gco))
    surf=SURF[key]; GT=ck.tree(Gco,Gt); PT=ck.tree(bc,part_t)
    pv=np.unique(part_t.ravel())
    s,d=signed(bc,pv,Gco,surf,GT)
    ok=~np.isnan(s)
    # proper side by majority of part verts within 30 mm
    near=ok&(d<0.03); proper=1.0 if (np.sign(s[near]).sum()>=0) else -1.0
    ov=PT.overlap(GT)
    du=CAP
    for i in pv:
        cp,n,fi,dd=GT.find_nearest(Vector(bc[i]),CAP)
        if cp is not None and dd<du: du=dd
    if mode=='mid' and not ov:
        SHELLB[(gname,)]=du
    if not ov:
        clr=float(d[ok].min()) if ok.any() else CAP
        return {'depth_mm':round(-min(clr,CAP)*1000,2),'min_dist_incl_hem_mm':round(du*1000,3),'tri_pairs':0,'n_pen_verts':0,'proper':proper}
    def lazy_grow(seeds,P_co,G_co,Gsurf,Gtree,adj,sign_ok):
        cache={}
        def w(v):
            if v not in cache:
                cp,n,fi,d=Gtree.find_nearest(Vector(P_co[v]),CAP*2)
                if cp is None or (Gsurf is not None and Gsurf.on_boundary(G_co,fi,cp)): cache[v]=None
                else:
                    ss=(Vector(P_co[v])-cp).dot(n); cache[v]=d if sign_ok(ss) else None
            return cache[v]
        reg=set(); st=[]
        for v in seeds:
            if w(v) is not None: reg.add(v); st.append(v)
        while st:
            v=st.pop()
            for u in adj[v]:
                if u not in reg and w(u) is not None: reg.add(u); st.append(u)
        return {v:cache[v] for v in reg}
    seedsA=set(np.unique(part_t[[o[0] for o in ov]].ravel()).tolist())
    rA=lazy_grow(seedsA,bc,Gco,surf,GT,body_adj,lambda ss:ss*proper<0)
    gv=set(np.unique(Gt[[o[1] for o in ov]].ravel()).tolist())
    rB=lazy_grow(gv,Gco,bc,None,PT,surf.adj,lambda ss:ss<0)
    dA=max(rA.values(),default=0.0); dB=max(rB.values(),default=0.0)
    if dA>=dB and rA: loc=bc[max(rA,key=rA.get)]
    elif rB: loc=Gco[max(rB,key=rB.get)]
    else: loc=bc[next(iter(seedsA))]
    return {'depth_mm':round(max(dA,dB,1e-6)*1000,2),'depth_part_out_mm':round(dA*1000,2),'depth_garment_in_mm':round(dB*1000,2),
            'tri_pairs':len(ov),'n_pen_verts':len(rA)+len(rB),'proper':proper,'worst_loc':[round(float(x),4) for x in loc],'min_dist_incl_hem_mm':round(du*1000,3)}
# box proxy
def box_axes(bx):
    o=bx[0]; e=sorted([bx[i]-o for i in range(1,8)],key=np.linalg.norm); ax=[e[0]]
    for v in e[1:]:
        if all(abs(np.dot(v,q))/(np.linalg.norm(v)*np.linalg.norm(q))<1e-3 for q in ax): ax.append(v)
        if len(ax)==3: break
    return o,np.array(ax).T
def box_depth(pts,bx):
    o,M=box_axes(bx); L=np.linalg.norm(M,axis=0); loc=np.linalg.solve(M,(pts-o).T).T*L   # metres in box frame
    inside=((loc>0)&(loc<L)).all(1)
    if inside.any():
        dm=np.minimum(loc[inside],L-loc[inside]).min(1); return float(dm.max()),int(inside.sum()),pts[inside][dm.argmax()]
    q=np.clip(loc,0,L); dist=np.linalg.norm(loc-q,axis=1); return -float(dist.min()),0,pts[dist.argmin()]
cco,ctri,CT,_=ck.chair
def is_back(fi):
    l=ck.chMi@Vector(cco[ctri[fi]].mean(0)); return l.y>0.17 and l.z>0.40
back_t=ctri[[i for i in range(len(ctri)) if is_back(i)]]; BACKT=ck.tree(cco,back_t)
body_adj=adj_from_tris(T,len(ck.ev(C.BODY)[0]))
hipsdom=np.isin(ck.dom,['hips'])
frames=[]
for item in spec.split(','):
    clip,r=item.split(':'); f0,f1=map(int,r.split('-')); frames+=[(clip,f) for f in range(f0,f1+1)]
res={'blend':blend,'method':__doc__,'frames':[]}
if os.path.exists(out+'.partial'):
    res=json.load(open(out+'.partial')); done={(x['clip'],x['frame']) for x in res['frames']}; frames=[x for x in frames if x not in done]
cur=None; t0=time.time()
for clip,f in frames:
    if clip!=cur: clips.activate(clip); cur=clip
    bpy.context.scene.frame_set(f); bpy.context.view_layer.update()
    bc,_=ck.ev(C.BODY); row={'clip':clip,'frame':f}
    for mode,solid in (('mid',False),('shell',True)):
        dc,dt=ck.ev(C.DRESS,solid); ac,at=ck.ev(C.APRON,solid)
        for p in ('legL','legR'):
            row[f'{p}x dress[{mode}]']=pair_depth(bc,T[ck.parts[p]],dc,dt,'dress',mode,body_adj)
            row[f'{p}x apron[{mode}]']=pair_depth(bc,T[ck.parts[p]],ac,at,'apron',mode,body_adj)
    for p in ('legL','legR'):
        for g in ('dress','apron'):
            m=row[f'{p}x {g}[mid]']
            # visible 0.8 mm solidify (offset 0) = +-0.4 mm around the game midsurface: if the midsurface is not intersected, the shell can be
            # penetrated by at most 0.4 mm - (unsigned min distance incl. hem rim); else mid depth + 0.4 mm
            row[f'{p}x {g}[shell_bound]']={'depth_mm':round((max(m['depth_mm'],0)+0.4) if m['tri_pairs'] else (0.4-m['min_dist_incl_hem_mm']),3)}
    hc,ht=ck.ev(C.HAIR)
    bx=ck.boxes.get('col_int_chair_back')
    HT=ck.tree(hc,ht)
    for p in ('legL','legR','body','body_nobow','bow','hair'):
        if p=='hair': pts=hc; tr=HT
        else:
            if p not in ck.parts: continue
            pts=bc[np.unique(T[ck.parts[p]].ravel())]; tr=ck.tree(bc,T[ck.parts[p]])
        dd,n,loc=box_depth(pts,bx); row[f'{p}x chair_back_proxy']={'depth_mm':round(dd*1000,2),'verts_inside':n,'worst_loc':[round(float(x),4) for x in loc]}
        ovb=len(tr.overlap(BACKT)); dmin=CAP
        for P in pts[::2]:
            cp,nn,fi,d=BACKT.find_nearest(Vector(P),CAP)
            if cp is not None: dmin=min(dmin,d)
        row[f'{p}x chair_back_real']={'depth_mm':(0.0 if ovb else round(-dmin*1000,2)),'tri_pairs':ovb}
    res['frames'].append(row); print('F',clip,f,round(time.time()-t0,1),{k:v['depth_mm'] for k,v in row.items() if isinstance(v,dict)},flush=True)
    json.dump(res,open(out+'.partial','w'))
json.dump(res,open(out,'w'),indent=0); os.remove(out+'.partial'); print('DONE')
