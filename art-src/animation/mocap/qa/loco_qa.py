# (copied from 角色动画bot locomotion-v1; only change: walk_loop length from the GLB)
# Feet / knees / handoff QA of a locomotion clip on the EXPORTED GLB (re-imported), in WORLD space using the clip's root curve.
# blender -b --python loco_qa.py -- <glb> <clip> <author.json> <out.json> [sub]
import bpy, sys, json, math
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]; GLB, CLIP, AJ, OUT = a[:4]; SUB = int(a[4]) if len(a) > 4 else 4
A = json.load(open(AJ)); N = A['frames']; FPS = 30
bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=GLB)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute = True
SCALE = None
def setclip(name):
    arm.animation_data.action = bpy.data.actions[name]
def frame_of(name, t):   # importer keys at scene fps of the import (24) -> map seconds to frames
    return t * bpy.data.actions[name].frame_range[1] / bpy.data.actions[name]['dur'] if 'dur' in bpy.data.actions[name] else None
# the importer keeps glTF seconds * 24 fps (scene default at import) -> detect from the action range
def clip_frames(name):
    return bpy.data.actions[name].frame_range[1]
F_END = clip_frames(CLIP); KF = F_END / (N / FPS)          # importer frames per second
def at(name, t):
    setclip(name); f = t * (clip_frames(name) / dur_of[name]); sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
WALK_T = clip_frames('walk_loop') / KF          # mocap: walk_loop length read from the GLB (was 34 / 30)
dur_of = {CLIP: N / FPS, 'walk_loop': WALK_T, 'idle_breathing_loop': None}
dur_of['idle_breathing_loop'] = clip_frames('idle_breathing_loop') / KF
rm = A['root_motion']
def root_at(t):
    def interp(tab):
        for i in range(len(tab) - 1):
            if tab[i][0] <= t <= tab[i + 1][0] + 1e-9:
                u = (t - tab[i][0]) / (tab[i + 1][0] - tab[i][0]); return tab[i][1] + u * (tab[i + 1][1] - tab[i][1])
        return tab[-1][1]
    s = interp(rm['forward_m']) if 'forward_m' in rm else 0.0
    y = math.radians(interp(rm['yaw_deg'])) if 'yaw_deg' in rm else 0.0
    x = interp(rm['lateral_m']) if 'lateral_m' in rm else 0.0
    m = Matrix.Rotation(y, 4, 'Z'); m.translation = Vector((x, -s, 0)); return m
body = bpy.data.objects['LOD0_G2_BODY']; gi = {g.index: g.name for g in body.vertex_groups}
FOOT = {s: [v.index for v in body.data.vertices if sum(g.weight for g in v.groups if gi[g.group] == 'foot.' + s) > 0.5] for s in 'LR'}
FS = {s: set(FOOT[s]) for s in 'LR'}
FPOLY = {s: [list(p.vertices) for p in body.data.polygons if all(i in FS[s] for i in p.vertices)] for s in 'LR'}
def sample(name, t, world=True):
    at(name, t); dg = bpy.context.evaluated_depsgraph_get(); eo = body.evaluated_get(dg); me = eo.to_mesh()
    Rm = root_at(t) if world else Matrix.Identity(4)
    r = dict(t=t, f=t * FPS)
    for s in 'LR': r[s] = {k: Rm @ (eo.matrix_world @ me.vertices[k].co) for k in FOOT[s]}
    r['minz'] = min((eo.matrix_world @ v.co).z for v in me.vertices)
    P = {b.name: Rm @ arm.matrix_world @ b.matrix for b in arm.pose.bones}
    for s in 'LR':
        th, kn, an = (P[x + '.' + s].translation for x in ('thigh', 'shin', 'foot')); r['knee' + s] = math.degrees((kn - th).angle(an - kn))
    tr = {s: BVHTree.FromPolygons([r[s][k] if k in r[s] else Vector() for k in range(len(me.vertices))], FPOLY[s]) for s in 'LR'}
    r['foot_overlap'] = len(tr['L'].overlap(tr['R']))
    r['P'] = P; eo.to_mesh_clear(); return r
