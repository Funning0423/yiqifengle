#!/usr/bin/env python3
"""Coast transition camera DRAFT v2. Checks run on the REAL mesh in the runtime world frame.
Island scene_root = world, using creator-project/assets/firstslice/combined_visual_m.glb plus combined_anchors_m.json.
Coast bundle from scene/b19-coast-scene @7297fa5f: root position (-2.11, -0.6, 17.39), yaw 180, scale 1, parent scene_root.
Her path is built from anchors: door_stand_point -> exit_path_06..17 (island), then S0 -> S1 -> E-0.25 (coast).
Her height comes from a downward ray on the owning mesh. Lens keys are path-relative: azimuth from her heading
(+ = her right), radius, height above her root, look-target lift/side offset and vFOV. Re-anchoring only needs the anchors.
Not runtime code."""
import json, math, sys, os, numpy as np, trimesh
from PIL import Image, ImageDraw
from realmesh import load, coast_to_world, W, FIT
RET = os.environ.get('DIR', 'out') == 'return'  # DIR=return: coast -> island return (r2 only)
SCREEN = os.environ.get('SCREEN', '390x844'); SW, SH_ = map(int, SCREEN.split('x'))
OUT = (os.environ.get('OUT_DIR') or os.path.dirname(os.path.abspath(__file__))) + ({'r5d': '/out_v4/' + SCREEN, 'r2': '/out_v3'}.get(FIT, '/out_v2')) + ('/return' if RET else ''); os.makedirs(OUT, exist_ok=True)
parts, missing = load()
names = []; ms = []
for n, m in parts: ms.append(m); names += [n] * len(m.faces)
MESH = trimesh.util.concatenate(ms); NAMES = np.array(names); RAY = trimesh.ray.ray_pyembree.RayMeshIntersector(MESH)
COAST = trimesh.util.concatenate([m for n, m in parts if n.startswith('coast:')]); CRAY = trimesh.ray.ray_pyembree.RayMeshIntersector(COAST)
ISL = trimesh.util.concatenate([m for n, m in parts if n.startswith('island:')]); IRAY = trimesh.ray.ray_pyembree.RayMeshIntersector(ISL)
AN = {d['name']: np.array(d['position_world_m']) for d in json.load(open(W + '/anchors.json'))['anchors']}
S0, S1, E = coast_to_world([0, 0.6, 12.1]), coast_to_world([0, 0, 10.9]), coast_to_world([0, 0, 4.9])
ESTOP = coast_to_world([0, 0, 5.15]); BOARD_C = coast_to_world([0, 0, 0])
P2 = FIT == 'r5d' and os.environ.get('P2', '1') == '1'  # 场景设计部 P2 route: S5 ends at the pause point, S7 walks pause -> stop (5.10 m, 1.2 m/s)
PAUSE = coast_to_world([0, 0, 10.25]) if P2 else ESTOP; S7_WALK_AT = float(os.environ.get('S7_WALK_AT', 2.0))  # S7 walk start, s after S7 begins
LH_TOP = np.array([0.0, 8.4, -2.65]); LH_LANTERN = [np.array([0, 8.9, -2.65]), np.array([0, 7.4, -2.65])]
def ground_y(x, z, ray, y0=0.0):
    loc, _, _ = ray.intersects_location([[x, y0 + 3, z]], [[0, -1, 0]], multiple_hits=True)  # highest surface within 0.5 m of anchor height (skips the overhang)
    ys = [float(v[1]) for v in loc if v[1] <= y0 + 0.5]; return max(ys) if ys else None
# ---- her path ----
if FIT in ('r2', 'r5d'):  # r2: exit_point -> exit_path_06..17 -> detour W -> ramp start R -> S0 (scene report r2 section 4)
    RAMP_R = coast_to_world([0, 0.845, 13.1]); WDET = np.array([-0.7, 0.0, 7.4])
    isl = [AN['exit_point']] + [AN[f'exit_path_{i:02d}'] for i in range(6, 18)] + [WDET, RAMP_R, S0]
else:
    isl = [AN['door_stand_point']] + [AN[f'exit_path_{i:02d}'] for i in range(6, 18)]
LEN_ISL = float(np.linalg.norm(np.diff(np.array(isl), axis=0), axis=1).sum())
WALK = 1.2; STEP_S = 1.8
T_S1, T_S2 = float(os.environ.get('T_S1', 7.2 if (FIT == 'r5d' and os.environ.get('S1V', '2') == '2') else 2.0)), 0.4; T_PATH = LEN_ISL / WALK; T_TER = float(np.linalg.norm(PAUSE - S1)) / WALK; T_W7 = float(np.linalg.norm(ESTOP - PAUSE)) / WALK; T_S6, T_S7 = float(os.environ.get('T_S6', (9.5 if FIT == 'r5d' and os.environ.get('P2', '1') == '1' else 5.6) if FIT == 'r5d' else 0.6)), float(os.environ.get('T_S7', 14.0 if FIT == 'r5d' else 5.0))  # r5d arrival X (Grok Bot): S6 5.6 s (stop beat + pull-back to the wide hut view, 1.0 s hold), S7 14 s orbit-rise (7 s ran 15 m/s from 30 m out)  # r2 map-collapse (a): S1 8.6 -> 7.2 s (ease 0.2), S2 unchanged
if RET: T_S1 = float(os.environ.get('T_S1', 3.0)); T_S6 = float(os.environ.get('T_S6', 1.5))  # v3.2: R6 0.6 -> 1.5 s (standing yaw accel)
T = np.cumsum([0, T_S1, T_S2, T_TER, STEP_S, T_PATH, T_S6, T_S7] if RET else [0, T_S1, T_S2, T_PATH, STEP_S, T_TER, T_S6, T_S7]); TOTAL = T[-1]
SHOTS = ['S1 map-collapse handover', 'S2 heading settle 0.4 s', 'S3 island exit path lead', 'S4 step-down profile',
         'S5 terrace lead', 'S6 stop + look back at lighthouse', 'S7 orbit-rise to board pose']
