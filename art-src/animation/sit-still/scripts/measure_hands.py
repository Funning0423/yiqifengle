# blender -b -P measure_hands.py -- <glb> <out.json>
# sit_hold t=0, sit_drape=1: hand/sleeve triangle overlaps and how far hand vertices sit through the apron.
import bpy, sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'sit-drape', 'scripts'))
import numpy as np
from mathutils import Vector
import sdlib as S

a = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
ch = S.Character(GLB)
for n in ('LOD0_G2_DRESS', 'LOD0_G2_APRON'):
    sk = ch.mesh[n].data.shape_keys
    if sk:
        for kb in sk.key_blocks[1:]:
            kb.value = 1.0 if kb.name == 'sit_drape' else 0.0
ch.pose('sit_hold', 0.0)
cls = np.array(S.body_parts(ch))
body = ch.deformed('LOD0_G2_BODY')
apron = ch.deformed('LOD0_G2_APRON')
dress = ch.deformed('LOD0_G2_DRESS')
BF = ch.faces('LOD0_G2_BODY')
parts = {}
for f in BF:
    parts.setdefault(cls[f[0]], []).append(f)


def depth(name, clothV, clothF):
    sel = np.where(cls == name)[0]
    V = body[sel]
    tree = S.bvh(clothV, clothF)
    signed = []
    for p in V:
        loc, normal, idx, dist = tree.find_nearest(Vector(p))
        if loc is None:
            continue
        signed.append(float((Vector(p) - loc).dot(normal)))
    signed = np.array(signed)
    neg = -signed[signed < 0]
    return dict(verts=int(len(V)),
                signed_mm=[round(float(np.percentile(signed, q)) * 1000, 2) for q in (0, 5, 50)],
                penetrating=int((signed < -0.001).sum()),
                depth_mm=dict(max=round(float(neg.max()) * 1000, 2) if len(neg) else 0,
                              p95=round(float(np.percentile(neg, 95)) * 1000, 2) if len(neg) else 0,
                              mean=round(float(neg.mean()) * 1000, 2) if len(neg) else 0))


hb = {k: S.bvh(body, v) for k, v in parts.items()}
ab = S.bvh(apron, ch.faces('LOD0_G2_APRON'))
db = S.bvh(dress, ch.faces('LOD0_G2_DRESS'))
pairs = {}
for h in ('hand_L', 'hand_R', 'sleeve_L', 'sleeve_R'):
    if h not in hb:
        continue
    pairs[h + '-apron'] = len(hb[h].overlap(ab))
    pairs[h + '-dress'] = len(hb[h].overlap(db))
# legs / skirt, so a hand edit can be checked against the settled-frame acceptance
legs = parts.get('legs', [])
lb = S.bvh(body, legs)
pairs['legs-dress'] = len(lb.overlap(db))
pairs['legs-apron'] = len(lb.overlap(ab))
pairs['apron-dress'] = len(ab.overlap(db))
def overlap_depth(hand_name, clothV, clothF):
    """Deepest hand vertex of an intersecting pair, measured through the cloth face along its upward normal."""
    hf = [f for f in BF if cls[f[0]] == hand_name]
    if len(hf) < 1:
        return dict(pairs=0)
    hb = S.bvh(body, hf)
    cb = S.bvh(clothV, clothF)
    bone = hand_name[-1]
    wrist = np.array(ch.arm.matrix_world @ ch.arm.pose.bones['hand.' + bone].head)
    depths = []
    where = []
    for i, j in hb.overlap(cb):
        hv = body[hf[i]]
        cv = clothV[clothF[j]]
        n = np.cross(cv[1] - cv[0], cv[2] - cv[0])
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            continue
        n = n / ln
        if n[2] < 0:
            n = -n
        if n[2] < 0.35:
            continue
        d = n @ (cv[0] - hv).T
        k = int(np.argmax(d))
        depths.append(float(d[k]))
        where.append(float(np.linalg.norm(hv[k] - wrist)))
    if not depths:
        return dict(pairs=0, depth_mm=0)
    a = np.array(depths)
    w = np.array(where)
    pos = a > 0
    def pack(mask):
        if not mask.any():
            return dict(n=0)
        x = a[mask]
        return dict(n=int(mask.sum()), max=round(float(x.max()) * 1000, 2),
                    p95=round(float(np.percentile(x, 95)) * 1000, 2),
                    median=round(float(np.median(x)) * 1000, 2))
    return dict(pairs=int(len(a)), through_mm=pack(pos),
                near_wrist_8cm=pack(pos & (w < 0.08)), far=pack(pos & (w >= 0.08)))


def vertical_gap(name, tree):
    """How far hand vertices sit under an upward-facing apron/dress face (Blender +Z = up)."""
    sel = np.where(cls == name)[0]
    under, over = [], []
    up = Vector((0, 0, 1))
    for p in body[sel]:
        o = Vector(p)
        loc, normal, idx, dist = tree.ray_cast(o, up, 0.08)
        if loc is not None and normal.z > 0.4:
            under.append((loc.z - o.z) * 1000)
        loc, normal, idx, dist = tree.ray_cast(o, -up, 0.08)
        if loc is not None and normal.z > 0.4:
            over.append((o.z - loc.z) * 1000)
    def pack(xs):
        if not xs:
            return dict(n=0)
        a = np.array(xs)
        return dict(n=int(len(a)), max=round(float(a.max()), 2), p95=round(float(np.percentile(a, 95)), 2),
                    median=round(float(np.median(a)), 2))
    return dict(below_surface_mm=pack(under), above_surface_mm=pack(over))


report = dict(overlaps=pairs,
              hand_L_apron=depth('hand_L', apron, ch.faces('LOD0_G2_APRON')),
              hand_R_apron=depth('hand_R', apron, ch.faces('LOD0_G2_APRON')),
              hand_L_dress=depth('hand_L', dress, ch.faces('LOD0_G2_DRESS')),
              hand_R_dress=depth('hand_R', dress, ch.faces('LOD0_G2_DRESS')),
              through=dict(L_apron=overlap_depth('hand_L', apron, ch.faces('LOD0_G2_APRON')),
                           R_apron=overlap_depth('hand_R', apron, ch.faces('LOD0_G2_APRON')),
                           L_dress=overlap_depth('hand_L', dress, ch.faces('LOD0_G2_DRESS')),
                           R_dress=overlap_depth('hand_R', dress, ch.faces('LOD0_G2_DRESS'))),
              gap=dict(L_apron=vertical_gap('hand_L', ab), R_apron=vertical_gap('hand_R', ab),
                       L_dress=vertical_gap('hand_L', db), R_dress=vertical_gap('hand_R', db)))
json.dump(report, open(OUT, 'w'), indent=1)
print(json.dumps(report, indent=1))
