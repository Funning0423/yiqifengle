# Clip building blocks: CMU take -> pose track on our rig at 30 fps (time warp, heading/position normalisation, mirroring,
# loop closure, blending to a reference pose).  Pose track = (Wr: bone -> [n,3,3] world rotation, hips: [n,3] world position)
# in the clip's root frame (glTF: Y up, +Z her forward, +X her left).
import os
import numpy as np
import rig as RG
import retarget as RT
import author_lib as AL

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
GLB = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
CMU = os.environ.get('CMU_DIR', '/tmp/cmu/raw')
FPS = 30
MAPPED = list(RT.TMAP.keys())

_rig = None
_ctx = None
_src = {}


def rig():
    global _rig
    if _rig is None:
        _rig = RG.Rig(os.environ.get('BASE_GLB', GLB))
    return _rig


def ctx():
    global _ctx
    if _ctx is None:
        _ctx = AL.Ctx(rig())
    return _ctx


class Take:
    """one CMU trial retargeted onto our rig (uniform scale = leg-length ratio)."""

    def __init__(self, trial, smooth=1.5):
        sid = trial.split('_')[0]
        key = (trial, smooth)
        if key not in _src:
            s = RT.Source(os.path.join(CMU, sid + '.asf'), os.path.join(CMU, trial + '.amc'))
            s.smooth(smooth)
            _src[key] = s
        self.trial = trial
        self.src = _src[key]
        self.rt = RT.Retargeter(rig(), self.src)
        self.scale = self.rt.leg_t / self.src.leg
        self.fps = self.src.fps

    def frames(self, t):
        return np.asarray(t, float) * self.fps

    def hip(self, t):
        return self.rt.hip_centre(self.frames(t))

    def heading(self, t):
        return np.unwrap(self.rt.heading(self.frames(t)))

    def track(self, t, yaw, origin, dy=0.0, hscale=1.0):
        """t: source seconds [n]; yaw: rotation applied (scalar); origin: source hip-centre xz that maps to x=z=0.
        returns Wr, hips."""
        f = self.frames(t)
        Wr = self.rt.world_rots(f, yaw)
        h = self.rt.hip_centre(f)
        Ry = RT.roty(yaw)
        p = h - np.array([origin[0], 0.0, origin[1]])
        p = p @ Ry.T * self.scale
        p[:, [0, 2]] *= hscale
        p[:, 1] += dy
        return Wr, p


    def contacts(self, t, h_tol=0.018, v_tol=0.35, ref=None):
        """foot contact masks at source seconds t from the performer's own markers (ankle / toe-base heights and speeds),
        keyed by OUR bone side ('R' = CMU l = her left)."""
        E = self.src.E
        f = np.clip(np.round(self.frames(t)).astype(int), 0, self.src.n - 1)
        out = {}
        for s, side in (('l', 'R'), ('r', 'L')):
            ank, toe = E[s + 'tibia'], E[s + 'foot']
            va = np.linalg.norm(np.gradient(ank[:, [0, 2]], axis=0), axis=1) * self.fps
            vt = np.linalg.norm(np.gradient(toe[:, [0, 2]], axis=0), axis=1) * self.fps
            fr = f if ref is None else np.arange(int(ref[0] * self.fps), int(ref[1] * self.fps))
            ba, bt = np.percentile(ank[fr, 1], 3 if ref is None else 50), np.percentile(toe[fr, 1], 3 if ref is None else 50)
            heel = (ank[f, 1] < ba + h_tol) & (va[f] < v_tol)
            ball = (toe[f, 1] < bt + h_tol * 0.8) & (vt[f] < v_tol)
            m = heel | ball
            for a, b in AL.intervals(~m):
                if b - a + 1 <= 2 and a > 0 and b < len(m) - 1:
                    m[a:b + 1] = True
            c = np.zeros_like(m)
            for a, b in AL.intervals(m, 3):
                c[a:b + 1] = True
            out[side] = c
        return out


def fk(Wr, hips):
    return ctx().fk(Wr, hips)


def soles(Wr, hips, W=None):
    c = ctx()
    if W is None:
        W = c.fk(Wr, hips)
    return {s: c.foot_verts(W, s) for s in 'LR'}


def floor_offset(Wr, hips):
    """vertical shift that puts the lowest sole vertex of the planted foot on y=0 (median over frames)."""
    V = soles(Wr, hips)
    low = np.minimum(V['L'][..., 1].min(1), V['R'][..., 1].min(1))
    return -np.percentile(low, 20)


def heel_strikes(C):
    return [i for i in range(1, len(C)) if C[i] and not C[i - 1]]


# ---------- pose-track algebra ----------
def tr_slice(tr, a, b):
    Wr, h = tr
    return {k: v[a:b] for k, v in Wr.items()}, h[a:b]


def tr_concat(*trs):
    Wr = {k: np.concatenate([t[0][k] for t in trs]) for k in trs[0][0]}
    return Wr, np.concatenate([t[1] for t in trs])


