# CMU 143_16 (BVH, una-dinosauria/cmu-mocap mirror) -> R5G2 A1 v4 final rig: get out of balloon basket (exit along -Y)
import bpy, math, json, os, sys, numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.environ.get('OUT', HERE)
TGT = '/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb'
BASKET = '/workspace/yiqifengle/work/fx-b11/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'
SRC = HERE + '/src/143_16.bvh'
T0, T1, SLOW = float(os.environ.get('T0', .45)), float(os.environ.get('T1', 2.45)), float(os.environ.get('SLOW', 1.4))
NB0, NB1 = 15, 12          # start blend idle->mocap, end blend mocap->walk_start f0 (frames @30)
RIM_FWD = 0.80             # rim inner plane distance from basket centre along exit dir
RENDER = os.environ.get('RENDER', '1') == '1'
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=TGT)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; PB = arm.pose.bones
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('LOD0')]
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name == 'Icosphere': o.hide_render = True; o.hide_set(True)
if arm.animation_data:
    for t in arm.animation_data.nla_tracks: t.mute = True
def setact(n):
    a = bpy.data.actions[n]; arm.animation_data.action = a
    try: arm.animation_data.action_slot = a.slots[0]
    except Exception: pass
def localpose(clip, f):
    setact(clip); sc.frame_set(f); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in PB}
IDLE = localpose('idle_breathing_loop', 0); WS0 = localpose('walk_start', 0)
d_iw = max(max((IDLE[k][0] - WS0[k][0]).length, IDLE[k][1].rotation_difference(WS0[k][1]).angle) for k in IDLE)
print('IDLEvsWS0 maxdiff', d_iw)
arm.animation_data.action = None
# ---- source
bpy.ops.import_anim.bvh(filepath=SRC, global_scale=1.0, axis_forward='-Z', axis_up='Y', update_scene_fps=False)
src = bpy.context.object; SB = src.pose.bones; bpy.context.view_layer.update()
def srest(n): return src.matrix_world @ src.data.bones[n].head_local
left = srest('LeftUpLeg') - srest('RightUpLeg'); fac = left.cross(Vector((0, 0, 1))); fac.z = 0
ang = math.atan2(fac.x, -fac.y)  # angle from -Y
src.rotation_euler = (src.rotation_euler.x, src.rotation_euler.y, src.rotation_euler.z + ang); bpy.context.view_layer.update()
left = srest('LeftUpLeg') - srest('RightUpLeg'); print('SRC rest facing', left.cross(Vector((0, 0, 1))).normalized())
def sfr(t): sc.frame_set(1 + int(t * 120), subframe=(t * 120) % 1); bpy.context.view_layer.update()
def sj(n): return src.matrix_world @ SB[n].head
def sq(n): return (src.matrix_world @ SB[n].matrix).to_quaternion()
SQR = {b.name: (src.matrix_world @ b.matrix_local).to_quaternion() for b in src.data.bones}
# mapping: her right = .L
M = [('hips', 'Hips', None, None), ('spine', 'Spine', 'Spine', 'Spine1'), ('chest', 'Spine1', 'Spine1', 'Neck'), ('neck', 'Neck', 'Neck', 'Head'), ('head', 'Head', None, None)]
for t, s in (('L', 'Right'), ('R', 'Left')):
    M += [('upper_arm.' + t, s + 'Arm', s + 'Arm', s + 'ForeArm'), ('forearm.' + t, s + 'ForeArm', s + 'ForeArm', s + 'Hand'), ('hand.' + t, s + 'Hand', s + 'Hand', s + 'FingerBase'),
          ('thigh.' + t, s + 'UpLeg', s + 'UpLeg', s + 'Leg'), ('shin.' + t, s + 'Leg', s + 'Leg', s + 'Foot'), ('foot.' + t, s + 'Foot', None, None)]
srcRestDir = {}; sfr(-1 / 120)  # frame 0 = rest? use bone rest instead
for tb, sb, a, b in M:
    if a: srcRestDir[tb] = (src.matrix_world @ src.data.bones[b].head_local - src.matrix_world @ src.data.bones[a].head_local).normalized()
TQR = {b.name: (arm.matrix_world @ b.matrix_local).to_quaternion() for b in arm.data.bones}
TRD = {b.name: (arm.matrix_world.to_3x3() @ (b.tail_local - b.head_local)).normalized() for b in arm.data.bones}
FAC = Vector((0, -1, 0))
BADF = [0]
def F(d, f):
    x = d.normalized(); y = (f - f.dot(x) * x)
    if d.length < 1e-6 or y.length < 1e-3:
        BADF[0] += 1; y = Vector((0, 0, 1)) - x.z * x
    y.normalize(); z = x.cross(y); return Matrix((x, y, z)).transposed()