if RET: SHOTS = ['R1 board-lens descent (she has turned to -Z)', 'R2 heading settle 0.4 s', 'R3 terrace lead back', 'R4 step-up',
                 'R5 island path lead back to the door', 'R6 arrive at exit_point', 'R7 rise to live island lens']
def polyline_at(P, s):
    P = np.array(P, float); seg = np.linalg.norm(np.diff(P, axis=0), axis=1); c = np.r_[0, np.cumsum(seg)]; s = min(max(s, 0), c[-1])
    i = min(np.searchsorted(c, s, 'right') - 1, len(seg) - 1); u = (s - c[i]) / seg[i]; return P[i] + (P[i + 1] - P[i]) * u
def her_xz(t):
    if RET:
        if t < T[2]: return ESTOP.copy()
        if t < T[3]: return ESTOP + (S1 - ESTOP) * (t - T[2]) / T_TER
        if t < T[4]: return S1 + (S0 - S1) * (t - T[3]) / STEP_S
        if t < T[5]: return polyline_at(isl[::-1], (t - T[4]) * WALK)
        return isl[0].copy()
    if t < T[2]: return isl[0].copy()
    if t < T[3]: return polyline_at(isl, (t - T[2]) * WALK)
    if t < T[4]: return S0 + (S1 - S0) * (t - T[3]) / STEP_S
    if t < T[5]: return S1 + (PAUSE - S1) * min(1, (t - T[4]) / T_TER)
    if P2 and t < T[6] + S7_WALK_AT: return PAUSE.copy()
    if P2 and t < T[6] + S7_WALK_AT + T_W7: return PAUSE + (ESTOP - PAUSE) * (t - T[6] - S7_WALK_AT) / T_W7
    return ESTOP.copy()
_gy = {}
def her_root(t):
    p = her_xz(t); key = (round(p[0], 3), round(p[2], 3))
    if key not in _gy:
        coast_side = p[2] > (RAMP_R[2] + 1e-3 if FIT in ('r2', 'r5d') else S0[2] - 1e-6)
        _gy[key] = ground_y(p[0], p[2], CRAY if coast_side else IRAY, p[1])
        if _gy[key] is None: raise SystemExit(f'no ground under her at {p}')
    return np.array([p[0], _gy[key], p[2]])
FPS = 60; TS = np.arange(0, TOTAL + 1e-9, 1 / FPS)
RAWP = np.array([her_root(t) for t in TS])
K = int(0.12 * FPS); SM = np.array([RAWP[max(0, i - K):i + K + 1].mean(0) for i in range(len(TS))])  # 0.24 s root smoothing
def heading_at(i):  # smoothed travel heading (look-ahead 0.6 m); standing at door = +Z; settles to path in S2
    t = TS[i]
    if RET:  # she stands facing -Z (back toward the island) from the first frame
        if t < T[2]: return 180.0
        j = min(len(TS) - 1, i + int(0.5 * FPS)); a = max(0, i - int(0.5 * FPS)); d = SM[j] - SM[a]
        dl = isl[0] - isl[1]; hl = math.degrees(math.atan2(dl[0], dl[2])) % 360  # v3.2: ease onto the last path-segment heading over 2 s before the stop
        if np.hypot(d[0], d[2]) < 0.05 or t >= T[5]: return hl
        h = math.degrees(math.atan2(d[0], d[2])) % 360; u = min(1, max(0, (t - (T[5] - 2.0)) / 2.0)); u = u * u * (3 - 2 * u)
        return h + ((hl - h + 180) % 360 - 180) * u
    if t < T[1]: return 0.0
    j = min(len(TS) - 1, i + int(0.5 * FPS)); a = max(0, i - int(0.5 * FPS))
    d = SM[j] - SM[a]
    if np.hypot(d[0], d[2]) < 0.05:  # standing
        d = SM[-1] - SM[np.searchsorted(TS, T[4])] if t > T[4] else np.array([0, 0, 1.0])
    h = math.degrees(math.atan2(d[0], d[2]))
    if t < T[2]: u = (t - T[1]) / T_S2; u = u * u * (3 - 2 * u); h = h * u
    return h
HD = np.degrees(np.unwrap(np.radians([heading_at(i) for i in range(len(TS))]))); HD = np.convolve(np.r_[[HD[0]] * 30, HD, [HD[-1]] * 30], np.ones(61) / 61, 'valid')
# ---- lens keys: t, az_deg (from her forward, + = her right), radius, height above root, look lift, look side (+ = her right), vfov ----
ISLAND_LIVE = dict(pos=np.array([-12, 15.5, 48.0]), look=np.array([1, .5, 1.0]), fov=42.0,
                   src="RegionCameraData.ts island.variants['v24-readable'] (islandPoseSource) @7297fa5f")
