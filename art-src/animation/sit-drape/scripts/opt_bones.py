# Dress panel bones for the sit clips (plain python3 + numpy / scipy, no Blender).  Names / hierarchy unchanged, no new
# bones: per clip frame the 8 skirt panel bones get a local rotation + non-uniform scale (all) + translation (the .low
# bones, so the lower panels pivot at the knees), solved jointly by nonlinear least squares on
#   W_FIT  * (dress - target)                       target = skinned skirt + w * (cloth sim - skinned skirt)
#   W_PEN  * penetration: chair parts / seat column, floor, thighs / shins / hips (margins M_*)
#   W_REG  * (parameters - previous frame)            (warm start in play order: sit_down -> sit_hold -> stand_up)
# w = the sit_drape weight (hips height ramp, drape_DRESS.npz from build_drape.py STOP_AFTER_BONES=1): standing = the
# clip's own skirt.  A rigid rotation per panel cannot fold the 75 cm skirt over the lap and down at the knees; with
# the scale the lower panels shorten / narrow and the back panel flattens on the seat.  The sparse key
# (build_drape.py REUSE_BONES=1) takes the collision remainder.
#   python3 opt_bones.py <body.glb> <work_dir> <sim.npz> sit_down|sit_hold|stand_up    (one process per clip, parallel)
#   python3 opt_bones.py <body.glb> <work_dir> <sim.npz> merge   -> work_dir/bones_DRESS.npz (Q_ / T_ / S_ per clip)
#   python3 opt_bones.py <body.glb> <work_dir> <sim.npz> legfix <clip>   (after merge, one process per clip) frames where
#     thigh / shin points that are under the dress at rest come out through it (sit_qa legs.out_of_dress: perpendicular
#     foot on a dress face around the nearest dress vertices) are solved again from the merged parameters with
#     W_POKE * (leg point outside the dress + M_POKE) added -> legfix_<clip>.npz, opt_legfix_<clip>.json; then
#     legfix_apply -> bones_DRESS.npz.  Only where the sit_drape weight is below LEGFIX_W (seated: the key, solved
#     against the body faces, covers the lap)
import json
import os
import sys
import time

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402
import fit_drape as FD  # noqa: E402
import author_lib as AL  # noqa: E402

RG = SL.RG
UPPER = FD.DRESS_BONES[:4]
LOWER = FD.DRESS_BONES[4:]
BONES = UPPER + LOWER
M_CHAIR = 0.005
M_FLOOR = 0.012
M_BODY = 0.005
M_POKE = 0.004
W_POKE = 16.0
POKE_MAXD = 0.025          # = sit_qa COVER_MAX
POKE_NN = 6
LEGFIX_W = 0.85
W_FIT = float(os.environ.get('W_FIT', 1.0))
W_PEN = float(os.environ.get('W_PEN', 4.0))
W_BODY = 0.6               # the seat wins where the cloth is sandwiched between the seat and the thighs / buttocks
W_REG = float(os.environ.get('W_REG', 0.1))
LOG_S = (np.log(0.35), np.log(1.4))
FIXED_Y = 1.135
BODY_FREE_Y = 1.085
SEAT_COLUMN_Y = 0.005
# the cloth pressed between the seat and the thighs / buttocks (body 4 mm above the seat): only the chair term, the
# key lays it flat on the seat
SEAT_ZONE = 0.045
SIGMA = float(os.environ.get('OPT_SIGMA', 1.0))          # time smoothing of the panel parameters (frames): sit_hold
SIGMA_TR = float(os.environ.get('OPT_SIGMA_TR', 0.0))     # sit_down / stand_up: scale / translation only (blurring the
#                                                           rotations too breaks the fit). Off: even this breaks the transitions
STAGES = ((4.0, 15), (16.0, 15))       # (W_PEN, max_nfev): fit first, then push out (stays in the draped basin)
STAGE_TR = (64.0, 15)                  # sit_down / stand_up frames still in the chair after STAGES (the back hem sweeps
#                                        past the seat front while she is above it)
BLEND_F = 6                            # clip seams: sit_down end / stand_up start blend into sit_hold frame 0
FADE_W = 0.2                           # panel transforms fade in over w 0 .. FADE_W (the standing skirt clears the chair)


