import bpy,json,math,numpy as np,sys,os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
REMOVED=os.environ.get('REMOVED')  # npz of removed masks for verification pass
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.environ.get('CITY','env_skycity.glb'))
city=[o for o in bpy.data.objects]
bpy.ops.import_scene.gltf(filepath=os.environ.get('SEA','env_sky_cloudsea_soft.glb'))
sea=bpy.data.objects['env_sky_cloudsea_soft']
TARGETS=['env_sky_cloudsea_soft','env_sky_static_palette','env_sky_greattree_canopy','env_sky_island_vines','env_sky_ruins','env_sky_static_rock_strata','env_sky_starring','env_sky_floor_seal','env_sky_islets_far','env_sky_cloud_small','env_sky_waterfall_mist']
def skinned(o):return any(m.type=='ARMATURE' for m in o.modifiers) or (o.parent and o.parent.type=='ARMATURE')
def isocc(o):
  if o.type!='MESH' or skinned(o):return False
  if o.name.startswith(('env_sky_cloudsea','env_sky_cumulus_far','state_','Icosphere')) and o!=sea:return False
  if any(ms.material and 'foliage_cards' in ms.material.name for ms in o.material_slots):return False
  return True
V=[];F=[]
for o in city+[sea]:
  if not isocc(o):continue
  mw=o.matrix_world;b=len(V);V+=[mw@v.co for v in o.data.vertices]
  F+=[[b+i for i in p.vertices] for p in o.data.polygons]
occ=BVHTree.FromPolygons(V,F)
def g2b(p):return Vector((p[0],-p[2],p[1]))
cams=[]
j=json.load(open('flight.json'));Mi=np.linalg.inv(np.array(j['seam']['skycityRootWorld']['matrix_rowmajor']))
for k in j['keys']:
  if k['frame']!='world':continue
  P=g2b(Mi@np.array(k['cam']+[1]));L=g2b(Mi@np.array(k['camLook']+[1]));cams.append((P,(L-P).normalized(),60))
anch={o.name:o.matrix_world.translation.copy() for o in bpy.data.objects if o.name.startswith('anchor')}
piv=[v for n,v in anch.items() if n!='anchor_scene_root']
pal=bpy.data.objects['env_sky_static_palette'];pv=np.array([tuple(pal.matrix_world@v.co) for v in pal.data.vertices])
mn,mx=pv.min(0),pv.max(0)
up=[(pal.matrix_world@v.co) for v in pal.data.vertices if (pal.matrix_world.to_3x3()@v.normal).z>0.8]
cells={}
for v in up:
  k=(int(v.x//8),int(v.y//8))
  if k not in cells or v.z>cells[k].z:cells[k]=v
top=sorted(cells.values(),key=lambda v:-v.z)
zs=sorted(v.z for v in top);print('cell z median',zs[len(zs)//2])
piv+= [v for v in top if v.z>zs[len(zs)//2]-6][::3]
for p in piv:
  look=p+Vector((0,0,1.25))
  for yaw in range(0,360,20):
    for pitch,ds in [(-6,(4,10,22)),(5,(4,10,22)),(20,(4,10,22)),(35,(4,10,22,40)),(55,(4,10,22,40,60)),(72,(40,60))]:
      for d in ds:
        u=Vector((math.cos(math.radians(pitch))*math.sin(math.radians(yaw)),math.cos(math.radians(pitch))*math.cos(math.radians(yaw)),math.sin(math.radians(pitch))))
        P=look+u*d
        if occ.ray_cast(look,u,d)[0] is not None:continue  # lens can't be inside geometry
        cams.append((P,-u,50))
print('cams',len(cams),'pivots',len(piv),flush=True)
out={}
rem=np.load(REMOVED) if REMOVED else None
for name in TARGETS:
  o=bpy.data.objects[name];m=o.data;mw=o.matrix_world;vv=[mw@v.co for v in m.vertices]
  idx=np.arange(len(m.polygons))
  if rem is not None: idx=np.where(rem[name])[0]  # only re-test removed faces (stored in ORIGINAL order; verification uses original glb)
  cent=[mw@m.polygons[i].center for i in idx];pts=[[cent[k]]+[vv[q] for q in m.polygons[i].vertices] for k,i in enumerate(idx)]
  C=np.array([tuple(c) for c in cent]);vis=np.zeros(len(idx),bool)
  for (P,fw,ha) in cams:
    if vis.all():break
    d=C-np.array(P);dist=np.linalg.norm(d,axis=1)+1e-9;cand=np.where(((d@np.array(fw))/dist>math.cos(math.radians(ha)))&~vis)[0]
    for k in cand:
      for q in pts[k]:
        q2=q+(P-q).normalized()*0.05;dv=q2-P;L=dv.length
        if occ.ray_cast(P,dv/L,L-0.02)[0] is None:vis[k]=True;break
  full=np.ones(len(m.polygons),bool) if rem is None else np.zeros(len(m.polygons),bool)
  full[idx]=vis;out[name]=full
  print('OBJ',name,len(m.polygons),'invisible' if rem is None else 'removed-now-visible',(~vis).sum() if rem is None else vis.sum(),flush=True)
np.savez(os.environ.get('OUT','vis2.npz'),**out)
