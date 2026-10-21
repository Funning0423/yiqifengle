# getout v2: idle -> door_reach (push basket_door) -> walk_start (rate 1.15) -> walk_loop @0.8 m/s, hipsway65 clips, door mock per DOOR_SPEC
import bpy, bmesh, math, json, os, sys, numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
OUT = os.path.dirname(os.path.abspath(__file__)); RENDER = os.environ.get('RENDER', '1') == '1'
G = '/workspace/yiqifengle/previews/角色动画bot/planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb'
BASKET = '/workspace/yiqifengle/work/fx-b11/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'
META = json.load(open('/workspace/yiqifengle/wt-b14/creator-build-project/assets/bundles/region_island/character/anim_meta.json')); META = META.get('clips', META)
# ---- spec numbers (Blender coords: x = glTF x, y = -glTF z, z = glTF y; basket origin = basket GLB root, exit along -Y = glTF +Z)
HALF_W = 0.40; INNER = -0.80; THK = 0.04; LEAF_H = 1.14; HINGE = Vector((HALF_W, INNER - THK, 0.0)); OPEN_DEG = 100.0; OPEN_S = 0.8
ROOT_X = 0.03; GAP = 0.001
MODE = os.environ.get('MODE', 'v2'); TAG = os.environ.get('TAG', MODE)
WALK = float(os.environ.get('WALK', 0.8)); NATIVE = 0.7; K = 1.15; XF = 0.2; IDLE_S = 0.5; DR_CUT = 1.8; CORNER_R = float(os.environ.get('CORNER', 0.6))
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=G)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; PB = arm.pose.bones
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name == 'Icosphere': o.hide_render = True; o.hide_set(True)
for t in arm.animation_data.nla_tracks: t.mute = True
def setact(n):
    a = bpy.data.actions[n]; arm.animation_data.action = a
    try: arm.animation_data.action_slot = a.slots[0]
    except Exception: pass
def lp(clip, t):  # local pose of clip at clip seconds t
    setact(clip); fr = t * 30; sc.frame_set(int(math.floor(fr)), subframe=fr - math.floor(fr)); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in PB}
def blend(A, B, w):
    R = {}
    for k in A:
        qa, qb = A[k][1], B[k][1]
        if qa.dot(qb) < 0: qb = -qb
        R[k] = (A[k][0].lerp(B[k][0], w), qa.slerp(qb, w))
    return R
def piece(f, t):
    if t <= f[0][0]: return f[0][1]
    for (a, va), (b, vb) in zip(f, f[1:]):
        if t <= b: return va + (vb - va) * (t - a) / (b - a)
    return f[-1][1] + (t - f[-1][0]) * (f[-1][1] - f[-2][1]) / (f[-1][0] - f[-2][0])
FWD = META['walk_start']['root_motion']['forward_m']; HO = META['walk_start']['handoff']
DRD = 2.0; WSD = META['walk_start']['duration_s']; C = META['walk_loop']['cycle_duration_s']
# ---- real b14 plan-A path (lake-local Cocos -> basket frame, Blender coords; door outward = -Y)
M_l = np.array([9.5, 23.0]); S_l = np.array([1.2, 24.5]); A_l = S_l + np.array([0, 2.0])   # mooringLocal, shore = walkLocal[-1], approach = shore + local (0,0,2)
h_l = (A_l - M_l) / np.linalg.norm(A_l - M_l)
def toB(p):  # lake-local (x,z) -> Blender basket frame: (x,-z), rotated so h -> (0,-1), origin at the mooring
    q = np.array([p[0] - M_l[0], -(p[1] - M_l[1])]); hb = np.array([h_l[0], -h_l[1]]); ang = math.atan2(-1, 0) - math.atan2(hb[1], hb[0])
    c, s_ = math.cos(ang), math.sin(ang); return np.array([c * q[0] - s_ * q[1], s_ * q[0] + c * q[1]])
Y0 = INNER + 0.405
P0 = np.array([ROOT_X, Y0]) if MODE == 'v2' else toB(M_l + 1.6 * h_l)       # v2: root in the basket; b14: the current exit point 1.6 m out
A_b, S_b = toB(A_l), toB(S_l)
def roundWalk(pts, r):
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a_, b_, c_ = pts[i - 1], pts[i], pts[i + 1]; l0 = np.linalg.norm(b_ - a_); l1 = np.linalg.norm(c_ - b_); k = min(r, l0 / 2, l1 / 2)
        p = b_ + (a_ - b_) * k / l0; q = b_ + (c_ - b_) * k / l1
        for j in range(33):
            u = j / 32; out.append((1 - u) ** 2 * p + 2 * u * (1 - u) * b_ + u * u * q)
    out.append(pts[-1]); return np.array(out)