class LegCover:
    """thigh / shin points under the dress at rest (= sit_qa cov_legs) vs the posed dress: signed distance along the face
    normal (> 0 = come out through it) where the perpendicular foot lies on one of the faces around the POKE_NN nearest
    dress vertices (the closest such face).  Dress = the free welded vertices (rep, GLB indices) as in Opt."""

    def __init__(self, ch):
        md = ch.md['DRESS']
        inv, Fw, _ = SL.weld(md['P'], md['F'])
        rep = np.zeros(inv.max() + 1, int)
        rep[inv] = np.arange(len(inv))
        wsel = md['P'][rep, 1] < FIXED_Y
        self.rep = rep[wsel]
        pos = -np.ones(len(rep), int)
        pos[np.where(wsel)[0]] = np.arange(int(wsel.sum()))
        F = pos[Fw]
        self.dF = F[(F >= 0).all(1)]
        inc = [[] for _ in range(len(self.rep))]
        for f, tri in enumerate(self.dF):
            for v in tri:
                inc[v].append(f)
        self.vf = -np.ones((len(self.rep), max(len(i) for i in inc)), int)
        for v, i in enumerate(inc):
            self.vf[v, :len(i)] = i
        legs = ch.ids['leg']
        s, ok, _ = self.dist(ch.md['BODY']['P'][legs], md['P'][self.rep], maxd=0.08)
        self.cov = legs[ok & (s < 0)]

    def visible(self, Bw):
        """covered leg points of the posed body Bw that are not on the seat under / between the thighs (hidden)."""
        lp = Bw[self.cov]
        L = SL.to_chair(lp)
        return lp[~((np.abs(L[:, 0]) < 0.26) & (np.abs(L[:, 2]) < 0.2) & (lp[:, 1] < SL.SEAT_TOP + 0.03))]

    def dist(self, pts, X, maxd=POKE_MAXD):
        """-> s [n], ok [n], nearest dress vertex [n] (index into rep)."""
        _, j = cKDTree(X).query(pts, k=POKE_NN)
        f = self.vf[j].reshape(len(pts), -1)
        valid = f >= 0
        f = np.where(valid, f, 0)
        A, Bv, C = (X[self.dF[f, i]] for i in range(3))
        e1, e2 = Bv - A, C - A
        n = np.cross(e1, e2)
        n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-12)
        d = pts[:, None] - A
        s = np.einsum('pfi,pfi->pf', d, n)
        q = d - s[..., None] * n
        d11, d12, d22 = (np.einsum('pfi,pfi->pf', u, v) for u, v in ((e1, e1), (e1, e2), (e2, e2)))
        q1, q2 = np.einsum('pfi,pfi->pf', q, e1), np.einsum('pfi,pfi->pf', q, e2)
        den = np.maximum(d11 * d22 - d12 ** 2, 1e-18)
        v = (d22 * q1 - d12 * q2) / den
        w = (d11 * q2 - d12 * q1) / den
        inside = valid & (v >= -1e-6) & (w >= -1e-6) & (v + w <= 1 + 1e-6) & (np.abs(s) < maxd)
        a = np.where(inside, np.abs(s), np.inf)
        i = a.argmin(1)
        ok = np.isfinite(a[np.arange(len(pts)), i])
        return s[np.arange(len(pts)), i], ok, j[:, 0]