BOARD_D = float(os.environ.get('BOARD_D', 16)); BOARD_POSE = dict(pos=BOARD_C + np.array([0, BOARD_D * math.sin(math.radians(55)), -BOARD_D * math.cos(math.radians(55))]), look=BOARD_C, fov=45.0)
BOARD_OLD = os.environ.get('BOARD_OLD') == '1'  # v4 'before' renders: keep the v3 16 m / 55 deg / fov 45 end pose
if FIT == 'r5d' and BOARD_OLD: OUT = OUT.replace('/out_v4/', '/out_v4/before_'); os.makedirs(OUT, exist_ok=True)
if FIT == 'r5d' and not BOARD_OLD:  # v4: official coast board lens (tools/coast-board-lens/lens.py), per-aspect distance for SCREEN
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../coast-board-lens')); import lens as _bl
    _bp, _bt = _bl.pose(_bl.LENS, _bl.distance_for(SW, SH_)); BOARD_POSE = dict(pos=_bp, look=_bt, fov=float(_bl.LENS['fov']))
if FIT == 'r5d' and os.environ.get('BOARD_POSE'):  # data-only candidates (item 3): 'px,py,pz,lx,ly,lz,fov'
    _v = [float(x) for x in os.environ['BOARD_POSE'].split(',')]; BOARD_POSE = dict(pos=np.array(_v[:3]), look=np.array(_v[3:6]), fov=_v[6]); OUT = OUT.replace('/out_v4/', '/out_v4/cand_'); os.makedirs(OUT, exist_ok=True)
S3_DR, S3_DS, S3_DF = (float(x) for x in os.environ.get('S3D', '0,0,4' if FIT == 'r5d' else '0,0,0').split(','))  # v4.2 S3 framing fix (radius, look-side, vfov deltas): r5d vfov 44 -> 48 on the two S3 keys, true vertical fov
S6KEY = [float(x) for x in os.environ.get('S6KEY', (('30,28,4,1.2,2.5,32' if P2 else '38,30,4,1.2,2.5,30') if FIT == 'r5d' else '0,6.0,1.9,1.8,0.6,50' if FIT == 'r2' else '5,6.0,1.9,1.8,0.3,50')).split(',')]  # r5d arrival lens A (Grok Bot): behind-left over her shoulder, hut above her head; old r5d '0,6.0,1.9,1.8,0.6,50' (front, 1.353 m over the r5f board)
S7_RFAST = float(os.environ.get('S7_RFAST', 1)); S7_LINE = os.environ.get('S7_LINE', '0') == '1'
S5KEY = [float(x) for x in (os.environ.get('S5KEY') or (('-20,4.5,2.6,1.0,0.3,44' if P2 else '38,13,3.6,1.2,1.5,36') if FIT == 'r5d' else '')).split(',') if x] or None; S6_HOLD = float(os.environ.get('S6_HOLD', (1.5 if P2 else 1.0) if FIT == 'r5d' else 0))  # r5d X: S5 ends on X's line at r 13, S6 pulls back r 13 -> 30 then holds
KEYS = [  # front-LEFT side through the walk: the right side of the curved exit path has a 2 m island prop at (-4.4..-3.25, 0..2.06, 2.4..3.9)
    (T[0], 'world'),
    (T[1], -30, 3.4, 2.1, 0.9, 0.3, 44),    # S1 end: front-left 3/4 medium
    (T[2], -28, 3.4, 2.1, 0.9, 0.3, 44),     # S2 heading settle
    (T[2] + 2.0, -24, 3.2 + S3_DR, (2.35 if FIT in ('r2', 'r5d') else 2.1), 0.9, 0.3 - S3_DS, 44 + S3_DF),  # S3 leading dolly; look side +0.3 (her right) -> she sits on screen-left third
] + ([(T[2] + 5.5, -26, 3.2 + S3_DR, 2.35, 0.9, 0.3 - S3_DS, 44 + S3_DF)] if FIT in ('r2', 'r5d') else []) + [  # r2: 8.7 s walk; lens kept >=2.35 over the 0.75 m island prop at x -2.56..-1.97, z 6.4..7.6
    (T[3], -30, 3.3, 2.2, 0.9, 0.2, 44),
    (T[3] + 1.0, -45, 3.5, 2.3, 0.8, 0.0, 45),  # S4 front-left 3/4 over the step-down (left profile would sit on the gull rock)
] + ([] if os.environ.get('S5_LEAD', '0' if P2 else '1') == '0' else [(T[4] + 0.8, -25, 4.2, 2.4, 0.9, 0.2, 46)]) + [  # S5 terrace lead (r5d arrival A2: dropped so the pull-back to the wide S6 spreads over S4 end..S5, 5.6 s)
    (T[5], *(S5KEY or (S6KEY[0], S6KEY[1] - 0.3, S6KEY[2] + 0.1, S6KEY[3], S6KEY[4], S6KEY[5]))),
] + ([(T[6] - S6_HOLD, *S6KEY)] if S6_HOLD > 0 else []) + [
    (T[6], *S6KEY),                            # S6 pull-back, low, looking up: lighthouse upper-right
    (T[7], 'world')]                           # S7 single orbit-rise round her RIGHT side to the board pose
