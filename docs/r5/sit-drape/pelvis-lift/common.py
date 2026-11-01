# shared: scene (u3_scene), 30 fps retime, controller placement, anim_meta morphs per clip/time
import bpy, os, json, math, numpy as np, mathutils
from mathutils import Vector
from mathutils.bvhtree import BVHTree
exec(open('/workspace/u3/tools/u3_scene.py').read())
sc = bpy.context.scene; sc.render.fps = 30
DUR = {'sit_down': 1.2, 'sit_hold': 2.0, 'stand_up': 1.266667}
for a_ in bpy.data.actions:
    if a_.name in DUR:
        f_ = DUR[a_.name] * 30 / a_.frame_range[1]
        for fc in a_.fcurves:
            for k in fc.keyframe_points: k.co[0] *= f_; k.handle_left[0] *= f_; k.handle_right[0] *= f_
            fc.update()
for t in arm.animation_data.nla_tracks: t.mute = True
STAND = [-0.016162758009872102, 0.0, -4.413050709661525]; SEAT = root
MC = {c: meta['clips'][c]['morph']['curves'] for c in DUR}
def interp(tab, t):
    if t <= tab[0][0]: return tab[0][1]
    for i in range(len(tab) - 1):
        if tab[i][0] <= t <= tab[i + 1][0]: u = (t - tab[i][0]) / max(1e-9, tab[i + 1][0] - tab[i][0]); return tab[i][1] + u * (tab[i + 1][1] - tab[i][1])
    return tab[-1][1]
def setclip(c):
    act = bpy.data.actions[c]; arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
def place(c, f):
    t = f / 30; p = min(1, t / DUR[c])
    w = p if c == 'sit_down' else (1 - p if c == 'stand_up' else 1)
    hc.location = bl([STAND[i] + (SEAT[i] - STAND[i]) * w for i in range(3)])
    cur = MC[c]
    for o in CH_MESH:
        sk = o.data.shape_keys
        if sk:
            for kb in sk.key_blocks[1:]: kb.value = interp(cur[kb.name], t) if kb.name in cur else 0.0
    sc.frame_set(int(f), subframe=f - int(f)); bpy.context.view_layer.update()
def wm(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world.copy()
    vs = [M @ v.co for v in me.vertices]; me.calc_loop_triangles(); t = [tuple(x.vertices) for x in me.loop_triangles]; oe.to_mesh_clear(); return vs, t
