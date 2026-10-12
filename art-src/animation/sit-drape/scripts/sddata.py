# Seated drape data in numpy (python3, glTF space: x = her left, y up, z = her forward; origin = seated controller root).
# - character: rig / skinning from the runtime GLB (mocap/scripts/rig.py = glTF linear blend skinning, what Cocos does)
# - chair: env_int_prop_reading_chair parts as boxes, measured from combined_visual_m.glb (chair-local, +Z = chair front)
#   and placed with the room's seat_anchor / chair_spec + CharacterReference.seatedRoot (same yaw as the seated character)
# - collider: body surface samples + normals (KD tree, signed distance along the nearest sample's normal), chair box SDF,
#   floor
import os, sys, math
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'art-src/animation/mocap/scripts'))
import rig as RG  # noqa: E402

CHR = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/character')
GLB = os.path.join(CHR, 'chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
ANIM_META = os.path.join(CHR, 'anim_meta.json')
FPS = 30

# room facts (creator-build-project/assets/scripts/world-r1/FirstsliceFacts.ts seat_anchor, CharacterReference.ts)
SEAT_ANCHOR = np.array([0.4203000068664551, 0.38, -4.2133002281188965])
SEAT_YAW = -2.0
SEATED_ROOT = np.array([0.4327299768730942, 0.0, -4.207611558444886])
CHAIR_SPEC = dict(width_m=0.4946, depth_m=0.3815, thickness_m=0.0389, back_height_m=0.862, seat_top_y_m=0.38)

# chair parts (chair-local AABBs of the connected components of env_int_prop_reading_chair in combined_visual_m.glb;
# legs and back posts are slightly splayed, their AABB is a conservative box)
CHAIR_BOXES = {
    'seat': ([-0.247, 0.341, -0.191], [0.247, 0.380, 0.191]),
    'seat_line_r': ([-0.101, 0.379, -0.145], [-0.097, 0.382, 0.145]),
    'seat_line_l': ([0.097, 0.379, -0.145], [0.101, 0.382, 0.145]),
    'leg_fr': ([-0.258, -0.001, 0.139], [-0.195, 0.365, 0.201]),
    'leg_br': ([-0.258, -0.001, -0.222], [-0.195, 0.365, -0.139]),
    'leg_fl': ([0.195, -0.001, 0.139], [0.258, 0.365, 0.202]),
    'leg_bl': ([0.195, -0.001, -0.222], [0.258, 0.365, -0.139]),
    'stretch_r': ([-0.246, 0.122, -0.191], [-0.220, 0.147, 0.191]),
    'stretch_l': ([0.220, 0.122, -0.191], [0.246, 0.147, 0.191]),
    'stretch_f': ([-0.223, 0.114, 0.178], [0.223, 0.140, 0.204]),
    'post_r': ([-0.242, 0.366, -0.265], [-0.199, 0.865, -0.156]),
    'post_l': ([0.199, 0.366, -0.265], [0.242, 0.865, -0.156]),
    'rail_low': ([-0.223, 0.461, -0.209], [0.223, 0.497, -0.172]),
    'rail_top': ([-0.223, 0.829, -0.277], [0.223, 0.895, -0.210]),
    'spindle_r': ([-0.141, 0.484, -0.256], [-0.113, 0.853, -0.178]),
    'spindle_c': ([-0.014, 0.484, -0.256], [0.014, 0.853, -0.178]),
    'spindle_l': ([0.113, 0.484, -0.256], [0.141, 0.853, -0.178]),
}


def seat_offset_local():
    d = SEAT_ANCHOR - SEATED_ROOT
    c, s = math.cos(SEAT_YAW), math.sin(SEAT_YAW)
    return np.array([c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]])


SEAT_OFF = seat_offset_local()          # seat-top centre in the seated root frame: (0, 0.38, +0.0137)


def chair_boxes():
    """boxes in the seated root frame: name -> (lo, hi)."""
    o = np.array([SEAT_OFF[0], 0.0, SEAT_OFF[2]])
    return {k: (np.array(a) + o, np.array(b) + o) for k, (a, b) in CHAIR_BOXES.items()}


def box_sdf(P, lo, hi):
    c = (lo + hi) / 2
    h = (hi - lo) / 2
    q = np.abs(P - c) - h
    out = np.linalg.norm(np.maximum(q, 0), axis=-1)
    ins = np.minimum(np.max(q, -1), 0)
    return out + ins


def chair_sdf(P, boxes=None):
    boxes = boxes or chair_boxes()
    d = np.full(len(P), np.inf)
    arg = np.zeros(len(P), int)
    for i, (lo, hi) in enumerate(boxes.values()):
        di = box_sdf(P, lo, hi)
        better = di < d
        d[better] = di[better]
        arg[better] = i
    return d, arg


TOP_BOXES = ('seat', 'seat_line_l', 'seat_line_r')


def chair_margin(P, name, lo, hi, top_m, edge_m):
    """per-point clearance: top_m straight above the seat's top face (she sits there: buttocks are 9.7 mm above it),
    edge_m everywhere else, so a cloth triangle whose vertices clear an edge by edge_m does not cut the sharp edge."""
    m = np.full(len(P), edge_m)
    if name in TOP_BOXES:
        over = (P[:, 0] > lo[0]) & (P[:, 0] < hi[0]) & (P[:, 2] > lo[2]) & (P[:, 2] < hi[2]) & (P[:, 1] > hi[1] - 0.004)
        m[over] = top_m
    return m


