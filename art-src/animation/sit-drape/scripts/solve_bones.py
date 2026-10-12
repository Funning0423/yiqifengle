# Stage 1 (python3): seated pose of the existing skirt bones (no new bones).  The sit clips left the skirt bones hanging
# straight down from the hips (task 1 skipped the seated skirt solve), so the panels went through the seat and the legs.
# Unknowns (in each bone's local frame, on top of its rest transform):
#   rotation vector of skirt.front / .low, skirt.left / .low, skirt.back / .low, skirt.right / .low, and a translation of
#   the four upper segments.  All skirt bones pivot at the hip centre, 10-15 cm inside the cloth; a rotation alone lifts a
#   panel by that offset, so the upper segments also slide (translation channel, same joints) to hinge at the waistline.
#   skirt.front.mid / .low.mid (apron centre strip) are zero-offset children of the front pair and keep their rest rotation.
# Objective on the skinned dress + apron at the settled frame (sit_hold t=0): body / chair / floor penetration (hinge^2)
# + edge strain of the welded dress (blend zones between panels) + light gravity + a pull toward the hand-set start.
# What two straight segments per panel cannot do (bend over the knee, fold at the seat edge) is left to the shape key.
#   python3 solve_bones.py <out.npz> [--init-only]
import sys, json, time
import numpy as np
from scipy.optimize import minimize
import sddata as D
RG = D.RG

MARG_BODY = 0.008
MARG_CHAIR = 0.004
FLOOR = 0.015
BONES = ['skirt.front', 'skirt.front.low', 'skirt.left', 'skirt.left.low', 'skirt.back', 'skirt.back.low', 'skirt.right', 'skirt.right.low']
UPPER = ['skirt.front', 'skirt.left', 'skirt.back', 'skirt.right']
TIE = ['skirt.front.mid', 'skirt.front.low.mid']
W_PEN, W_CHAIR, W_FLOOR, W_STRETCH, W_GRAV, W_PRIOR = 3000.0, 3000.0, 3000.0, 40.0, 1.0, 0.05


def body_collider(ch, W):
    VB = ch.skin('BODY', W)
    F = ch.md['BODY']['F']
    keep = ch.body_cls != 'head'
    return D.SurfaceSDF(VB, F[np.all(keep[F], 1)], sub=3), VB


def bone_axis_local(r, b):
    """unit direction of a skirt segment in its own local frame.  Upper segments point at their .low child; the .low
    segments are leaves (their .mid child sits at the same point), they continue the upper segment's rest direction."""
    up = b[:-4] if b.endswith('.low') else b
    lo = up + '.low'
    d = r.rest_world[r.idx[lo], :3, 3] - r.rest_world[r.idx[up], :3, 3]
    d /= np.linalg.norm(d)
    return r.rest_world[r.idx[b], :3, :3].T @ d


class Problem:
    def __init__(self, ch, clip='sit_hold', t=0.0):
        self.ch = ch
        r = ch.rig
        self.T, self.R, self.S = ch.local(clip, t)
        self.bi = [r.idx[b] for b in BONES]
        self.ui = [r.idx[b] for b in UPPER]
        self.sdf, self.VB = body_collider(ch, ch.world(self.T, self.R, self.S))
        self.boxes = D.chair_boxes()
        dr = ch.md['DRESS']
        self.rep, nu = D.weld(dr['P'])
        F = self.rep[dr['F']]
        F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
        self.E = D.edges_of(F)
        first = np.zeros(nu, int)
        first[self.rep[::-1]] = np.arange(len(self.rep))[::-1]
        self.first = first
        P0 = dr['P'][first]
        self.L0 = np.linalg.norm(P0[self.E[:, 0]] - P0[self.E[:, 1]], axis=1)
        self.n = 3 * len(BONES) + 3 * len(UPPER)

    def locals(self, x):
        R = self.R.copy()
        T = self.T.copy()
        r = self.ch.rig
        for k, j in enumerate(self.bi):
            R[j] = RG.qmul(r.rest_r[j], RG.m2q(RG.rotvec2m(x[3 * k:3 * k + 3])))
        o = 3 * len(BONES)
        for k, j in enumerate(self.ui):
            T[j] = r.rest_t[j] + x[o + 3 * k:o + 3 * k + 3]
        for nm in TIE:
            j = r.idx[nm]
            R[j] = r.rest_r[j]
            T[j] = r.rest_t[j]
        return T, R

    def world(self, x):
        T, R = self.locals(x)
        return self.ch.world(T, R, self.S)

    def pose(self, x):
        W = self.world(x)
        return self.ch.skin('DRESS', W), self.ch.skin('APRON', W)

    def terms(self, x):
        VD, VA = self.pose(x)
        P = np.concatenate([VD, VA])
        s, _, d = self.sdf.query(P, k=3)
        pen = np.where(d < 0.12, np.maximum(0, MARG_BODY - s), 0)
        cd, _ = D.chair_sdf(P, self.boxes)
        pc = np.maximum(0, MARG_CHAIR - cd)
        fl = np.maximum(0, FLOOR - P[:, 1])
        U = VD[self.first]
        L = np.linalg.norm(U[self.E[:, 0]] - U[self.E[:, 1]], axis=1)
        st = (L / self.L0 - 1)
        return dict(pen=float(np.sum(pen ** 2)), chair=float(np.sum(pc ** 2)), floor=float(np.sum(fl ** 2)),
                    stretch=float(np.mean(st ** 2)), grav=float(np.mean(VD[:, 1])),
                    n_pen=int((pen > 0).sum()), n_chair=int((pc > 0).sum()), n_floor=int((fl > 0).sum()),
                    max_pen=float(pen.max()), max_chair=float(pc.max()), max_strain=float(np.abs(st).max()),
                    n_strain30=int((np.abs(st) > 0.3).sum()))

    def f(self, x, x0):
        t = self.terms(x)
        return (W_PEN * t['pen'] + W_CHAIR * t['chair'] + W_FLOOR * t['floor'] + W_STRETCH * t['stretch'] + W_GRAV * t['grav']
                + W_PRIOR * float(np.sum((x - x0) ** 2)))


