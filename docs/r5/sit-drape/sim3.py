# cloth-sim bake of sit_drape: sit_down (30 fps) -> blend to sit_hold f0 -> settle; DRESS(+collider) / APRON / BOW cloth; stool + body colliders
import bpy, os, json, math, numpy as np, mathutils, time
from mathutils import Vector
exec(open('/workspace/u3/tools/u3_scene.py').read())
OUT = os.environ['OUT']; SETTLE = int(os.environ.get('SETTLE', 40)); Q = int(os.environ.get('QUAL', 12))
PINLO, PINHI = float(os.environ.get('PINLO', .35)), float(os.environ.get('PINHI', .9))
sc = bpy.context.scene; sc.render.fps = 30
for a_ in bpy.data.actions:
    for fc in a_.fcurves:
        for k in fc.keyframe_points: k.co[0] *= 1.25; k.handle_left[0] *= 1.25; k.handle_right[0] *= 1.25
        fc.update()
SD, SH = bpy.data.actions['sit_down'], bpy.data.actions['sit_hold']; END = 36; HOLD = END + 10; LAST = HOLD + SETTLE
for fc in SH.fcurves:
    d = SD.fcurves.find(fc.data_path, index=fc.array_index)
    if d is None: d = SD.fcurves.new(fc.data_path, index=fc.array_index)
    d.keyframe_points.insert(HOLD, fc.evaluate(0)).interpolation = 'LINEAR'; d.extrapolation = 'CONSTANT'
for t in (arm.animation_data.nla_tracks): t.mute = True
arm.animation_data.action = SD
try: arm.animation_data.action_slot = SD.slots[0]
except Exception: pass
STAND = [-0.016162758009872102, 0.0, -4.413050709661525]
hc.location = bl(STAND); hc.keyframe_insert('location', frame=0); hc.location = bl(root); hc.keyframe_insert('location', frame=END)
for fc in hc.animation_data.action.fcurves:
    for k in fc.keyframe_points: k.interpolation = 'LINEAR'
meta = json.load(open(META)); cv = meta['clips']['sit_down']['morph']['curves']
def interp(tab, t):
    if t <= tab[0][0]: return tab[0][1]
    for i in range(len(tab) - 1):
        if tab[i][0] <= t <= tab[i + 1][0]: u = (t - tab[i][0]) / max(1e-9, tab[i + 1][0] - tab[i][0]); return tab[i][1] + u * (tab[i + 1][1] - tab[i][1])
    return tab[-1][1]
O = {o.name: o for o in CH_MESH}; CLOTH = ['LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW']
# BODY morphs follow sit_down curves then sit_hold W0; cloth meshes: sit_hold W0 except sit_drape (=0) held constant
bk = O['LOD0_G2_BODY'].data.shape_keys
for kb in bk.key_blocks[1:]:
    for f in range(0, LAST + 1):
        t = f / 30; v = interp(cv[kb.name], t) if (kb.name in cv and f <= END) else W0.get(kb.name, 0.0)
        if END < f <= HOLD and kb.name in cv: u = (f - END) / (HOLD - END); v = (1 - u) * interp(cv[kb.name], 1.2) + u * W0.get(kb.name, 0.0)
        kb.value = v; kb.keyframe_insert('value', frame=f)
for n in CLOTH:
    sk = O[n].data.shape_keys
    if sk:
        for kb in sk.key_blocks[1:]: kb.value = 0.0 if kb.name == 'sit_drape' else W0.get(kb.name, 0.0)
# colliders
def coll(o, outer, inner=.002):
    m = o.modifiers.new('Collision', 'COLLISION'); o.collision.thickness_outer = outer; o.collision.thickness_inner = inner; o.collision.cloth_friction = 5; o.collision.damping = .5
coll(STOOL_MESH[0], .002, .01); coll(O['LOD0_G2_BODY'], .002, .002)
CB = bpy.data.collections.new('col_base'); CA = bpy.data.collections.new('col_apron')
for o_ in (STOOL_MESH[0], O['LOD0_G2_BODY']): CB.objects.link(o_); CA.objects.link(o_)
CA.objects.link(O['LOD0_G2_DRESS'])

