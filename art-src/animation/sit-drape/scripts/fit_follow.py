# Stage 3d (python3): skirt-bone corrections for every other clip time, WITH the seated-drape shape key applied.
#   python3 fit_follow.py <comp.npz> <out_dir> <clip>:<t>[:<sim key>] ... [--sim sim.npz] [--warm]
# The shape key is fixed (shaped at sit_hold t=0); when the body moves (sit_hold hip rock, sit_down settle, stand_up rise)
# only the 8 skirt bones can carry it.  Target at (clip, t), shape-key weight w = build_glb CURVES:
#   carried = the settled dress / apron moved by the body's own skinning from sit_hold 0 to (clip, t) (each cloth vertex
#             follows its nearest body vertices: thighs, knees, hips), original = the clip's own LBS without the key,
#   target  = sim[key] where a transition sim frame exists, else w * carried + (1 - w) * original.
# Fit: rest positions P + w * delta, per-bone rigid world corrections (fit_bones.Model), bow -> its original LBS,
# then leg / chair penalties (chair boxes shifted by the clip's root motion, as the driver moves the root).
import sys, os, json
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree
import sddata as D
from fit_bones import Model, FIT, new_locals
from compose import Colliders, LEG_M, CHAIR_M, HAND_M, DRESS_HAND_M
from build_glb import CURVES, curve

WAIST_Y = 1.0


def root_z(meta, clip, t):
    rm = meta['clips'][clip].get('root_motion')
    if not isinstance(rm, dict):
        return 0.0
    f = np.asarray(rm['forward_m'], float)
    v = float(np.interp(t, f[:, 0], f[:, 1]))
    return (-f[-1, 1] + v) if clip == 'sit_down' else v


def blended(rig, md, W):
    Sk = W @ rig.ibm
    M = np.zeros((len(md['P']), 4, 4))
    for k in range(4):
        M += md['W'][:, k, None, None] * Sk[md['J'][:, k]]
    return M


class Carrier:
    def __init__(self, c, W0, k=6):
        self.c = c
        md = c.md['BODY']
        self.M0inv = np.linalg.inv(blended(c.rig, md, W0))
        self.tree = cKDTree(c.skin('BODY', W0))
        self.k = k

    def __call__(self, X0, Wt):
        Mt = blended(self.c.rig, self.c.md['BODY'], Wt)
        d, i = self.tree.query(X0, k=self.k)
        w = 1.0 / np.maximum(d, 1e-3) ** 2
        w /= w.sum(1, keepdims=True)
        rel = Mt[i] @ self.M0inv[i]
        A = (w[..., None, None] * rel).sum(1)
        return np.einsum('nij,nj->ni', A[:, :3, :3], X0) + A[:, :3, 3]


def with_rest(c, key, P):
    md = dict(c.md[key])
    md['P'] = P
    return md