PATH = roundWalk([P0, A_b, S_b], CORNER_R); SEGL = np.linalg.norm(np.diff(PATH, axis=0), axis=1); CUM = np.concatenate([[0], np.cumsum(SEGL)]); LTOT = float(CUM[-1])
def at(sd):
    sd = min(max(sd, 0), LTOT); i = min(int(np.searchsorted(CUM, sd, side='right')) - 1, len(SEGL) - 1); u = (sd - CUM[i]) / SEGL[i]
    p = PATH[i] + (PATH[i + 1] - PATH[i]) * u
    a_ = at_pt(sd - .3); b_ = at_pt(sd + .3); d = b_ - a_; yaw = math.atan2(d[0], -d[1])  # 0 = facing -Y
    return p, yaw
def at_pt(sd):
    sd = min(max(sd, 0), LTOT); i = min(int(np.searchsorted(CUM, sd, side='right')) - 1, len(SEGL) - 1); u = (sd - CUM[i]) / SEGL[i]
    return PATH[i] + (PATH[i + 1] - PATH[i]) * u
turn = math.degrees(math.acos(np.dot((A_b - P0) / np.linalg.norm(A_b - P0), (S_b - A_b) / np.linalg.norm(S_b - A_b))))
print('PATH L', LTOT, 'leg1', np.linalg.norm(A_b - P0), 'leg2', np.linalg.norm(S_b - A_b), 'turn deg', turn, 'basket yaw for door (Cocos Y deg)', math.degrees(math.atan2(-h_l[0], -h_l[1])))
FWD = META['walk_start']['root_motion']['forward_m']; HO = META['walk_start']['handoff']
DRD = 2.0; WSD = META['walk_start']['duration_s']; C = META['walk_loop']['cycle_duration_s']
STOPS = {n: (META[n]['root_motion']['forward_m'], META[n]['entry']['walk_time_s'], META[n]['duration_s']) for n in ('walk_stop_bodyL', 'walk_stop_bodyR')}
fps = 30
if MODE == 'v2':
    t_dr = IDLE_S; t_ws = t_dr + DR_CUT; t_ho = t_ws + HO['at_s'] / K; s_ho = piece(FWD, HO['at_s'])
    best = None
    for n, (ff, ph, dur) in STOPS.items():
        se = LTOT - ff[-1][1]; ctn = HO['next_time_s'] + (se - s_ho) / NATIVE
        for m_ in range(int(ctn / C) - 1, int(ctn / C) + 3):
            tgt = m_ * C + ph; w = (tgt - HO['next_time_s']) / ((se - s_ho) / NATIVE)
            if best is None or abs(w - 1) < abs(best[1] - 1): best = (n, w, se)
    STOP, WARP, S_E = best; t_e = t_ho + (S_E - s_ho) / WALK; FS, _, SD = STOPS[STOP]
    T_END = t_e + SD + 0.3; print('STOP', STOP, 'warp', WARP, 'entry s', S_E, 't', t_e)
else:
    TT = LTOT / WALK + 0.8; EA = EB = 0.8; VC = LTOT / (TT - EA / 2 - EB / 2); t0 = 0.3
    def s5I(u): return u ** 3 - u ** 4 + 0.4 * u ** 5 if False else (u ** 4 * (2.5 - 3 * u + u * u)) if False else (10 * u ** 4 / 4 - 15 * u ** 5 / 5 + 6 * u ** 6 / 6)
    def dist(t):
        if t <= 0: return 0.0
        if t >= TT: return LTOT
        if t < EA: return VC * EA * s5I(t / EA)
        if t <= TT - EB: return VC * (EA / 2 + t - EA)
        return max(0.0, LTOT - VC * EB * s5I((TT - t) / EB))
    T_END = t0 + TT + 0.6; WARP = 1.0; print('B14 cruise v', VC, 'T', TT)