class Opt:
    def __init__(self, glb, work, sim):
        self.ch = ch = SL.Character(glb)
        self.rig = ch.rig
        md = ch.md['DRESS']
        inv, Fw, _ = SL.weld(md['P'], md['F'])
        rep = np.zeros(inv.max() + 1, int)
        rep[inv] = np.arange(len(inv))
        self.rep = rep[md['P'][rep, 1] < FIXED_Y]               # free welded vertices (GLB index)
        self.bsel = md['P'][self.rep, 1] < BODY_FREE_Y
        self.P = md['P'][self.rep]
        self.Ph = np.concatenate([self.P, np.ones((len(self.P), 1))], 1)
        self.J = md['J'][self.rep]
        self.Wt = md['W'][self.rep]
        self.bi = [self.rig.idx[b] for b in BONES]
        self.low = np.array([b in LOWER for b in BONES])
        chair = SL.Chair()
        self.parts = []
        for p in chair.parts:
            if p['name'] == 'seat':
                keep = p['n'][:, 1] > -0.3
                p = dict(p, n=np.vstack([p['n'][keep], [[0.0, -1.0, 0.0]]]), b=np.concatenate([p['b'][keep], [SEAT_COLUMN_Y]]))
            self.parts.append((p['n'], p['b']))
        self.sim = np.load(sim)
        self.d = np.load(os.path.join(work, 'drape_DRESS.npz'))
        self.clips = {}
        for c in SL.CLIPS:
            z = np.load(os.path.join(work, 'body_%s.npz' % c))
            n = len(z['Q'])
            roots = np.array([SL.root_matrix(c, k / SL.FPS, ch.dur[c]) for k in range(n)])
            self.clips[c] = dict(Q0=z['Q'], T0=z['T'], roots=roots, n=n, w=self.d['w_' + c])
        B = ch.md['BODY']
        self.bids = np.concatenate([ch.ids['leg'], ch.ids['hips']])
        self.bF = B['F']
        self.npar = 6 * len(BONES) + 3 * int(self.low.sum())
        self.lc = LegCover(ch)
        self.cov = self.lc.cov
        self.is_rot = np.concatenate([[1, 1, 1, 0, 0, 0] + ([0, 0, 0] if lo else []) for lo in self.low]).astype(bool)

    # ------------------------------------------------------------ pose
    def unpack(self, c, k, x):
        cl = self.clips[c]
        Q = cl['Q0'][k].copy()
        T = cl['T0'][k].copy()
        S = self.rig.rest_s.copy()
        o = 0
        for i, j in enumerate(self.bi):
            r, ls = x[o:o + 3], x[o + 3:o + 6]
            o += 6
            Q[j] = RG.m2q((RG.q2m(Q[j][None])[0] @ RG.rotvec2m(r[None])[0])[None])[0]
            S[j] = S[j] * np.exp(ls)
            if self.low[i]:
                T[j] = T[j] + x[o:o + 3]
                o += 3
        return Q, T, S

    def bounds(self):
        lo, hi = [], []
        for i in range(len(BONES)):
            lo += [-np.pi] * 3 + [LOG_S[0]] * 3
            hi += [np.pi] * 3 + [LOG_S[1]] * 3
            if self.low[i]:
                lo += [-0.45] * 3
                hi += [0.45] * 3
        return np.array(lo), np.array(hi)

    def skin(self, Ww):
        Sk = Ww @ self.rig.ibm
        out = np.zeros_like(self.P)
        for k in range(4):
            M = Sk[self.J[:, k]]
            out += self.Wt[:, k:k + 1] * (np.einsum('nij,nj->ni', M[:, :3, :3], self.P) + M[:, :3, 3])
        return out

    def dress(self, c, k, x):
        Q, T, S = self.unpack(c, k, x)
        Ww = self.clips[c]['roots'][k][None] @ self.rig.fk(T[None], Q[None], S[None])[0]
        return self.skin(Ww)

    # ------------------------------------------------------------ per frame data
    def frame(self, c, k):
        cl = self.clips[c]
        Ww = cl['roots'][k][None] @ self.rig.fk(cl['T0'][k][None], cl['Q0'][k][None])[0]
        Bw = self.ch.skin('BODY', Ww)
        fn = np.cross(Bw[self.bF[:, 1]] - Bw[self.bF[:, 0]], Bw[self.bF[:, 2]] - Bw[self.bF[:, 0]])
        vn = np.zeros_like(Bw)
        for i in range(3):
            np.add.at(vn, self.bF[:, i], fn)
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
        X0 = self.skin(Ww)
        S = self.sim['DRESS'][self.sim['index_' + c][k]][self.rep].astype(float)
        w = float(cl['w'][k])
        lp = self.lc.visible(Bw)
        return dict(tree=cKDTree(Bw[self.bids]), bp=Bw[self.bids], bn=vn[self.bids], C=X0 + w * (S - X0), X0=X0, w=w, lp=lp)

    def poke(self, X, fr):
        s, ok, _ = self.lc.dist(fr['lp'], X)
        return np.where(ok, np.maximum(0.0, s + M_POKE), 0.0)

    def pens(self, X, fr):
        pc = np.zeros(len(X))
        for n, b in self.parts:
            m = (X @ n.T + b).max(1)
            pc = np.maximum(pc, M_CHAIR - m)
        pf = np.maximum(0.0, M_FLOOR - X[:, 1])
        Xb = X[self.bsel]
        dist, ii = fr['tree'].query(Xb, distance_upper_bound=0.06)
        L = SL.to_chair(Xb)
        seat_zone = (np.abs(L[:, 0]) < 0.26) & (np.abs(L[:, 2]) < 0.2) & (Xb[:, 1] < SL.SEAT_TOP + SEAT_ZONE)
        ok = np.isfinite(dist) & ~seat_zone
        pb = np.zeros(len(Xb))
        s = np.einsum('ij,ij->i', Xb[ok] - fr['bp'][ii[ok]], fr['bn'][ii[ok]])
        pb[ok] = np.maximum(0.0, M_BODY - s)
        return pc, pf, pb

    def resid(self, x, c, k, fr, prev):
        X = self.dress(c, k, x)
        pc, pf, pb = self.pens(X, fr)
        n = np.sqrt(len(X))
        r = [W_FIT * (X - fr['C']).ravel() / n, W_PEN * pc / n, W_PEN * pf / n, W_PEN * W_BODY * pb / n, W_REG * (x - prev)]
        if fr.get('legfix'):
            r.append(W_POKE * self.poke(X, fr) / np.sqrt(len(fr['lp'])))
        return np.concatenate(r)

    def solve(self, c, k, x0, prev, stages=None):
        global W_PEN
        fr = self.frame(c, k)
        lo, hi = self.bounds()
        x = np.clip(x0, lo + 1e-9, hi - 1e-9)
        nfev = 0
        keep = W_PEN
        for wp, nf in stages or ((W_PEN, int(os.environ.get('MAX_NFEV', 40))),):
            W_PEN = wp
            r = least_squares(self.resid, x, bounds=(lo, hi), args=(c, k, fr, prev), method='trf', x_scale='jac',
                              max_nfev=nf, diff_step=1e-4)
            x = r.x
            nfev += int(r.nfev)
        W_PEN = keep
        return x, self.stat(c, k, x, fr) | dict(nfev=nfev)

    def stat(self, c, k, x, fr=None):
        fr = fr or self.frame(c, k)
        X = self.dress(c, k, x)
        pc, pf, pb = self.pens(X, fr)
        pc0, pf0, pb0 = self.pens(fr['X0'], fr)
        e = np.linalg.norm(X - fr['C'], axis=1)
        mm = lambda v: round(float(v) * 1000, 1)  # noqa: E731
        return dict(fit_rms=mm(np.sqrt((e ** 2).mean())), fit_max=mm(e.max()),
                    chair=mm(pc.max() - M_CHAIR), floor=mm(pf.max() - M_FLOOR), body=mm(pb.max() - M_BODY),
                    n_pen=int((pc > M_CHAIR).sum() + (pf > M_FLOOR).sum() + (pb > M_BODY).sum()),
                    chair0=mm(pc0.max() - M_CHAIR), floor0=mm(pf0.max() - M_FLOOR), body0=mm(pb0.max() - M_BODY),
                    poke=mm(self.poke(X, fr).max() - M_POKE))


