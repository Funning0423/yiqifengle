# getout stepdown (b15 floor 333f0b15: board top 0 = mooring 0.602, lawn -0.03): based on v3b.
# getout v2: idle -> door_reach (push basket_door) -> walk_start (rate 1.15) -> walk_loop @0.8 m/s, hipsway65 clips, door mock per DOOR_SPEC
import bpy, bmesh, math, json, os, sys, numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
OUT = os.path.dirname(os.path.abspath(__file__)); RENDER = os.environ.get('RENDER', '1') == '1'
G = '/workspace/yiqifengle/previews/角色动画bot/planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb'
BASKET = OUT + '/src/' + os.environ.get('BGLB', 'transport_balloon_333f0b15.glb')  # 场景特效bot 893ac038, sha256 24008c3c
META = json.load(open('/workspace/yiqifengle/wt-b14/creator-build-project/assets/bundles/region_island/character/anim_meta.json')); META = META.get('clips', META)
# ---- spec numbers (Blender coords: x = glTF x, y = -glTF z, z = glTF y; basket origin = basket GLB root, exit along -Y = glTF +Z)
HALF_W = 0.40; INNER = -0.80; THK = 0.04; LEAF_H = 1.14; HINGE = Vector((HALF_W, INNER - THK, 0.0)); OPEN_DEG = 100.0; OPEN_S = 0.8
ROOT_X = 0.03; GAP = 0.001
MODE = os.environ.get('MODE', 'v2'); TAG = os.environ.get('TAG', MODE)
WALK = float(os.environ.get('WALK', 0.8)); NATIVE = 0.7; K = 1.15; XF = 0.2; IDLE_S = 0.5; DR_CUT = 1.8; CORNER_R = float(os.environ.get('CORNER', 1.0))
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
M_l = np.array([9.5, 25.6]); S_l = np.array([1.2, 24.5]); A_l = S_l + np.array([0, 2.0])   # mooringLocal, shore = walkLocal[-1], approach = shore + local (0,0,2)
h_l = (A_l - M_l) / np.linalg.norm(A_l - M_l)
def toB(p):  # lake-local (x,z) -> Blender basket frame: (x,-z), rotated so h -> (0,-1), origin at the mooring
    q = np.array([p[0] - M_l[0], -(p[1] - M_l[1])]); hb = np.array([h_l[0], -h_l[1]]); ang = math.atan2(-1, 0) - math.atan2(hb[1], hb[0])
    c, s_ = math.cos(ang), math.sin(ang); return np.array([c * q[0] - s_ * q[1], s_ * q[0] + c * q[1]])
P0FWD = float(os.environ.get('P0FWD', 0.0)); Y0 = INNER + 0.405 - P0FWD  # stepdown: P0 moved toward the door so the 1st step (L) lands fully on the lawn
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
        if os.environ.get('STOPN') and n != os.environ['STOPN']: continue
        se = LTOT - float(os.environ.get('SFWD', 0.065)) - ff[-1][1]; ctn = HO['next_time_s'] + (se - s_ho) / NATIVE
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
hinge = bpy.data.objects['basket_door']; leaf = bpy.data.objects['basket_door_leaf']; leaf.hide_render = False; leaf.hide_set(False); hinge.rotation_mode = 'XYZ'
assert (hinge.location - HINGE).length < 1e-4, hinge.location
LV0 = [v.co.copy() for v in leaf.data.vertices]; LPOL = [tuple(p.vertices) for p in leaf.data.polygons]
def leaf_tree(th):
    hinge.rotation_euler = (0, 0, th); bpy.context.view_layer.update(); W = leaf.matrix_world
    return BVHTree.FromPolygons([W @ v for v in LV0], LPOL)
# ---- character root placement
arm.animation_data.action = None; arm.rotation_mode = 'XYZ'
RISE = float(os.environ.get('RISE', 0.008)); DROP = float(os.environ.get('DROP', 0.03)); EDGE_Y = -0.84
SA = float(os.environ.get('SA', 0.30)); SB = float(os.environ.get('SB', 0.75)); DIP = float(os.environ.get('DIP', 0.006))
def gz0(s): return RISE * min(1.0, max(0.0, (s - (LTOT - 2.0)) / 2.0))  # ground rise over the last 2 m (mooring 0.572 -> L1 0.58)
def ss(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)
def rootz(s):  # root (pelvis carrier) height: board 0 -> lawn -DROP over s in [SA,SB], small settle dip after, then the lawn rise
    u = (s - SA) / (SB - SA); d = -DROP * ss(u)
    if DIP > 0 and u > 0.6: d -= DIP * math.sin(math.pi * min(1.0, (u - 0.6) / 1.0))  # extra knee give on weight acceptance, recovers
    return d + gz0(s)