NF = int(round(T_END * fps)) + 1
def sched(t):
    if MODE != 'v2':
        if t < t0: return lp('idle_breathing_loop', t % 1.8), 0.0, 'idle'
        if t >= t0 + TT:
            ct = dist(TT) / NATIVE; w = min(1, (t - t0 - TT) / XF)
            return blend(lp('walk_loop', ct % C), lp('idle_breathing_loop', 0), w), LTOT, 'xf_wl_idle' if w < 1 else 'idle_end'
        sd = dist(t - t0); ct = sd / NATIVE; wl = lp('walk_loop', ct % C)
        if t < t0 + XF: return blend(lp('idle_breathing_loop', t % 1.8), wl, (t - t0) / XF), sd, 'xf_idle_wl'
        return wl, sd, 'walk_loop'
    if t < t_dr: return lp('idle_breathing_loop', t % 1.8), 0.0, 'idle'
    if t < t_dr + XF:
        w = (t - t_dr) / XF; return blend(lp('idle_breathing_loop', t % 1.8), lp('door_reach', t - t_dr), w), 0.0, 'xf_idle_dr'
    if t < t_ws: return lp('door_reach', t - t_dr), 0.0, 'door_reach'
    tau = (t - t_ws) * K; sd = piece(FWD, min(tau, WSD))
    if t < t_ws + XF:
        w = (t - t_ws) / XF; return blend(lp('door_reach', min(DRD, t - t_dr)), lp('walk_start', tau), w), sd, 'xf_dr_ws'
    if t < t_ho: return lp('walk_start', tau), sd, 'walk_start'
    if t >= t_e:
        u = min(t - t_e, SD); return lp(STOP, u), S_E + piece(FS, u), STOP if t - t_e <= SD else 'end_hold'
    sd = s_ho + WALK * (t - t_ho); ct = HO['next_time_s'] + (sd - s_ho) / NATIVE * WARP
    wl = lp('walk_loop', ct % C)
    if t < t_ho + XF:
        w = (t - t_ho) / XF; return blend(lp('walk_start', min(WSD, tau)), wl, w), sd, 'xf_ws_wl'
    return wl, sd, 'walk_loop'
# ---- basket: cut door opening + remove floor (spec: inner floor lowered to 0)
bset = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=BASKET); bobs = [o for o in bpy.data.objects if o not in bset]
for o in bobs:
    if o.type == 'MESH' and o.name != 'balloon_basket': o.hide_render = True; o.hide_set(True)
bk = bpy.data.objects['balloon_basket']; Mb = bk.matrix_world.copy()
bm = bmesh.new(); bm.from_mesh(bk.data); bm.faces.ensure_lookup_table()
kill = []
for f in bm.faces:
    P = [Mb @ v.co for v in f.verts]; c = sum(P, Vector()) / len(P); zmax = max(p.z for p in P)
    if zmax < 0.15: kill.append(f)                                                     # floor at 0.10 -> lowered to ground
    elif abs(c.x) < HALF_W + 0.02 and c.y < -0.55 and c.z < 1.25: kill.append(f)      # door opening (full height, no sill)
nk = len(kill); bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(bk.data); bm.free(); print('BASKET faces removed', nk)
# ---- door mock
hinge = bpy.data.objects.new('basket_door', None); sc.collection.objects.link(hinge); hinge.location = HINGE
bpy.ops.mesh.primitive_cube_add(size=1); leaf = bpy.context.active_object; leaf.name = 'basket_door_leaf'
leaf.scale = (2 * HALF_W, THK, LEAF_H); leaf.location = (-HALF_W, THK / 2, LEAF_H / 2 + 0.01); bpy.ops.object.transform_apply(location=True, scale=True)
leaf.parent = hinge; md = bpy.data.materials.new('door'); md.diffuse_color = (.55, .35, .2, 1); leaf.data.materials.append(md)
# ---- character root placement
arm.animation_data.action = None; arm.rotation_mode = 'XYZ'
def place(s):
    p, yaw = at(s); arm.location = (float(p[0]), float(p[1]), 0); arm.rotation_euler = (0, 0, yaw)
