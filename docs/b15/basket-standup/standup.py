# b15 basket stand-up v1: sit_hold (seat root = P0 + 0.494 m behind, facing the door) -> stand_up (mocap, root 0.494 m fwd) -> idle at P0 -> getout v3b clock (idle 0.5 -> door_reach)
import bpy, math, json, os, sys, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT = os.path.dirname(os.path.abspath(__file__)); RENDER = os.environ.get('RENDER', '1') == '1'; TAG = os.environ.get('TAG', 'v1')
G = '/workspace/yiqifengle/previews/角色动画bot/planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb'
BASKET = OUT + '/transport_balloon_b69faa60.glb'
META = json.load(open('/workspace/yiqifengle/wt-b14/creator-build-project/assets/bundles/region_island/character/anim_meta.json')); META = META.get('clips', META)
fps = 30; XF = 0.2; SIT_S = float(os.environ.get('SIT', 0.6)); SU = META['stand_up']['duration_s']; SUF = META['stand_up']['root_motion']['forward_m']
IDLE_S = 0.5; TAIL = 1.4   # getout clock after the stand-up: idle 0.5 then door_reach (first 0.9 s)
P0 = np.array([0.03, -0.395]); YAW = math.radians(float(os.environ.get('YAW', -0.22)))   # getout start: basket (Blender) P0, facing ~ -Y (door), 95.97 world vs door 96.19
FW = np.array([math.sin(YAW), -math.cos(YAW)])
SEAT = P0 - FW * SUF[-1][1]
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = fps
bpy.ops.import_scene.gltf(filepath=G)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; PB = arm.pose.bones
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name == 'Icosphere': o.hide_render = True; o.hide_set(True)
for t in arm.animation_data.nla_tracks: t.mute = True
def setact(n):
    a = bpy.data.actions[n]; arm.animation_data.action = a
    try: arm.animation_data.action_slot = a.slots[0]
    except Exception: pass
def lp(clip, t):
    setact(clip); fr = t * 30; sc.frame_set(int(math.floor(fr)), subframe=fr - math.floor(fr)); bpy.context.view_layer.update()
    return {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in PB}
def piece(f, t):
    if t <= f[0][0]: return f[0][1]
    for (a, va), (b, vb) in zip(f, f[1:]):
        if t <= b: return va + (vb - va) * (t - a) / (b - a) if b > a else vb
    return f[-1][1]
def morph(clip, t):
    return {k: piece(v, t) for k, v in (META[clip].get('morph') or {}).get('curves', {}).items()}
def blendm(A, B, w):
    return {k: A.get(k, 0) * (1 - w) + B.get(k, 0) * w for k in set(A) | set(B)}
def blend(A, B, w):
    R = {}
    for k in A:
        qa, qb = A[k][1], B[k][1]
        if qa.dot(qb) < 0: qb = -qb
        R[k] = (A[k][0].lerp(B[k][0], w), qa.slerp(qb, w))
    return R
T_SU = SIT_S; T_G = T_SU + SU; T_DR = T_G + IDLE_S; T_END = T_G + TAIL
NF = int(round(T_END * fps)) + 1
def sched(t):  # -> pose, morph, forward s, label
    if t < T_SU: return lp('sit_hold', 0), morph('sit_hold', 0), 0.0, 'sit_hold'
    if t < T_G:
        u = t - T_SU; P = lp('stand_up', u); M = morph('stand_up', u)
        return P, M, piece(SUF, u), 'stand_up'   # start_pose = sit_hold frame 0: hard switch, no crossfade (a blend would cancel the in-pose root compensation -> 11 mm/f slide)
    g = t - T_G; s = SUF[-1][1]
    if g < XF:
        w = g / XF; return blend(lp('stand_up', SU), lp('idle_breathing_loop', g), w), blendm(morph('stand_up', SU), morph('idle_breathing_loop', g), w), s, 'xf_su_idle(getout t=%.3f)' % g
    if g < IDLE_S: return lp('idle_breathing_loop', g), morph('idle_breathing_loop', g), s, 'getout_idle'
    d = g - IDLE_S
    if d < XF:
        w = d / XF; return blend(lp('idle_breathing_loop', g % 1.8), lp('door_reach', d), w), blendm(morph('idle_breathing_loop', g), morph('door_reach', d), w), s, 'getout_xf_idle_dr'
    return lp('door_reach', d), morph('door_reach', d), s, 'getout_door_reach'
