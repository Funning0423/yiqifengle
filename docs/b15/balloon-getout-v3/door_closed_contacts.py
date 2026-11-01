import bpy, bmesh, math, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='src/transport_balloon_893ac038.glb')
leaf=bpy.data.objects['basket_door_leaf']; bk=bpy.data.objects['balloon_basket']; door=bpy.data.objects['basket_door']; door.rotation_mode='XYZ'
M=bk.matrix_world; BV=[M@v.co for v in bk.data.vertices]; BP=[tuple(p.vertices) for p in bk.data.polygons]; bt=BVHTree.FromPolygons(BV,BP)
Lv=[v.co.copy() for v in leaf.data.vertices]; LP=[tuple(p.vertices) for p in leaf.data.polygons]
for d in (0,0.25,0.5,1,2):
    door.rotation_euler=(0,0,math.radians(d)); bpy.context.view_layer.update(); W=leaf.matrix_world; V=[W@v for v in Lv]
    ov=bt.overlap(BVHTree.FromPolygons(V,LP))
    print('deg',d,'pairs',len(ov))
    for a,b in ov[:6]:
        bc=np.array([tuple(BV[i]) for i in BP[a]]); lc=np.array([tuple(V[i]) for i in LP[b]])
        print('  basket',bc.min(0).round(3),bc.max(0).round(3),'| leaf',lc.min(0).round(3),lc.max(0).round(3))