# leg length scale
tl = (Vector(arm.data.bones['thigh.L'].head_local) - Vector(arm.data.bones['shin.L'].head_local)).length + (Vector(arm.data.bones['shin.L'].head_local) - Vector(arm.data.bones['foot.L'].head_local)).length
sl = (srest('RightUpLeg') - srest('RightLeg')).length + (srest('RightLeg') - srest('RightFoot')).length
SCALE = tl / sl; print('SCALE', SCALE)
# heading + obstacle from source
sfr(T0); h0 = sj('Hips').copy(); sfr(T1); h1 = sj('Hips').copy(); w = (h1 - h0); w.z = 0; w.normalize()
yaw = math.atan2(w.x, -w.y); RY = Matrix.Rotation(-yaw, 4, 'Z')  # maps heading -> -Y
def fw(p): return -(RY @ p).y
peaks = {}
for s in ('LeftToeBase', 'RightToeBase'):
    best = (-1, 0)
    for i in range(int(T0 * 120), int(T1 * 120)):
        sfr(i / 120); p = sj(s)
        if p.z > best[0]: best = (p.z, fw(p))
    peaks[s] = best
obst_fw = sum(v[1] for v in peaks.values()) / 2; print('PEAKS', peaks, 'obst_fw', obst_fw)
# world placement: target = RY*(src - ref)*SCALE + off ; obstacle -> forward RIM_FWD
def place(p, zoff):
    q = RY @ p; v = Vector((q.x - (RY @ h0).x, q.y + obst_fw, q.z)) * SCALE
    return Vector((v.x, v.y - RIM_FWD, v.z + zoff))
ORDER = [m[0] for m in M]
RQ = RY.to_quaternion()
def mocap_pose(t, zoff):
    sfr(t)
    for tb, sb, a, b in M:
        dq = sq(sb) @ SQR[sb].inverted()
        if a:
            dpose = (sj(b) - sj(a)); dpose = RQ @ dpose
            fpose = RQ @ (dq @ (SQR[sb].inverted() @ SQR[sb]) @ Vector((0, 0, 0)) + dq @ (FAC.copy()))  # transported rest facing
            # source rest facing is -Y after the facing rotation; transport through the bone delta
            R = F(dpose, fpose) @ F(TRD[tb], FAC).transposed() @ TQR[tb].to_matrix()
        else:
            R = (RQ @ dq).to_matrix() @ TQR[tb].to_matrix()
        pb = PB[tb]
        if tb == 'hips': head = place(sj('Hips'), zoff) + Vector((0, 0, 0))
        else: head = arm.matrix_world.inverted() @ (arm.matrix_world @ pb.head)
        pb.matrix = Matrix.Translation(head) @ R.to_quaternion().normalized().to_matrix().to_4x4(); bpy.context.view_layer.update(); pb.scale = (1, 1, 1); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in PB}
# body / foot verts
body = [o for o in meshes if o.name == 'LOD0_G2_BODY'][0]; gi = {g.index: g.name for g in body.vertex_groups}
def vg(o, names):
    g = {x.index: x.name for x in o.vertex_groups}
    return [v.index for v in o.data.vertices if v.groups and g[max(v.groups, key=lambda q: q.weight).group] in names]
FVI = {sd: vg(body, ('foot.' + sd,)) for sd in 'LR'}
LEGV = vg(body, ('thigh.L', 'thigh.R', 'shin.L', 'shin.R'))
def evalv(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh(); Mw = oe.matrix_world
    V = np.array([tuple(Mw @ v.co) for v in me.vertices]); P = [tuple(p.vertices) for p in me.polygons]; oe.to_mesh_clear(); return V, P
def apply(P):
    for b in PB:
        if b.name in P: b.location, b.rotation_quaternion = P[b.name]
        b.scale = (1, 1, 1)
    bpy.context.view_layer.update()

def plant(toe, lo, hi):
    prev = None
    for i in range(int(lo * 120), int(hi * 120)):
        sfr(i / 120); p = sj(toe).copy(); p.z = 0
        if prev is not None and (p - prev).length * 120 < 5.0: return i / 120
        prev = p
    return hi
T0 = plant('RightToeBase', 0.40, 0.70); TE = plant('LeftToeBase', 1.60, 1.95); print('PLANTS', T0, TE)
NBA, NBB = 6, 6
NM = int(round((TE - T0) * SLOW * 30)) + NBB
MOC = [mocap_pose(T0 + k / 30 / SLOW, 0.0) for k in range(NM + 1)]
def soles(P):
    apply(P); V, _ = evalv(body); return {sd: V[FVI[sd]] for sd in 'LR'}
def hipsW(P):
    apply(P); return (arm.matrix_world @ PB['hips'].matrix).copy()
def shift(P, d):
    apply(P); m = (arm.matrix_world @ PB['hips'].matrix).copy(); m.translation += d
    PB['hips'].matrix = arm.matrix_world.inverted() @ m; bpy.context.view_layer.update(); PB['hips'].scale = (1, 1, 1); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in PB}
