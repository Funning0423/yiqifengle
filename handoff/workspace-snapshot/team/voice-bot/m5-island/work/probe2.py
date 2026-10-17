import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/art/island/v2.2a/scene/env_scene_island_v2_2a.blend')
for o in sorted(bpy.data.objects,key=lambda o:o.name):
    bb=[o.matrix_world@Vector(c) for c in o.bound_box]
    tris=sum(len(p.vertices)-2 for p in o.data.polygons) if o.type=='MESH' else 0
    print(o.name, o.type, o.parent.name if o.parent else None, 'tris',tris, 'mats',[s.material.name if s.material else None for s in o.material_slots] if o.type=='MESH' else '',
     'bb',[round(min(v[i] for v in bb),2) for i in range(3)],[round(max(v[i] for v in bb),2) for i in range(3)], {k:str(o[k])[:60] for k in o.keys() if not k.startswith('_')})