def aim_targets(pb):
    ch = pb.ch
    r = ch.rig
    W = ch.world(pb.T, pb.R, pb.S)
    fwd = W[r.idx['hips'], :3, :3] @ np.array([0, 0, 1.0])
    fwd[1] = 0
    fwd /= np.linalg.norm(fwd)
    up = np.array([0, 1.0, 0])
    side = np.cross(up, fwd)                 # her left (+x)
    th = 0.5 * (r.pos(W, 'shin.L') + r.pos(W, 'shin.R')) - 0.5 * (r.pos(W, 'thigh.L') + r.pos(W, 'thigh.R'))
    th /= np.linalg.norm(th)
    return {
        'skirt.front': th, 'skirt.front.low': 0.75 * th - 0.65 * up,
        'skirt.left': 0.85 * side - 0.55 * up + 0.25 * fwd, 'skirt.left.low': 0.2 * side - 0.95 * up + 0.2 * fwd,
        'skirt.right': -0.85 * side - 0.55 * up + 0.25 * fwd, 'skirt.right.low': -0.2 * side - 0.95 * up + 0.2 * fwd,
        'skirt.back': -0.7 * fwd - 0.7 * up, 'skirt.back.low': -0.15 * fwd - 1.0 * up,
    }


def initial_guess(pb):
    """aim each segment at a hand-set direction, then slide each upper segment so its panel's top band stays where the
    clip had it (the waistline)."""
    ch = pb.ch
    r = ch.rig
    tg = aim_targets(pb)
    x = np.zeros(pb.n)
    for k, b in enumerate(BONES):
        j = r.idx[b]
        Wc = pb.world(x)
        # world direction with this bone at its rest local rotation (x[k] = 0)
        xx = x.copy()
        xx[3 * k:3 * k + 3] = 0
        Wc = pb.world(xx)
        cur = Wc[j, :3, :3] @ bone_axis_local(r, b)
        t = tg[b] / np.linalg.norm(tg[b])
        Rw = RG.align(cur, t)
        Wj = Wc[j, :3, :3]
        x[3 * k:3 * k + 3] = RG.m2rotvec(Wj.T @ Rw @ Wj)
    # translation: keep each panel's top band in place
    dr = ch.md['DRESS']
    W0 = ch.world(pb.T, pb.R, pb.S)
    V0 = ch.skin('DRESS', W0)
    names = np.array(r.names)
    o = 3 * len(BONES)
    for it in range(3):
        V1 = ch.skin('DRESS', pb.world(x))
        for k, b in enumerate(UPPER):
            w = np.zeros(len(dr['P']))
            for c in range(4):
                w += dr['W'][:, c] * (names[dr['J'][:, c]] == b)
            cand = np.where(w > 0.25)[0]
            top = cand[dr['P'][cand, 1] >= np.quantile(dr['P'][cand, 1], 0.8)]
            dw = (V0[top] - V1[top]).mean(0)
            Wp = pb.world(x)[r.parent[r.idx[b]], :3, :3]
            x[o + 3 * k:o + 3 * k + 3] += Wp.T @ dw
    return x


def optimise(pb, x0, maxiter=60):
    t0 = time.time()
    res = minimize(pb.f, x0, args=(x0,), method='L-BFGS-B', options=dict(maxiter=maxiter, eps=1e-4))
    print('opt', res.nit, res.nfev, round(time.time() - t0, 1), 's', res.fun, flush=True)
    return res.x


def main(out):
    ch = D.Char()
    pb = Problem(ch)
    x0 = initial_guess(pb)
    print('init', json.dumps(pb.terms(x0)), flush=True)
    x = x0 if '--init-only' in sys.argv else optimise(pb, x0)
    print('final', json.dumps(pb.terms(x)))
    T, R = pb.locals(x)
    np.savez(out, x=x, x0=x0, bones=np.array(BONES), T=T, R=R)
    print('saved', out)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sd/bones.npz')