n = N * SUB + 1; recs = [sample(CLIP, i / (SUB * FPS)) for i in range(n)]
out = dict(clip=CLIP, sampling=f'{SUB}/frame', frames=N)
TOL1, TOL2 = 0.001, 0.002
cont = {s: [min(p.z for p in r[s].values()) < TOL2 for r in recs] for s in 'LR'}
out['double_support_pct'] = round(100 * sum(1 for i in range(n) if cont['L'][i] and cont['R'][i]) / n, 1)
out['no_support_pct'] = round(100 * sum(1 for i in range(n) if not cont['L'][i] and not cont['R'][i]) / n, 1)
out['min_mesh_z_mm'] = round(min(r['minz'] for r in recs) * 1000, 2)
out['foot_foot_overlap_tris'] = sum(r['foot_overlap'] for r in recs)
for s in 'LR':
    segs = []; i = 0
    while i < n:
        if cont[s][i]:
            j = i
            while j + 1 < n and cont[s][j + 1]: j += 1
            segs.append((i, j)); i = j + 1
        else: i += 1
    rep = []
    for i0, i1 in segs:
        for tol, key in ((TOL1, 'planted_mm'), (TOL2, 'contact_mm')):
            tracks = {}
            for i in range(i0, i1 + 1):
                for k, p in recs[i][s].items():
                    if p.z < tol: tracks.setdefault(k, []).append(p)
            sl = [max((q - v[0]).length for q in v) for v in tracks.values() if len(v) > 1]
            if key == 'planted_mm': d = dict(frames=f"{recs[i0]['f']:.2f}..{recs[i1]['f']:.2f}", planted_mm=round(max(sl) * 1000, 2) if sl else 0)
            else: d['contact_mm'] = round(max(sl) * 1000, 2) if sl else 0
        r0 = recs[i0]; k0 = min(r0[s], key=lambda k: r0[s][k].z)
        d['first_contact_rest_y'] = round((body.matrix_world @ body.data.vertices[k0].co).y, 3) if i0 > 0 else None
        rep.append(d)
    out['stance_' + s] = rep
    out['slide_planted_max_mm_' + s] = max([d['planted_mm'] for d in rep] + [0])
    # knee: per-frame values (frames are keys) -> velocity/acc + isolated spike test (non-periodic)
    kf = [recs[i]['knee' + s] for i in range(0, n, SUB)]
    v = [(kf[j + 1] - kf[j]) * FPS for j in range(N)]; acc = [(v[j + 1] - v[j]) * FPS for j in range(N - 1)]
    big = [j for j in range(1, N - 2) if abs(acc[j]) > 0.3 * max(abs(x) for x in acc)]
    spike = {j: abs(acc[j]) / max(1e-6, 0.5 * (abs(acc[j - 1]) + abs(acc[j + 1]))) for j in big}
    st = [recs[i]['knee' + s] for i in range(n) if cont[s][i]]
    out['knee_' + s] = dict(stance_min_deg=round(min(st), 2), stance_max_deg=round(max(st), 2), max_deg=round(max(kf), 1),
                           max_ext_vel_dps=round(min(v)), max_flex_vel_dps=round(max(v)), max_abs_acc_dps2=round(max(abs(x) for x in acc)),
                           max_acc_frame=max(range(N - 1), key=lambda j: abs(acc[j])), max_spike_ratio=round(max(spike.values()), 2) if spike else 0,
                           spike_frame=max(spike, key=spike.get) if spike else None, per_frame=[round(x, 1) for x in kf])
# ---- handoff residuals: pose (all bones) and shoe vertices vs neighbour clip ----
def pose_diff(ra, rb):
    ang = 0; nm = None
    for b in ra['P']:
        qa = ra['P'][b].to_quaternion(); qb = rb['P'][b].to_quaternion()
        e = math.degrees(2 * math.acos(min(1.0, abs(qa.dot(qb)))))
        if e > ang: ang, nm = e, b
    fv = max((ra[s][k] - rb[s][k]).length for s in 'LR' for k in ra[s])
    return dict(max_bone_deg=round(ang, 3), bone=nm, max_shoe_vertex_mm=round(fv * 1000, 2))
H = {}
def idle_rec(t, rmat):
    r = sample('idle_breathing_loop', t, world=False)
    for s in 'LR': r[s] = {k: rmat @ p for k, p in r[s].items()}
    r['P'] = {b: rmat @ m for b, m in r['P'].items()}; return r
def walk_rec(tw, rmat):
    r = sample('walk_loop', tw % WALK_T, world=False)
    for s in 'LR': r[s] = {k: rmat @ p for k, p in r[s].items()}
    r['P'] = {b: rmat @ m for b, m in r['P'].items()}; return r
if CLIP == 'walk_start':
    H['start_vs_idle_frame0'] = pose_diff(recs[0], idle_rec(0.0, root_at(0.0)))
    t2 = A['t2']
    for tt in (t2, t2 + 0.2, N / FPS):
        H[f'vs_walk_loop_at_clip_{tt:.3f}s'] = pose_diff(sample(CLIP, tt), walk_rec(tt - t2, root_at(tt)))
elif CLIP.startswith('walk_stop'):
    H['entry_vs_walk_loop'] = pose_diff(recs[0], walk_rec(A['te'], root_at(0.0)))
    H['end_vs_idle_frame0'] = pose_diff(recs[-1], idle_rec(0.0, root_at(N / FPS)))
else:
    H['start_vs_idle_frame0'] = pose_diff(recs[0], idle_rec(0.0, root_at(0.0)))
    H['end_vs_idle_frame0'] = pose_diff(recs[-1], idle_rec(0.0, root_at(N / FPS)))
out['handoff'] = H
print('LOCOQA', json.dumps({k: v for k, v in out.items() if not k.startswith('knee_') and not k.startswith('stance_')}),
      json.dumps({s: {k: v for k, v in out['knee_' + s].items() if k != 'per_frame'} for s in 'LR'}))
json.dump(out, open(OUT, 'w'), indent=1)