if RET:  # front-RIGHT on the coast (same side as the board lens, so R1 needs no 180° swing), then swings to behind-right on the island
    # path: a front lens would sit inside the lighthouse at the door, and the live island lens is behind her (+Z)
    KEYS = [(T[0], 'world'),
        (T[1], 30, 3.8, 2.6, 1.0, -0.2, 44), (T[2], 28, 3.6, 2.6, 1.0, -0.2, 44),
        (T[3], 35, 3.5, 3.15, 1.0, -0.2, 44), (T[3] + 1.0, 45, 3.5, 3.15, 0.9, 0.0, 45),  # v3.2: h 2.9 -> 3.15 over the gull rock / rock_2
        (T[4] + 1.5, 60, 3.4, 2.7, 1.0, 0.0, 44), (T[4] + 5.0, 150, 3.2, 2.45, 1.0, 0.0, 44),
        (T[5], 165, 3.8, 2.55, 1.0, 0.0, 44), (T[6], 165, 4.0, 2.6, 1.0, 0.0, 44),  # v3.2: no azimuth change while she stops
        (T[7], 'world')]
START_POSE, END_POSE = (BOARD_POSE, ISLAND_LIVE) if RET else (ISLAND_LIVE, BOARD_POSE)
def ease(u): return u * u * u * (u * (6 * u - 15) + 10)
S1_STRAIGHT = FIT == 'r5d' and os.environ.get('S1V', '2') == '2'; S1_EASE = float(os.environ.get('S1_EASE', 0.2 if FIT == 'r5d' else 0.35))
def remap(x, a):  # CameraPose.remapProgress with easeIn = easeOut = a (C2, zero speed at both ends)
    x = min(1, max(0, x)); s = 1 / (1 - 2 * a / 3)
    if x < a: u = x / a; return s * a * (u + (1 - u) ** 3 / 3 - 1 / 3)
    if x > 1 - a: u = (x - (1 - a)) / a; return min(1, s * (2 * a / 3 + (1 - 2 * a)) + s * a * (u - u ** 3 / 3))
    return s * (2 * a / 3 + (x - a))
def rel_pose(k, i):
    _, az, r, h, ll, ls, fov = k; hd = math.radians(HD[i]); a = hd - math.radians(az)  # right of her = -az in world yaw
    fwd = np.array([math.sin(hd), 0, math.cos(hd)]); right = np.array([-math.cos(hd), 0, math.sin(hd)])
    pos = SM[i] + np.array([r * math.sin(hd + math.radians(-az)), h, r * math.cos(hd + math.radians(-az))])
    pos = SM[i] + fwd * r * math.cos(math.radians(az)) + right * r * math.sin(math.radians(az)) + np.array([0, h, 0])
    return pos, SM[i] + np.array([0, ll, 0]) + right * ls, fov
