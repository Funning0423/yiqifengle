# blender -b -P render_strip.py -- <glb> <outdir> <clip> <times comma> <views comma> [res_h]
# One import, many stills: <outdir>/<view>_<time>.png plus pose.json (joint rotation vs t=0).
import bpy, sys, os, json, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'sit-drape', 'scripts'))
import numpy as np
from mathutils import Vector, Quaternion
import sdlib as S
import render_lib as R

a = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT, CLIP = a[0], a[1], a[2]
TIMES = [float(x) for x in a[3].split(',')]
VIEWS = a[4].split(',')
RES = int(a[5]) if len(a) > 5 else 420
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
CV, CF = S.extract_chair()
ch = S.Character(GLB)
S.make_mesh_object('chair', S.gl2bl(S.chair_in_seated_root(CV)), CF, R.flat_material('wood', (0.55, 0.38, 0.25)))
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
bpy.context.object.data.materials.append(R.flat_material('floor', (0.42, 0.40, 0.37)))
for n in ('LOD0_G2_DRESS', 'LOD0_G2_APRON'):
    sk = ch.mesh[n].data.shape_keys
    if sk:
        for kb in sk.key_blocks[1:]:
            kb.value = 1.0 if kb.name == 'sit_drape' else 0.0
R.setup_workbench()
ch.top.location = (0, 0, 0)
cams = {}
for v in VIEWS:
    loc, tg = R.SEAT_VIEWS[v]
    cams[v] = R.camera(v, loc, tg, lens=50)
WATCH = ('hips', 'spine', 'chest', 'neck', 'head', 'thigh.L', 'thigh.R', 'skirt.front', 'skirt.back', 'hand.L', 'hand.R')


def quat(name):
    q = ch.arm.pose.bones[name].matrix.to_quaternion()
    return (q.x, q.y, q.z, q.w)


def ang(a, b):
    d = abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])
    d = min(1.0, d)
    return math.degrees(2 * math.acos(d))


ch.pose(CLIP, TIMES[0])
q0 = {n: quat(n) for n in WATCH}
report = []
for t in TIMES:
    ch.pose(CLIP, t)
    row = dict(t=t)
    for n in WATCH:
        row[n] = round(ang(q0[n], quat(n)), 4)
    report.append(row)
    tag = ('%.2f' % t).replace('.', '_')
    for v, cam in cams.items():
        R.render(cam, os.path.join(OUT, '%s_%s.png' % (v, tag)), int(RES * 0.8), RES)
    print('FRAME', json.dumps(row), flush=True)
json.dump(report, open(os.path.join(OUT, 'pose.json'), 'w'), indent=1)
print('POSE_MAX', max(max(row[n] for n in WATCH) for row in report))
