import bpy, math, numpy as np
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='src/transport_balloon_893ac038.glb')
for o in bpy.data.objects:
    M=o.matrix_world
    s=f"{o.name:30s} {o.type:6s} parent={o.parent.name if o.parent else None} loc={tuple(round(x,4) for x in o.location)} rot={tuple(round(math.degrees(x),2) for x in o.rotation_euler)} mode={o.rotation_mode} q={tuple(round(x,4) for x in o.rotation_quaternion)} scl={tuple(round(x,3) for x in o.scale)}"
    if o.type=='MESH':
        V=np.array([tuple(M@v.co) for v in o.data.vertices]); s+=f" nV={len(V)} nF={len(o.data.polygons)} min={V.min(0).round(4)} max={V.max(0).round(4)}"
    print(s)
print('ANIMS',[a.name for a in bpy.data.actions])
