# arm/leg seam v2: sit_down end -> exact sit_hold f0 (legs+skirt eased over a long window with ankle IK, arms eased with per-frame minimal lift that lands early);
# stand_up start = exact sit_hold f0 arms, hand_rest_support 1 -> 0 smoothstep (patched curve), cloth_waist_rise_seam ramp from 0, arms back to mocap with minimal lift.
import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUTG = os.environ['OUTG']; PATCH = os.environ['PATCH_OUT']
LEG0, ARM0, END = [int(x) for x in os.environ.get('SDWIN', '16,22,36').split(',')]; SU1 = int(os.environ.get('SU1', 10))
THS = [float(x) for x in os.environ.get('THS', '0.1667').split(',')]
CWRS_T = float(os.environ.get('CWRS_T', 0.1333))
MC['sit_down']['cloth_envelope_sit_down_8'] = [[0.0, 0.0], [1.2, 0.0]]   # patched: end at the sit_hold value (0) so the seam morph state matches; CWRS_T = float(os.environ.get('CWRS_T', 0.1333))
PB = arm.pose.bones; MW = arm.matrix_world; ARMB = ('upper_arm', 'forearm', 'hand'); LEGB = ('thigh', 'shin', 'foot')
O = {o.name[8:]: o for o in CH_MESH}; body = O['BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]
HV = set(i for i, d in enumerate(D) if d.startswith(('hand.', 'forearm.'))); AV = HV | set(i for i, d in enumerate(D) if d.startswith('upper_arm.'))
FV = {s: [i for i, d in enumerate(D) if d == 'foot.' + s] for s in 'LR'}
def sm(u): u = min(1, max(0, u)); return u * u * u * (u * (6 * u - 15) + 10)
def ss(u): u = min(1, max(0, u)); return u * u * (3 - 2 * u)
FR = {'sit_down': 36, 'sit_hold': 60, 'stand_up': 38}
def grab(c, f):
    setclip(c); sc.frame_set(f); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in PB}
ORIG = {c: [grab(c, f) for f in range(N + 1)] for c, N in FR.items()}; OLDHOLD = ORIG['sit_hold'][0]; HOLD = ORIG['sit_down'][36]
BREATH = ('spine', 'chest', 'neck', 'head')
def holdframe(f):   # sit_down f36 full pose + the old sit_hold's own idle delta on spine/chest/neck/head
    Q = dict(HOLD)
    for k in HOLD:
        if k.startswith(BREATH):
            dl = ORIG['sit_hold'][f][k][0] - OLDHOLD[k][0]
            Q[k] = (HOLD[k][0] + dl, HOLD[k][1] @ (OLDHOLD[k][1].inverted() @ ORIG['sit_hold'][f][k][1]), HOLD[k][2])
    return Q
BRD = max(math.degrees(2 * math.acos(min(1, abs(OLDHOLD[k][1].dot(ORIG['sit_hold'][f][k][1]))))) for f in range(61) for k in OLDHOLD if k.startswith(BREATH))
BRA = max(math.degrees(2 * math.acos(min(1, abs(OLDHOLD[k][1].dot(ORIG['sit_hold'][f][k][1]))))) for f in range(61) for k in OLDHOLD if not k.startswith(BREATH))
print('BREATH max deg spine/chest/neck/head', round(BRD, 3), 'other bones', round(BRA, 3), flush=True)
def ssamp(t0, t1, a, b, n=None):   # smoothstep a->b sampled at 30 fps keys (runtime interpolates linearly)
    n = n or max(2, round((t1 - t0) * 30)); return [[round(t0 + (t1 - t0) * i / n, 6), round(a + (b - a) * ss(i / n), 6)] for i in range(n + 1)]
def setmorph(c, f):
    t = f / 30
    for o in CH_MESH:
        sk = o.data.shape_keys
        if sk:
            for kb in sk.key_blocks[1:]: kb.value = interp(MC[c][kb.name], t) if kb.name in MC[c] else 0.0
def setroot(c, f):
    p = min(1, f / 30 / DUR[c]); w = p if c == 'sit_down' else (1 - p if c == 'stand_up' else 1)
    hc.location = bl([STAND[i] + (SEAT[i] - STAND[i]) * w for i in range(3)])
def setpose(P):
    arm.animation_data.action = None
    for b in PB: b.location, b.rotation_quaternion, b.scale = P[b.name]
    bpy.context.view_layer.update()
def snap(): return {b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in PB}
def aim(pb, target):
    cur = (pb.tail - pb.head).normalized(); want = (target - pb.head).normalized()
    R = cur.rotation_difference(want).to_matrix().to_4x4(); M = pb.matrix.copy(); h = M.translation.copy(); M = R @ M; M.translation = h; pb.matrix = M; bpy.context.view_layer.update()