def solve_clip(o, c, work, stride=1):
    """warm-started chains anchored on one seated solution: sit_hold forward over the loop (every `stride` frames, linear
    in between), twice - the second pass starts from the end of the first, so the loop closes; then sit_down backward
    from the seated end and stand_up forward from it, both starting at sit_hold frame 0 (the standing ends come out at
    the rest pose, w = 0) -> work/opt_x_<clip>.npy, opt_<clip>.json."""
    t0 = time.time()
    cl = o.clips[c]
    n = cl['n']
    hold = os.path.join(work, 'opt_x_sit_hold.npy')
    if c == 'sit_hold':
        order = list(range(0, n, stride))
        prev = np.load(hold) if os.path.exists(hold) and os.environ.get('HOLD_PASS2') else None
        x = prev[order[-1]] if prev is not None else np.zeros(o.npar)
        cold = prev is None
    else:
        order = list(range(n - 1, -1, -1)) if c == 'sit_down' else list(range(n))
        x = np.load(hold)[0]
        cold = False
    xs = np.zeros((n, o.npar))
    log = []
    for k in order:
        if cl['w'][k] <= 0:
            x = np.zeros(o.npar)
            st = o.stat(c, k, x)
            cold = False
        else:
            xp = x
            x, st = o.solve(c, k, x, xp, stages=STAGES if cold or k == order[0] else STAGES[1:])
            if c != 'sit_hold' and st['chair'] > 0:
                x, st = o.solve(c, k, x, xp, stages=(STAGE_TR,))
            cold = False
        xs[k] = x
        st['k'] = k
        log.append(st)
        print(c, k, json.dumps(st), '%.0fs' % (time.time() - t0), flush=True)
    done = sorted(order)
    for i in range(n):
        if i in done:
            continue
        lo = max(d for d in done if d < i)
        hi = min([d for d in done if d > i] or [n])
        xh = xs[hi] if hi < n else xs[0]                 # sit_hold wraps to frame 0
        xs[i] = xs[lo] + (xh - xs[lo]) * (i - lo) / (hi - lo)
    np.save(os.path.join(work, 'opt_x_%s.npy' % c), xs)
    with open(os.path.join(work, 'opt_%s.json' % c), 'w') as f:
        json.dump(log, f)


