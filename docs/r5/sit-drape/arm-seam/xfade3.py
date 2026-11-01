# runtime crossfade sim (CharacterMotion: CROSSFADE_S 0.2, outgoing weight 1-fadeT/fadeS, per-joint lerp loc/scale + slerp rot, morph weights blended the same)
import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUTD = os.environ['ROUT']; os.makedirs(OUTD, exist_ok=True); PB = arm.pose.bones
O = {o.name[8:]: o for o in CH_MESH}; body = O['BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]; HV = set(i for i, d in enumerate(D) if d.startswith(('hand.', 'forearm.'))); AV = HV | set(i for i, d in enumerate(D) if d.startswith('upper_arm.'))
def pose(c, t):
    setclip(c); sc.frame_set(int(t * 30), subframe=t * 30 - int(t * 30)); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in PB}
def wts(c, t): return {k: interp(v, t) for k, v in MC[c].items()}
def apply(P, W, rootw):
    arm.animation_data.action = None
    for b in PB: b.location, b.rotation_quaternion, b.scale = P[b.name]
    hc.location = bl([STAND[i] + (SEAT[i] - STAND[i]) * rootw for i in range(3)])
    for o in CH_MESH:
        sk = o.data.shape_keys
        if sk:
            for kb in sk.key_blocks[1:]: kb.value = min(1, max(0, W.get(kb.name, 0.0)))
    bpy.context.view_layer.update()
def blend(Po, Pi, fo):
    R = {}
    for k in Pi:
        qo, qi = Po[k][1], Pi[k][1]
        if qo.dot(qi) < 0: qo = -qo
        R[k] = (Pi[k][0].lerp(Po[k][0], fo), qi.slerp(qo, fo), Pi[k][2].lerp(Po[k][2], fo))
    return R
seq = []
for f in range(30, 37): seq.append(('A', f'sd{f:02d}', pose('sit_down', f / 30), None, 0, wts('sit_down', f / 30), None, f / 36))
for k in range(0, 10):
    fo = max(0, 1 - k / 6); seq.append(('A', f'xA{k:02d}_fo{fo:.2f}', pose('sit_down', 1.2), pose('sit_hold', k / 30), fo, wts('sit_down', 1.2), wts('sit_hold', k / 30), 1))
for k in range(0, 14):
    t = k / 30; fo = max(0, 1 - k / 6); seq.append(('B', f'xB{k:02d}_fo{fo:.2f}', pose('sit_hold', t), pose('stand_up', t), fo, wts('sit_hold', t), wts('stand_up', t), 1 - min(1, t / 1.266667)))
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'OBJECT'; sh.show_cavity = True
for o in bpy.data.objects:
    if o.type == 'MESH': o.color = (0.82, 0.80, 0.74, 1)
for n, col in (('DRESS', (0.95, 0.85, 0.25, 1)), ('APRON', (0.97, 0.97, 0.95, 1)), ('BOW', (0.6, 0.9, 1, 1)), ('BODY', (0.85, 0.72, 0.62, 1))): O[n].color = col
STOOL_MESH[0].color = (0.45, 0.33, 0.22, 1)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.clip_start = .01
walls = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(('env_interior_shell', 'env_island', 'env_lighthouse', 'env_rear', 'env_interior_props'))]
def shot(fn, loc, look, fov, W, H, hide=()):
    for o in hide: o.hide_render = True
    cam.location = loc; cam.rotation_euler = (look - loc).to_track_quat('-Z', 'Y').to_euler(); cd.angle = math.radians(fov)
    sc.render.resolution_x, sc.render.resolution_y = W, H; sc.render.filepath = OUTD + '/' + fn + '.png'; bpy.ops.render.render(write_still=True)
    for o in hide: o.hide_render = False
def bdiff(A, B):
    r = (0, 0, '')
    for k in A:
        a = math.degrees(2 * math.acos(min(1, abs(A[k][1].dot(B[k][1]))))); l = (A[k][0] - B[k][0]).length * 1000
        if a + l > r[0] + r[1]: r = (round(a, 3), round(l, 3), k)
    return r
SEAM = dict(A=bdiff(pose('sit_down', 1.2), pose('sit_hold', 0)), B=bdiff(pose('sit_hold', 0), pose('stand_up', 0)))
WA = wts('sit_down', 1.2); WH = wts('sit_hold', 0); WB = wts('stand_up', 0)
SEAM['morphA'] = max([(round(abs(WA.get(k, 0) - WH.get(k, 0)), 3), k) for k in set(WA) | set(WH)]); SEAM['morphB'] = max([(round(abs(WB.get(k, 0) - WH.get(k, 0)), 3), k) for k in set(WB) | set(WH)])
print('SEAM', SEAM, flush=True); json.dump(SEAM, open(OUTD + '/seam.json', 'w'))
log = []; prev = None
for i, (g, name, Po, Pi, fo, Wo, Wi, rw) in enumerate(seq):
    P = Po if Pi is None else blend(Po, Pi, fo)
    W = Wo if Wi is None else {k: Wi.get(k, 0) * (1 - fo) + Wo.get(k, 0) * fo for k in set(Wo) | set(Wi)}
    apply(P, W, rw)
    bv, bt = wm(body); bh = BVHTree.FromPolygons(bv, [t for t in bt if all(v in HV for v in t)])
    bb = BVHTree.FromPolygons(bv, [t for t in bt if not any(v in AV for v in t)]); n = sum(len(bh.overlap(BVHTree.FromPolygons(*wm(O[m])))) for m in ('APRON', 'DRESS')) + len(bh.overlap(bb))
    hp = {s: (arm.matrix_world @ PB['hand.' + s].head) for s in 'LR'}
    step = {s: round((hp[s] - prev[s]).length * 1000, 1) for s in 'LR'} if prev is not None else {'L': 0, 'R': 0}; prev = hp
    log.append(dict(i=i, name=name, handXcloth=n, hand_step_mm=step, hand_rest_support=round(W.get('hand_rest_support', 0), 2), cloth_waist_rise_seam=round(W.get('cloth_waist_rise_seam', 0), 2)))
    print('XF', json.dumps(log[-1]), flush=True)
    shot(f'{i:02d}_{name}_game', bl([-1.32022071, 1.38613379, -2.11374307]), bl([0.04, 1.22, -4.45]), 75, 375, 812)
    hm = (hp['L'] + hp['R']) / 2; shot(f'{i:02d}_{name}_hands', hm + Vector((math.cos(YAW), math.sin(YAW), 0)) * 0.7 + Vector((0, 0, 0.1)), hm, 35, 480, 480, hide=walls)
json.dump(log, open(OUTD + '/xfade.json', 'w'), indent=1)
