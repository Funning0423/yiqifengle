# Debug renders of numpy shapes (cloth sim / fitted reconstructions) on the chair, same cameras as render_sit.py.
#   blender -b -P render_pts.py -- <job.json>
# job: {"glb", "out", "res", "dist", "npz": {"DRESS": path, "APRON": path, "BOW": path} (arrays [sim frame, V, 3]),
#       "shots": [{"name", "frame" (sim frame), "view", "dist", "lift"}]}
# The body follows sitlib.sequence (same frames as drape_sim.py); meshes without an npz are skinned.
import json
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))


def g2b(P):
    P = np.asarray(P)
    return np.stack([P[..., 0], -P[..., 2], P[..., 1]], -1)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
ch = SL.Character(job['glb'])
frames, _ = SL.sequence(ch)
src = {}
for m, p in job.get('npz', {}).items():
    z = np.load(p)
    src[m] = z[m]
COL = dict(BODY=(0.93, 0.78, 0.68, 1), DRESS=(0.92, 0.72, 0.22, 1), APRON=(0.95, 0.95, 0.93, 1), BOW=(0.95, 0.95, 0.93, 1),
           chair=(0.55, 0.36, 0.22, 1), floor=(0.78, 0.72, 0.62, 1))


def mesh_obj(name, V, F, color):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in g2b(V)], [], [tuple(int(i) for i in f) for f in F])
    me.update()
    for p in me.polygons:
        p.use_smooth = name not in ('chair', 'floor')
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    mt = bpy.data.materials.new(name + '_m')
    mt.diffuse_color = color
    me.materials.append(mt)
    return ob


d = np.load(SL.CHAIR_NPZ)
mesh_obj('chair', d['chair_V'], d['chair_F'], COL['chair'])
mesh_obj('floor', d['floor_V'], d['floor_F'], COL['floor'])
objs = {m: mesh_obj(m, ch.md[m]['P'], ch.md[m]['F'], COL[m]) for m in ('BODY', 'DRESS', 'APRON', 'BOW')}

sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.color_type = 'MATERIAL'
sh.show_cavity = True
sh.cavity_type = 'WORLD'
sh.background_type = 'WORLD'
wd = bpy.data.worlds.new('w')
wd.color = (0.20, 0.21, 0.23)
sc.world = wd
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x, sc.render.resolution_y = job.get('res', [640, 640])
sc.render.image_settings.file_format = 'PNG'
cam_d = bpy.data.cameras.new('cam')
cam_d.lens = job.get('lens', 50)
cam_d.clip_start = 0.02
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
FWD = SL.roty(SL.YAW) @ np.array([0, 0, 1.0])
LEFT = SL.roty(SL.YAW) @ np.array([1.0, 0, 0])
AIM = SL.from_chair(np.array([[0.0, 0.42, 0.04]]))[0]
VIEWS = dict(side_L=(LEFT, 0.0), side_R=(-LEFT, 0.0), front=(FWD, 0.05), q34=(FWD * 0.70 + LEFT * 0.71, 0.18),
             q34_R=(FWD * 0.70 - LEFT * 0.71, 0.18), q34_back=(-FWD * 0.6 + LEFT * 0.8, 0.25), back=(-FWD, 0.35),
             top=(FWD * 0.15, 3.0), under=(FWD * 0.9, -0.25), wide=(FWD * 0.75 + LEFT * 0.66, 0.35))
os.makedirs(job['out'], exist_ok=True)
for s in job['shots']:
    f = s['frame']
    W = SL.world_joints(ch, frames[f])
    for m, ob in objs.items():
        P = src[m][f] if m in src else ch.skin(m, W)
        ob.data.vertices.foreach_set('co', g2b(P).astype(np.float64).ravel())
        ob.data.update()
    v, up = VIEWS[s['view']]
    dv = np.asarray(v, float) / np.linalg.norm(v)
    dd = s.get('dist', job.get('dist', 1.25))
    aim = np.array(s.get('aim', AIM))
    pos = aim + dv * dd + np.array([0, up * dd + s.get('lift', 0.0), 0])
    cam.location = Vector(g2b(pos))
    cam.rotation_euler = (Vector(g2b(aim)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(job['out'], s['name'] + '.png')
    bpy.ops.render.render(write_still=True)
print('DONE', len(job['shots']))