def tr_rotate(tr, yaw, pivot=(0, 0)):
    """rotate a pose track about the vertical axis (per-frame yaw allowed)."""
    Wr, h = tr
    yaw = np.broadcast_to(np.asarray(yaw, float), (len(h),))
    R = np.stack([RT.roty(a) for a in yaw])
    piv = np.array([pivot[0], 0, pivot[1]])
    h2 = np.einsum('nij,nj->ni', R, h - piv) + piv
    return {k: R @ v for k, v in Wr.items()}, h2


def tr_translate(tr, d):
    Wr, h = tr
    return dict(Wr), h + np.asarray(d, float)


def tr_blend(ta, tb, w):
    """per-frame blend (w=0 -> ta)."""
    w = np.asarray(w, float)
    Wr = {k: AL.rot_blend(ta[0][k], tb[0][k], w) for k in ta[0]}
    h = ta[1] * (1 - w)[:, None] + tb[1] * w[:, None]
    return Wr, h


def tr_const(pose, n):
    Wr, h = pose
    return {k: np.repeat(v[None], n, 0) for k, v in Wr.items()}, np.repeat(h[None], n, 0)


def tr_frame(tr, i):
    return {k: v[i] for k, v in tr[0].items()}, tr[1][i].copy()


def tr_resample(tr, fpos):
    """sample a track at fractional frame positions (slerp / lerp)."""
    Wr, h = tr
    n = len(h)
    f = np.clip(np.asarray(fpos, float), 0, n - 1)
    i0 = np.floor(f).astype(int)
    i1 = np.minimum(i0 + 1, n - 1)
    u = f - i0
    out = {}
    for k, v in Wr.items():
        q = RG.m2q(v)
        out[k] = RG.q2m(RG.slerp(q[i0], q[i1], u[:, None]))
    return out, h[i0] * (1 - u)[:, None] + h[i1] * u[:, None]


def tr_smooth(tr, sigma, periodic=False, bones=None):
    Wr, h = tr
    out = dict(Wr)
    for k in (bones or Wr.keys()):
        out[k] = AL.rot_smooth(Wr[k], sigma, periodic)
    return out, AL.gauss(h, sigma, periodic)


def close_loop(tr, end_pose):
    """distribute the residual between the frame after the last (end_pose) and frame 0 linearly over the clip so that
    the clip loops: frame n (== end_pose) maps onto frame 0."""
    Wr, h = tr
    n = len(h)
    u = np.arange(n) / n
    out = {}
    for k, v in Wr.items():
        D = Wr[k][0] @ end_pose[0][k].T                   # residual rotation end -> start
        rv = RG.m2rotvec(D[None])[0]
        out[k] = RG.rotvec2m(rv[None] * u[:, None]) @ v
    dh = h[0] - end_pose[1]
    return out, h + dh[None] * u[:, None]


def mirror(tr):
    """mirror a pose track across her sagittal plane (x -> -x), swapping .L/.R bones."""
    r = rig()
    Wr, h = tr
    M = np.diag([-1.0, 1, 1])
    rr = ctx().rest_rot
    out = {}
    for k, v in Wr.items():
        src = k
        dst = k[:-2] + ('.R' if k.endswith('.L') else '.L') if k.endswith(('.L', '.R')) else k
        D = v @ np.linalg.inv(rr[src])[None]                 # delta from rest (world)
        out[dst] = (M @ D @ M) @ rr[dst][None]
    h2 = h.copy()
    h2[:, 0] *= -1
    return out, h2


def to_clip(tr, skirt=None):
    """pose track -> local Q [n,J,4], T [n,J,3] for all 28 joints (skirt joints: rest unless given)."""
    r = rig()
    Q, T = AL.local_from_world(r, tr[0], tr[1])
    if skirt is not None:
        for k, q in skirt.items():
            Q[:, r.idx[k]] = q
    return Q, T


def from_clip(Q, T):
    """local arrays -> pose track (mapped bones only)."""
    r = rig()
    W = r.fk(T, Q)
    Wr = {}
    for k in MAPPED:
        M = W[:, r.idx[k], :3, :3]
        Wr[k] = M / np.linalg.norm(M, axis=-2, keepdims=True)
    return Wr, W[:, r.idx['hips'], :3, 3].copy()


def old_clip(name, fps=FPS, n=None):
    """sample an existing clip of the base GLB at fps -> (Q, T, track)."""
    r = rig()
    d = r.clip_duration(name)
    if n is None:
        n = int(round(d * fps)) + 1
    t = np.arange(n) / fps
    T, Q, S = r.sample_clip(name, np.minimum(t, d))
    return Q, T, from_clip(Q, T)


def pose_err(tra, trb):
    """per frame max bone angle (deg) between two tracks."""
    e = np.zeros(len(tra[1]))
    for k in tra[0]:
        R = np.einsum('nji,njk->nik', tra[0][k], trb[0][k])
        c = np.clip((np.trace(R, axis1=1, axis2=2) - 1) / 2, -1, 1)
        e = np.maximum(e, np.degrees(np.arccos(c)))
    return e
