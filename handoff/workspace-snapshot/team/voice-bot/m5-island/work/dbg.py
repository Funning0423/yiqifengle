import sys; sys.path.insert(0,'/workspace/wechat-game/team/voice-bot/m5-island/scripts')
import bpy, math, numpy as np
from mathutils import Vector
from m5_common import *
from m5_bl import *
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=OUT+'/candidate/collision/env_exterior_collision_v2_2b_candidate.glb')
V,F=world_mesh(bpy.data.objects['col_ext_tower_wall']); TC=TOWER_C
for p in [(-2.252,1.026,1.816),(-1.4,0.195,1.157),(-1.703,4.872,1.034)]:
  for vi,fi in components_vf(V,F):
    an=[math.degrees(math.atan2(V[i].y-TC[1],V[i].x-TC[0])) for i in vi]
    pa=math.degrees(math.atan2(p[1]-TC[1],p[0]-TC[0]))
    if min(an)-2<pa<max(an)+2 and max(an)-min(an)<20:
        w=winding([p],tri_array(V,[F[j] for j in fi]))[0]
        print(p,'slab',round(min(an),1),round(max(an),1),'nverts',len(vi),'w',round(w,3))
        for i in vi: print('   ',[round(x,3) for x in V[i]],round(math.hypot(V[i].x-TC[0],V[i].y-TC[1]),3),round(math.degrees(math.atan2(V[i].y-TC[1],V[i].x-TC[0])),2))
        break