def cam_i(i):
    t = TS[i]
    for a, b in zip(KEYS, KEYS[1:]):
        if a[0] <= t <= b[0] + 1e-9: break
    u = ease((t - a[0]) / (b[0] - a[0]))
    if a[1] != 'world' and b[1] != 'world':
        k = (t,) + tuple(np.array(a[1:]) + (np.array(b[1:]) - np.array(a[1:])) * u); return rel_pose(k, i)
    if a[1] != 'world' and b[1] == 'world':  # orbit in her cylinder from the rel key to the board pose, then exact
        hd = math.radians(HD[i]); fwd = np.array([math.sin(hd), 0, math.cos(hd)]); right = np.array([-math.cos(hd), 0, math.sin(hd)])
        pa, la, fa = rel_pose(a, i); w = END_POSE
        def cyl(p):
            v = p - SM[i]; return math.atan2(v @ right, v @ fwd), math.hypot(v @ right, v @ fwd), v[1]
        (aa, ra, ya_), (ab, rb, yb) = cyl(pa), cyl(w['pos'])
        if P2:  # she walks during S7: the end cylinder is taken round her final stand (constant), the orbit centre follows her
            v = w['pos'] - SM[-1]; ab, rb, yb = math.atan2(v @ right, v @ fwd), math.hypot(v @ right, v @ fwd), v[1]
        if RET or os.environ.get('S7_SHORT', '1' if FIT == 'r5d' else '0') == '1': ab = aa + (ab - aa + math.pi) % (2 * math.pi) - math.pi  # return / arrival-lens candidates (S6 behind her): shortest way round
        elif ab < aa: ab += 2 * math.pi  # go round her right side (increasing az)
        uo = ease(min(1, (t - a[0]) / (b[0] - a[0])))  # orbit over the whole shot; look hand-off in the second half
        ur = ease(min(1, (t - a[0]) / (b[0] - a[0]) / S7_RFAST)) if S7_RFAST < 1 else u  # r5d X: close the radius early so the swing round her runs on a small circle
        az, r, y = aa + (ab - aa) * uo, ra + (rb - ra) * ur, ya_ + (yb - ya_) * u
        pos = SM[i] + fwd * r * math.cos(az) + right * r * math.sin(az) + [0, y, 0]
        if S7_LINE: pos = pa + (w['pos'] - pa) * u  # r5d arrival X: straight rise from the wide S6 (no orbit arc round her)
        ul = ease(min(1, max(0, ((t - a[0]) / (b[0] - a[0]) - 0.5) / 0.5)))  # look stays on her, then hands to board centre
        if S7_LINE: ul = u  # look hands over across the whole straight rise (no overhead yaw flip)
        return pos, la + (w['look'] - la) * ul, fa + (w['fov'] - fa) * u
    if a[1] == 'world' and b[1] != 'world' and S1_STRAIGHT:  # v4.1 S1: straight line (shortest path, 48.95 m vs 50.75 m arc), C2 trapezoid remap
        pb, lb, fb = rel_pose(b, i); w = START_POSE; x = (t - a[0]) / (b[0] - a[0]); v = remap(x, S1_EASE)
        return w['pos'] + (pb - w['pos']) * v, w['look'] + (lb - w['look']) * v, w['fov'] + (fb - w['fov']) * v
    if a[1] == 'world' and b[1] != 'world':  # S1: descend in her cylinder (az, log r, h) from the live island lens
        hd = math.radians(HD[i]); fwd = np.array([math.sin(hd), 0, math.cos(hd)]); right = np.array([-math.cos(hd), 0, math.sin(hd)])
        pb, lb, fb = rel_pose(b, i); w = START_POSE
        def cyl(p):
            v = p - SM[i]; return math.atan2(v @ right, v @ fwd), math.hypot(v @ right, v @ fwd), v[1]
        (aa, ra, ya_), (ab, rb, yb) = cyl(w['pos']), cyl(pb)
        ab = aa + (ab - aa + math.pi) % (2 * math.pi) - math.pi
        az, r, y = aa + (ab - aa) * u, math.exp(math.log(ra) + (math.log(rb) - math.log(ra)) * u), ya_ + (yb - ya_) * u
        pos = SM[i] + fwd * r * math.cos(az) + right * r * math.sin(az) + [0, y, 0]
        return pos, w['look'] + (lb - w['look']) * u, w['fov'] + (fb - w['fov']) * u
    def P(k):
        if k[1] == 'world':
            w = START_POSE if k[0] == 0 else END_POSE; return w['pos'], w['look'], w['fov']
        return rel_pose(k, i)
    pa, la, fa = P(a); pb, lb, fb = P(b); pos = pa + (pb - pa) * u
    da, db = la - pa, lb - pb; na, nb = np.linalg.norm(da), np.linalg.norm(db); da, db = da / na, db / nb  # slerp the view direction
    om = math.acos(min(1, max(-1, float(da @ db))))
    return pos, la + (lb - la) * u, fa + (fb - fa) * u  # linear look keeps her in frame during the descent
CAM = [cam_i(i) for i in range(len(TS))]
# ---- projection ----
def basis(p, l):
    f = (l - p) / np.linalg.norm(l - p); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); return f, r, np.cross(r, f)
def tanh_(fov, asp):
    th = math.tan(math.radians(fov) / 2)
    if FIT == 'r5d': return th  # v4: engine truth, pure vertical fov (CAMERA_FIXED.fovAxis 'vertical', no portrait widening)
    return th * 0.62 / asp if asp < 0.62 else th
def project(pt, p, l, fov, asp):
    f, r, u = basis(p, l); v = pt - p; z = v @ f
    if z <= 0.05: return None
    th = tanh_(fov, asp); return (0.5 + (v @ r) / z / (th * asp) / 2, 0.5 - (v @ u) / z / th / 2, z)
