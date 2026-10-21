# pelvis lift (+LIFT mm, eased) on sit_down end / sit_hold / stand_up start, seam blend to sit_hold f0, 2-bone leg IK keeps ankles+feet
import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
LIFT = float(os.environ.get('LIFT', 11)) / 1000; OUTG = os.environ['OUTG']; ZSET = None
FR = {'sit_down': 36, 'sit_hold': 60, 'stand_up': 38}; PB = arm.pose.bones; MW = arm.matrix_world
def ss(x, a, b): u = min(1, max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u)
def grab(c, f):
    setclip(c); sc.frame_set(f); bpy.context.view_layer.update()
    return {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in PB}, (MW @ PB['hips'].head).z
HOLD, ZSET = grab('sit_hold', 0)
SEAMW = {'sit_down': (lambda f: ss(f, 27, 36)) if os.environ.get('SEAMSD', '0') == '1' else (lambda f: 0.0), 'sit_hold': lambda f: 1.0, 'stand_up': lambda f: 1 - ss(f, 0, 9)}
def lift_of(c, f, z0):
    if c == 'sit_hold': return LIFT
    if c == 'sit_down':
        fill = max(0, ZSET + .0006 - z0) * ss(f, 22, 26) * (1 - ss(f, 33, 36))   # remove the settle undershoot (body dips into the seat f27-33)
        return LIFT * ss(f, 15, 27) + fill
    return LIFT * (1 - ss(f, 3, 12))
def setpose(P):
    for b in PB: b.rotation_quaternion, b.location = P[b.name][0], P[b.name][1]
    bpy.context.view_layer.update()
def aim(pb, target):
    cur = (pb.tail - pb.head).normalized(); want = (target - pb.head).normalized()
    R = cur.rotation_difference(want).to_matrix().to_4x4(); M = pb.matrix.copy(); h = M.translation.copy()
    M = R @ M; M.translation = h; pb.matrix = M; bpy.context.view_layer.update()
out = {}; log = {}
for c, N in FR.items():
    frames = []; lg = []
    for f in range(N + 1):
        P, z0 = grab(c, f); w = SEAMW[c](f)
        tgt0 = {s: (PB['foot.' + s].head.copy(), PB['foot.' + s].matrix.copy()) for s in 'LR'}   # planted feet from the ORIGINAL clip pose
        ARMB = ('upper_arm', 'forearm', 'hand', 'shoulder', 'f_', 'thumb', 'finger')
        Q = {k: (P[k] if k.startswith(ARMB) else (P[k][0].slerp(HOLD[k][0] if P[k][0].dot(HOLD[k][0]) >= 0 else -HOLD[k][0], w), P[k][1].lerp(HOLD[k][1], w))) for k in P}
        setpose(Q)
        tgt = {s: (tgt0[s][0], tgt0[s][1], PB['shin.' + s].head.copy()) for s in 'LR'}
        zb = PB['hips'].head.z  # armature space (armature object unscaled/unrotated within holder; Z up)
        L = lift_of(c, f, (MW @ PB['hips'].head).z)
        M = PB['hips'].matrix.copy(); M.translation.z += L / MW.to_scale()[2]; PB['hips'].matrix = M; bpy.context.view_layer.update()
        for s in 'LR':
            T, FM, K0 = tgt[s]; th, sh = PB['thigh.' + s], PB['shin.' + s]
            H = th.head.copy(); l1 = (sh.head - th.head).length; l2 = (PB['foot.' + s].head - sh.head).length
            d = min((T - H).length, l1 + l2 - 1e-5); ax = (T - H).normalized()
            pole = (K0 - H) - ax * (K0 - H).dot(ax); pole.normalize()
            a = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d); K = H + ax * (l1 * a) + pole * (l1 * math.sqrt(max(0, 1 - a * a)))
            aim(th, K); aim(sh, T)
            fm = FM.copy(); fm.translation = PB['foot.' + s].head.copy(); PB['foot.' + s].matrix = fm; bpy.context.view_layer.update()
        frames.append({b.name: (tuple(b.rotation_quaternion), tuple(b.location)) for b in PB}); lg.append(round(L * 1000, 2))
    out[c] = frames; log[c] = lg; print('LIFT', c, lg)
json.dump(log, open(OUTG + '.lift.json', 'w'))
# write dense actions
for c, frames in out.items():
    act = bpy.data.actions[c]
    for fc in list(act.fcurves): act.fcurves.remove(fc)
    for bn in frames[0]:
        for path, j, n_ in (('rotation_quaternion', 0, 4), ('location', 1, 3)):
            for i in range(n_):
                fc = act.fcurves.new(f'pose.bones["{bn}"].{path}', index=i, action_group=bn)
                fc.keyframe_points.add(len(frames))
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