def gz(s): return rootz(s)
def ground_xy(x, y, s):  # true ground under a point (basket frame)
    return np.where((y > EDGE_Y) & (np.abs(x) < 0.68) & (y < 0.68), 0.0, -DROP + gz0(s))
SFWD = float(os.environ.get('SFWD', 0.065)); FA = int(os.environ.get('FA', 74)); FB = int(os.environ.get('FB', 85))
def sx(f): return SFWD * ss((f - FA) / (FB - FA))  # extra root distance: the first step out (L) is SFWD longer, over L's swing
CUR_F = [0]
def place(s):
    p, yaw = at(s + sx(CUR_F[0])); arm.location = (float(p[0]), float(p[1]), rootz(s)); arm.rotation_euler = (0, 0, yaw)
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
print('THHAND', [round(math.degrees(x),2) for x in th_hand[18:40]]); print('DOOR touch f', f_touch, 'peak f', fpk, 'theta_peak deg', math.degrees(th0), 'clip t touch', (f_touch / fps - t_dr) if f_touch else None)
# ---- foot ground plan (FK, root at z 0): plant intervals -> board (0) or lawn (-DROP)
GP = {}; PLANTS = {}; MINB = {sd: np.full(NF, 9.0) for sd in 'LR'}
FKH = {sd: [] for sd in 'LR'}; FY = {sd: [] for sd in 'LR'}
for f, (t, P, s, lab) in enumerate(FR):
    p_, yaw_ = at(s + sx(f)); arm.location = (float(p_[0]), float(p_[1]), 0.0); arm.rotation_euler = (0, 0, yaw_); apply(P)
    if 40 <= f <= 200:
        V, _ = ev(body)
        for sd in 'LR':
            fv = V[FVI[sd]]; FKH[sd].append(float(fv[:, 2].min())); FY[sd].append((float(fv[:, 1].min()), float(fv[:, 1].max())))
            ob = fv[:, 1] > EDGE_Y; MINB[sd][f] = float(fv[ob, 2].min()) if ob.any() else 9.0
    else:
        for sd in 'LR': FKH[sd].append(0.0 if f < 40 else 0.0); FY[sd].append((-99.0, -99.0) if f > 200 else (0.0, 0.0))
for sd in 'LR':
    h = np.array(FKH[sd]); pl = h < 0.004; iv = []; f = 0
    while f < NF:
        if pl[f]:
            g = f
            while g + 1 < NF and pl[g + 1]: g += 1
            iv.append((f, g)); f = g + 1
        else: f += 1
    lv = []
    for a_, b_ in iv:
        ys = [FY[sd][k] for k in range(a_, b_ + 1) if FY[sd][k][0] > -98]
        if not ys: lv.append(-DROP); continue
        lo = min(y[0] for y in ys); hi = max(y[1] for y in ys)
        lev = 0.0 if lo > EDGE_Y else (-DROP if hi < EDGE_Y else None)
        print('PLANT', sd, a_, b_, 'y', round(lo, 3), round(hi, 3), 'level', lev)
        if lev is None: lev = 0.0 if (lo + hi) / 2 > EDGE_Y else -DROP; print('  !! STRADDLE', sd, a_, b_)
        lv.append(lev)
    PLANTS[sd] = list(zip(iv, lv))
    G = np.zeros(NF)
    for k, ((a_, b_), lev) in enumerate(PLANTS[sd]):
        G[a_:b_ + 1] = lev
        if k + 1 < len(PLANTS[sd]):
            (a2, _), lev2 = PLANTS[sd][k + 1]
            for g in range(b_ + 1, a2): G[g] = lev + (lev2 - lev) * ss((g - b_) / (a2 - b_))
        else: G[b_ + 1:] = lev
    if PLANTS[sd]: G[:PLANTS[sd][0][0][0]] = PLANTS[sd][0][1]
    G = np.where(MINB[sd] < 1.0, np.maximum(G, np.minimum(0.0, -MINB[sd] * float(os.environ.get('KEEP', 0.5)) + 0.0008)), G)  # never below the board while any sole vert is over it
    GP[sd] = G
print('MINB_L', [(f, round(MINB['L'][f]*1000,1), round(FKH['L'][f-40]*1000,1), round(FY['L'][f-40][1],3)) for f in range(72, 92)])
if os.environ.get('PROBE'): 
    for f in range(60, 200, 2): print(f, FR[f][3], round(FR[f][2], 3), 'root', round(rootz(FR[f][2]) * 1000, 1), 'GL', round(GP['L'][f] * 1000, 1), 'GR', round(GP['R'][f] * 1000, 1))
    sys.exit()