def ik2(b1, b2, b3, T, K0):
    H = b1.head.copy(); l1 = (b2.head - H).length; l2 = (b3.head - b2.head).length; d = min((T - H).length, l1 + l2 - 1e-5); ax = (T - H).normalized()
    pole = (K0 - H) - ax * (K0 - H).dot(ax); pole.normalize(); a = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    K = H + ax * (l1 * a) + pole * (l1 * math.sqrt(max(0, 1 - a * a))); q3 = b3.matrix.copy(); aim(b1, K); aim(b2, T); q3.translation = b3.head.copy(); b3.matrix = q3; bpy.context.view_layer.update()
    return math.degrees((K0 - H).normalized().angle((K - H).normalized()))
def slq(a, b, w): return a.slerp(b if a.dot(b) >= 0 else -b, w)
# ankle targets (armature space) from original frames and hold
def heads(P, names): setpose(P); return {n: PB[n].head.copy() for n in names}
HOLDF = heads(HOLD, ['foot.L', 'foot.R'])
def pose_sd(f, L):
    P = ORIG['sit_down'][f]; wL = sm((f - LEG0) / (END - LEG0)); wA = sm((f - ARM0) / (END - ARM0))
    if f >= END: setpose(HOLD); return snap(), 0, 0
    Q = dict(P)
    for k in P:
        if k.startswith(ARMB):
            ww = wA if not k.startswith('hand') else sm((wA - .25) / .75)
            Q[k] = (P[k][0], slq(P[k][1], HOLD[k][1], ww), P[k][2])
        elif not k.startswith(('hips', 'root')):
            Q[k] = (P[k][0].lerp(HOLD[k][0], wL), slq(P[k][1], HOLD[k][1], wL), P[k][2].lerp(HOLD[k][2], wL))
    of = heads(P, ['foot.L', 'foot.R']); setpose(Q)
    for s in 'LR':   # pin ankle: original-frame ankle position eased to the hold ankle position (same weight), knee pole from the blended pose
        if wL > 0: ik2(PB['thigh.' + s], PB['shin.' + s], PB['foot.' + s], of['foot.' + s].lerp(HOLDF['foot.' + s], wL), PB['shin.' + s].head.copy())
    return armik(L), wL, wA
def armik(L):
    fl = 0.0
    if L > 1e-5:
        inv = MW.inverted().to_3x3()
        for s in 'LR': fl = max(fl, ik2(PB['upper_arm.' + s], PB['forearm.' + s], PB['hand.' + s], PB['hand.' + s].head + inv @ Vector((0, 0, L)), PB['forearm.' + s].head.copy()))
    return snap() if L <= 1e-5 else (snap(), fl)
SU0F = None; SUL = int(os.environ.get('SUL', 6))
def pose_su(f, L):
    global SU0F
    P = ORIG['stand_up'][f]; w = 1 - sm(f / SU1); wL = 1 - sm(f / SUL)
    if f == 0: setpose(HOLD); return snap(), w
    if SU0F is None:
        setpose(ORIG['stand_up'][0]); SU0F = {n: (PB['foot.' + n].head.copy(), PB['foot.' + n].tail.copy()) for n in 'LR'}
        setpose(HOLD); globals()['HF'] = {n: (PB['foot.' + n].head.copy(), PB['foot.' + n].tail.copy()) for n in 'LR'}
    setpose(P); of = {n: (PB['foot.' + n].head.copy(), PB['foot.' + n].tail.copy()) for n in 'LR'}
    Q = dict(P)
    for k in P:
        if k.startswith(ARMB):
            ww = w if not k.startswith('hand') else 1 - sm(min(1, (1 - w) / .75))
            Q[k] = (P[k][0], slq(P[k][1], HOLD[k][1], ww), P[k][2])
        elif not k.startswith('root'):
            Q[k] = (P[k][0].lerp(HOLD[k][0], wL), slq(P[k][1], HOLD[k][1], wL), P[k][2].lerp(HOLD[k][2], wL))
    setpose(Q)
    if wL > 0:
        for n in 'LR':
            A = of[n][0] + (HF[n][0] - SU0F[n][0]) * wL; T = of[n][1] + (HF[n][1] - SU0F[n][1]) * wL
            ik2(PB['thigh.' + n], PB['shin.' + n], PB['foot.' + n], A, PB['shin.' + n].head.copy())
            aim(PB['foot.' + n], T)
    r = armik(L); return (r if isinstance(r, dict) else r[0]), w
def hits():
    M = {n: wm(o) for n, o in O.items()}; bv, bt = M['BODY']
    bh = BVHTree.FromPolygons(bv, [t for t in bt if all(v in HV for v in t)]); bb = BVHTree.FromPolygons(bv, [t for t in bt if not any(v in AV for v in t)])
    ap = BVHTree.FromPolygons(*M['APRON']); dr = BVHTree.FromPolygons(*M['DRESS'])
    n = dict(apron=len(bh.overlap(ap)), dress=len(bh.overlap(dr)), body=len(bh.overlap(bb)))
    clr = {s: round(min(min(ap.find_nearest(bv[i], 1)[3] if ap.find_nearest(bv[i], 1)[0] else 9, dr.find_nearest(bv[i], 1)[3] if dr.find_nearest(bv[i], 1)[0] else 9) for i in HV if D[i] == 'hand.' + s) * 1000, 2) for s in 'LR'}
    foot = {s: [round(x, 5) for x in min((bv[i] for i in FV[s]), key=lambda v: v.z)] for s in 'LR'}
    return sum(n.values()), n, clr, foot