bset = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=BASKET); bobs = [o for o in bpy.data.objects if o not in bset]
for o in bobs:
    if o.type == 'MESH' and o.name not in ('balloon_basket', 'basket_door_leaf'): o.hide_render = True; o.hide_set(True)
bk = bpy.data.objects['balloon_basket']; leaf = bpy.data.objects['basket_door_leaf']; hinge = bpy.data.objects['basket_door']; hinge.rotation_mode = 'XYZ'
def door_deg(t):  # INTEGRATE.md v3b on the getout clock: trigger T0+0.333, follow 2.75 deg over 2 f, ease-out cubic to 100 over 0.8 s
    a = t - (T_DR + 0.333)
    if a <= 0: return 0.0
    if a < 2 / 30: return 2.75 * a / (2 / 30)
    u = min(1.0, (a - 2 / 30) / 0.8); return 2.75 + 97.25 * (1 - (1 - u) ** 3)
arm.animation_data.action = None; arm.rotation_mode = 'XYZ'
def place(s):
    p = SEAT + FW * s; arm.location = (float(p[0]), float(p[1]), 0.0); arm.rotation_euler = (0, 0, YAW)
MESH = {n: bpy.data.objects[n] for n in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW') if n in bpy.data.objects}
def setm(M):
    for o in MESH.values():
        for kb in o.data.shape_keys.key_blocks[1:]: kb.value = float(M.get(kb.name, 0.0))
body = MESH['LOD0_G2_BODY']; gi = {g.index: g.name for g in body.vertex_groups}
def vg(names): return [v.index for v in body.data.vertices if v.groups and gi[max(v.groups, key=lambda q: q.weight).group] in names]
FVI = {sd: vg(('foot.' + sd,)) for sd in 'LR'}
def ev(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world
    V = np.array([tuple(M @ v.co) for v in me.vertices]); P = [tuple(p.vertices) for p in me.polygons]; oe.to_mesh_clear(); return V, P
def apply(P):
    for b in PB:
        if b.name in P: b.location, b.rotation_quaternion = P[b.name]
    bpy.context.view_layer.update()
FR = [(f / fps,) + sched(f / fps) for f in range(NF)]
act = bpy.data.actions.new('basket_standup_' + TAG); arm.animation_data.action = act
for f, (t, P, M, s, lab) in enumerate(FR):
    apply(P)
    for b in PB: b.keyframe_insert('location', frame=f); b.keyframe_insert('rotation_quaternion', frame=f)
    place(s); arm.keyframe_insert('location', frame=f); arm.keyframe_insert('rotation_euler', frame=f)
    hinge.rotation_euler = (0, 0, math.radians(door_deg(t))); hinge.keyframe_insert('rotation_euler', frame=f)
    for o in MESH.values():
        for kb in o.data.shape_keys.key_blocks[1:]: kb.value = float(M.get(kb.name, 0.0)); kb.keyframe_insert('value', frame=f)
for a in bpy.data.actions:
    for fc in getattr(a, 'fcurves', []):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
bV, _ = ev(bk); BP = [tuple(p.vertices) for p in bk.data.polygons if 0.003 < max(bV[i][2] for i in p.vertices) < 1.3]
btree = BVHTree.FromPolygons([tuple(v) for v in bV], BP)
# wall clearance: basket inner box approx |x|<0.8, |y|<0.8 slanted; use signed nearest dist to wall polys for cloth verts
def tree(o):
    V, P = ev(o); return V, BVHTree.FromPolygons([tuple(v) for v in V], P)
rows = []; prev = None
for f in range(NF):
    sc.frame_set(f); bpy.context.view_layer.update()
    lV, lP = ev(leaf); ltree = BVHTree.FromPolygons([tuple(v) for v in lV], lP)
    V, bt = tree(body); r = dict(door_deg=round(door_deg(f / fps), 2), f=f, t=round(f / fps, 3), seg=FR[f][4], s=round(FR[f][3], 4), x=round(arm.location.x, 4), y=round(arm.location.y, 4))
    for sd in 'LR':
        fv = V[FVI[sd]]; r['sole' + sd] = round(float(fv[:, 2].min()) * 1000, 1)
        if prev is not None:
            c = (fv[:, 2] < 0.012) & (prev[sd][:, 2] < 0.012)
            r['slide' + sd] = round(float(np.linalg.norm(fv[c, :2] - prev[sd][c, :2], axis=1).max()) * 1000, 2) if c.any() else None
        a_ = (PB['thigh.' + sd].tail - PB['thigh.' + sd].head).normalized(); b_ = (PB['shin.' + sd].tail - PB['shin.' + sd].head).normalized()
        r['knee' + sd] = round(math.degrees(a_.angle(b_)), 2)
        ua = (PB['upper_arm.' + sd].tail - PB['upper_arm.' + sd].head).normalized(); r['armAbd' + sd] = round(math.degrees(ua.angle(Vector((0, 0, -1)))), 1)
    prev = {sd: V[FVI[sd]] for sd in 'LR'}
    r['hipZ'] = round((arm.matrix_world @ PB['hips'].head).z, 4); r['headZ'] = round((arm.matrix_world @ PB['head'].tail).z, 3)
    for n, o in MESH.items():
        if n == 'LOD0_G2_BODY': ot = bt; Vo = V
        else: Vo, ot = tree(o)
        k = n.split('_')[-1].lower(); r['bk_x_' + k] = len(btree.overlap(ot)); r['leaf_x_' + k] = len(ltree.overlap(ot))
        r['minY_' + k] = round(float(Vo[:, 1].min()), 4); r['maxY_' + k] = round(float(Vo[:, 1].max()), 4)
    rows.append(r)
json.dump(dict(SEAT=list(SEAT), P0=list(P0), YAW_deg=math.degrees(YAW), T_SU=T_SU, T_G=T_G, NF=NF, rows=rows), open(OUT + f'/qa_{TAG}.json', 'w'), indent=0)
print('QADONE', flush=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT + f'/{TAG}.blend')
if not RENDER: sys.exit()
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); gp = bpy.context.active_object
m = bpy.data.materials.new('g'); m.diffuse_color = (.35, .45, .3, 1); gp.data.materials.append(m)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
os.makedirs(OUT + '/frames', exist_ok=True)
def shoot(tag, loc, look, deg, res, wire):
    cd.angle = math.radians(deg); sc.render.resolution_x, sc.render.resolution_y = res
    mod = bk.modifiers.get('W') or bk.modifiers.new('W', 'WIREFRAME'); mod.show_render = wire; mod.thickness = 0.008
    cam.location = loc; cam.rotation_euler = (look - loc).to_track_quat('-Z', 'Y').to_euler()
    for f in range(NF):
        sc.frame_set(f); sc.render.filepath = OUT + f'/frames/{TAG}_{tag}_{f:03d}.png'; bpy.ops.render.render(write_still=True)
# door lens (shore side, ahead of the door and to the side, looking back at the door: LAKESIDE_DOOR_LENS ahead 3.2 side 3.6 up 1.5)
shoot('door', Vector((2.6, -4.6, 1.7)), Vector((0.0, -0.4, 0.8)), 50, (450, 800), False)
shoot('side', Vector((4.2, -0.2, 1.1)), Vector((0.0, -0.2, 0.7)), 50, (800, 600), True)
print('DONE')