SCREENS = [(390, 844), (414, 896), (360, 780), (375, 667), (320, 568), (390, 520), (768, 1024)]
if FIT == 'r5d': SCREENS = [(SW, SH_)]  # v4: the board pose is per aspect, so one trajectory per screen
def capsule(w, h): top = 48 if h >= 780 else 26; return ((w - 7 - 87) / w, top / h, (w - 7) / w, (top + 32) / h)
FACE, CHEST, HEAD_TOP, HALF_W = 1.42, 1.12, 1.62, 0.28
def gates(render_only=False):
    g = {}
    P = np.array([c[0] for c in CAM]); L = np.array([c[1] for c in CAM])
    F = (L - P); yaw = np.unwrap(np.arctan2(F[:, 0], F[:, 2])); yr = np.degrees(np.gradient(yaw, 1 / FPS)); ya = np.gradient(yr, 1 / FPS)
    walking = (TS >= T[2]) & (TS < T[5])
    def st(m): return dict(max_rate=round(float(np.abs(yr[m]).max()), 1), p99_acc=round(float(np.percentile(np.abs(ya[m]), 99)), 1))
    g['yaw_standing'] = st(~walking); g['yaw_walking'] = st(walking)
    g['yaw_standing']['pass'] = g['yaw_standing']['max_rate'] <= 90 and g['yaw_standing']['p99_acc'] <= 200
    g['yaw_walking']['pass'] = g['yaw_walking']['max_rate'] <= 120 and g['yaw_walking']['p99_acc'] <= 300
    step = np.linalg.norm(np.diff(P, axis=0), axis=1); g['max_lens_step_m_per_frame'] = round(float(step.max()), 3); g['max_step_t'] = round(float(TS[step.argmax()]), 2)
    if FIT == 'r5d':  # v4 motion limits (Grok Bot): real dt, yaw/pitch <=90 deg/s, p99 ang accel <=200, <=8 m/s, <=0.5 m/frame, fov <=1.5 deg/frame
        Fn = F / np.linalg.norm(F, axis=1)[:, None]; pit = np.degrees(np.arcsin(np.clip(Fn[:, 1], -1, 1))); dt = np.diff(TS)
        yawd = np.degrees(yaw); wy = np.diff(yawd) / dt; wp = np.diff(pit) / dt; ay = np.diff(wy) / dt[1:]; ap = np.diff(wp) / dt[1:]
        sp = step / dt; fv = np.abs(np.diff(np.array([c[2] for c in CAM])))
        def mot(m, ma):
            r = dict(yaw_max=round(float(np.abs(wy[m]).max()), 1), pitch_max=round(float(np.abs(wp[m]).max()), 1), yaw_acc_p99=round(float(np.percentile(np.abs(ay[ma]), 99)), 1),
                     pitch_acc_p99=round(float(np.percentile(np.abs(ap[ma]), 99)), 1), speed_max=round(float(sp[m].max()), 2), step_max=round(float(step[m].max()), 3), fov_step_max=round(float(fv[m].max()), 3))
            r['pass'] = r['yaw_max'] <= 90 and r['pitch_max'] <= 90 and r['yaw_acc_p99'] <= 200 and r['pitch_acc_p99'] <= 200 and r['speed_max'] <= 8 and r['step_max'] <= 0.5 and r['fov_step_max'] <= 1.5; return r
        s7 = TS[:-1] >= T[6] - 1e-9; g['motion_s7_pushin'] = mot(s7, s7[1:]); g['motion_whole'] = mot(np.ones(len(dt), bool), np.ones(len(dt) - 1, bool))
        g['motion_whole_fail_shots'] = sorted({SHOTS[int(np.searchsorted(T, TS[k], 'right') - 1)] for k in range(len(dt)) if sp[k] > 8 or step[k] > 0.5 or abs(wy[k]) > 90 or abs(wp[k]) > 90 or fv[k] > 1.5})
        g['last_frame_pose_err'] = dict(pos_m=float(np.linalg.norm(P[-1] - END_POSE['pos'])), look_m=float(np.linalg.norm(L[-1] - END_POSE['look'])), fov=float(abs(CAM[-1][2] - END_POSE['fov'])))
    g['hard_cuts'] = 0; g['first_frame_eq_live'] = bool(np.allclose(P[0], START_POSE['pos']) and np.allclose(L[0], START_POSE['look']))
    g['last_frame_eq_board'] = bool(np.allclose(P[-1], END_POSE['pos']) and np.allclose(L[-1], END_POSE['look']))  # return: last = live island lens
    # clearance (30 fps samples): solids distance + ground below
    idx = np.arange(0, len(TS), 2); cp, dist, tri = trimesh.proximity.closest_point(MESH, P[idx])
    gr = []
    for i in idx:
        loc, _, ti = RAY.intersects_location([P[i]], [[0, -1, 0]], multiple_hits=False); gr.append(P[i][1] - loc[0][1] if len(loc) else 99)
    gr = np.array(gr); moving = np.array([np.linalg.norm(SM[min(i + 3, len(TS) - 1)] - SM[max(i - 3, 0)]) > 0.02 for i in idx]) | (TS[idx] < T[1]) | (TS[idx] > T[6])
    stand = ~moving
    g['clear_standing_min'] = round(float(dist[stand].min()), 3) if stand.any() else None
    g['clear_standing_who'] = NAMES[tri[stand][dist[stand].argmin()]] if stand.any() else None
    g['travel_solid_min'] = round(float(dist[moving].min()), 3); g['travel_solid_who'] = NAMES[tri[moving][dist[moving].argmin()]]; g['travel_solid_t'] = round(float(TS[idx][moving][dist[moving].argmin()]), 2)
    g['travel_ground_min'] = round(float(gr[moving].min()), 3); g['travel_ground_t'] = round(float(TS[idx][moving][gr[moving].argmin()]), 2)
    g['clear_pass'] = (g['clear_standing_min'] is None or g['clear_standing_min'] >= 1.1) and g['travel_solid_min'] >= 0.5 and g['travel_ground_min'] >= 1.5
    # her ground sanity (feet on mesh)
    g['her_ground_check'] = {k: round(float(her_root(t)[1]), 3) for k, t in ([('Estop', 0.0), ('S1', T[3]), ('S0', T[4]), ('exit_point', T[7])] if RET else [('door', 0.0), ('S0', T[3]), ('S1', T[4]), ('Estop', T[5])])}
    # occlusion (both rays; 60 fps)
    o = []
    for i in range(len(TS)):
        p = P[i]; hit = False
        for y in (FACE, CHEST):
            q = SM[i] + [0, y, 0]; d = q - p; Ld = np.linalg.norm(d)
            loc, _, ti = RAY.intersects_location([p], [d / Ld], multiple_hits=False)
            if len(loc) and np.linalg.norm(loc[0] - p) < Ld - 0.3: hit = NAMES[ti[0]]; break
        o.append(hit)
    run = 0; worst = 0; who = None; dist12 = np.linalg.norm(P - SM - [0, 1.1, 0], axis=1)
    for i, h in enumerate(o):
        run = run + 1 / FPS if h else 0
        if run > worst: worst, who = run, h
    g['occlusion_worst_s'] = round(worst, 2); g['occlusion_who'] = who; g['occlusion_pass'] = worst <= 0.5
    far = dist12 > 12; g['far_12m_s'] = round(far.sum() / FPS, 2)
    segs = []; s0 = None
    for i, f in enumerate(far):
        if f and s0 is None: s0 = TS[i]
        if (not f or i == len(far) - 1) and s0 is not None: segs.append((round(s0, 2), round(TS[i], 2))); s0 = None
    g['far_12m_segments'] = segs
    scr = []
    for (w, h) in SCREENS:
        asp = w / h; cap = capsule(w, h); mm, mmt = 9, None; capbad = 0; farin = 0; farn = 0; lh_ok = 0; lh_n = 0
        for i in range(len(TS)):
            p, l, fov = CAM[i]; hp = SM[i]
            pts = [hp + [0, HEAD_TOP, 0], hp + [0, .02, 0]]; rgt = basis(p, l)[1]; pts += [hp + [0, FACE, 0] + rgt * HALF_W, hp + [0, FACE, 0] - rgt * HALF_W]
            pr = [project(q, p, l, fov, asp) for q in pts]
            inside = all(x is not None for x in pr) and all(0 <= x[0] <= 1 and 0 <= x[1] <= 1 for x in pr)
            if far[i]: farn += 1; farin += inside and not o[i]
            if any(x is None for x in pr): m = -9
            else:
                xs = [x[0] for x in pr]; ys = [x[1] for x in pr]; m = min(min(xs), 1 - max(xs), min(ys), 1 - max(ys))
            if m < mm: mm, mmt = m, TS[i]
            fp = project(hp + [0, FACE, 0], p, l, fov, asp)
            if fp and cap[0] - .02 <= fp[0] <= cap[2] + .02 and cap[1] - .02 <= fp[1] <= cap[3] + .02: capbad += 1
            if not RET and T[5] + 0.15 <= TS[i] <= T[6]:
                lh_n += 1; q = [project(x, p, l, fov, asp) for x in LH_LANTERN]
                lh_ok += all(x is not None and 0.55 <= x[0] <= 0.95 and 0.04 <= x[1] <= 0.5 for x in q) and not (cap[0] - .03 <= q[0][0] <= cap[2] + .03 and q[0][1] <= cap[3] + .03 and q[0][1] >= cap[1] - .03)
        scr.append(dict(screen=f'{w}x{h}', min_margin=round(mm, 3), at_t=round(float(mmt), 2), margin_pass=bool(mm >= 0.08), face_under_menu=capbad,
                        far_in_frame_pct=round(100 * farin / farn, 1) if farn else None, lighthouse_upper_right_pct=round(100 * lh_ok / max(1, lh_n), 1)))
    g['screens'] = scr
    return g
