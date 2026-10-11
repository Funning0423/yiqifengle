# Arm pose QA (front view): elbow-to-torso gap, upper-arm & forearm frontal-plane angle, palm orientation.
# blender -b --python walk_qa_arms.py -- <glb> <clip> <nframes> <fps> <out.json>
import bpy, sys, json, math
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]
GLB, CLIP, NF, FPS, OUT = a[0], a[1], int(a[2]), int(a[3]), a[4]; SUB = int(a[5]) if len(a) > 5 else 1
bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=GLB)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute = True
arm.animation_data.action = bpy.data.actions[CLIP]
body = bpy.data.objects['LOD0_G2_BODY']; dress = bpy.data.objects['LOD0_G2_DRESS']
gi = {g.index: g.name for g in body.vertex_groups}
def dom(v): return gi[max(v.groups, key=lambda g: g.weight).group] if v.groups else None
TORSO = [v.index for v in body.data.vertices if dom(v) in ('chest', 'spine', 'hips')]
HAND = {s: [v.index for v in body.data.vertices if dom(v) == 'hand.' + s] for s in 'LR'}
UPPER = {s: [v.index for v in body.data.vertices if dom(v) == 'upper_arm.' + s] for s in 'LR'}
rows = []
for i in range(NF * SUB):
    f = i / SUB; sc.frame_set(int(f), subframe=f - int(f)); dg = bpy.context.evaluated_depsgraph_get()
    eo = body.evaluated_get(dg); me = eo.to_mesh(); P = [eo.matrix_world @ v.co for v in me.vertices]
    ed = dress.evaluated_get(dg); md = ed.to_mesh(); PD = [ed.matrix_world @ v.co for v in md.vertices]
    pb = {n: arm.matrix_world @ arm.pose.bones[n].matrix for n in ('upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R', 'hips')}
    hips = pb['hips'].translation
    r = dict(f=f)
    for s in 'LR':
        sg = -1 if s == 'L' else 1
        sh = pb['upper_arm.' + s].translation; el = pb['forearm.' + s].translation; wr = pb['hand.' + s].translation
        # torso surface at elbow height: max |x| (on that side) of torso+dress verts within 2 cm of elbow z and |y-el.y|<6cm
        zs = [p for p in P if False]
        tor = [P[i] for i in TORSO if abs(P[i].z - el.z) < 0.02 and abs(P[i].y - el.y) < 0.06 and P[i].x * sg > 0]
        tor += [p for p in PD if abs(p.z - el.z) < 0.02 and abs(p.y - el.y) < 0.06 and p.x * sg > 0]
        tx = max(p.x * sg for p in tor) if tor else float('nan')
        # inner surface of the upper arm near the elbow
        ua = [P[i] for i in UPPER[s] if abs(P[i].z - el.z) < 0.03]
        inner = min(p.x * sg for p in ua) if ua else float('nan')
        def frontal(a, b):   # outward lean of the segment (asin of lateral component), independent of fwd flex; + = outward
            d = (b - a).normalized(); return math.degrees(math.asin(max(-1, min(1, d.x * sg))))
        hv = np.array([list(P[i]) for i in HAND[s]]); c = hv - hv.mean(0)
        _, _, vt = np.linalg.svd(c, full_matrices=False); nrm = vt[2]      # thinnest axis = palm normal
        palm = math.degrees(math.acos(min(1, abs(nrm[0]))))   # 0 = palm faces the thigh (±X), 90 = faces front/back
        flex = math.degrees((el - sh).angle(wr - el))
        r[s] = dict(elbow_flex_deg=round(flex, 1), elbow_gap_cm=round((inner - tx) * 100, 2), elbow_x_cm=round(el.x * sg * 100, 2),
                    upper_frontal_deg=round(frontal(sh, el), 1), fore_frontal_deg=round(frontal(el, wr), 1), palm_vs_thigh_deg=round(palm, 1),
                    hand_fwd_cm=round(-(wr.y - hips.y) * 100, 1))
    eo.to_mesh_clear(); ed.to_mesh_clear(); rows.append(r)
summ = {}
for s in 'LR':
    for k in rows[0][s]:
        vals = [r[s][k] for r in rows]
        summ[f'{s}.{k}'] = dict(min=min(vals), max=max(vals), worst_frame_max=rows[vals.index(max(vals))]['f'])
print('ARMQA', json.dumps(summ))
json.dump(dict(rows=rows, summary=summ), open(OUT, 'w'), indent=1)
