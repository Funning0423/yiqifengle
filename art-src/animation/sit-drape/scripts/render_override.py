# blender -b -P render_override.py -- <shapes.npz> <out_prefix> <clip> <t_s> [views] [res_h] [root_z]
# Renders the posed character with LOD0_G2_DRESS / LOD0_G2_APRON replaced by static meshes at the given positions
# (npz keys 'dress' / 'apron', glTF axes, seated-root frame, one row per original vertex).  Used to look at solver targets.
import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from mathutils import Matrix, Vector
import sdlib as S
import render_lib as R

a = sys.argv[sys.argv.index('--') + 1:]
NPZ, OUT, CLIP, T = a[0], a[1], a[2], float(a[3])
VIEWS = (a[4] if len(a) > 4 else 'side,front,q34,back').split(',')
RES = int(a[5]) if len(a) > 5 else 400
RZ = float(a[6]) if len(a) > 6 else 0.0
d = np.load(NPZ)
bpy.ops.wm.read_factory_settings(use_empty=True)
CV, CF = S.extract_chair()
ch = S.Character(os.environ.get('SD_GLB', S.GLB))
S.make_mesh_object('chair', S.gl2bl(S.chair_in_seated_root(CV)), CF, R.flat_material('wood', (0.55, 0.38, 0.25)))
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
bpy.context.object.data.materials.append(R.flat_material('floor', (0.42, 0.40, 0.37)))
ch.top.location = Vector((0, -RZ, 0))
ch.pose(CLIP, T)
for key, name in (('dress', 'LOD0_G2_DRESS'), ('apron', 'LOD0_G2_APRON')):
    if key not in d.files:
        continue
    src = ch.mesh[name]
    o = src.copy()
    o.data = src.data.copy()
    o.name = name + '_OVR'
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    if o.data.shape_keys:
        o.shape_key_clear()
    P = S.gl2bl(d[key])
    P[:, 1] -= RZ
    for v, p in zip(o.data.vertices, P):
        v.co = Vector(p)
    bpy.context.scene.collection.objects.link(o)
    src.hide_render = True
R.setup_workbench()
for v in VIEWS:
    loc, tg = R.SEAT_VIEWS[v]
    loc = (loc[0], loc[1] - RZ, loc[2])
    tg = (tg[0], tg[1] - RZ, tg[2])
    c = R.camera(v, loc, tg, lens=50)
    R.render(c, '%s_%s.png' % (OUT, v), int(RES * 0.8), RES)
