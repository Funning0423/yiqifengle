# Shared by the sit-drape QA / solver / renders (run inside Blender: numpy + mathutils.bvhtree).
# The character is placed exactly like the driver does it (WorldIntegrationBoot FlowReferenceStandin): controller root moved
# linearly between CharacterReference.standingRoot and .seatedRoot over sit_down / stand_up, yaw = seatYawRad, scale 1.
# All positions are game world space (glTF: Y up, metres); the chair / floor come from data/chair_floor.npz (extract_chair.py).
import json
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'art-src/animation/mocap/scripts'))
import rig as RG  # noqa: E402

CHR = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/character')
GLB = os.path.join(CHR, 'chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
ANIM_META = os.path.join(CHR, 'anim_meta.json')
CHAIR_NPZ = os.path.join(HERE, '..', 'data', 'chair_floor.npz')
STANDING = np.array([-0.016162758009872102, 0.0, -4.413050709661525])    # CharacterReference.ts standingRoot
SEATED = np.array([0.4327299768730942, 0.0, -4.207611558444886])         # CharacterReference.ts seatedRoot
YAW = -2.0                                                                # seatYawRad
SEAT_TOP = 0.38
FPS = 30
CLIPS = ('sit_down', 'sit_hold', 'stand_up')
MESHES = ('DRESS', 'APRON', 'BODY')


def roty(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def root_matrix(clip, t, dur):
    u = 0.0 if dur <= 0 else min(max(t / dur, 0.0), 1.0)
    if clip == 'sit_down':
        p = STANDING + (SEATED - STANDING) * u
    elif clip == 'stand_up':
        p = SEATED + (STANDING - SEATED) * u
    else:
        p = SEATED
    M = np.eye(4)
    M[:3, :3] = roty(YAW)
    M[:3, 3] = p
    return M


CHAIR_R = roty(YAW)                                   # chair local -> world rotation (local +Z = chair front)
CHAIR_O = np.array([0.4203000068664551, 0.0, -4.2133002281188965])


def to_chair(P):
    return (np.asarray(P) - CHAIR_O) @ CHAIR_R


def from_chair(L):
    return np.asarray(L) @ CHAIR_R.T + CHAIR_O


def frame_times(clip, dur):
    n = int(round(dur * FPS))
    return np.arange(n + (0 if clip == 'sit_hold' else 1)) / FPS


# ------------------------------------------------------------------ morph targets (dense or sparse POSITION accessors)
def read_accessor(J, BIN, i):
    a = J['accessors'][i]
    n = RG.NC[a['type']]
    if 'bufferView' in a:
        out = RG.acc(J, BIN, i)
    else:
        out = np.zeros((a['count'], n))
    sp = a.get('sparse')
    if sp:
        ii = sp['indices']
        bv = J['bufferViews'][ii['bufferView']]
        idx = np.frombuffer(BIN, RG.CT[ii['componentType']], count=sp['count'],
                            offset=bv.get('byteOffset', 0) + ii.get('byteOffset', 0)).astype(int)
        vv = sp['values']
        bv = J['bufferViews'][vv['bufferView']]
        val = np.frombuffer(BIN, RG.CT[a['componentType']], count=sp['count'] * n,
                            offset=bv.get('byteOffset', 0) + vv.get('byteOffset', 0)).reshape(-1, n).astype(float)
        out = np.array(out)
        out[idx] = val
    return out


def read_targets(J, BIN, mesh_name):
    m = [x for x in J['meshes'] if x['name'] == mesh_name][0]
    names = (m.get('extras') or {}).get('targetNames') or []
    per = []
    for pr in m['primitives']:
        per.append([read_accessor(J, BIN, t['POSITION']) for t in pr.get('targets', [])])
    out = {}
    for k in range(len(per[0]) if per else 0):
        out[names[k] if k < len(names) else 'target%d' % k] = np.concatenate([p[k] for p in per])
    return out


# ------------------------------------------------------------------ welded topology (UV seams split vertices in the GLB)
def weld(P, F, tol=1e-5):
    key = np.round(P / tol).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    Fw = inv[F]
    e = np.sort(np.concatenate([Fw[:, [0, 1]], Fw[:, [1, 2]], Fw[:, [2, 0]]]), 1)
    eu, cnt = np.unique(e, axis=0, return_counts=True)
    bnd = eu[cnt == 1]
    bv = np.zeros(inv.max() + 1, bool)
    bv[bnd.ravel()] = True
    return inv, Fw, bv[inv]          # weld map, welded faces, per original vertex: on an open boundary (hem, neck, ...)


class Character:
    def __init__(self, glb=GLB):
        self.glb = glb
        self.rig = RG.Rig(glb)
        J, BIN = self.rig.J, self.rig.BIN
        self.md = {k: self.rig.mesh_data('LOD0_G2_' + k) for k in MESHES + ('BOW',)}
        self.targets = {k: read_targets(J, BIN, 'LOD0_G2_' + k) for k in MESHES + ('BOW',)}
        self.dur = {c: self.rig.clip_duration(c) for c in CLIPS}
        self.topo = {k: weld(self.md[k]['P'], self.md[k]['F']) for k in MESHES}
        body = self.md['BODY']
        dom = body['J'][np.arange(len(body['J'])), body['W'].argmax(1)]
        nm = np.array(self.rig.names)[dom]
        self.body_bone = nm
        base = np.array([n.split('.')[0] for n in nm])
        self.base = base
        P = body['P']
        self.ids = dict(leg=np.where(np.isin(base, ['thigh', 'shin']))[0],
                        thigh=np.where(base == 'thigh')[0],
                        foot=np.where(base == 'foot')[0],
                        hand=np.where(base == 'hand')[0],
                        arm=np.where(np.isin(base, ['upper_arm', 'forearm', 'hand']))[0],
                        hips=np.where(base == 'hips')[0],
                        torso=np.where(np.isin(base, ['hips', 'spine', 'chest']))[0],
                        head=np.where(np.isin(base, ['neck', 'head']))[0])
        self.P0 = P
        F = body['F']
        self.body_part_faces = {}
        for k, ids in self.ids.items():
            s = np.zeros(len(P), bool)
            s[ids] = True
            self.body_part_faces[k] = F[s[F].all(1)]
        # dress / apron vertex -> panel name of its dominant bone (skirt.front*, ... or 'top')
        self.panel = {}
        for k in ('DRESS', 'APRON'):
            m = self.md[k]
            d = m['J'][np.arange(len(m['J'])), m['W'].argmax(1)]
            nmk = np.array(self.rig.names)[d]
            self.panel[k] = np.array([x.split('.')[1] if x.startswith('skirt') else 'top' for x in nmk])
            self.panel[k + '_bone'] = nmk

    def joints(self, clip, t, local=None):
        """world joint matrices [J,4,4] at clip time t (driver root placement). local: optional (T, R) override."""
        if local is None:
            T, R, S = self.rig.sample_clip(clip, [t])
        else:
            T, R = local
            T, R = T[None], R[None]
            S = None
        W = self.rig.fk(T, R, S)[0]
        return root_matrix(clip, t, self.dur.get(clip, 0.0))[None] @ W

    def skin(self, mesh, W, weights=None, extra=None):
        md = self.md[mesh]
        P = md['P']
        if weights:
            P = P.copy()
            for name, w in weights.items():
                if w and name in self.targets[mesh]:
                    P = P + w * self.targets[mesh][name]
        if extra is not None:
            P = P + extra
        Sk = W @ self.rig.ibm
        out = np.zeros_like(P)
        for k in range(4):
            M = Sk[md['J'][:, k]]
            out += md['W'][:, k:k + 1] * (np.einsum('nij,nj->ni', M[:, :3, :3], P) + M[:, :3, 3])
        return out

    def skin_matrices(self, mesh, W):
        """blended LBS matrix per vertex [V,4,4] (bind -> world); its 3x3 inverse maps world deltas to morph deltas."""
        md = self.md[mesh]
        Sk = W @ self.rig.ibm
        M = np.zeros((len(md['P']), 4, 4))
        for k in range(4):
            M += md['W'][:, k:k + 1, None] * Sk[md['J'][:, k]]
        return M


# ------------------------------------------------------------------ the driver's sit -> hold -> stand sequence (cloth sim timeline)
PRE = 20                   # standing pre-roll frames (sit_down frame 0) for the cloth to settle
HOLD_LOOPS = 2
POST = 10
CROSSFADE_F = 6            # CharacterMotion.CROSSFADE_S = 0.2 s, linear, the outgoing clip keeps running (clamped)


def sequence(ch):
    """per sim frame: dict(root 4x4, T, R local pose, base=(clip, t), out=(clip, t, w) | None) following
    WorldIntegrationBoot: sit_down while the root moves to the seat -> sit_hold (loop, faded in from the sit_down end
    pose) -> stand_up from sit_hold phase 0 after HOLD_LOOPS loops (faded in) while the root moves back -> hold."""
    d_sd, d_sh, d_su = ch.dur['sit_down'], ch.dur['sit_hold'], ch.dur['stand_up']
    n_sd, n_sh, n_su = int(round(d_sd * FPS)), int(round(d_sh * FPS)), int(round(d_su * FPS))
    frames = []
    for f in range(PRE):
        frames.append(dict(base=('sit_down', 0.0), out=None, root=root_matrix('sit_down', 0.0, d_sd)))
    for k in range(n_sd + 1):
        frames.append(dict(base=('sit_down', k / FPS), out=None, root=root_matrix('sit_down', k / FPS, d_sd)))
    for k in range(1, n_sh * HOLD_LOOPS + 1):
        tau = k / FPS
        w = max(0.0, 1 - k / CROSSFADE_F)
        frames.append(dict(base=('sit_hold', tau % d_sh), out=('sit_down', d_sd, w) if w > 0 else None,
                           root=root_matrix('sit_hold', 0, d_sh)))
    t_hold_end = (n_sh * HOLD_LOOPS) / FPS
    for k in range(1, n_su + 1):
        w = max(0.0, 1 - k / CROSSFADE_F)
        frames.append(dict(base=('stand_up', k / FPS), out=('sit_hold', (t_hold_end + k / FPS) % d_sh, w) if w > 0 else None,
                           root=root_matrix('stand_up', k / FPS, d_su)))
    for k in range(POST):
        frames.append(dict(base=('stand_up', d_su), out=None, root=root_matrix('stand_up', d_su, d_su)))
    f_sd = PRE
    f_sh2 = PRE + n_sd + n_sh * (HOLD_LOOPS - 1)          # sit_hold phase 0 of the last loop
    f_su = PRE + n_sd + n_sh * HOLD_LOOPS                 # = stand_up frame 0 (sit_hold phase 0, pure)
    index = dict(sit_down=[f_sd + k for k in range(n_sd + 1)], sit_hold=[f_sh2 + k for k in range(n_sh)],
                 stand_up=[f_su + k for k in range(n_su + 1)])
    for fr in frames:
        T, R = pose_at(ch, *fr['base'])
        if fr['out']:
            c, t, w = fr['out']
            To, Ro = pose_at(ch, c, t)
            T = To + (T - To) * (1 - w)
            R = slerp_rows(Ro, R, 1 - w)
        fr['T'], fr['R'] = T, R
    return frames, index


def slerp_rows(a, b, u):
    out = np.zeros_like(a)
    for j in range(len(a)):
        bj = b[j] if np.dot(a[j], b[j]) >= 0 else -b[j]
        c = np.clip(np.dot(a[j], bj), -1, 1)
        if c > 0.9995:
            q = a[j] + (bj - a[j]) * u
        else:
            th = np.arccos(c)
            q = (np.sin((1 - u) * th) * a[j] + np.sin(u * th) * bj) / np.sin(th)
        out[j] = q / np.linalg.norm(q)
    return out


_pose_cache = {}


def pose_at(ch, clip, t):
    key = (id(ch), clip, round(t, 6))
    if key not in _pose_cache:
        T, R, _ = ch.rig.sample_clip(clip, [t])
        _pose_cache[key] = (T[0], R[0])
    return _pose_cache[key]


def world_joints(ch, fr):
    return fr['root'][None] @ ch.rig.fk(fr['T'][None], fr['R'][None])[0]


# ------------------------------------------------------------------ chair / floor
class Chair:
    """convex parts of the chair (signed distance = max over the part's face planes inside, BVH distance outside)."""

    def __init__(self, path=CHAIR_NPZ):
        d = np.load(path)
        self.V, self.F = d['chair_V'], d['chair_F']
        self.floorV, self.floorF = d['floor_V'], d['floor_F']
        try:
            from mathutils import Vector
            from mathutils.bvhtree import BVHTree
            self.tree = BVHTree.FromPolygons([Vector(v) for v in self.V], self.F.tolist())
        except ImportError:          # plain python3: inside_depth / seat_height only
            Vector = BVHTree = None
            self.tree = None
        inv, Fw, _ = weld(self.V, self.F, 1e-4)
        # connected components of the welded mesh = convex parts
        lab = np.arange(inv.max() + 1)

        def find(i):
            while lab[i] != i:
                lab[i] = lab[lab[i]]
                i = lab[i]
            return i
        for f in Fw:
            a = find(f[0])
            for b in f[1:]:
                rb = find(b)
                if rb != a:
                    lab[rb] = a
        comp = np.array([find(i) for i in range(len(lab))])
        fcomp = comp[Fw[:, 0]]
        self.parts = []
        L = to_chair(self.V)
        for c in np.unique(fcomp):
            fi = np.where(fcomp == c)[0]
            tri = self.V[self.F[fi]]
            n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
            ln = np.linalg.norm(n, axis=1)
            ok = ln > 1e-12
            n = n[ok] / ln[ok, None]
            v0 = tri[ok, 0]
            cen = self.V[np.unique(self.F[fi])].mean(0)
            s = np.sign(np.einsum('ij,ij->i', n, v0 - cen))
            n = n * np.where(s == 0, 1, s)[:, None]
            b = -np.einsum('ij,ij->i', n, v0)
            Lp = L[np.unique(self.F[fi])]
            self.parts.append(dict(n=n, b=b, faces=fi, lmin=Lp.min(0), lmax=Lp.max(0), name=self._name(Lp)))
        self.seat_parts = [i for i, p in enumerate(self.parts) if p['name'] in ('seat', 'piping')]
        self.Vector = Vector
        self.BVHTree = BVHTree

    @staticmethod
    def _name(Lp):
        mn, mx = Lp.min(0), Lp.max(0)
        if mx[1] <= 0.3801 and mn[1] >= 0.34 and mx[0] - mn[0] > 0.4:
            return 'seat'
        if mn[1] > 0.378 and mx[1] < 0.39:
            return 'piping'
        if mx[1] < 0.37 and mn[1] < 0.01:
            return 'leg'
        if mx[1] < 0.16:
            return 'stretcher'
        if mn[1] > 0.45 and mx[1] - mn[1] < 0.08:
            return 'rail'
        if mn[2] < -0.15 and mn[1] > 0.35 and mx[0] - mn[0] < 0.06:
            return 'back_post' if abs((mn[0] + mx[0]) / 2) > 0.15 else 'back_slat'
        return 'other'

    def inside_depth(self, P, parts=None):
        """per point: max penetration depth (m, >= 0) over the convex parts and the part index (-1 = outside)."""
        P = np.asarray(P)
        depth = np.zeros(len(P))
        which = -np.ones(len(P), int)
        for i, p in enumerate(self.parts):
            if parts is not None and i not in parts:
                continue
            d = P @ p['n'].T + p['b']
            m = d.max(1)
            ins = m < 0
            dd = np.where(ins, -m, 0.0)
            upd = dd > depth
            depth[upd] = dd[upd]
            which[upd] = i
        return depth, which

    def signed(self, P, maxd=0.1):
        """signed distance to the chair surface (negative inside), clipped to maxd outside."""
        depth, which = self.inside_depth(P)
        out = np.full(len(P), maxd)
        L = to_chair(P)
        near = (L[:, 0] > -0.38) & (L[:, 0] < 0.38) & (L[:, 2] > -0.40) & (L[:, 2] < 0.36) & (L[:, 1] < 1.0)
        V = self.Vector
        for i in np.where(near & (which < 0))[0]:
            r = self.tree.find_nearest(V(P[i]), maxd)
            if r[0] is not None:
                out[i] = r[3]
        out[which >= 0] = -depth[which >= 0]
        return out

    def seat_height(self, L):
        """seat surface height (chair local xz -> y): 0.38, piping strips 0.382; nan outside the slab."""
        x, z = L[:, 0], L[:, 2]
        y = np.full(len(L), np.nan)
        on = (np.abs(x) <= 0.247) & (np.abs(z) <= 0.191)
        y[on] = SEAT_TOP
        for p in self.parts:
            if p['name'] == 'piping':
                m = on & (x >= p['lmin'][0]) & (x <= p['lmax'][0]) & (z >= p['lmin'][2]) & (z <= p['lmax'][2])
                y[m] = p['lmax'][1]
        return y


def bvh(P, F):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    return BVHTree.FromPolygons([Vector(v) for v in P], np.asarray(F).tolist())


def face_normals(P, F):
    n = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def signed_to_surface(points, tree, P, F, maxd=0.03, cos_min=0.95):
    """signed distance of points to an (open) surface along its face normal, only where the closest point is the
    perpendicular foot on a face (|cos| >= cos_min), else nan.  Returns d [n] (positive = on the normal side)."""
    from mathutils import Vector
    out = np.full(len(points), np.nan)
    for i, p in enumerate(points):
        r = tree.find_nearest(Vector(p), maxd)
        if r[0] is None:
            continue
        q = np.array(r[0])
        n = np.array(r[1])
        d = np.asarray(p) - q
        L = np.linalg.norm(d)
        if L < 1e-7:
            out[i] = 0.0
            continue
        c = float(d @ n) / L
        if abs(c) >= cos_min:
            out[i] = L if c > 0 else -L
    return out


def load_meta(path=ANIM_META):
    with open(path) as f:
        return json.load(f)


def curve_at(pts, t):
    if not pts:
        return 0.0
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return float(np.clip(np.interp(t, xs, ys), 0, 1))


def morph_weights(meta, clip, t):
    m = (meta.get('clips', {}).get(clip) or {}).get('morph') or {}
    return {k: curve_at(v, t) for k, v in (m.get('curves') or {}).items()}