COLS = {'env_island_main': (214, 196, 150), 'env_lighthouse_ext': (236, 232, 222), 'terrain': (222, 202, 150), 'headland': (150, 140, 120), 'arrival_steps': (205, 185, 140)}
def colour(n):
    b = n.split(':')[1].split('@')[0]
    if b in COLS: return COLS[b]
    if b.startswith('rock') or b == 'barnacles': return (135, 128, 118)
    if b.startswith('slab') or b == 'joint_bed': return (176, 160, 130)
    if b.startswith(('grass', 'moss', 'flowers')) or 'palm' in b: return (110, 160, 90)
    if b.startswith('piece'): return (240, 170, 120)
    return (190, 170, 150)
FC = np.array([colour(n) for n in NAMES], float); FN = MESH.face_normals; TRI = MESH.triangles
SEA = (70, 140, 195)
def render(i, w, h, H=300):
    Wd = int(H * w / h); im = Image.new('RGB', (Wd, H), (160, 205, 235)); d = ImageDraw.Draw(im); asp = w / h
    p, l, fov = CAM[i]; f, r, u = basis(p, l); th = tanh_(fov, asp)
    # sea plane band (y=-0.7) drawn first: horizon line
    V = TRI - p; z = V @ f; x = V @ r; y = V @ u; ok = (z > 0.1).all(1)
    sx = (0.5 + x / np.maximum(z, 1e-3) / (th * asp) / 2) * Wd; sy = (0.5 - y / np.maximum(z, 1e-3) / th / 2) * H
    hz = project(p + f * 500 * np.array([1, 0, 1]) / max(1e-6, np.linalg.norm(f * [1, 0, 1])) + [0, -0.7 - p[1], 0], p, l, fov, asp)
    if hz: d.rectangle([0, hz[1] * H, Wd, H], fill=SEA)
    vis = ok & (sx.max(1) > 0) & (sx.min(1) < Wd) & (sy.max(1) > 0) & (sy.min(1) < H)
    order = np.argsort(-z.mean(1)[vis]); ids = np.where(vis)[0][order]
    sh = 0.55 + 0.45 * np.clip(FN @ np.array([0.35, 0.85, 0.4]) / 1.0, 0, 1)
    hp = SM[i]; zb = (hp + [0, 0.8, 0] - p) @ f; drawn_her = False
    def draw_her():
        for a, b, c in [((-.2, 0, -.14), (.2, 1.25, .14), (230, 90, 80))]:
            box = trimesh.creation.box(extents=np.array(b) - a); box.apply_translation(hp + (np.array(a) + b) / 2)
            for t_ in box.triangles:
                pr = [project(v, p, l, fov, asp) for v in t_]
                if all(pr): d.polygon([(q[0] * Wd, q[1] * H) for q in pr], fill=c)
        hd = project(hp + [0, FACE + .08, 0], p, l, fov, asp)
        if hd: rr = max(2, .17 / hd[2] / th / 2 * H); d.ellipse([hd[0] * Wd - rr, hd[1] * H - rr, hd[0] * Wd + rr, hd[1] * H + rr], fill=(250, 215, 180), outline=(0, 0, 0))
    for k in ids:
        if not drawn_her and z[k].mean() < zb: draw_her(); drawn_her = True
        c = tuple(int(v * sh[k]) for v in FC[k]); d.polygon(list(zip(sx[k], sy[k])), fill=c)
    if not drawn_her: draw_her()
    c = capsule(w, h); d.rounded_rectangle([c[0] * Wd, c[1] * H, c[2] * Wd, c[3] * H], 4, outline=(0, 0, 0), fill=(255, 255, 255))
    m = .08; d.rectangle([m * Wd, m * H, (1 - m) * Wd, (1 - m) * H], outline=(255, 0, 255))
    return im
