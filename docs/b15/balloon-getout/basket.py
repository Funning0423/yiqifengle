import bpy, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/fx-b11/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb')
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o.type == 'MESH':
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; mn = [min(v[i] for v in bb) for i in range(3)]; mx = [max(v[i] for v in bb) for i in range(3)]
        print('MESH', o.name, len(o.data.vertices), [round(x, 3) for x in mn], [round(x, 3) for x in mx], 'parent', o.parent.name if o.parent else None)
    else:
        print('NODE', o.name, o.type, [round(x, 3) for x in o.matrix_world.translation])
import numpy as np
o = bpy.data.objects['balloon_basket']; V = np.array([tuple(o.matrix_world @ v.co) for v in o.data.vertices])
r = np.hypot(V[:, 0], V[:, 1]); z = V[:, 2]
low = z < 1.6
print('ZHIST', np.histogram(z[low], bins=16, range=(0, 1.6))[0].tolist())
print('RIM z max(low)', round(z[low].max(), 3), 'r at rim', np.round(np.percentile(r[low & (z > z[low].max() - .05)], [0, 50, 100]), 3).tolist())
for zz in (0.05, 0.3, 0.6, 0.9):
    m = low & (abs(z - zz) < 0.06); print('SLICE', zz, 'r', np.round(np.percentile(r[m], [0, 10, 50, 90, 100]), 3).tolist() if m.any() else None, 'x', np.round([V[m, 0].min(), V[m, 0].max()], 3).tolist() if m.any() else None, 'y', np.round([V[m, 1].min(), V[m, 1].max()], 3).tolist() if m.any() else None)
m = (z > .95) & (z < 1.15) & (abs(V[:, 1]) < .3); print('RIMX', sorted(set(np.round(abs(V[m, 0]), 3).tolist())), sorted(set(np.round(V[m, 2], 3).tolist())))
m = (z < 1.15) & (abs(V[:, 1]) < .3); print('ALLX', sorted(set(zip(np.round(abs(V[m, 0]), 3).tolist(), np.round(V[m, 2], 3).tolist()))))
print('FACES', len(o.data.polygons), 'nonmanifold?')
