# Clip-check on body-r2 (head skipped). Part classes as 角色建模bot qa_clash.py (BASE mode): sleeve_L/R, hand_L/R, legs (thigh/shin/foot incl.
# high-top shoes), torso. Side label = bone side (.L = -x = her right). Every frame (step S).
# blender -b --python r2_check.py -- <glb> <clip> <out.json> [step]
import bpy, sys, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]; GLB, CLIP, OUT = a[:3]; STEP = int(a[3]) if len(a) > 3 else 1
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=GLB)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
body, dress, apron = (bpy.data.objects[n] for n in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON'))
gn = {g.index: g.name for g in body.vertex_groups}
def grp(v):
    d = max(((g.weight, gn[g.group]) for g in v.groups), default=(0, '-'))[1]; side = 'L' if v.co.x < 0 else 'R'
    if d.startswith('hand'): return 'hand_' + side
    if d.startswith(('upper_arm', 'forearm')): return 'sleeve_' + side
    if d in ('chest', 'spine', 'neck'): return 'torso'
    if d == 'head' or d.startswith(('hair', '_tag')): return 'skull'
    return 'legs'
cls = [grp(v) for v in body.data.vertices]
parts = {}
for p in body.data.polygons:
    c = cls[p.vertices[0]]
    if c != 'skull': parts.setdefault(c, []).append(list(p.vertices))
PAIRS = [('sleeve_L', 'dress'), ('sleeve_R', 'dress'), ('sleeve_L', 'apron'), ('sleeve_R', 'apron'), ('hand_L', 'dress'), ('hand_R', 'dress'), ('hand_L', 'apron'),
         ('hand_R', 'apron'), ('hand_L', 'legs'), ('hand_R', 'legs'), ('legs', 'dress'), ('legs', 'apron'), ('hand_L', 'torso'), ('hand_R', 'torso'),
         ('sleeve_L', 'torso'), ('sleeve_R', 'torso'), ('legs3', 'dress'), ('legs3', 'apron'), ('dress', 'apron')]
GAPS = [('sleeve_L', 'apron'), ('sleeve_R', 'apron'), ('hand_L', 'apron'), ('hand_R', 'apron'), ('sleeve_L', 'dress'), ('sleeve_R', 'dress'),
        ('hand_L', 'dress'), ('hand_R', 'dress'), ('legs', 'dress'), ('legs', 'apron')]
def evm(o):
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); m = ev.to_mesh()
    V = [o.matrix_world @ x.co for x in m.vertices]; N = [(o.matrix_world.to_3x3() @ x.normal).normalized() for x in m.vertices]
    F = [list(p.vertices) for p in m.polygons]; ev.to_mesh_clear(); return V, N, F
VS = {k: sorted({i for ps in parts[k] for i in ps}) for k in parts}
def trees():
    V, N, _ = evm(body); T = {k: BVHTree.FromPolygons(V, ps) for k, ps in parts.items()}
    T['legs3'] = BVHTree.FromPolygons([v + n * 0.003 for v, n in zip(V, N)], parts['legs'])
    for nm, o in (('dress', dress), ('apron', apron)):
        Vo, _, Fo = evm(o); T[nm] = BVHTree.FromPolygons(Vo, Fo)
    return T, V
# rest dress-apron contacts (sewn waist band) excluded
arm.animation_data_create(); arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.frame_set(0); T0, _ = trees(); REST_DA = set(T0['dress'].overlap(T0['apron']))
for t in arm.animation_data.nla_tracks: t.mute = True
act = bpy.data.actions[CLIP]; arm.animation_data.action = act
f0, f1 = [int(round(x)) for x in act.frame_range]
worst = {}; wg = {}; frames = []
for fr in range(f0, f1 + 1, STEP):
    sc.frame_set(fr); T, V = trees(); rec = dict(f=fr)
    for x, y in PAIRS:
        k = f'{x}-{y}'; n = len(set(T[x].overlap(T[y])) - REST_DA) if (x, y) == ('dress', 'apron') else len(T[x].overlap(T[y]))
        rec[k] = n
        if n > worst.get(k, (0, 0))[0]: worst[k] = (n, fr)
    for x, y in GAPS:
        best = 9
        for i in VS[x][::2]:
            h = T[y].find_nearest(V[i], 0.2)
            if h[0] is not None: best = min(best, h[3])
        k = f'{x}->{y}'; rec[k] = round(best * 1000, 1)
        if k not in wg or rec[k] < wg[k][0]: wg[k] = (rec[k], fr)
    frames.append(rec)
res = dict(clip=CLIP, frames=[f0, f1], step=STEP, overlap_max=worst, min_gap_mm=wg, per_frame=frames, parts={k: len(v) for k, v in parts.items()})
print('R2', CLIP, json.dumps(dict(overlap_max=worst, min_gap_mm=wg)))
json.dump(res, open(OUT, 'w'), indent=1)
