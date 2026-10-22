import bpy,sys,math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
print('ARM',arm.name,arm.matrix_world.to_euler(),arm.parent)
for b in arm.data.bones:print('B',b.name,b.parent.name if b.parent else None,[round(x,3) for x in arm.matrix_world@b.head_local],[round(x,3) for x in arm.matrix_world@b.tail_local])
print([a.name for a in bpy.data.actions])
print([ (o.name,o.type) for o in bpy.data.objects])
