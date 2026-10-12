# Fit the cloth reference (drape_sim.py, cleaned by drape_fix.Projector) with what the runtime can play:
#   1. skirt panel bone corrections per clip frame (the existing skirt.* bones, names / hierarchy unchanged): per bone a
#      rotation about its head (weighted Kabsch on the vertices it drives, parents first, a few sweeps), smoothed in time
#   2. one "sit_drape" shape key per mesh = the remaining bind-space residual of the settled frames (sit_hold), sparse
#      (largest residuals first, budget KEY_BYTES), smooth fall-off at the edge of the selection
#   3. its weight curve per clip (least squares per frame, monotone 0 -> 1 over sit_down, 1 -> 0 over stand_up)
# Library used by build_drape.py.
import numpy as np

import sitlib as SL
import author_lib as AL

RG = SL.RG
DRESS_BONES = ('skirt.front', 'skirt.left', 'skirt.back', 'skirt.right',
               'skirt.front.low', 'skirt.left.low', 'skirt.back.low', 'skirt.right.low')
APRON_BONES = ('skirt.front.mid', 'skirt.front.low.mid')
KEY_BYTES = 20000          # per shape key, sparse accessor: uint16 index + 3 x float32 per vertex
MAX_STEP_DEG = 45.0


def kabsch(a, b, w):
    M = (b * w[:, None]).T @ a
    U, S, Vt = np.linalg.svd(M)
    d = np.sign(np.linalg.det(U @ Vt))
    return U @ np.diag([1, 1, d]) @ Vt


def clamp_rot(R, deg):
    v = RG.m2rotvec(R[None])[0]
    a = np.linalg.norm(v)
    lim = np.radians(deg)
    if a > lim:
        v = v * lim / a
    return RG.rotvec2m(v[None])[0]


class Fitter:
    def __init__(self, ch, mesh, bones):
        self.ch, self.mesh, self.bones = ch, mesh, bones
        rig = ch.rig
        md = ch.md[mesh]
        self.md = md
        self.bi = [rig.idx[b] for b in bones]
        self.wb = {}
        for b in bones:
            j = rig.idx[b]
            self.wb[b] = (md['W'] * (md['J'] == j)).sum(1)

    def lbs(self, Wm, extra=None):
        return self.ch.skin(self.mesh, Wm, extra=extra)

    def fit_frame(self, T, Q, C, free, sweeps=4, extra=None, S=None):
        """T, Q (S): local pose [J,3] / [J,4] ([J,3]); C: model-space target [V,3]; free: [V] bool (not pinned) -> new Q."""
        rig = self.ch.rig
        Q = Q.copy()
        for _ in range(sweeps):
            for b in self.bones:
                j = rig.idx[b]
                W = rig.fk(T[None], Q[None], None if S is None else S[None])[0]
                x = self.lbs(W, extra)
                w = self.wb[b]
                sel = (w > 0.3) & free
                if sel.sum() < 6:
                    continue
                h = W[j, :3, 3]
                R = kabsch(x[sel] - h, C[sel] - h, w[sel] ** 2)
                R = clamp_rot(R, MAX_STEP_DEG)
                P = W[rig.parent[j], :3, :3]
                P = P / np.linalg.norm(P, axis=0, keepdims=True)
                L = RG.q2m(Q[j][None])[0]
                Q[j] = RG.m2q((P.T @ R @ P @ L)[None])[0]
        return Q

    def smooth(self, Q, sigma, periodic):
        Q = Q.copy()
        for j in self.bi:
            R = RG.q2m(Q[:, j])
            Q[:, j] = RG.m2q(AL.rot_smooth(R, sigma, periodic))
        return Q

    def residual(self, T, Q, C, roots):
        """bind-space residual per frame: M^-1 (C - LBS) with the blended skin matrix of every vertex."""
        rig = self.ch.rig
        out = np.zeros((len(Q),) + C.shape[1:])
        for k in range(len(Q)):
            W = rig.fk(T[k][None], Q[k][None])[0]
            M = self.ch.skin_matrices(self.mesh, W)
            x = self.lbs(W)
            out[k] = np.einsum('nij,nj->ni', np.linalg.inv(M[:, :3, :3]), C[k] - x)
        return out


def sparse_key(D, inv, budget=KEY_BYTES, floor=0.0005):
    """keep the largest deltas within the byte budget; deltas below the cut fade out linearly over [cut/2, cut] so
    the selection has no step."""
    mag = np.linalg.norm(D, axis=1)
    nmax = budget // 14
    order = np.argsort(-mag)
    cut = max(floor, mag[order[min(nmax, len(order)) - 1]] if len(order) > nmax else floor)
    f = np.clip((mag - cut / 2) / (cut / 2), 0, 1)
    out = D * f[:, None]
    keep = np.linalg.norm(out, axis=1) > 1e-6
    while keep.sum() > nmax:
        cut *= 1.02
        f = np.clip((mag - cut / 2) / (cut / 2), 0, 1)
        out = D * f[:, None]
        keep = np.linalg.norm(out, axis=1) > 1e-6
    out[~keep] = 0
    return out, dict(verts=int(keep.sum()), cut_mm=round(cut * 1000, 2), bytes=int(keep.sum()) * 14 + 0)


def fit_weight(R, D, mask=None):
    """per-frame least-squares weight of the key D for residuals R [n,V,3] (only where D != 0)."""
    s = np.linalg.norm(D, axis=1) > 1e-6
    if mask is not None:
        s &= mask
    d = D[s].ravel()
    dd = float(d @ d)
    return np.array([float(R[k][s].ravel() @ d) / dd if dd > 0 else 0.0 for k in range(len(R))])
