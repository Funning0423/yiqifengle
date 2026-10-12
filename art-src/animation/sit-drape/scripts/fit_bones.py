# Stage 2 (python3): fit the 8 skirt bones of the SEATED pose (sit_hold t=0) to the cloth-sim target (sim_dress.py).
#   python3 fit_bones.py <sim.npz> <out.npz> [key=settled]
# Unknowns: one rigid world correction D_b (rotation about the bone's vertex centroid + translation) per skirt bone
# (front, front.low, left, left.low, back, back.low, right, right.low). The zero-offset children front.mid / front.low.mid
# keep their local transform, so they follow their parent (D_mid = D_parent). Skinned position = glTF LBS (what Cocos does):
#   v' = sum_b w_vb * D_b(S_b v)    (S_b = current skin matrix, D_b = identity for every non-skirt bone)
# Terms: dress vertices -> sim target (welded nodes, smoothed target), bow vertices -> stay where they are.
# Output: per-bone world correction (R, t, pivot), plus the new local T / R of every skirt bone at sit_hold t=0.
import sys, os
import numpy as np
from scipy.optimize import least_squares
import sddata as D
import rig as RG

FIT = ['skirt.front', 'skirt.front.low', 'skirt.left', 'skirt.left.low', 'skirt.back', 'skirt.back.low', 'skirt.right', 'skirt.right.low']
FOLLOW = {'skirt.front.mid': 'skirt.front', 'skirt.front.low.mid': 'skirt.front.low'}


def per_bone_points(rig, md, W):
    """u[b] = S_b v for every influence: returns U [V,4,3] (per influence slot) and the slot bone index."""
    Sk = W @ rig.ibm
    U = np.zeros(md['J'].shape + (3,))
    for k in range(4):
        Mk = Sk[md['J'][:, k]]
        U[:, k] = np.einsum('nij,nj->ni', Mk[:, :3, :3], md['P']) + Mk[:, :3, 3]
    return U


class Model:
    def __init__(self, char, W):
        self.c, self.r, self.W = char, char.rig, W
        r = self.r
        self.bi = [r.idx[b] for b in FIT]
        slot = {r.idx[b]: i for i, b in enumerate(FIT)}
        for f, p in FOLLOW.items():
            slot[r.idx[f]] = FIT.index(p)
        self.slot = slot
        self.parts = {}
        for key in ('DRESS', 'BOW', 'APRON'):
            md = char.md[key]
            U = per_bone_points(r, md, W)
            S = np.full(md['J'].shape, -1)
            for k in range(4):
                for j, s in slot.items():
                    S[md['J'][:, k] == j, k] = s
            self.parts[key] = dict(U=U, S=S, Wt=md['W'])
        # pivots: weight-averaged dress points per bone
        Pd = self.parts['DRESS']
        piv = np.zeros((len(FIT), 3))
        for i in range(len(FIT)):
            w = (Pd['Wt'] * (Pd['S'] == i)).sum(1)
            piv[i] = (w[:, None] * D_pos(Pd)).sum(0) / max(w.sum(), 1e-9)
        self.piv = piv

    def transforms(self, x):
        x = x.reshape(-1, 6)
        R = np.array([RG.rotvec2m(v) for v in x[:, :3]])
        return R, x[:, 3:]

    def pos(self, key, x):
        R, t = self.transforms(x)
        p = self.parts[key]
        U, S, Wt = p['U'], p['S'], p['Wt']
        out = np.zeros(U.shape[0:1] + (3,))
        for k in range(4):
            u = U[:, k]
            s = S[:, k]
            m = s >= 0
            v = u.copy()
            if m.any():
                ss = s[m]
                v[m] = np.einsum('nij,nj->ni', R[ss], u[m] - self.piv[ss]) + self.piv[ss] + t[ss]
            out += Wt[:, k:k + 1] * v
        return out


def D_pos(p):
    return (p['Wt'][:, :, None] * p['U']).sum(1)