def wrist():
    return {s: (MW @ PB['hand.' + s].head).copy() for s in 'LR'}
def ev(c, f, L):
    setroot(c, f); setmorph(c, f)
    r = pose_sd(f, L) if c == 'sit_down' else pose_su(f, L)
    P = r[0] if isinstance(r[0], dict) else r[0][0]
    h = hits(); return P, h, wrist()
def need(c, f, step=.002, cap=.12):
    L = 0.0
    while ev(c, f, L)[1][0] and L < cap: L += step
    return L
def shape(need_d, frames, land, R=3, m=.002):
    M = {g: (need_d[g] + m if need_d[g] > 0 else 0) for g in frames}
    return {f: max([0] + [M[g] * math.cos(math.pi * (f - g) / (2 * (R + 1))) ** 2 for g in frames if abs(f - g) <= R]) for f in frames}
LOG = {}; OUT = {}
for o in CH_MESH:
    sk = o.data.shape_keys
    if sk:
        for nm in ('cloth_waist_rise_seam', 'cloth_envelope_sit_down_8', 'hand_rest_support'):
            if nm in sk.key_blocks:
                kb = sk.key_blocks[nm]; rb = kb.relative_key; print('KEYDISP', o.name, nm, round(max((a.co - b.co).length for a, b in zip(kb.data, rb.data)) * 1000, 2), 'mm', flush=True)
MC['stand_up']['hand_rest_support'] = [[0.0, 1], [0.03334, 0.896], [0.06668, 0.648], [0.10002, 0.352], [0.13336, 0.104], [0.1667, 0], [1.266667, 0.0]]
MC['stand_up']['cloth_waist_rise_seam'] = [[0.0, 0.0], [0.033325, 0.15625], [0.06665, 0.5], [0.099975, 0.84375], [0.1333, 1], [0.8667, 0.0], [1.2667, 0.0]]
patch = {'sit_down': {'cloth_envelope_sit_down_8': MC['sit_down']['cloth_envelope_sit_down_8']}, 'stand_up': {k: MC['stand_up'][k] for k in ('hand_rest_support', 'cloth_waist_rise_seam')}}
json.dump(patch, open(PATCH, 'w'), indent=1); TH = 0.1667
OUT['sit_hold'] = {f: holdframe(f) for f in range(61)}
for f in (0, 30, 60):
    setroot('sit_hold', f); setmorph('sit_hold', f); setpose(OUT['sit_hold'][f]); h = hits(); print('HOLD', f, h[1], h[2], flush=True)
frames = list(range(0, SU1 + 1)); nd = {f: (0.0 if f == 0 else need('stand_up', f)) for f in frames}; Ls = shape(nd, frames, None); Ls[0] = 0
rows = []
for f in frames:
    P, h, wr = ev('stand_up', f, Ls[f]); OUT.setdefault('stand_up', {})[f] = P; rows.append(dict(f=f, lift_mm=round(Ls[f] * 1000, 1), need_mm=round(nd[f] * 1000, 1), hits=h[1], clear_mm=h[2]))
    print('ROW stand_up', json.dumps(rows[-1]), flush=True)
LOG['stand_up'] = rows
LOG['TH'] = TH; LOG['patch'] = patch
json.dump(LOG, open(OUTG + '.log.json', 'w'))
for c in ('sit_down', 'sit_hold', 'stand_up'):
    act = bpy.data.actions[c]; frames = [OUT.get(c, {}).get(f, ORIG[c][f]) for f in range(FR[c] + 1)]
    for fc in list(act.fcurves): act.fcurves.remove(fc)
    for bn in frames[0]:
        for path, j, n_ in (('location', 0, 3), ('rotation_quaternion', 1, 4), ('scale', 2, 3)):
            for i in range(n_):
                fc = act.fcurves.new(f'pose.bones["{bn}"].{path}', index=i, action_group=bn); fc.keyframe_points.add(len(frames))
                for f, fr_ in enumerate(frames): fc.keyframe_points[f].co = (f, fr_[bn][j][i]); fc.keyframe_points[f].interpolation = 'LINEAR'
                fc.update()
for x in list(bpy.data.actions):
    if x.name not in FR: bpy.data.actions.remove(x)
setclip('sit_hold'); hc.location = (0, 0, 0); hc.rotation_euler = (0, 0, 0)
for o in list(bpy.data.objects):
    if o not in chobjs and o.name != 'chr_holder': bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in chobjs: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUTG, export_format='GLB', use_selection=True, export_tangents=False, export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=False, export_def_bones=False, export_skins=True, export_morph=False, export_extras=False)
