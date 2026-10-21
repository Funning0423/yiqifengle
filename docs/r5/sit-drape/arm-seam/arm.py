# arm seam re-author: sit_down end -> exact sit_hold f0 arms, stand_up start from sit_hold arms -> mocap.
# eased local blend + 2-bone arm IK on a wrist path lifted along +Z (bump, 0 at both ends), pole = blended elbow, hand local = blended (delayed ease)
import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUTG = os.environ['OUTG']; C0 = float(os.environ.get('C0', .03)); CMAX = float(os.environ.get('CMAX', .10))
SD0, SD1 = int(os.environ.get('SD0', 22)), 36; SU1 = int(os.environ.get('SU1', 10))
PB = arm.pose.bones; MW = arm.matrix_world; ARMB = ('upper_arm', 'forearm', 'hand')
O = {o.name[8:]: o for o in CH_MESH}; body = O['BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]
HV = set(i for i, d in enumerate(D) if d.startswith(('hand.', 'forearm.'))); AV = HV | set(i for i, d in enumerate(D) if d.startswith('upper_arm.'))
def sm(u): u = min(1, max(0, u)); return u * u * u * (u * (6 * u - 15) + 10)
FR = {'sit_down': 36, 'sit_hold': 60, 'stand_up': 38}
def grab(c, f):
    setclip(c); sc.frame_set(f); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in PB}
HOLD = grab('sit_hold', 0)
ORIG = {c: [grab(c, f) for f in range(N + 1)] for c, N in FR.items()}
def wfun(c, f):
    if c == 'sit_down': return sm((f - SD0) / (SD1 - SD0))
    if c == 'stand_up': return 1 - sm(f / SU1)
    return 1.0
def morphs(c, f):
    t = f / 30
    for o in CH_MESH:
        sk = o.data.shape_keys
        if sk:
            for kb in sk.key_blocks[1:]: kb.value = interp(MC[c][kb.name], t) if kb.name in MC[c] else 0.0
def setroot(c, f):
    p = min(1, f / 30 / DUR[c]); w = p if c == 'sit_down' else (1 - p if c == 'stand_up' else 1)
    hc.location = bl([STAND[i] + (SEAT[i] - STAND[i]) * w for i in range(3)])
def setpose(P):
    for b in PB: b.location, b.rotation_quaternion, b.scale = P[b.name]
    bpy.context.view_layer.update()
def aim(pb, target):
    cur = (pb.tail - pb.head).normalized(); want = (target - pb.head).normalized()
    R = cur.rotation_difference(want).to_matrix().to_4x4(); M = pb.matrix.copy(); h = M.translation.copy(); M = R @ M; M.translation = h; pb.matrix = M; bpy.context.view_layer.update()