def merge(o, work):
    """seams (sit_down end / stand_up start -> sit_hold frame 0 over BLEND_F frames), smoothing, rest where w = 0
    -> work/bones_DRESS.npz."""
    X = {c: np.load(os.path.join(work, 'opt_x_%s.npy' % c)) for c in SL.CLIPS}
    h0 = X['sit_hold'][0]
    for c in ('sit_down', 'stand_up'):
        xs = X[c]
        n = len(xs)
        for i in range(BLEND_F):
            u = AL.smoothstep(1 - i / BLEND_F)
            k = n - 1 - i if c == 'sit_down' else i
            xs[k] = xs[k] + (h0 - xs[k]) * u
    res = {}
    for c in SL.CLIPS:
        cl = o.clips[c]
        # the chains do not relax to the rest pose while she is still standing (w ~ 0): fade them out there
        X[c] = X[c] * AL.smoothstep(np.clip(cl['w'] / FADE_W, 0, 1))[:, None]
        sg = [SIGMA if c == 'sit_hold' else (SIGMA_TR if not o.is_rot[i] else 0.0) for i in range(o.npar)]
        xs = np.stack([AL.gauss(X[c][:, i], sg[i], c == 'sit_hold') for i in range(o.npar)], 1)
        if c == 'sit_down':
            xs[-1] = h0
        if c == 'stand_up':
            xs[0] = h0
        xs[cl['w'] <= 0] = 0
        Q, T, S = zip(*[o.unpack(c, k, xs[k]) for k in range(cl['n'])])
        res['Q_' + c], res['T_' + c], res['S_' + c], res['x_' + c] = np.array(Q), np.array(T), np.array(S), xs
    np.savez(os.path.join(work, 'bones_DRESS.npz'), **res)
    log = {c: [o.stat(c, k, res['x_' + c][k]) for k in range(o.clips[c]['n'])] for c in SL.CLIPS}
    with open(os.path.join(work, 'opt_bones.json'), 'w') as f:
        json.dump(log, f)
    for c in SL.CLIPS:
        L = log[c]
        print(c, {k: max(r[k] for r in L) for k in ('fit_rms', 'chair', 'floor', 'body', 'n_pen')})


def legfix(o, c, work):
    p = os.path.join(work, 'bones_DRESS.npz')
    b = dict(np.load(p))
    xs = b['x_' + c].copy()
    cl = o.clips[c]
    log = []
    t0 = time.time()
    for k in range(cl['n']):
        if cl['w'][k] <= 0 or cl['w'][k] >= LEGFIX_W:
            continue
        fr = o.frame(c, k)
        st = o.stat(c, k, xs[k], fr)
        if st['poke'] <= 0:
            continue
        fr['legfix'] = True
        x, st2 = o.solve(c, k, xs[k], xs[k], stages=STAGES[1:])
        if st2['poke'] < st['poke'] and st2['chair'] <= max(st['chair'], 0.0) + 1.0:
            xs[k] = x
        log.append(dict(k=k, before=st, after=st2, kept=bool((xs[k] == x).all())))
        print(c, k, 'poke %.1f -> %.1f  chair %.1f -> %.1f  body %.1f -> %.1f' % (st['poke'], st2['poke'], st['chair'], st2['chair'],
              st['body'], st2['body']), '%.0fs' % (time.time() - t0), flush=True)
    Q, T, S = zip(*[o.unpack(c, k, xs[k]) for k in range(cl['n'])])
    np.savez(os.path.join(work, 'legfix_%s.npz' % c), x=xs, Q=np.array(Q), T=np.array(T), S=np.array(S))
    with open(os.path.join(work, 'opt_legfix_%s.json' % c), 'w') as f:
        json.dump(log, f)


def legfix_apply(work):
    """bones_DRESS.npz <- legfix_<clip>.npz (the per clip legfix processes run in parallel)."""
    p = os.path.join(work, 'bones_DRESS.npz')
    b = dict(np.load(p))
    for c in SL.CLIPS:
        q = os.path.join(work, 'legfix_%s.npz' % c)
        if os.path.exists(q):
            z = np.load(q)
            b['x_' + c], b['Q_' + c], b['T_' + c], b['S_' + c] = z['x'], z['Q'], z['T'], z['S']
    np.savez(p, **b)


def main():
    a = sys.argv[1:]
    glb, work, sim, mode = a[:4]
    if mode == 'legfix_apply':
        return legfix_apply(work)
    o = Opt(glb, work, sim)
    if mode == 'merge':
        merge(o, work)
    elif mode == 'legfix':
        legfix(o, a[4], work)
    else:
        solve_clip(o, mode, work, stride=int(os.environ.get('OPT_STRIDE', 2)))


if __name__ == '__main__':
    main()
