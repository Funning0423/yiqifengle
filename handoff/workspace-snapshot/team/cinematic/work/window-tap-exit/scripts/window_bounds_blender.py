import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/wte/room.glb')
for o in bpy.data.objects:
  if 'window' in o.name.lower() and o.type=='MESH':
    vs=[o.matrix_world@v.co for v in o.data.vertices];g=[(v.x,v.z,-v.y) for v in vs]
    mn=[round(min(a[i] for a in g),3) for i in range(3)];mx=[round(max(a[i] for a in g),3) for i in range(3)]
    print('WIN',o.name,mn,mx,[round((mn[i]+mx[i])/2,3) for i in range(3)])
