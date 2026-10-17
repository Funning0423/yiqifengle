import bpy, json
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/art/island/v2.2a/scene/env_scene_island_v2_2a.blend')
out=[]
for o in bpy.data.objects:
    if any(k in o.name for k in ('fence','col_','tower','lighthouse','exit_path','anchor','return','route','path')) or o.type=='CAMERA':
        bb=[o.matrix_world@Vector(c) for c in o.bound_box]
        print(o.name, o.type, 'parent=',o.parent.name if o.parent else None, 'loc=',tuple(round(x,3) for x in o.matrix_world.translation),
              'bbx=',round(min(v.x for v in bb),3),round(max(v.x for v in bb),3),'bby=',round(min(v.y for v in bb),3),round(max(v.y for v in bb),3),'bbz=',round(min(v.z for v in bb),3),round(max(v.z for v in bb),3),
              'mesh=',o.data.name if o.type=='MESH' else '', 'users=',o.data.users if o.type=='MESH' else '')
print('NOBJ',len(bpy.data.objects),'NMESH',len(bpy.data.meshes),'NMAT',len(bpy.data.materials))
for m in bpy.data.materials: print('MAT',m.name,'backface_cull=',m.use_backface_culling, 'users',m.users)