if __name__ == '__main__':
    g = gates(); g['timeline'] = dict(T=[round(float(x), 3) for x in T], total=round(float(TOTAL), 3), island_path_len=round(LEN_ISL, 3), terrace_len=round(float(np.linalg.norm(ESTOP - S1)), 3))
    g['island_live_src'] = ISLAND_LIVE['src']; g['coast_missing_meshes(proxied=none)'] = sorted(missing)
    json.dump(g, open(OUT + '/gates.json', 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print(json.dumps(g, default=lambda o: o.item() if hasattr(o, 'item') else str(o)))
    if FIT == 'r5d':  # per-frame trajectory for the node gate (tools/coast-board-lens/test_coast_board_lens.cjs)
        with open(OUT + '/frames.csv', 'w') as fh:
            fh.write('frame,t,shot,px,py,pz,lx,ly,lz,fov,hx,hy,hz\n')
            for i, (p_, l_, f_) in enumerate(CAM): fh.write(f"{i},{TS[i]:.6f},{int(np.searchsorted(T, TS[i], 'right') - 1) + 1 if TS[i] < T[-1] else 7},{p_[0]:.6f},{p_[1]:.6f},{p_[2]:.6f},{l_[0]:.6f},{l_[1]:.6f},{l_[2]:.6f},{f_:.6f},{her_root(TS[i])[0]:.6f},{her_root(TS[i])[1]:.6f},{her_root(TS[i])[2]:.6f}\n")
        json.dump(dict(screen=SCREEN, board_pose=dict(pos=[float(x) for x in END_POSE['pos']], look=[float(x) for x in END_POSE['look']], fov=float(END_POSE['fov'])), s7_start=float(T[6]), total=float(T[-1]), **({'s7_walk': [float(T[6] + S7_WALK_AT), float(T[6] + S7_WALK_AT + T_W7)], 's7_walk_from': [0, 0, 10.25], 's7_walk_to': [0, 0, 5.15]} if P2 else {})), open(OUT + '/end_pose.json', 'w'), indent=1)
        for a_ in sys.argv:
            if a_.startswith('--shot-at='): tt = float(a_.split('=')[1]); render(min(len(TS) - 1, int(round(tt * FPS))), SW, SH_, 420).save(OUT + f'/shot_{tt:.2f}.png')
        if '--end-shot' in sys.argv: render(len(TS) - 1, SW, SH_, 420).save(OUT + '/end_frame.png')
    if '--render' in sys.argv:
        mids = [(T[k] + T[k + 1]) / 2 for k in range(7)]; mids[5] = T[6] - 0.05; mids[6] = T[7] - 1 / FPS
        tiles = [[render(int(round(t * FPS)), w, h) for (w, h) in SCREENS] for t in mids]
        Wt = sum(x.width for x in tiles[0]) + 56; sh_ = Image.new('RGB', (Wt + 160, 7 * 308 + 30), 'white'); d = ImageDraw.Draw(sh_); x = 160
        for j, (w, h) in enumerate(SCREENS): d.text((x, 8), f'{w}x{h}', fill='black'); x += tiles[0][j].width + 8
        for k, row in enumerate(tiles):
            d.text((6, 30 + k * 308 + 140), f'{SHOTS[k]}\nt={mids[k]:.2f}s', fill='black'); x = 160
            for im in row: sh_.paste(im, (x, 30 + k * 308)); x += im.width + 8
        sh_.save(OUT + '/contact_sheet_7shots_x_7screens.png')
        ts = np.arange(0, TOTAL, 1.0); strip = [render(int(round(t * FPS)), 390, 844, 260) for t in ts] + [render(len(TS) - 1, 390, 844, 260)]
        s2 = Image.new('RGB', (len(strip) * (strip[0].width + 4), 280), 'white'); d = ImageDraw.Draw(s2)
        for k, im in enumerate(strip): s2.paste(im, (k * (im.width + 4), 18)); d.text((k * (im.width + 4) + 2, 2), f't={(list(ts) + [TOTAL])[k]:.1f}', fill='black')
        s2.save(OUT + '/timeline_strip_390x844.png')