def build(c, f, C, lift=None):
    P = ORIG[c][f]; w = wfun(c, f)
    if w <= 0:
        arm.animation_data.action = None; setpose(P); return P, 0.0, 0.0
    Q = dict(P)
    for k in P:
        if k.startswith('skirt') and c == 'sit_down':
            qa, qb = P[k][1], HOLD[k][1]
            if qa.dot(qb) < 0: qb = -qb
            Q[k] = (P[k][0].lerp(HOLD[k][0], w), qa.slerp(qb, w), P[k][2])
        if k.startswith(ARMB):
            ww = w if not k.startswith('hand') else sm((w - .25) / .75) if w < 1 else 1.0   # hand (wrist/fingers) relaxes last
            qa, qb = P[k][1], HOLD[k][1]
            if qa.dot(qb) < 0: qb = -qb
            Q[k] = (P[k][0], qa.slerp(qb, ww), P[k][2])
    arm.animation_data.action = None; setpose(Q)
    if lift is None: lift = C * 4 * w * (1 - w)
    flare = 0.0
    if lift > 1e-5:
        inv = MW.inverted().to_3x3()
        for s in 'LR':
            ua, fa, ha = PB['upper_arm.' + s], PB['forearm.' + s], PB['hand.' + s]
            hq = ha.matrix.to_quaternion()
            K0 = fa.head.copy(); T = ha.head + inv @ Vector((0, 0, lift)); H = ua.head.copy()
            l1 = (fa.head - H).length; l2 = (ha.head - fa.head).length; d = min((T - H).length, l1 + l2 - 1e-5); ax = (T - H).normalized()
            pole = (K0 - H) - ax * (K0 - H).dot(ax); pole.normalize()
            a = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d); K = H + ax * (l1 * a) + pole * (l1 * math.sqrt(max(0, 1 - a * a)))
            d0 = (K0 - H).normalized(); aim(ua, K); aim(fa, T); flare = max(flare, math.degrees(d0.angle((K - H).normalized())))
            m = hq.to_matrix().to_4x4(); m.translation = ha.head.copy(); ha.matrix = m; bpy.context.view_layer.update()   # keep the blended hand orientation (no twist)
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in PB}, lift, flare
def hits():
    M = {n: wm(o) for n, o in O.items()}; bv, bt = M['BODY']
    bh = BVHTree.FromPolygons(bv, [t for t in bt if all(v in HV for v in t)]); bb = BVHTree.FromPolygons(bv, [t for t in bt if not any(v in AV for v in t)])
    n = len(bh.overlap(BVHTree.FromPolygons(*M['APRON']))) + len(bh.overlap(BVHTree.FromPolygons(*M['DRESS']))) + len(bh.overlap(bb))
    ap = BVHTree.FromPolygons(*M['APRON']); hv = [bv[i] for i in HV if D[i].startswith('hand.')]
    clr = {s: round(min(ap.find_nearest(bv[i], 1)[3] for i in HV if D[i] == 'hand.' + s) * 1000, 2) for s in 'LR'}
    return n, clr
out = {}; log = {}
def ev(c, f, L):
    setroot(c, f); morphs(c, f); P, l, fl = build(c, f, 0, L); n, clr = hits(); return P, l, fl, n, clr
for c, frames in (('sit_down', list(range(SD0, SD1 + 1))), ('stand_up', list(range(0, SU1 + 1)))):
    need = {}
    for f in frames:
        w = wfun(c, f)
        if w <= 0 or w >= 1: need[f] = 0.0; continue
        L = 0.0
        while ev(c, f, L)[3] and L < CMAX: L += .005
        need[f] = L
    # smooth envelope: running max over +-2 frames, then 3-tap smooth, plus 3 mm margin when >0; pinned 0 at w in {0,1}
    env = {f: max(need[g] for g in frames if abs(g - f) <= 2) for f in frames}
    sm3 = {f: (env.get(f - 1, env[f]) + 2 * env[f] + env.get(f + 1, env[f])) / 4 for f in frames}
    lift = {f: (0.0 if wfun(c, f) in (0.0, 1.0) else sm3[f] + (.003 if sm3[f] > 0 else 0)) for f in frames}
    res = [(f,) + ev(c, f, lift[f]) for f in frames]
    out[c] = {f: P for f, P, *_ in res}; log[c] = dict(need_mm={f: round(v * 1000, 1) for f, v in need.items()}, rows=[dict(f=f, w=round(wfun(c, f), 3), lift_mm=round(l * 1000, 1), elbow_dev_deg=round(fl, 2), hits=n, clear_mm=cl) for f, P, l, fl, n, cl in res])
    for r in log[c]['rows']: print('ROW', c, json.dumps(r), flush=True)
json.dump(log, open(OUTG + '.log.json', 'w'))
for c in ('sit_down', 'sit_hold', 'stand_up'):
    act = bpy.data.actions[c]; frames = [out.get(c, {}).get(f, ORIG[c][f]) for f in range(FR[c] + 1)]
    for fc in list(act.fcurves): act.fcurves.remove(fc)
    for bn in frames[0]:
        for path, j, n_ in (('location', 0, 3), ('rotation_quaternion', 1, 4), ('scale', 2, 3)):
            for i in range(n_):
                fc = act.fcurves.new(f'pose.bones["{bn}"].{path}', index=i, action_group=bn); fc.keyframe_points.add(len(frames))
                for f, fr in enumerate(frames): fc.keyframe_points[f].co = (f, fr[bn][j][i]); fc.keyframe_points[f].interpolation = 'LINEAR'
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