def main():
    a = sys.argv[1:]
    comp = np.load(a[0])
    out = a[1]
    os.makedirs(out, exist_ok=True)
    sim = np.load(a[a.index('--sim') + 1]) if '--sim' in a else None
    jobs = [x for x in a[2:] if ':' in x]
    meta = json.load(open(D.ANIM_META))
    c = D.Char()
    T0, R0, S0 = c.local('sit_hold', 0.0)
    W0 = c.world(comp['T'], comp['Rq'], S0)
    carry = Carrier(c, c.world(T0, R0, S0))
    XD0, XA0 = comp['dress_world'], comp['apron_world']
    dD, dA = comp['dress_delta'], comp['apron_delta']
    md0 = {k: c.md[k] for k in ('DRESS', 'APRON')}
    x_prev = None
    for job in jobs:
        parts = job.split(':')
        clip, t = parts[0], float(parts[1])
        skey = parts[2] if len(parts) > 2 else None
        w = curve(CURVES[clip]['sit_drape'], t)
        T, R, S = c.local(clip, t)
        W = c.world(T, R, S)
        c.md['DRESS'] = with_rest(c, 'DRESS', md0['DRESS']['P'] + w * dD)
        c.md['APRON'] = with_rest(c, 'APRON', md0['APRON']['P'] + w * dA)
        m = Model(c, W)
        c.md.update(md0)
        origD, origA = c.skin('DRESS', W), c.skin('APRON', W)
        tD = w * carry(XD0, W) + (1 - w) * origD
        tA = w * carry(XA0, W) + (1 - w) * origA
        if skey is not None and sim is not None:
            tD = sim[skey].copy()
        bow0 = c.skin('BOW', W)
        col = Colliders(c, W)
        rz = root_z(meta, clip, t)
        col.boxes = {k: (lo - [0, 0, rz], hi - [0, 0, rz]) for k, (lo, hi) in D.chair_boxes().items()}
        wd = np.where(md0['DRESS']['P'][:, 1] > WAIST_Y, 5.0, 1.0)
        wa = np.where(md0['APRON']['P'][:, 1] > WAIST_Y, 5.0, 1.0)
        KCOL = 0.0
        # hands rest on the lap: cloth under them stays below their underside (cap fixed at the target); off by default,
        # the 8 skirt bones cannot lower the lap under the hands without pushing the cloth into the thighs
        KHAND = float(os.environ.get('SD_KHAND', '0'))
        capD = col.hand_cap(tD, DRESS_HAND_M)
        capA = col.hand_cap(tA, HAND_M)
        capD[~np.isfinite(capD)] = 1e3
        capA[~np.isfinite(capA)] = 1e3

        def res(x):
            P = m.pos('DRESS', x)
            rd = (P - tD) * np.sqrt(wd)[:, None]
            rb = (m.pos('BOW', x) - bow0) * 10.0
            ra = (m.pos('APRON', x) - tA) * np.sqrt(wa)[:, None]
            s, _, dist = col.legs.query(P)
            rl = KCOL * np.maximum(0, LEG_M + 0.003 - s) * (dist < 0.06)
            cs, _ = D.chair_sdf(P, col.boxes)
            rc = KCOL * np.maximum(0, CHAIR_M + 0.003 - cs)
            sa, _, da = col.legs.query(m.pos('APRON', x))
            rla = KCOL * np.maximum(0, LEG_M + 0.006 - sa) * (da < 0.06)
            PA = m.pos('APRON', x)
            rh = KHAND * KCOL * np.concatenate([np.maximum(0, P[:, 1] - capD), np.maximum(0, PA[:, 1] - capA)])
            return np.concatenate([rd.ravel(), rb.ravel(), ra.ravel(), rl, rc, rla, rh, 1e-3 * x])
        xs = np.tile([0.3, 0.3, 0.3, 0.05, 0.05, 0.05], len(FIT))
        x0 = x_prev if (x_prev is not None and '--warm' in a) else np.zeros(6 * len(FIT))
        x = least_squares(res, x0, method='trf', x_scale=xs, max_nfev=300).x
        KCOL = float(os.environ.get('SD_KCOL', '4'))
        x = least_squares(res, x, method='trf', x_scale=xs, max_nfev=200).x
        x_prev = x
        P = m.pos('DRESS', x)
        err = np.linalg.norm(P - tD, axis=1)
        Rm, tt = m.transforms(x)
        Tn, Rqn = new_locals(c, W, Rm, tt, m.piv, T, R)
        path = os.path.join(out, '%s_%.4f.npz' % (clip, t))
        np.savez(path, T=Tn, Rq=Rqn, x=x, clip=clip, time=t, w=w)
        print('FOLLOW %s %.4f w=%.2f err mean %.1f mm p90 %.1f | %s -> %s' % (
            clip, t, w, err.mean() * 1e3, np.percentile(err, 90) * 1e3, json.dumps(col.violations(P)), path), flush=True)


if __name__ == '__main__':
    main()
