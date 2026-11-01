"""b19 skycity face budget: per-triangle visibility over every repo lens (embree ray casts, resolution independent).
A triangle is visible if ANY of 7 sample points (centroid, 3 corners pulled 10 % in, 3 edge midpoints) has a clear line of sight
from ANY camera whose view cone (45 deg half-angle, wider than every screen's diagonal) contains it.
Occluders: static opaque geometry only (no robot, no foliage cards (alpha), no clouds / cloud sea, no state_* toggles, no mooring props).
Cameras: cams.json (board x7 screens, T-02 final, 247 balloon-flight keys, 504 sky->lake departure lenses) + free-orbit lenses around
walkable pivots (every 3 m of the baked walkable floor + anchors): yaw /20 deg, pitch -6..72, arm 3..40 m, lens pulled in front of walls.
out: vis.npz {"<node>|<prim>": bool[faces] visible}"""
import sys,os,json,math,gzip,numpy as np,trimesh
sys.path.insert(0,os.path.dirname(__file__));import glbio
GLB=sys.argv[1];CAMS=json.load(open(sys.argv[2]));OUT=sys.argv[3]
WALK=os.path.join(os.path.dirname(__file__),'../../region-nodes/fixtures/skycity-walkable.json.gz')
TARGETS={'env_sky_static_palette','env_sky_ruins','env_sky_static_rock_strata','env_sky_floor_seal','env_sky_greattree_canopy','env_sky_island_vines','env_sky_islets_far'}
j,b=glbio.load(GLB);occV=[];occF=[];T={}
def isocc(name,mat):
    if name.startswith(('chr_','state_','env_sky_cloud','env_sky_cumulus','env_sky_waterfall_mist','env_sky_rope_roots','env_sky_ambient_props')):return False
    if 'foliage_cards' in mat or mat=='M_sky_cloud':return False
    return True
nb=0
for name,pi,mat,M,d in glbio.prims(j,b):
    P=(np.c_[d.points.astype('f8'),np.ones(len(d.points))]@M.T)[:,:3];F=d.faces.astype(np.int64)
    if isocc(name,mat):occV.append(P);occF.append(F+nb);nb+=len(P)
    if name in TARGETS:T[f'{name}|{pi}']=(P,F)
occ=trimesh.Trimesh(np.concatenate(occV),np.concatenate(occF),process=False)
ray=trimesh.ray.ray_pyembree.RayMeshIntersector(occ)
print('occluder tris',len(occ.faces),flush=True)
# ---- cameras ----
cams=[(np.array(c['position'],float),np.array(c['target'],float)) for c in CAMS['vis']]
w=json.load(gzip.open(WALK));W,c,x0,z0=w['W'],w['c'],w['x0'],w['z0']
piv={}
for ci,li,y in w['cells']:
    gx,gz=ci%W,ci//W;x=x0+(gx+.5)*c;z=z0+(gz+.5)*c;k=(int(x//3),int(z//3))
    if k not in piv:piv[k]=np.array([x,y,z])
A=json.load(open('/workspace/b16night/poses.json'))['A']
pivots=list(piv.values())+[np.array(v) for k,v in A.items() if k!='anchor_scene_root']
orbit=[]
for p in pivots:
    look=p+np.array([0,1.15,0])
    for yaw in range(0,360,20):
        for pitch,ds in [(-6,(3,6,10)),(8,(3,6,10,22)),(22,(4,6,10,22)),(38,(6,10,22,40)),(55,(6,10,22,40)),(72,(10,22,40))]:
            u=np.array([math.cos(math.radians(pitch))*math.sin(math.radians(yaw)),math.sin(math.radians(pitch)),math.cos(math.radians(pitch))*math.cos(math.radians(yaw))])
            for dd in ds:orbit.append((look,u,dd))
# lens guard: pull the lens in front of the first hit
O=np.array([o[0] for o in orbit]);U=np.array([o[1] for o in orbit]);D=np.array([o[2] for o in orbit],float)
loc,ir,_=ray.intersects_location(O,U,multiple_hits=False);hit=np.full(len(O),np.inf);hit[ir]=np.linalg.norm(loc-O[ir],axis=1)
D2=np.minimum(D,hit-0.3);keep=D2>1.0
for o,u,dd in zip(O[keep],U[keep],D2[keep]):cams.append((o+u*dd,o))
print('cams',len(cams),'(repo',len(CAMS['vis']),'orbit',int(keep.sum()),') pivots',len(pivots),flush=True)
# ---- samples ----
S={};vis={}
for k,(P,F) in T.items():
    a,b_,c_=P[F[:,0]],P[F[:,1]],P[F[:,2]];ce=(a+b_+c_)/3
    S[k]=np.stack([ce,a+(ce-a)*.1,b_+(ce-b_)*.1,c_+(ce-c_)*.1,(a+b_)/2,(b_+c_)/2,(c_+a)/2],1)  # [F,7,3]
    vis[k]=np.zeros(len(F),bool)
COS=math.cos(math.radians(45))
for ci,(Pc,Lc) in enumerate(cams):
    fw=Lc-Pc;fw/=np.linalg.norm(fw)
    for k in T:
        idx=np.where(~vis[k])[0]
        if not len(idx):continue
        pts=S[k][idx].reshape(-1,3);dv=pts-Pc;L=np.linalg.norm(dv,axis=1);dn=dv/L[:,None]
        inc=(dn@fw)>COS
        if not inc.any():continue
        sel=np.where(inc)[0];orig=np.repeat(Pc[None],len(sel),0)
        loc,ir,_=ray.intersects_location(orig,dn[sel],multiple_hits=False)
        hd=np.full(len(sel),np.inf);hd[ir]=np.linalg.norm(loc-orig[ir],axis=1)
        seen=hd>=L[sel]-0.03
        if seen.any():vis[k][idx[np.unique(sel[seen]//7)]]=True
    if ci%500==0:print('cam',ci,{k:int((~v).sum()) for k,v in vis.items()},flush=True)
np.savez(OUT,**vis)
print('INVISIBLE',{k:[int((~v).sum()),len(v)] for k,v in vis.items()})
