import sys; sys.path.insert(0,'/workspace/wechat-game/team/voice-bot/m5-island/scripts')
import bpy, math, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from m5_common import *
from m5_bl import *
CCOL=OUT+'/candidate/collision/env_exterior_collision_v2_2b_candidate.glb'
bpy.ops.wm.open_mainfile(filepath=V22A_BLEND)
L=bpy.data.objects['env_lighthouse_ext']; LV,LF=world_mesh(L)
ints={n:world_mesh(bpy.data.objects[n]) for n in ('col_int_door_frame','col_int_walls')}
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=CCOL)
c={n:world_mesh(bpy.data.objects[n]) for n in ('col_ext_tower_wall','col_ext_cottage')}; c.update(ints)
TC=TOWER_C; P=[]
for v in LV:
    if not (0.02<v.z<3.25): continue
    r=math.hypot(v.x-TC[0],v.y-TC[1])
    if r<2.47 or r>3.2: continue
    if 1.419<=v.x<=4.763 and -0.989<=v.y<=2.997: continue
    if abs(v.x)<0.735 and v.z<2.42 and v.y>-0.2: continue
    P.append(tuple(v))
cov=np.zeros(len(P),bool)
for n,(V,F) in c.items(): cov|=np.abs(winding(P,tri_array(V,F)))>0.5
b=[BVHTree.FromPolygons(*c[n]) for n in c]
for i in np.where(~cov)[0]:
    p=Vector(P[i]); d=min(x.find_nearest(p)[3] for x in b)
    if d>0.003: print(round(d,3),[round(x,3) for x in P[i]],'r',round(math.hypot(p.x-TC[0],p.y-TC[1]),3),'ang',round(math.degrees(math.atan2(p.y-TC[1],p.x-TC[0])),1))
V,F=c['col_ext_tower_wall']
for vi,fi in components_vf(V,F):
    an=[math.degrees(math.atan2(V[i].y-TC[1],V[i].x-TC[0])) for i in vi]
    if -150<min(an)<-110: print('slab',round(min(an),1),round(max(an),1),'z',round(min(V[i].z for i in vi),3),round(max(V[i].z for i in vi),3),'r',round(min(math.hypot(V[i].x-TC[0],V[i].y-TC[1]) for i in vi),3),round(max(math.hypot(V[i].x-TC[0],V[i].y-TC[1]) for i in vi),3))