def new_locals(char, W, R, t, piv, T0, R0):
    """world corrections -> new local T/R for every skirt bone (parents first)."""
    r = char.rig
    Wn = W.copy()
    for i, b in enumerate(FIT):
        j = r.idx[b]
        Dm = np.eye(4)
        Dm[:3, :3] = R[i]
        Dm[:3, 3] = piv[i] + t[i] - R[i] @ piv[i]
        Wn[j] = Dm @ W[j]
    T, Rq = T0.copy(), R0.copy()
    for f, p in FOLLOW.items():
        Wn[r.idx[f]] = Wn[r.idx[p]] @ np.linalg.inv(W[r.idx[p]]) @ W[r.idx[f]]
    for b in FIT + list(FOLLOW):
        j = r.idx[b]
        pj = r.parent[j]
        L = np.linalg.inv(Wn[pj]) @ Wn[j]
        T[j] = L[:3, 3]
        Rq[j] = RG.qnorm(RG.m2q(L[:3, :3]))
    return T, Rq


def main():
    a = sys.argv[1:]
    sim = np.load(a[0])
    key = a[2] if len(a) > 2 else 'settled'
    tgt = sim[key]
    clip, tc = ('sit_hold', 0.0) if key == 'settled' else ('sit_down', float(key.split('_')[-1]))
    c = D.Char()
    T0, R0, S0 = c.local(clip, tc)
    W = c.world(T0, R0, S0)
    m = Model(c, W)
    bow0 = c.skin('BOW', W)
    x0 = np.load(a[3])['x'] if len(a) > 3 else np.zeros(6 * len(FIT))
    # waistband (rest y > WAIST_Y): dress -> the sim (pinned there, ~ its old place), apron -> stays put; the big skirt-bone
    # rotations must not drag the partly skirt-weighted waistbands through each other
    WAIST_Y = 1.0
    wd = np.where(c.md['DRESS']['P'][:, 1] > WAIST_Y, 25.0, 1.0)
    waist = c.md['DRESS']['P'][:, 1] > WAIST_Y
    tgt = tgt.copy()
    tgt[waist] = c.skin('DRESS', W)[waist]
    apron0 = c.skin('APRON', W)
    wa = np.where(c.md['APRON']['P'][:, 1] > WAIST_Y, 5.0, 0.0)

    from compose import Colliders, LEG_M, CHAIR_M
    col = Colliders(c, W)
    KCOL = 0.0

    def res(x):
        P = m.pos('DRESS', x)
        rd = (P - tgt) * np.sqrt(wd)[:, None]
        rb = (m.pos('BOW', x) - bow0) * 10.0
        ra = (m.pos('APRON', x) - apron0) * wa[:, None]
        s, _, dist = col.legs.query(P)
        rl = KCOL * np.maximum(0, LEG_M + 0.003 - s) * (dist < 0.06)
        cs, _ = D.chair_sdf(P, col.boxes)
        rc = KCOL * np.maximum(0, CHAIR_M + 0.003 - cs)
        return np.concatenate([rd.ravel(), rb.ravel(), ra.ravel(), rl, rc, 1e-3 * x])
    xs = np.tile([0.3, 0.3, 0.3, 0.05, 0.05, 0.05], len(FIT))
    x = least_squares(res, x0, method='trf', x_scale=xs, max_nfev=400).x
    KCOL = float(os.environ.get('SD_KCOL', '4'))
    if KCOL > 0:
        x = least_squares(res, x, method='trf', x_scale=xs, max_nfev=200).x
    err = np.linalg.norm(m.pos('DRESS', x) - tgt, axis=1)
    print('fit dress err mm: mean %.1f p90 %.1f max %.1f' % (err.mean() * 1e3, np.percentile(err, 90) * 1e3, err.max() * 1e3))
    print('bow drift mm max %.2f' % (np.linalg.norm(m.pos('BOW', x) - bow0, axis=1).max() * 1e3))
    print('violations', col.violations(m.pos('DRESS', x)))
    R, t = m.transforms(x)
    for i, b in enumerate(FIT):
        print('%-18s rot %5.1f deg  t %s' % (b, np.degrees(np.linalg.norm(x[6 * i:6 * i + 3])), np.round(t[i] * 1000, 1)))
    T, Rq = new_locals(c, W, R, t, m.piv, T0, R0)
    Wc = c.world(T, Rq, S0)
    chk = np.abs(c.skin('DRESS', Wc) - m.pos('DRESS', x)).max()
    print('local round-trip max err', chk)
    np.savez(a[1], x=x, R=R, t=t, piv=m.piv, T=T, Rq=Rq, err=err, clip=clip, time=tc)


if __name__ == '__main__':
    main()