def lvl2g(lev, s): return lev + gz0(s) * (-lev / DROP)
def ik_leg(sd, dz, hv=Vector((0, 0, 0))):
    if abs(dz) < 1e-7 and hv.length < 1e-7: return 0.0
    th, sh, ft = PB['thigh.' + sd], PB['shin.' + sd], PB['foot.' + sd]
    Mf = ft.matrix.copy(); H = th.head.copy(); K = sh.head.copy(); A = sh.tail.copy(); T = A + Vector((hv.x, hv.y, dz))
    a = (K - H).length; b = (A - K).length; c = min((T - H).length, a + b - 1e-4); d = (T - H).normalized()
    n = (K - H).cross(A - H).normalized(); m = n.cross(d).normalized()
    if (K - H).dot(m) < 0: m = -m
    al = math.acos(max(-1, min(1, (a * a + c * c - b * b) / (2 * a * c)))); K2 = H + a * (math.cos(al) * d + math.sin(al) * m)
    R1 = (K - H).rotation_difference(K2 - H).to_matrix().to_4x4()
    th.matrix = Matrix.Translation(H) @ R1 @ Matrix.Translation(-H) @ th.matrix; bpy.context.view_layer.update()
    A1 = sh.tail.copy(); K1 = sh.head.copy(); R2 = (A1 - K1).rotation_difference(T - K1).to_matrix().to_4x4()
    sh.matrix = Matrix.Translation(K1) @ R2 @ Matrix.Translation(-K1) @ sh.matrix; bpy.context.view_layer.update()
    M2 = Mf.copy(); M2.translation = Mf.translation + Vector((hv.x, hv.y, dz)); ft.matrix = M2; bpy.context.view_layer.update()
    return (sh.tail - T).length
def hcorr(sd, f, s):  # horizontal correction (world xy) keeping the trailing R sole where the un-extended clip put it
    if sd != 'R' or sx(f) == 0: return Vector((0, 0, 0))
    a_ = at_pt(s + sx(f)) - at_pt(s); fr = 1.0
    pr = [iv for iv, lev in PLANTS['R'] if iv[0] <= FB and iv[1] >= FA][0]; nx = [iv for iv, lev in PLANTS['R'] if iv[0] > pr[1]][0]
    if f > pr[1]: fr = 1 - ss((f - pr[1]) / (nx[0] - pr[1]))
    a0 = at_pt(s + sx(pr[1])) - at_pt(s) if f > pr[1] else a_
    return Vector((-a0[0] * fr, -a0[1] * fr, 0))
IKERR = []
# ---- bake action + door keys
act = bpy.data.actions.new('balloon_getout_stepdown'); arm.animation_data.action = act
for f, (t, P, s, lab) in enumerate(FR):
    CUR_F[0] = f; place(s); apply(P); bpy.context.view_layer.update(); R_ = rootz(s); e_ = 0.0
    for sd in 'LR': e_ = max(e_, ik_leg(sd, lvl2g(GP[sd][f], s) - R_, hcorr(sd, f, s)))
    IKERR.append(e_)
    for b in PB: b.keyframe_insert('location', frame=f); b.keyframe_insert('rotation_quaternion', frame=f)
    arm.keyframe_insert('location', frame=f); arm.keyframe_insert('rotation_euler', frame=f)
    hinge.rotation_euler = (0, 0, TH[f]); hinge.keyframe_insert('rotation_euler', frame=f)
for fc in list(act.fcurves) + list(hinge.animation_data.action.fcurves):
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
# ---- QA
bV, _ = ev(bk); BP = [tuple(p.vertices) for p in bk.data.polygons if max(bV[i][2] for i in p.vertices) < 1.3 and (max(bV[i][2] for i in p.vertices) > 0.003 or (max(bV[i][2] for i in p.vertices) - min(bV[i][2] for i in p.vertices) > 0.02))]  # floor (z=0, = ground) checked separately via sole height
BPC = [bV[list(p)].mean(0) for p in BP]
btree = BVHTree.FromPolygons([tuple(v) for v in bV], BP)
def tree(o):
    V, P = ev(o); return V, BVHTree.FromPolygons([tuple(v) for v in V], P)