def footc(P, sd):  # centroid of lowest foot verts (xy)
    S = soles(P)[sd]; lo = S[S[:, 2] < S[:, 2].min() + 0.02]; return Vector((lo[:, 0].mean(), lo[:, 1].mean(), 0))
# mocap root height correction: lowest sole -> 0 (smoothed)
mins = np.array([min(v[:, 2].min() for v in soles(P).values()) for P in MOC]); ker = np.ones(5) / 5
corr = np.convolve(np.pad(mins, 2, mode='edge'), ker, mode='valid'); print('ROOTCORR mm', np.round(corr * 1000, 0).tolist())
MOC = [shift(P, Vector((0, 0, -float(c)))) for P, c in zip(MOC, corr)]
ZOFF = float(-corr.mean())
# walk_start segment: .R planted -> root advances so it stays fixed
FW = 21
WSP = [localpose('walk_start', f) for f in range(0, FW + NBA)]; arm.animation_data.action = None
c0 = footc(WSP[0], 'R'); WSS = []
for f, P in enumerate(WSP):
    d = c0 - footc(P, 'R') if f <= FW else WSS_d
    if f == FW: WSS_d = d
    WSS.append((P, d))
lW = footc(shift(WSS[FW][0], WSS[FW][1]), 'L'); lM = footc(MOC[0], 'L'); base0 = lM - lW
WSS = [shift(P, d + base0) for P, d in WSS]
# walk_stop_bodyL: .R planted
ke = NM - NBB
STP = [localpose('walk_stop_bodyL', f) for f in range(0, 45)]; arm.animation_data.action = None
r0 = footc(STP[0], 'R'); rM = footc(MOC[ke], 'R'); STS = []; dl = None
for f, P in enumerate(STP):
    if f <= 30: dl = r0 - footc(P, 'R')
    else:
        if f == 31: l30 = footc(STP[30], 'L'); dl30 = dl
        dl = dl30 + (l30 - footc(P, 'L'))
    STS.append(shift(P, dl + (rM - r0)))
endroot = dl + (rM - r0)
WS_E = shift(WS0, endroot)
def blend(A, B, w):
    R = {}
    for k in A:
        qa, qb = A[k][1], B[k][1]
        if qa.dot(qb) < 0: qb = -qb
        R[k] = (A[k][0].lerp(B[k][0], w), qa.slerp(qb, w))
    return R
ss = lambda x: x * x * (3 - 2 * x)
SKIRT = [b.name for b in PB if b.name.startswith('skirt')]
FR = []
for f in range(FW): FR.append(('walk_start', WSS[f]))
for k in range(NBA): FR.append(('xfade_in', blend(WSS[FW + k], MOC[k], ss((k + 1) / (NBA + 1)))))
for k in range(NBA, ke): FR.append(('mocap', MOC[k]))
for k in range(NBB): FR.append(('xfade_out', blend(MOC[ke + k], STS[k], ss((k + 1) / (NBB + 1)))))
for f in range(NBB, 45): FR.append(('walk_stop', STS[f]))
d_end = max(max((STS[-1][k][0] - WS_E[k][0]).length, 2 * math.acos(min(1.0, abs(STS[-1][k][1].normalized().dot(WS_E[k][1].normalized()))))) for k in WS_E); print('STOPEND vs WS0', d_end)
if d_end > 1e-4:
    for k in range(1, 5): FR.append(('settle', blend(STS[-1], WS_E, ss(k / 4))))
FR[-1] = ('end', WS_E)
sA, sB = FR[FW - 1][1], STS[0]; i0, i1 = FW, FW + ke + NBB
for i, (n, P) in enumerate(FR):
    if n in ('xfade_in', 'mocap', 'xfade_out'):
        w = min(1.0, max(0.0, (i - i0) / max(1, i1 - i0)))
        for s_ in SKIRT: P[s_] = (sA[s_][0].lerp(sB[s_][0], w), sA[s_][1].slerp(sB[s_][1], w))

