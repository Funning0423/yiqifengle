# Cloth/limb interpenetration check for walk_loop (any GLB). blender -b --python walk_clipcheck.py -- <glb> <clip> <nframes> <fps> <out.json> [sub]
# Method (normal-independent): from each test vertex cast a horizontal ray toward the body axis (hips x,y at the vertex height).
#   leg vertex OUTSIDE dress/apron  <=> ray hits that cloth before reaching the axis (depth = hit distance).
#   arm vertex INSIDE dress/torso   <=> ray AWAY from the axis hits that surface within 5 cm.
#   arm_in_torso_dyn (added for the mocap task): arm_in_torso without the arm vertices already inside at rest and without the
#   sleeve seam band (< 10 cm from the shoulder joint), i.e. elbows / forearms / hands entering the torso.
import bpy, sys, json, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]
GLB, CLIP, NF, FPS, OUT = a[0], a[1], int(a[2]), int(a[3]), a[4]; SUB = int(a[5]) if len(a) > 5 else 1
bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=GLB)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute = True
arm.animation_data.action = bpy.data.actions[CLIP]
body, dress, apron = (bpy.data.objects[n] for n in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON'))
gi = {g.index: g.name for g in body.vertex_groups}
def dom(v): return gi[max(v.groups, key=lambda g: g.weight).group] if v.groups else None
LEG = [v.index for v in body.data.vertices if dom(v) and dom(v).split('.')[0] in ('thigh', 'shin')]
ARM = [v.index for v in body.data.vertices if dom(v) and dom(v).split('.')[0] in ('forearm', 'hand', 'upper_arm')]
CHEST = set(v.index for v in body.data.vertices if dom(v) in ('chest', 'spine', 'hips'))
LEGF = set(v.index for v in body.data.vertices if dom(v) and dom(v).split('.')[0] in ('thigh', 'shin', 'foot', 'toe'))
ARMS = set(ARM)
LEGF_POLYS = [list(p.vertices) for p in body.data.polygons if all(i in LEGF for i in p.vertices)]
ARM_POLYS = [list(p.vertices) for p in body.data.polygons if all(i in ARMS for i in p.vertices)]
dgi = {g.index: g.name for g in dress.vertex_groups}
def panel_of_face(p):
    c = {}
    for i in p.vertices:
        v = dress.data.vertices[i]; b = dgi[max(v.groups, key=lambda g: g.weight).group] if v.groups else 'none'
        k = 'back' if b.startswith('skirt.back') else 'front' if b.startswith('skirt.front') else 'left' if b.startswith('skirt.left') else 'right' if b.startswith('skirt.right') else 'waist'
        c[k] = c.get(k, 0) + 1
    return max(c, key=c.get)
DFACE_PANEL = [panel_of_face(p) for p in dress.data.polygons]
BACK_FACES = set(i for i, k in enumerate(DFACE_PANEL) if k == 'back')
INFL = float(__import__('os').environ.get('CLIP_MARGIN', '0.003'))     # margin: leg/foot surface inflated along normals
def body_trees():
    dg = bpy.context.evaluated_depsgraph_get(); eo = body.evaluated_get(dg); me = eo.to_mesh()
    vs = [eo.matrix_world @ v.co for v in me.vertices]; ns = [(eo.matrix_world.to_3x3() @ v.normal).normalized() for v in me.vertices]
    vi = [vs[i] + ns[i] * INFL for i in range(len(vs))]
    eo.to_mesh_clear()
    return BVHTree.FromPolygons(vs, LEGF_POLYS), BVHTree.FromPolygons(vi, LEGF_POLYS), BVHTree.FromPolygons(vs, ARM_POLYS), vs
TOL = 0.001
def bvh_of(o, polyfilter=None):
    dg = bpy.context.evaluated_depsgraph_get(); eo = o.evaluated_get(dg); me = eo.to_mesh()
    vs = [eo.matrix_world @ v.co for v in me.vertices]
    ps = [list(p.vertices) for p in me.polygons if polyfilter is None or all(i in polyfilter for i in p.vertices)]
    eo.to_mesh_clear(); return BVHTree.FromPolygons(vs, ps), vs
res = dict(frames=[], method='horizontal ray to/away from body axis; depth = distance outside', tol_mm=TOL * 1000)
worst = dict(leg_out_dress=0, leg_out_apron=0, dress_out_apron=0, apron_in_dress=0, arm_in_dress=0, arm_in_apron=0, arm_in_torso=0, arm_in_torso_dyn=0)
counts = {k: 0 for k in worst}
# rest-pose dress/apron triangle contacts (layers sewn together at the waist band) are excluded from the layer check
sc.frame_set(0); arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
bpy.context.view_layer.update()
REST_DA = set(bvh_of(dress)[0].overlap(bvh_of(apron)[0]))
# arm vertices already inside the torso at the rest pose, and the sleeve seam band (< 10 cm from the shoulder joint at rest,
# pressed into the bodice by any hanging-arm pose) -> arm_in_torso_dyn skips them
_tB0, _bv0 = bvh_of(body, CHEST); _h0 = (arm.matrix_world @ arm.pose.bones['hips'].matrix).translation
def _inside0(p):
    d = Vector((p.x - _h0.x, p.y - _h0.y, 0)); L = d.length
    if L < 1e-4: return False
    hit = _tB0.ray_cast(p, d / L, 0.05); return hit[0] is not None and hit[3] > TOL
_sh0 = {sd: arm.matrix_world @ arm.pose.bones['upper_arm.' + sd].head for sd in 'LR'}
SEAM = set(k for k in ARM if (_bv0[k] - _sh0[dom(body.data.vertices[k])[-1]]).length < 0.10)
REST_ARM_TORSO = set(k for k in ARM if _inside0(_bv0[k])) | SEAM
ARM_DYN = [k for k in ARM if k not in REST_ARM_TORSO]
arm.animation_data.action = bpy.data.actions[CLIP]
tri_tot = {}; tri_frames = {}
for i in range(NF * SUB):
    fr = i / SUB; sc.frame_set(int(fr), subframe=fr - int(fr))
    hips = (arm.matrix_world @ arm.pose.bones['hips'].matrix).translation
    tD, _ = bvh_of(dress); tA, _ = bvh_of(apron); tB, bv = bvh_of(body, CHEST)
    _, dv = bvh_of(dress); _, av = bvh_of(apron)
    rec = dict(f=fr)
    tL, tLi, tAr, bvall = body_trees()
    if i == 0 and 'rest_da' not in globals():
        pass
    ov_d = tL.overlap(tD); ov_a = tL.overlap(tA); ovi_d = tLi.overlap(tD); ovi_a = tLi.overlap(tA)
    ov_da = set(tD.overlap(tA)) - REST_DA
    ov_arm = len(tAr.overlap(tD)) + len(tAr.overlap(tA)) + len(tAr.overlap(tB))
    rec['tri_leg_dress'] = len(ov_d); rec['tri_leg_apron'] = len(ov_a); rec['tri_dress_apron_new'] = len(ov_da); rec['tri_arm_any'] = ov_arm
    rec['tri_leg_dress_margin'] = len(ovi_d); rec['tri_leg_apron_margin'] = len(ovi_a)
    rec['tri_leg_back_panel'] = sum(1 for a_, b_ in ov_d if b_ in BACK_FACES); rec['tri_leg_back_panel_margin'] = sum(1 for a_, b_ in ovi_d if b_ in BACK_FACES)
    for k_ in ('tri_leg_dress', 'tri_leg_apron', 'tri_dress_apron_new', 'tri_arm_any', 'tri_leg_dress_margin', 'tri_leg_apron_margin', 'tri_leg_back_panel', 'tri_leg_back_panel_margin'):
        tri_tot[k_] = tri_tot.get(k_, 0) + rec[k_]
        if rec[k_]: tri_frames.setdefault(k_, []).append(fr)
    # closest approach of leg+foot surface to the BACK panel (for the rear-camera issue)
    bestb = 9.0
    for k_ in LEGF:
        n_ = tD.find_nearest(bvall[k_])
        if n_[0] is not None and n_[2] in BACK_FACES: bestb = min(bestb, n_[3])
    rec['clear_legfoot_back_mm'] = round(bestb * 1000, 1)
    def outside(p, tree):
        d = Vector((hips.x - p.x, hips.y - p.y, 0)); L = d.length
        if L < 1e-4: return 0
        hit = tree.ray_cast(p, d / L, L)
        return hit[3] if hit[0] is not None and hit[3] > TOL else 0
    def inside(p, tree, maxd=0.05):
        d = Vector((p.x - hips.x, p.y - hips.y, 0)); L = d.length
        if L < 1e-4: return 0
        hit = tree.ray_cast(p, d / L, maxd)
        return hit[3] if hit[0] is not None and hit[3] > TOL else 0
    for key, verts, fn, tree in (('leg_out_dress', [bv[k] for k in LEG], outside, tD), ('leg_out_apron', [bv[k] for k in LEG], outside, tA),
                                 ('dress_out_apron', dv, outside, tA), ('apron_in_dress', av, inside, tD), ('arm_in_dress', [bv[k] for k in ARM], inside, tD), ('arm_in_apron', [bv[k] for k in ARM], inside, tA),
                                 ('arm_in_torso', [bv[k] for k in ARM], inside, tB), ('arm_in_torso_dyn', [bv[k] for k in ARM_DYN], inside, tB)):
        ds = [fn(p, tree) for p in verts]; n = sum(1 for x in ds if x > 0); m = max(ds)
        rec[key] = [n, round(m * 1000, 1)]
        if m > 0:
            pw = verts[ds.index(m)]; rel = pw - hips
            rec[key].append(dict(z=round(pw.z, 3), az_deg=round(math.degrees(math.atan2(rel.x, -rel.y))), r=round(rel.xy.length, 3))); counts[key] += n; worst[key] = max(worst[key], m)
    # clearance (closest approach) leg->dress, leg->apron, arm->dress/apron/torso (mm), only below the waist band
    def mind(verts, tree, zmax):
        best = 9.0
        for p in verts:
            if p.z > zmax: continue
            n = tree.find_nearest(p)
            if n[0] is not None: best = min(best, n[3])
        return round(best * 1000, 1)
    rec['clear_leg_dress_mm'] = mind([bv[k] for k in LEG], tD, 0.95)
    rec['clear_leg_apron_mm'] = mind([bv[k] for k in LEG], tA, 0.95)
    rec['clear_arm_cloth_mm'] = min(mind([bv[k] for k in ARM], tD, 1.2), mind([bv[k] for k in ARM], tA, 1.2))
    rec['clear_arm_torso_mm'] = mind([bv[k] for k in ARM], tB, 1.6)
    res['frames'].append(rec)
res['total_vertex_hits'] = counts; res['max_depth_mm'] = {k: round(v * 1000, 1) for k, v in worst.items()}
for key in ('clear_leg_dress_mm', 'clear_leg_apron_mm', 'clear_arm_cloth_mm', 'clear_arm_torso_mm'):
    vals = [r[key] for r in res['frames']]; res.setdefault('min_clearance', {})[key] = dict(min=min(vals), frame=res['frames'][vals.index(min(vals))]['f'])
for key in worst:
    vals = [r[key][1] for r in res['frames']]; res.setdefault('worst_frame', {})[key] = res['frames'][vals.index(max(vals))]['f']
res['tri_overlap_total'] = tri_tot; res['tri_overlap_frames'] = tri_frames; res['rest_dress_apron_pairs'] = len(REST_DA)
res['tri_margin_mm'] = INFL * 1000
vals = [r['clear_legfoot_back_mm'] for r in res['frames']]; res['min_clearance']['clear_legfoot_back_mm'] = dict(min=min(vals), frame=res['frames'][vals.index(min(vals))]['f'])
res['n_test_verts'] = dict(leg=len(LEG), arm=len(ARM), dress=len(dress.data.vertices), arm_skipped_for_dyn=len(REST_ARM_TORSO))
print('CLIP', json.dumps(dict(total=counts, max_mm=res['max_depth_mm'], min_clear=res['min_clearance'], tri=tri_tot, tri_frames={k: v[:12] for k, v in tri_frames.items()}, rest_da=len(REST_DA))))
json.dump(res, open(OUT, 'w'), indent=1)