import bmesh
from mathutils.kdtree import KDTree
SIMO, REFO, MAPS = {}, {}, {}
def islands(me):
    par = list(range(len(me.vertices)))
    def f(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for e in me.edges: a_, b_ = map(f, e.vertices); par[a_] = b_
    d = {}
    for i in range(len(me.vertices)): d.setdefault(f(i), []).append(i)
    return list(d.values())
for n in CLOTH:
    o = O[n]; hg = o.vertex_groups['hips'].index
    hw = np.array([max([g.weight for g in v.groups if g.group == hg] or [0]) for v in o.data.vertices])
    keep = np.zeros(len(hw), bool)
    for isl in islands(o.data):
        if hw[isl].max() > PINLO: keep[isl] = True
    s_ = o.copy(); s_.data = o.data.copy(); s_.name = n + '_SIM'; sc.collection.objects.link(s_)
    r_ = o.copy(); r_.data = o.data.copy(); r_.name = n + '_REF'; sc.collection.objects.link(r_); r_.hide_render = True
    bm = bmesh.new(); bm.from_mesh(s_.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.where(~keep)[0]], context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(s_.data); bm.free()
    # map original verts -> sim verts by basis position
    SP = [v.co.copy() for v in s_.data.vertices]; kd = KDTree(len(SP)); [kd.insert(p, i) for i, p in enumerate(SP)]; kd.balance()
    MAPS[n] = dict(keep=keep, idx=[kd.find(v.co)[1] if keep[i] else -1 for i, v in enumerate(o.data.vertices)])
    pg = s_.vertex_groups.new(name='pin'); hgs = s_.vertex_groups['hips'].index
    for v in s_.data.vertices:
        w = max([g.weight for g in v.groups if g.group == hgs] or [0]); pw = min(1, max(0, (w - PINLO) / (PINHI - PINLO)))
        if pw > 0: pg.add([v.index], pw, 'REPLACE')
    o.hide_render = True; o.hide_viewport = True; SIMO[n] = s_; REFO[n] = r_
    print('SIMMESH', n, 'orig', len(o.data.vertices), 'sim', len(s_.data.vertices), 'excluded loose', int((~keep).sum()))
CB = bpy.data.collections.new('col_base'); CA = bpy.data.collections.new('col_apron')
for o_ in (STOOL_MESH[0], O['LOD0_G2_BODY']): CB.objects.link(o_); CA.objects.link(o_)
CA.objects.link(SIMO['LOD0_G2_DRESS'])
for n in CLOTH:
    o = SIMO[n]; m = o.modifiers.new('Cloth', 'CLOTH'); s = m.settings; c = m.collision_settings
    s.quality = Q; s.mass = .3; s.air_damping = 1; s.tension_stiffness = s.compression_stiffness = 40; s.shear_stiffness = 40; s.bending_stiffness = .5
    s.tension_damping = s.compression_damping = s.shear_damping = 5; s.vertex_group_mass = 'pin'; s.pin_stiffness = 5
    c.collision_quality = 4; c.distance_min = .0035; c.use_self_collision = False; c.collection = CA if n != 'LOD0_G2_DRESS' else CB
    m.point_cache.frame_start = 0; m.point_cache.frame_end = LAST
    if n == 'LOD0_G2_BOW': s.mass = .1; s.bending_stiffness = 2
    if n == 'LOD0_G2_DRESS': coll(o, .002, .002)
sc.frame_start = 0; sc.frame_end = LAST
def wpos(o):
    dgx = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dgx); me_ = oe.to_mesh(); P = np.array([tuple(oe.matrix_world @ v.co) for v in me_.vertices]); oe.to_mesh_clear(); return P
t0 = time.time(); H0 = None
for f in range(0, LAST + 1):
    sc.frame_set(f)
    for n in CLOTH:
        S = wpos(SIMO[n]); Rf = wpos(REFO[n])[np.array([i for i, k in enumerate(MAPS[n]['keep']) if k])]
        # ref positions for sim verts via map
        idx = np.array(MAPS[n]['idx']); keep = MAPS[n]['keep']; Rall = wpos(REFO[n]); Rs = np.zeros_like(S); Rs[idx[keep]] = Rall[keep]
        dev = np.linalg.norm(S - Rs, axis=1).max(); h = S[:, 2].max() - S[:, 2].min(); hr = Rs[:, 2].max() - Rs[:, 2].min()
        if dev > .5 or (n != 'LOD0_G2_BOW' and abs(h - hr) / hr > .10):
            print('ABORT', n, 'frame', f, 'maxdev', round(dev, 3), 'height', round(h, 3), 'ref', round(hr, 3), flush=True); raise SystemExit(3)
    if f % 6 == 0: print('SIMF', f, round(time.time() - t0, 1), 'dress maxdev', round(float(np.linalg.norm(wpos(SIMO['LOD0_G2_DRESS'])[idx[keep]] - wpos(REFO['LOD0_G2_DRESS'])[keep], axis=1).max()) if False else 0, 3), flush=True)