# ---- foot-plant lock (analytic 2-bone IK, knee plane kept) on xfade_in/mocap/xfade_out frames
def capture(): return {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in PB}
def rotate_bone_to(pbn, newdir):
    pb = PB[pbn]; cur = (pb.tail - pb.head).normalized(); q = cur.rotation_difference(newdir.normalized())
    m = pb.matrix.copy(); R = q.to_matrix() @ m.to_3x3(); pb.matrix = Matrix.Translation(m.translation) @ R.to_4x4()
    bpy.context.view_layer.update(); pb.scale = (1, 1, 1); bpy.context.view_layer.update()
def ik(sd, A):
    th, sh, ft = PB['thigh.' + sd], PB['shin.' + sd], PB['foot.' + sd]
    fq = ft.matrix.to_3x3().copy(); H = th.head.copy(); K0 = sh.head.copy()
    l1 = (sh.head - th.head).length; l2 = (ft.head - sh.head).length
    d = A - H; L = min(d.length, (l1 + l2) * 0.9999); dn = d.normalized()
    pole = (K0 - H) - (K0 - H).dot(dn) * dn
    if pole.length < 1e-6: pole = Vector((0, -1, 0)) - dn.y * dn
    pole.normalize(); ca = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L); ca = max(-1, min(1, ca))
    K = H + dn * (l1 * ca) + pole * (l1 * math.sqrt(1 - ca * ca)); Aeff = H + dn * L
    rotate_bone_to('thigh.' + sd, K - H); rotate_bone_to('shin.' + sd, Aeff - sh.head)
    ft.matrix = Matrix.Translation(ft.head) @ fq.to_4x4(); bpy.context.view_layer.update(); ft.scale = (1, 1, 1); bpy.context.view_layer.update()
MIDX = [i for i, (n, P) in enumerate(FR) if n in ('xfade_in', 'mocap', 'xfade_out')]
info = {sd: [] for sd in 'LR'}
for i in MIDX:
    S = soles(FR[i][1])
    for sd in 'LR': apply(FR[i][1]); info[sd].append((i, float(S[sd][:, 2].min()), PB['foot.' + sd].head.copy()))
LOCKN = 0
for sd in 'LR':
    pl = [z < 0.02 for (_, z, _) in info[sd]]
    k = 0
    while k < len(pl):
        if not pl[k]: k += 1; continue
        j = k
        while j + 1 < len(pl) and pl[j + 1]: j += 1
        anchor = info[sd][k][2].copy()
        for q in range(k, j + 1):
            i = info[sd][q][0]; cur = info[sd][q][2]
            w = min(1.0, (q - k + 1) / 2, (j - q + 1) / 2)
            tgt = Vector((anchor.x, anchor.y, cur.z)).lerp(cur, 1 - w)
            apply(FR[i][1]); ik(sd, tgt); FR[i] = (FR[i][0], capture()); LOCKN += 1
        k = j + 1
print('LOCKED foot-frames', LOCKN)
act = bpy.data.actions.new('balloon_getout'); arm.animation_data.action = act
for f, (n, P) in enumerate(FR):
    apply(P)
    for b in PB:
        b.keyframe_insert('location', frame=f); b.keyframe_insert('rotation_quaternion', frame=f); b.keyframe_insert('scale', frame=f)
NF = len(FR); print('BADF', BADF[0]); print('FRAMES', NF, 'dur', (NF - 1) / 30)
# ---- basket
bset = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=BASKET); bobs = [o for o in bpy.data.objects if o not in bset]
for o in bobs:
    if o.type == 'MESH' and o.name != 'balloon_basket': o.hide_render = True; o.hide_set(True)
bk = bpy.data.objects['balloon_basket']; bpy.context.view_layer.update()
BV, BP = evalv(bk); keepf = [p for p in BP if max(BV[i, 2] for i in p) < 1.3 and max(BV[i, 2] for i in p) > 0.15]
btree = BVHTree.FromPolygons([tuple(v) for v in BV], keepf); print('BASKETF', len(BP), len(keepf), BV[:,2].min(), BV[:,2].max())
# ---- QA per frame
def tree(o):
    V, P = evalv(o); return V, BVHTree.FromPolygons([tuple(v) for v in V], P)
