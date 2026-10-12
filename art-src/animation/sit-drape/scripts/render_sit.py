# Close-up renders of the character on the reading chair at its game position (Blender workbench, headless).
#   blender -b -P render_sit.py -- <job.json>
# job: {"glb": path, "out": dir, "res": [w, h], "shots": [{"name", "clip", "t", "view", "weights": {target: w} | null,
#        "label": str}], "dist": 1.25, "lens": 50}
# view: side_L | side_R | front | back | q34 | q34_R | q34_back | wide.  weights null = no morph (the shape keys stay at 0).
# Camera aims at the seat (chair local y 0.42); the chair / floor come from data/chair_floor.npz, the character root is
# placed by the driver rule (sitlib.root_matrix).
import json
import math
import os
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
G2B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))    # glTF -> Blender basis
B2G = G2B.inverted()


def g2b(p):
    return Vector((p[0], -p[2], p[1]))


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = SL.FPS
bpy.ops.import_scene.gltf(filepath=job['glb'])
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
top = arm
while top.parent is not None:
    top = top.parent
ctrl = bpy.data.objects.new('CTRL', None)
sc.collection.objects.link(ctrl)
top.parent = ctrl
if arm.animation_data:
    for t in arm.animation_data.nla_tracks:
        t.mute = True
else:
    arm.animation_data_create()
raw = open(job['glb'], 'rb').read()
jl = struct.unpack('<I', raw[12:16])[0]
GJ = json.loads(raw[20:20 + jl])
DUR = {an['name']: max(GJ['accessors'][s['input']]['max'][0] for s in an['samplers']) for an in GJ['animations']}

# chair + floor
d = np.load(SL.CHAIR_NPZ)


def mesh_obj(name, V, F, color):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(g2b(v)) for v in V], [], [tuple(int(i) for i in f) for f in F])
    me.update()
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    m = bpy.data.materials.new(name + '_m')
    m.diffuse_color = color
    me.materials.append(m)
    return ob


mesh_obj('chair', d['chair_V'], d['chair_F'], (0.55, 0.36, 0.22, 1))
fl = mesh_obj('floor', d['floor_V'], d['floor_F'], (0.78, 0.72, 0.62, 1))
for p in fl.data.polygons:
    p.use_smooth = False

sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.color_type = 'TEXTURE'
sh.show_shadows = False
sh.show_cavity = True
sh.cavity_type = 'WORLD'
sh.show_object_outline = False
sh.background_type = 'WORLD'
wd = bpy.data.worlds.new('w')
wd.color = (0.20, 0.21, 0.23)
sc.world = wd
sc.view_settings.view_transform = 'Standard'
res = job.get('res', [720, 720])
sc.render.resolution_x, sc.render.resolution_y = res
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('LOD0'):
        for m in o.data.materials:
            pass
cam_d = bpy.data.cameras.new('cam')
cam_d.lens = job.get('lens', 50)
cam_d.clip_start = 0.02
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam

FWD = SL.roty(SL.YAW) @ np.array([0, 0, 1.0])      # her forward (= chair front)
LEFT = SL.roty(SL.YAW) @ np.array([1.0, 0, 0])     # her left
AIM = SL.from_chair(np.array([[0.0, 0.42, 0.04]]))[0]
VIEWS = dict(side_L=(LEFT, 0.0), side_R=(-LEFT, 0.0), front=(FWD, 0.05), q34=(FWD * 0.70 + LEFT * 0.71, 0.18),
             q34_R=(FWD * 0.70 - LEFT * 0.71, 0.18), q34_back=(-FWD * 0.6 + LEFT * 0.8, 0.25), back=(-FWD, 0.30), wide=(FWD * 0.75 + LEFT * 0.66, 0.35))


def set_pose(clip, t, weights):
    act = bpy.data.actions[clip]
    arm.animation_data.action = act
    fs = (act.frame_range[1] - act.frame_range[0]) / DUR[clip] if DUR[clip] > 0 else 1.0
    f = act.frame_range[0] + t * fs
    sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    M = Matrix(SL.root_matrix(clip, t, DUR[clip]).tolist())
    ctrl.matrix_world = G2B @ M @ B2G
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = float((weights or {}).get(kb.name, 0.0))
    bpy.context.view_layer.update()


os.makedirs(job['out'], exist_ok=True)
dist = job.get('dist', 1.25)
for s in job['shots']:
    set_pose(s['clip'], s['t'], s.get('weights'))
    v, up = VIEWS[s['view']]
    aim = np.array(s.get('aim', AIM))
    dv = np.asarray(v, float)
    dv = dv / np.linalg.norm(dv)
    dd = s.get('dist', dist)
    pos = aim + dv * dd + np.array([0, up * dd + s.get('lift', 0.0), 0])
    cam.location = g2b(pos)
    look = g2b(aim) - cam.location
    cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(job['out'], s['name'] + '.png')
    bpy.ops.render.render(write_still=True)
    print('SHOT', s['name'], flush=True)