body = bpy.data.objects['LOD0_G2_BODY']; dress = bpy.data.objects['LOD0_G2_DRESS']; apron = bpy.data.objects['LOD0_G2_APRON']
gi = {g.index: g.name for g in body.vertex_groups}
def vg(names): return [v.index for v in body.data.vertices if v.groups and gi[max(v.groups, key=lambda q: q.weight).group] in names]
FVI = {sd: vg(('foot.' + sd,)) for sd in 'LR'}; HV = {sd: vg(('hand.' + sd,)) for sd in 'LR'}
def ev(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world
    V = np.array([tuple(M @ v.co) for v in me.vertices]); P = [tuple(p.vertices) for p in me.polygons]; oe.to_mesh_clear(); return V, P
def apply(P):
    for b in PB:
        if b.name in P: b.location, b.rotation_quaternion = P[b.name]
    bpy.context.view_layer.update()
def door_local(V, th):  # -> door-local coords (hinge origin, leaf x in [-0.8,0], y in [0,THK])
    c, s = math.cos(-th), math.sin(-th); d = V - np.array(HINGE)
    return np.stack([c * d[:, 0] - s * d[:, 1], s * d[:, 0] + c * d[:, 1], d[:, 2]], 1)
def leaf_gap(V, th):  # signed gap (m) of verts to the leaf box; <0 = inside
    q = door_local(V, th); lo = np.array([-2 * HALF_W, 0, 0.01]); hi = np.array([0, THK, LEAF_H + 0.01])
    out = np.maximum(np.maximum(lo - q, q - hi), 0); dout = np.linalg.norm(out, axis=1)
    inside = np.all((q > lo) & (q < hi), 1); din = np.min(np.minimum(q - lo, hi - q), 1)
    return np.where(inside, -din, dout)
# ---- pass 1: poses + door angle (hand-driven while the hand pushes forward, then code ease-out)
FR = []
for f in range(NF):
    t = f / fps; P, s, lab = sched(t); FR.append((t, P, s, lab))
th_hand = []
for f, (t, P, s, lab) in enumerate(FR):
    if MODE != 'v2' or lab not in ('xf_idle_dr', 'door_reach') or t - t_dr > 1.0: th_hand.append(0.0); continue
    place(s); apply(P); V, _ = ev(body); H = V[HV['L']]
    g0 = leaf_gap(H, 0.0).min()
    if g0 >= GAP: th_hand.append(0.0); continue
    lo, hi = 0.0, math.radians(30)
    for _ in range(40):
        m = (lo + hi) / 2
        if leaf_gap(H, m).min() < GAP: lo = m
        else: hi = m
    th_hand.append(hi)
th_hand = np.array(th_hand); fpk = int(th_hand.argmax()); f_touch = int(np.argmax(th_hand > 0)) if th_hand.max() > 0 else None
th0 = float(th_hand[fpk]); TH = np.zeros(NF) if MODE == 'v2' else np.full(NF, math.radians(OPEN_DEG))
for f in range(NF):
    if f_touch is not None and f_touch <= f <= fpk: TH[f] = max(th_hand[f_touch:f + 1])
    elif f > fpk:
        u = min(1.0, (f - fpk) / (OPEN_S * fps)); TH[f] = th0 + (math.radians(OPEN_DEG) - th0) * (1 - (1 - u) ** 3)
print('DOOR touch f', f_touch, 'peak f', fpk, 'theta_peak deg', math.degrees(th0), 'clip t touch', (f_touch / fps - t_dr) if f_touch else None)
# ---- bake action + door keys
act = bpy.data.actions.new('balloon_getout_v2'); arm.animation_data.action = act
for f, (t, P, s, lab) in enumerate(FR):
    apply(P)
    for b in PB: b.keyframe_insert('location', frame=f); b.keyframe_insert('rotation_quaternion', frame=f)
    place(s); arm.keyframe_insert('location', frame=f); arm.keyframe_insert('rotation_euler', frame=f)
    hinge.rotation_euler = (0, 0, TH[f]); hinge.keyframe_insert('rotation_euler', frame=f)
for fc in list(act.fcurves) + list(hinge.animation_data.action.fcurves):
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
# ---- QA
bV, _ = ev(bk); BP = [tuple(p.vertices) for p in bk.data.polygons if max(bV[i][2] for i in p.vertices) < 1.3]
btree = BVHTree.FromPolygons([tuple(v) for v in bV], BP)
def tree(o):
    V, P = ev(o); return V, BVHTree.FromPolygons([tuple(v) for v in V], P)
rows = []; prev = None
for f in range(NF):
    sc.frame_set(f); bpy.context.view_layer.update(); th = TH[f]
    V, bt = tree(body); dV, dt_ = tree(dress); aV, at_ = tree(apron)
    r = dict(f=f, t=round(f / fps, 3), seg=FR[f][3], door_deg=round(math.degrees(th), 2))
    for sd in 'LR':
        fv = V[FVI[sd]]; r['sole' + sd] = round(float(fv[:, 2].min()) * 1000, 1)
        if prev is not None:
            c = (fv[:, 2] < 0.012) & (prev[sd][:, 2] < 0.012)
            r['slide' + sd] = round(float(np.linalg.norm(fv[c, :2] - prev[sd][c, :2], axis=1).max()) * 1000, 2) if c.any() else None
        th_ = (PB['thigh.' + sd].tail - PB['thigh.' + sd].head).normalized(); sh = (PB['shin.' + sd].tail - PB['shin.' + sd].head).normalized()
        r['knee' + sd] = round(math.degrees(th_.angle(sh)), 2)
    prev = {sd: V[FVI[sd]].copy() for sd in 'LR'}
    r['basket_x_body'] = len(btree.overlap(bt)); r['basket_x_dress'] = len(btree.overlap(dt_)); r['basket_x_apron'] = len(btree.overlap(at_))
    gB = leaf_gap(V, th); gD = leaf_gap(dV, th); gA = leaf_gap(aV, th)
    r['door_in_body'] = int((gB < 0).sum()); r['door_in_dress'] = int((gD < 0).sum()); r['door_in_apron'] = int((gA < 0).sum())
    r['door_gap_body_mm'] = round(float(gB.min()) * 1000, 1); r['door_gap_cloth_mm'] = round(float(min(gD.min(), gA.min())) * 1000, 1)
    r['hand_door_gap_mm'] = round(float(leaf_gap(V[HV['L']], th).min()) * 1000, 2)
    r['s'] = round(FR[f][2], 4); r['x'] = round(arm.location.x, 3); r['y'] = round(arm.location.y, 3); r['yaw'] = round(math.degrees(arm.rotation_euler.z), 2)
    rows.append(r)
json.dump(dict(spec=dict(HALF_W=HALF_W, INNER=INNER, THK=THK, LEAF_H=LEAF_H, HINGE=list(HINGE), OPEN_DEG=OPEN_DEG, OPEN_S=OPEN_S, ROOT=[ROOT_X, Y0], K=K, WALK=WALK),
               timeline=dict(MODE=MODE, WALK=WALK, LTOT=LTOT, turn_deg=turn, P0=list(P0), A=list(A_b), S=list(S_b), NF=NF, f_touch=f_touch, f_peak=fpk, theta_peak_deg=math.degrees(th0), **({'t_dr': t_dr, 't_ws': t_ws, 't_ho': t_ho, 's_ho': s_ho, 'stop': STOP, 'warp': WARP, 't_e': t_e, 's_e': S_E} if MODE == 'v2' else {'cruise_v': VC, 'T': TT})), door_deg=[round(math.degrees(x), 3) for x in TH], rows=rows),
          open(OUT + f'/qa_{TAG}.json', 'w'), indent=0)
print('QADONE', flush=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT + f'/{TAG}.blend')
if not RENDER: sys.exit()
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); gp = bpy.context.active_object
m = bpy.data.materials.new('g'); m.diffuse_color = (.35, .45, .3, 1); gp.data.materials.append(m)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
os.makedirs(OUT + '/frames', exist_ok=True)
def shoot(tag, mode, deg, res, wire):
    cd.angle = math.radians(deg); sc.render.resolution_x, sc.render.resolution_y = res
    mod = bk.modifiers.get('W') or bk.modifiers.new('W', 'WIREFRAME'); mod.show_render = wire; mod.thickness = 0.012
    for f in range(NF):
        sc.frame_set(f); p = Vector((arm.location.x, arm.location.y, 0)); yaw = arm.rotation_euler.z
        fw = Vector((math.sin(yaw), -math.cos(yaw), 0)); rt = Vector((-fw.y, fw.x, 0)) * -1  # her right
        if mode == 'side':
            c = p.lerp(Vector((0, -0.8, 0)), 0.5) if FR[f][2] < 1.5 else p
            loc = c - rt * 4.2 + Vector((0, 0, 1.0)); look = c + Vector((0, 0, 0.8))
        else:
            loc = p - fw * 3.2 + rt * 0.6 + Vector((0, 0, 2.3)); look = p + fw * 0.8 + Vector((0, 0, 0.8))
        cam.location = loc; cam.rotation_euler = (look - loc).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = OUT + f'/frames/{TAG}_{tag}_{f:03d}.png'; bpy.ops.render.render(write_still=True)
shoot('side', 'side', 50, (800, 600), True)
shoot('game', 'game', 50, (450, 800), False)
print('DONE')
