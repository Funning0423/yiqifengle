"""Pick the faces to drop: never-seen (vis.npz) faces of the STATIC opaque meshes only, with
 - no face of the great tree trunk / giant roots / S6 terrace (cylinder r 14 m around the trunk axis (1.6, -23.9), all heights),
 - no emissive primitive (env_sky_ruins|1), no animated / skinned / card / cloud / star-ring / state mesh,
 - 'deep' first: faces that share no vertex position with any seen face (a hidden face on a seen face's edge goes last).
python3 select.py env_skycity.glb vis.npz removals.npz target_count"""
import sys,os,json,numpy as np
sys.path.insert(0,os.path.dirname(__file__));import glbio
GLB,VIS,OUT,TARGET=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
ALLOWED=['env_sky_static_palette|0','env_sky_static_rock_strata|0','env_sky_ruins|0','env_sky_floor_seal|0']
TRUNK=(1.6,-23.9,14.0)
j,b=glbio.load(GLB);V=np.load(VIS);cand=[];masks={}
for name,pi,mat,M,d in glbio.prims(j,b):
    k=f'{name}|{pi}'
    if k not in ALLOWED:continue
    P=(np.c_[d.points,np.ones(len(d.points))]@M.T)[:,:3];F=d.faces;vis=V[k];C=P[F].mean(1)
    key=np.round(P,3);_,vid=np.unique(key,axis=0,return_inverse=True);vid=vid.ravel()
    seenv=np.zeros(vid.max()+1,bool);seenv[vid[F[vis].ravel()]]=True
    edge=seenv[vid[F]].any(1)
    trunk=np.hypot(C[:,0]-TRUNK[0],C[:,2]-TRUNK[1])<TRUNK[2]
    ok=(~vis)&(~trunk)
    for i in np.where(ok)[0]:cand.append((int(edge[i]),float(C[i,1]),k,int(i)))  # deep first, then the lowest (underside) edge faces
    masks[k]=np.zeros(len(F),bool)
    print(k,'hidden',int((~vis).sum()),'trunk/S6 protected',int(((~vis)&trunk).sum()),'deep',int((ok&~edge).sum()),'edge',int((ok&edge).sum()))
cand.sort()
for e,_,k,i in cand[:TARGET]:masks[k][i]=True
np.savez(OUT,**masks);print('selected',{k:int(m.sum()) for k,m in masks.items()},'edge-adjacent used',sum(c[0] for c in cand[:TARGET]),'edge y max',max([c[1] for c in cand[:TARGET] if c[0]]+[-99]))