rows = []; prev = None
for f in range(NF):
    sc.frame_set(f); bpy.context.view_layer.update(); th = TH[f]; CUR_F[0] = f
    V, bt = tree(body); dV, dt_ = tree(dress); aV, at_ = tree(apron)
    r = dict(f=f, t=round(f / fps, 3), seg=FR[f][3], door_deg=round(math.degrees(th), 2))
    for sd in 'LR':
        W = V[FVI[sd]]; hgt = W[:, 2] - ground_xy(W[:, 0], W[:, 1], FR[f][2]); fv = np.column_stack([W[:, :2], hgt]); r['sole' + sd] = round(float(hgt.min()) * 1000, 2); r['footY' + sd] = round(float(W[:, 1].min()), 3)
        if prev is not None:
            c = (fv[:, 2] < 0.012) & (prev[sd][:, 2] < 0.012)
            r['slide' + sd] = round(float(np.linalg.norm(fv[c, :2] - prev[sd][c, :2], axis=1).max()) * 1000, 2) if c.any() else None
        th_ = (PB['thigh.' + sd].tail - PB['thigh.' + sd].head).normalized(); sh = (PB['shin.' + sd].tail - PB['shin.' + sd].head).normalized()
        r['knee' + sd] = round(math.degrees(th_.angle(sh)), 2)
    prev = {sd: np.column_stack([V[FVI[sd]][:, :2], V[FVI[sd]][:, 2] - ground_xy(V[FVI[sd]][:, 0], V[FVI[sd]][:, 1], FR[f][2])]) for sd in 'LR'}; r['root_mm'] = round(rootz(FR[f][2]) * 1000, 2); r['GL'] = round(GP['L'][f] * 1000, 1); r['GR'] = round(GP['R'][f] * 1000, 1); r['ikerr_mm'] = round(IKERR[f] * 1000, 3)
    bn = sum(1 for v in V if v[2] < ground_xy(np.array([v[0]]), np.array([v[1]]), FR[f][2])[0] - 1e-4); r['body_below_ground'] = bn
    ob = btree.overlap(bt); r['bk_parts'] = sorted({tuple(np.round(BPC[a], 2)) for a, _ in ob})[:4]; r['basket_x_body'] = len(ob); r['basket_x_dress'] = len(btree.overlap(dt_)); r['basket_x_apron'] = len(btree.overlap(at_))
    gB = leaf_gap(V, th); gD = leaf_gap(dV, th); gA = leaf_gap(aV, th)
    lt = leaf_tree(th); r['leafX_body'] = len(lt.overlap(bt)); r['leafX_dress'] = len(lt.overlap(dt_)); r['leafX_apron'] = len(lt.overlap(at_)); r['door_in_body'] = int((gB < 0).sum()); r['door_in_dress'] = int((gD < 0).sum()); r['door_in_apron'] = int((gA < 0).sum())
    r['door_gap_body_mm'] = round(float(gB.min()) * 1000, 1); r['door_gap_cloth_mm'] = round(float(min(gD.min(), gA.min())) * 1000, 1)
    r['hand_door_gap_mm'] = round(float(leaf_gap(V[HV['L']], th).min()) * 1000, 2)
    r['s'] = round(FR[f][2], 4); r['sx_mm'] = round(sx(f) * 1000, 2); r['x'] = round(arm.location.x, 3); r['y'] = round(arm.location.y, 3); r['yaw'] = round(math.degrees(arm.rotation_euler.z), 2)
    rows.append(r)
json.dump(dict(spec=dict(HALF_W=HALF_W, INNER=INNER, THK=THK, LEAF_H=LEAF_H, HINGE=list(HINGE), OPEN_DEG=OPEN_DEG, OPEN_S=OPEN_S, ROOT=[ROOT_X, Y0], K=K, WALK=WALK),
               timeline=dict(MODE=MODE, WALK=WALK, LTOT=LTOT, turn_deg=turn, P0=list(P0), A=list(A_b), S=list(S_b), NF=NF, f_touch=f_touch, f_peak=fpk, theta_peak_deg=math.degrees(th0), **({'t_dr': t_dr, 't_ws': t_ws, 't_ho': t_ho, 's_ho': s_ho, 'stop': STOP, 'warp': WARP, 't_e': t_e, 's_e': S_E} if MODE == 'v2' else {'cruise_v': VC, 'T': TT})), door_deg=[round(math.degrees(x), 3) for x in TH], rows=rows),
          open(OUT + f'/qa_{TAG}.json', 'w'), indent=0)
print('QADONE', flush=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT + f'/{TAG}.blend')
if not RENDER: sys.exit()
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -DROP)); gp = bpy.context.active_object
m = bpy.data.materials.new('g'); m.diffuse_color = (.35, .45, .3, 1); gp.data.materials.append(m)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
os.makedirs(OUT + '/frames', exist_ok=True)
def shoot(tag, mode, deg, res, wire):
    cd.angle = math.radians(deg); sc.render.resolution_x, sc.render.resolution_y = res
    bk.hide_render = False
    for o_ in (bk,):
        mod = o_.modifiers.get('W') or o_.modifiers.new('W', 'WIREFRAME'); mod.show_render = wire; mod.thickness = 0.008
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