res = {}
for n in CLOTH:
    S = wpos(SIMO[n]); idx = np.array(MAPS[n]['idx']); keep = MAPS[n]['keep']; Rall = wpos(REFO[n])
    P = np.zeros((len(keep), 3)); P[keep] = S[idx[keep]]
    if (~keep).any():  # loose trim islands follow the simulated surface: displacement of the 4 nearest kept verts (rest-space nearest)
        B = np.array([tuple(v.co) for v in O[n].data.vertices]); kk = np.where(keep)[0]; kd = KDTree(len(kk)); [kd.insert(B[i], j) for j, i in enumerate(kk)]; kd.balance()
        for i in np.where(~keep)[0]:
            nn = kd.find_n(B[i], 4); w = np.array([1 / (x[2] + 1e-4) for x in nn]); js = [kk[x[1]] for x in nn]
            P[i] = Rall[i] + (w[:, None] * (P[js] - Rall[js])).sum(0) / w.sum()
    res[n] = dict(sim=P.tolist())
    SIMO[n].hide_viewport = True; O[n].hide_viewport = False; O[n].hide_render = False; REFO[n].hide_viewport = True
# baseline: sit_hold f0 skin (cloth off), old sit_drape zeroed, Jacobian of new sit_drape key
arm.animation_data.action = SH; hc.animation_data_clear(); hc.location = bl(root); sc.frame_set(0)
def ev(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh(); P = np.array([tuple(oe.matrix_world @ v.co) for v in me.vertices]); oe.to_mesh_clear(); return P
for n in CLOTH:
    o = O[n]; me = o.data
    if not me.shape_keys: o.shape_key_add(name='Basis', from_mix=False)
    if 'sit_drape' not in me.shape_keys.key_blocks: o.shape_key_add(name='sit_drape', from_mix=False)
    kb = me.shape_keys.key_blocks['sit_drape']; basis = np.array([tuple(v.co) for v in me.vertices])
    for i, k in enumerate(kb.data): k.co = Vector(basis[i])
    kb.value = 1.0; bpy.context.view_layer.update(); P0 = ev(o); Jm = np.zeros((len(basis), 3, 3))
    for a in range(3):
        K = basis.copy(); K[:, a] += .01
        for i, k in enumerate(kb.data): k.co = Vector(K[i])
        Jm[:, :, a] = (ev(o) - P0) / .01
    D = np.array(res[n]['sim']) - P0; dk = np.linalg.solve(Jm + np.eye(3) * 1e-9, D[:, :, None])[:, :, 0]; key = basis + dk
    for i, k in enumerate(kb.data): k.co = Vector(key[i])
    # normals in rest space (basis vs basis+delta)
    def vn(co):
        m2 = me.copy(); [setattr(v, 'co', Vector(co[i])) for i, v in enumerate(m2.vertices)]; m2.shape_keys and None; m2.update()
        N = np.array([tuple(v.normal) for v in m2.vertices]); bpy.data.meshes.remove(m2); return N
    nd = vn(key) - vn(basis)
    pinned = np.array([max([g.weight for g in v.groups if g.group == o.vertex_groups['hips'].index] or [0]) > .95 for v in me.vertices])
    res[n].update(key=key.tolist(), basis=basis.tolist(), ndelta=nd.tolist(), maxdisp_mm=round(float(np.linalg.norm(D, axis=1).max()) * 1000, 1), pin_drift_mm=round(float(np.linalg.norm(D[pinned], axis=1).max()) * 1000 if pinned.any() else 0, 2))
    print('RES', n, res[n]['maxdisp_mm'], 'pin drift', res[n]['pin_drift_mm'])
json.dump(res, open(OUT, 'w'))
