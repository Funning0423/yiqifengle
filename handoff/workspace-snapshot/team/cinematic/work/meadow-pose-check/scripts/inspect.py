import bpy
from mathutils import Vector
for o in sorted(bpy.data.objects,key=lambda o:o.name):
    if o.type!='MESH':
        print("NM",o.type,o.name,tuple(round(c,2) for c in o.matrix_world.translation),o.parent.name if o.parent else '');continue
    if o.parent and o.parent.name in('meadow_grass_instances','meadow_flower_instances'): continue
    bb=[o.matrix_world@Vector(c) for c in o.bound_box]
    mn=[round(min(v[i] for v in bb),2) for i in range(3)];mx=[round(max(v[i] for v in bb),2) for i in range(3)]
    print("M",o.name,len(o.data.vertices),mn,mx,'hide' if o.hide_render else '',o.parent.name if o.parent else '')
g=[o for o in bpy.data.objects if o.parent and o.parent.name=='meadow_grass_instances'];f=[o for o in bpy.data.objects if o.parent and o.parent.name=='meadow_flower_instances']
print("grass",len(g),"flowers",len(f))
print("world",bpy.context.scene.world.name if bpy.context.scene.world else None)