dress = bpy.data.objects['LOD0_G2_DRESS']; apron = bpy.data.objects['LOD0_G2_APRON']
bV, bP = evalv(body); legset = set(LEGV); legP = [p for p in bP if sum(i in legset for i in p) >= len(p) - 1]
def legtree():
    V, _ = evalv(body); return V, BVHTree.FromPolygons([tuple(v) for v in V], legP)
rows = []; prev = None
_bg = {g.index: g.name for g in body.vertex_groups}
def _part(n):
    for k in ('hand', 'forearm', 'upper_arm', 'foot', 'shin', 'thigh'):
        if n.startswith(k): return k
    return 'torso/other'
_vpart = {v.index: _part(_bg[max(v.groups, key=lambda q: q.weight).group]) if v.groups else 'other' for v in body.data.vertices}
PART = {p.index: _vpart[p.vertices[0]] for p in body.data.polygons}
handv = {sd: vg(body, ('hand.' + sd, 'forearm.' + sd)) for sd in 'LR'}
for f in range(NF):
    sc.frame_set(f); bpy.context.view_layer.update()
    V, lt = legtree(); dV, dt_ = tree(dress); aV, at_ = tree(apron)
    r = dict(f=f, t=round(f / 30, 3), seg=FR[f][0])
    for sd in 'LR':
        fv = V[FVI[sd]]; r['sole' + sd] = round(float(fv[:, 2].min()) * 1000, 1)
        if prev is not None:
            c = (fv[:, 2] < 0.012) & (prev[sd][:, 2] < 0.012)
            r['slide' + sd] = round(float(np.linalg.norm(fv[c, :2] - prev[sd][c, :2], axis=1).max()) * 1000, 2) if c.any() else None
        # knee flex
        th = (PB['thigh.' + sd].tail - PB['thigh.' + sd].head).normalized(); sh = (PB['shin.' + sd].tail - PB['shin.' + sd].head).normalized()
        r['knee' + sd] = round(math.degrees(th.angle(sh)), 2)
    prev = {sd: V[FVI[sd]].copy() for sd in 'LR'}
    r['skirt_x_leg_pairs'] = len(dt_.overlap(lt)) + len(at_.overlap(lt))
    _, bt = tree(body)
    ovb = btree.overlap(bt); r['basket_x_body'] = len(ovb)
    parts = {}
    for _, pi in ovb:
        g = PART.get(pi, 'other'); parts[g] = parts.get(g, 0) + 1
    r['basket_x_body_parts'] = parts
    r['basket_x_dress'] = len(btree.overlap(dt_)); r['basket_x_apron'] = len(btree.overlap(at_))
    for sd in 'LR':
        ds = [(Vector(V[i]) - bk.closest_point_on_mesh(Vector(V[i]))[1]).length for i in vg(body, ('hand.' + sd,))[::2]]; r['hand_rim_mm' + sd] = round(min(ds) * 1000, 1)
    hp = arm.matrix_world @ PB['hips'].head; r['root_fwd'] = round(-hp.y, 4); r['root_h'] = round(hp.z, 4)
    rows.append(r)
json.dump(dict(src='CMU 143_16', T0=T0, TE=TE, base0=list(base0), endroot=list(endroot), SLOW=SLOW, SCALE=SCALE, ZOFF=ZOFF, idle_vs_ws0=d_iw, rows=rows), open(OUT + '/qa.json', 'w'), indent=0)
print('QADONE', flush=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT + '/getout_cand1.blend')
if not RENDER: sys.exit()
# ---- renders
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); gp = bpy.context.active_object
m = bpy.data.materials.new('g'); m.diffuse_color = (.35, .45, .3, 1); gp.data.materials.append(m)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
os.makedirs(OUT + '/frames', exist_ok=True)
def shoot(tag, loc, look, lens_deg, res, wire):
    cam.location = loc; cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); cd.angle = math.radians(lens_deg)
    sc.render.resolution_x, sc.render.resolution_y = res
    mod = bk.modifiers.get('W') or (bk.modifiers.new('W', 'WIREFRAME') if wire else None)
    if mod: mod.show_render = wire; mod.thickness = 0.012
    for f in range(NF):
        sc.frame_set(f); sc.render.filepath = OUT + f'/frames/{tag}_{f:03d}.png'; bpy.ops.render.render(write_still=True)
shoot('side', (4.8, -1.15, 1.0), (0, -1.15, 0.75), 50, (960, 720), True)
shoot('game', (2.4, 3.4, 2.6), (0, -0.7, 0.8), 45, (540, 960), False)
print('DONE')
