import sys; sys.path.insert(0,'/workspace/wechat-game/team/voice-bot/m5-island/scripts')
import bpy
from mathutils import Vector
from m5_common import *
from m5_bl import *
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=V21_COL)
W=bvh_of(bpy.data.objects['col_ext_ground_walkable'])
for y in [-0.2,-0.4,-0.8,-1.3,-1.8,-2.0,-2.2,-2.3,-2.4]:
    print(y,[ (x, W.ray_cast(Vector((x,y,3)),Vector((0,0,-1)),10)[0] is not None) for x in (-1.76,-1.70,-1.66,-1.62,-1.56)])
for o in bpy.data.objects: print(o.name, o.matrix_world.translation[:], o.parent)