def chair_push_faces(P, top_m, edge_m, boxes=None):
    boxes = boxes or chair_boxes()
    push = np.zeros_like(P)
    for name, (lo, hi) in boxes.items():
        d = box_sdf(P, lo, hi)
        m = chair_margin(P, name, lo, hi, top_m, edge_m)
        bad = d < m
        if not bad.any():
            continue
        Q = P[bad]
        g = np.zeros_like(Q)
        e = 1e-4
        for k in range(3):
            dp = np.zeros(3)
            dp[k] = e
            g[:, k] = (box_sdf(Q + dp, lo, hi) - box_sdf(Q - dp, lo, hi)) / (2 * e)
        g /= np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
        push[bad] += g * (m[bad] - d[bad])[:, None]
    return push


def chair_push(P, margin, boxes=None):
    """displacement that moves each point to >= margin outside the nearest violated box (numerical gradient of the box sdf)."""
    boxes = boxes or chair_boxes()
    push = np.zeros_like(P)
    for lo, hi in boxes.values():
        d = box_sdf(P, lo, hi)
        bad = d < margin
        if not bad.any():
            continue
        Q = P[bad]
        g = np.zeros_like(Q)
        e = 1e-4
        for k in range(3):
            dp = np.zeros(3)
            dp[k] = e
            g[:, k] = (box_sdf(Q + dp, lo, hi) - box_sdf(Q - dp, lo, hi)) / (2 * e)
        g /= np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
        push[bad] += g * (margin - d[bad])[:, None]
    return push


# ---------------- character ----------------
class Char:
    def __init__(self, glb=GLB):
        self.rig = RG.Rig(glb)
        r = self.rig
        self.md = {k: r.mesh_data('LOD0_G2_' + k) for k in ('DRESS', 'APRON', 'BODY', 'BOW')}
        names = np.array(r.names)
        body = self.md['BODY']
        dom = names[body['J'][np.arange(len(body['J'])), body['W'].argmax(1)]]
        self.body_dom = dom
        base = np.array([n.split('.')[0] for n in dom])
        P = body['P']
        cls = np.full(len(P), 'torso', dtype=object)
        cls[np.isin(base, ['thigh', 'shin', 'foot'])] = 'legs'
        cls[(base == 'hips') & (P[:, 1] < 1.0)] = 'legs'
        cls[base == 'hand'] = np.array(['hand_' + n[-1] for n in dom[base == 'hand']], dtype=object)
        arm = np.isin(base, ['upper_arm', 'forearm'])
        cls[arm] = np.array(['sleeve_' + n[-1] for n in dom[arm]], dtype=object)
        cls[np.isin(base, ['head', 'neck'])] = 'head'
        self.body_cls = cls
        for k in ('DRESS', 'APRON'):
            m = self.md[k]
            m['dom'] = names[m['J'][np.arange(len(m['J'])), m['W'].argmax(1)]]
        self.skirt = [n for n in r.names if n.startswith('skirt')]
        self.sidx = [r.idx[n] for n in self.skirt]

    def local(self, clip, t):
        T, R, S = self.rig.sample_clip(clip, [t])
        return T[0], R[0], S[0]

    def world(self, T, R, S=None):
        return self.rig.fk(T[None], R[None], None if S is None else S[None])[0]

    def skin(self, key, W):
        return self.rig.skin(self.md[key], W)


def weld(P, tol=1e-5):
    """position weld: returns (rep index per vertex, unique count). UV / normal seams become one node."""
    key = np.round(P / tol).astype(np.int64)
    _, rep, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return inv.ravel(), len(rep)


def edges_of(F):
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    e = np.sort(e, 1)
    return np.unique(e, axis=0)


def face_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    a = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.maximum(a, 1e-12), a[:, 0] / 2


def vertex_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    vn = np.zeros_like(V)
    for k in range(3):
        np.add.at(vn, F[:, k], n)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)


class SurfaceSDF:
    """signed distance to a closed-ish triangle surface, approximated by the nearest of dense surface samples
    (vertices + barycentric face samples), sign from that sample's face normal."""

    def __init__(self, V, F, sub=4):
        fn, area = face_normals(V, F)
        pts, nrm = [], []
        bary = []
        for i in range(sub + 1):
            for j in range(sub + 1 - i):
                bary.append((i / sub, j / sub, 1 - (i + j) / sub))
        bary = np.array(bary)
        for b in bary:
            pts.append(V[F[:, 0]] * b[0] + V[F[:, 1]] * b[1] + V[F[:, 2]] * b[2])
            nrm.append(fn)
        self.P = np.concatenate(pts)
        self.N = np.concatenate(nrm)
        self.tree = cKDTree(self.P)

    def query(self, X, k=4):
        d, i = self.tree.query(X, k=k)
        # signed distance per neighbour, take the neighbour average of normals for a smoother field
        n = self.N[i].mean(1)
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        q = self.P[i[:, 0]]
        s = np.sum((X - q) * n, 1)
        return s, n, d[:, 0]
