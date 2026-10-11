# Skirt-panel / arm clearance solver for mocap clips (runs inside Blender for mathutils.bvhtree; numpy LBS = glTF skinning).
# Same test as the walk-v2 solver and walk_clipcheck.py: a leg vertex is "outside" a cloth layer when a horizontal ray from it
# toward the body axis (hips x/z) hits that layer, with a margin (the ray starts MARG_LEG outside the vertex); an arm vertex
# is "inside" a layer / the torso when a ray from it away from the axis hits that surface within 5 cm (+ margin).
# Unknowns per frame: pitch of each skirt panel and of its lower segment about the hips' lateral axis, and arm abduction about
# the chest's forward axis.  Per frame a greedy search adds the smallest rotation that removes every hit; the per-frame needs
# are then turned into smooth curves with a constrained low-pass (never less rotation than needed), verified at half frames,
# and the needs are raised where the smooth curves still fail.
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import rig as RG

PANELS = ['skirt.front', 'skirt.back', 'skirt.left', 'skirt.right']
LOWS = {'skirt.front': 'skirt.front.low', 'skirt.back': 'skirt.back.low', 'skirt.left': 'skirt.left.low', 'skirt.right': 'skirt.right.low'}
ROLLS = {'skirt.left': -1.0, 'skirt.right': 1.0}        # outward flare sign about the hips' forward axis (left = her right, -X)
VARS = PANELS + [LOWS[p] for p in PANELS] + ['roll.' + p for p in ROLLS] + ['arm.L', 'arm.R']
MARG_LEG = 0.006
MARG_ARM = 0.003
STEP = np.radians(1.0)
CAP = {v: np.radians(50.0) for v in VARS}
CAP['arm.L'] = CAP['arm.R'] = np.radians(25.0)
for _p in ROLLS:
    CAP['roll.' + _p] = np.radians(30.0)
PARENT_VAR = {LOWS[p]: p for p in PANELS}


def _panel_var(bone):
    if bone is None:
        return None
    for p in PANELS:
        if bone == LOWS[p] or bone.startswith(LOWS[p]):
            return LOWS[p]
    for p in PANELS:
        if bone.startswith(p):
            return p
    return None


def rx(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rz(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


class Solver:
    def __init__(self, rig):
        self.rig = rig
        r = rig
        self.md = {k: r.mesh_data('LOD0_G2_' + k) for k in ('DRESS', 'APRON', 'BODY')}
        body = self.md['BODY']
        dom = body['J'][np.arange(len(body['J'])), body['W'].argmax(1)]
        nm = np.array(r.names)[dom]
        base = np.array([n.split('.')[0] for n in nm])
        P = body['P']
        self.leg_ids = np.where(np.isin(base, ['thigh', 'shin']) & (P[:, 1] > 0.30))[0]
        arm = np.where(np.isin(base, ['upper_arm', 'forearm', 'hand']))[0]
        hand = np.isin(base[arm], ['hand'])
        self.arm_ids = np.concatenate([arm[~hand], arm[hand][::3]])
        self.arm_side = np.array([nm[i][-1] for i in self.arm_ids])
        tor = np.where(np.isin(base, ['chest', 'spine', 'hips']))[0]
        self.torso_ids = tor
        F = body['F']
        tset = np.zeros(len(P), bool)
        tset[tor] = True
        self.torso_F = F[tset[F].all(1)]
        remap = -np.ones(len(P), int)
        remap[tor] = np.arange(len(tor))
        self.torso_F = remap[self.torso_F]
        self.face_var = {}
        for k in ('DRESS', 'APRON'):
            m = self.md[k]
            d = m['J'][np.arange(len(m['J'])), m['W'].argmax(1)]
            vb = [_panel_var(r.names[j]) if r.names[j].startswith('skirt') else None for j in d]
            fv = []
            for f in m['F']:
                c = {}
                for i in f:
                    c[vb[i]] = c.get(vb[i], 0) + 1
                fv.append(max(c, key=c.get))
            self.face_var[k] = fv
        self.hi = r.idx['hips']
        self.ci = r.idx['chest']

    # ---------- skinning ----------
    def skin(self, W, md, ids=None):
        Sk = W @ self.rig.ibm
        P, J, Wt = md['P'], md['J'], md['W']
        if ids is not None:
            P, J, Wt = P[ids], J[ids], Wt[ids]
        out = np.zeros_like(P)
        for k in range(4):
            M = Sk[J[:, k]]
            out += Wt[:, k:k + 1] * (np.einsum('nij,nj->ni', M[:, :3, :3], P) + M[:, :3, 3])
        return out

    # ---------- apply variables to local pose of one frame ----------
    def apply(self, Q, T, x):
        """Q [J,4], T [J,3] local (one frame), x: dict var -> angle. returns new Q (copy)."""
        r = self.rig
        Q = Q.copy()
        for v in PANELS:
            a = x.get(v, 0.0)
            ro = x.get('roll.' + v, 0.0) * ROLLS.get(v, 0.0)
            if abs(a) > 1e-9 or abs(ro) > 1e-9:   # parent = hips: pitch about the hips' lateral (x) axis, then flare about z
                i = r.idx[v]
                Q[i] = RG.m2q(rz(ro) @ rx(a) @ RG.q2m(Q[i]))
        for p in PANELS:
            v = LOWS[p]
            a = x.get(v, 0.0)
            if abs(a) > 1e-9:            # parent = upper panel: hips lateral axis expressed in the panel's frame
                i = r.idx[v]
                Pp = RG.q2m(Q[r.idx[p]])          # panel rotation relative to hips
                Lr = Pp.T @ rx(a) @ Pp
                Q[i] = RG.m2q(Lr @ RG.q2m(Q[i]))
        if abs(x.get('arm.L', 0)) > 1e-9 or abs(x.get('arm.R', 0)) > 1e-9:
            W = r.fk(T[None], Q[None])[0]
            Wc = W[self.ci, :3, :3]
            for s, sg in (('L', -1.0), ('R', 1.0)):
                a = x.get('arm.' + s, 0.0)
                if abs(a) < 1e-9:
                    continue
                i = r.idx['upper_arm.' + s]
                L = RG.q2m(Q[i])
                L2 = Wc.T @ rz(sg * a) @ Wc @ L
                Q[i] = RG.m2q(L2)
        return Q

    # ---------- collision test of one posed frame ----------
    def collide(self, Q, T, marg_leg=MARG_LEG, marg_arm=MARG_ARM, arms=True):
        r = self.rig
        W = r.fk(T[None], Q[None])[0]
        H = W[self.hi, :3, 3]
        Rh = W[self.hi, :3, :3]
        dr = self.skin(W, self.md['DRESS'])
        ap = self.skin(W, self.md['APRON'])
        tD = BVHTree.FromPolygons([Vector(v) for v in dr], self.md['DRESS']['F'].tolist())
        tA = BVHTree.FromPolygons([Vector(v) for v in ap], self.md['APRON']['F'].tolist())
        lg = self.skin(W, self.md['BODY'], self.leg_ids)
        push = {}
        hits = dict(leg_dress=0, leg_apron=0, arm=0)
        depth = 0.0
        for p in lg:
            d = np.array([H[0] - p[0], 0.0, H[2] - p[2]])
            L = np.linalg.norm(d)
            if L < 1e-4:
                continue
            d /= L
            fw = 1.0 if (Rh.T @ (p - H))[2] > 0 else -1.0
            o = Vector(p - d * marg_leg)
            dv = Vector(d)
            for tree, key, k in ((tD, 'leg_dress', 'DRESS'), (tA, 'leg_apron', 'APRON')):
                hit = tree.ray_cast(o, dv, L + marg_leg)
                if hit[0] is not None:
                    hits[key] += 1
                    depth = max(depth, marg_leg + 0.0)
                    var = self.face_var[k][hit[2]]
                    if var:
                        push.setdefault(var, []).append(fw)
        armp = {'L': 0, 'R': 0}
        if arms:
            am = self.skin(W, self.md['BODY'], self.arm_ids)
            tor = self.skin(W, self.md['BODY'], self.torso_ids)
            tC = BVHTree.FromPolygons([Vector(v) for v in tor], self.torso_F.tolist())
            for p, s in zip(am, self.arm_side):
                d = np.array([p[0] - H[0], 0.0, p[2] - H[2]])
                L = np.linalg.norm(d)
                if L < 1e-4:
                    continue
                d /= L
                o = Vector(p - d * marg_arm)
                dv = Vector(d)
                for tree in (tD, tA, tC):
                    hit = tree.ray_cast(o, dv, 0.05 + marg_arm)
                    if hit[0] is not None:
                        hits['arm'] += 1
                        armp[s] += 1
                        break
        return push, armp, hits

    def solve_frame(self, Q, T, start=None, iters=80, arms=True):
        x = dict(start or {})
        hist = []
        for it in range(iters):
            push, armp, hits = self.collide(self.apply(Q, T, x), T, arms=arms)
            hist.append(sum(hits.values()))
            if len(hist) > 15 and hist[-1] >= min(hist[:-12]):
                return x, hits, it                      # stalled: unfixable hits (reported by the verification pass)
            moved = False
            for v, sg in push.items():
                dv = -STEP * (1 if sum(sg) >= 0 else -1)
                up = PARENT_VAR.get(v, v)
                # side panels: a leg pressing on them from inside is cleared by flaring the panel outward; pitch only
                # helps once the flare is at its cap
                if up in ROLLS and x.get('roll.' + up, 0.0) + STEP <= CAP['roll.' + up]:
                    x['roll.' + up] = x.get('roll.' + up, 0.0) + STEP
                    moved = True
                    continue
                while v is not None and abs(x.get(v, 0.0) + dv) > CAP[v]:
                    v = PARENT_VAR.get(v)
                if v is None:
                    continue
                x[v] = x.get(v, 0.0) + dv
                moved = True
            for s in 'LR':
                if armp[s] and x.get('arm.' + s, 0.0) + STEP <= CAP['arm.' + s]:
                    x['arm.' + s] = x.get('arm.' + s, 0.0) + STEP
                    moved = True
            if not moved:
                return x, hits, it
        return x, hits, iters


def envelope(r, sigma, periodic, iters=40):
    """smooth curve that is >= r where r > 0 and <= r where r < 0 (same sign envelope), C-inf-ish."""
    import author_lib as AL
    x = r.copy()
    for _ in range(iters):
        x = AL.gauss(x, sigma, periodic)
        x = np.where(r > 1e-6, np.maximum(x, r), np.where(r < -1e-6, np.minimum(x, r), x))
    n = len(r)
    ii = np.arange(n)
    x = AL.gauss(x, sigma * 0.6, periodic)
    for _ in range(80):
        vp = np.where(r > 1e-6, np.maximum(r - x, 0), 0)
        vn = np.where(r < -1e-6, np.minimum(r - x, 0), 0)
        if vp.max() < 1e-5 and vn.min() > -1e-5:
            break
        for v in (vp, vn):
            j = int(np.argmax(np.abs(v)))
            if abs(v[j]) < 1e-5:
                continue
            dd = np.abs(ii - j)
            if periodic:
                dd = np.minimum(dd, n - dd)
            x = x + v[j] * 1.05 * np.exp(-0.5 * (dd / max(sigma, 1.0)) ** 2)
    return x


def solve_clip(solver, Q, T, periodic=False, sigma=2.0, end_lock=None, outer=5, arms=True, log=print, low_lag=1.5, low_k=0.0,
               lock=None):
    """Q [n,J,4], T [n,J,3] (frames at 30 fps). end_lock: (n_start, n_end) frames over which curves are faded to 0 at the clip
    ends (to match idle), or None. lock: (w [n], {var: [n] radians}) -> curves = (1-w) * solved + w * given (hand-offs to a
    clip whose curves are already fixed, e.g. walk_loop). returns (Q_out, report)."""
    import author_lib as AL
    n = len(Q)
    need = {v: np.zeros(n) for v in VARS}
    cur = None
    best = None
    rep = []

    def compose(i, curves, frac=0.0):
        """pose at frame i (+frac toward i+1) with the given curves."""
        if frac > 0:
            j = (i + 1) % n if periodic else min(i + 1, n - 1)
            q = RG.slerp(Q[i], Q[j], frac)
            t = T[i] * (1 - frac) + T[j] * frac
            x = {v: curves[v][i] * (1 - frac) + curves[v][j] * frac for v in VARS}
        else:
            q, t = Q[i], T[i]
            x = {v: curves[v][i] for v in VARS}
        return solver.apply(q, t, x), t

    for it in range(outer):
        for i in range(n):
            st = {v: float(need[v][i]) for v in VARS}
            x, hits, k = solver.solve_frame(Q[i], T[i], st, arms=arms)
            for v in VARS:
                need[v][i] = x.get(v, 0.0)
        cur = {}
        for v in VARS:
            c = envelope(need[v], sigma, periodic)
            if end_lock is not None and not periodic:
                a, b = end_lock
                w = np.ones(n)
                if a:
                    w[:a] = AL.smootherstep(np.arange(a) / a)
                if b:
                    w[n - b:] = np.minimum(w[n - b:], AL.smootherstep((n - 1 - np.arange(n - b, n)) / b))
                c = c * w
            if lock is not None:
                lw, lv = lock
                c = (1 - lw) * c + lw * lv.get(v, np.zeros(n))
            cur[v] = np.clip(c, -CAP[v] * 1.1, CAP[v] * 1.1)
        # lower segments: add follow-through (lagged copy of the upper segment's motion)
        for p in PANELS:
            up = cur[p]
            if periodic:
                lag = np.interp((np.arange(n) - low_lag) % n, np.arange(n + 1), np.append(up, up[0]))
            else:
                lag = np.interp(np.arange(n) - low_lag, np.arange(n), up)
            cur[LOWS[p]] = cur[LOWS[p]] + low_k * (lag - up)
        bad = []
        tot = dict(leg_dress=0, leg_apron=0, arm=0)
        for i in range(n):
            for frac in (0.0, 0.5):
                if frac and not periodic and i == n - 1:
                    continue
                q, t = compose(i, cur, frac)
                push, armp, hits = solver.collide(q, t, arms=arms)
                for k, v in hits.items():
                    tot[k] += v
                if push or armp['L'] or armp['R']:
                    bad.append(i + frac)
                    j = (i + 1) % n if periodic else min(i + 1, n - 1)
                    xc = {v: cur[v][i] * (1 - frac) + cur[v][j] * frac for v in VARS}
                    if frac:
                        q0, t0 = RG.slerp(Q[i], Q[j], frac), T[i] * (1 - frac) + T[j] * frac
                    else:
                        q0, t0 = Q[i], T[i]
                    xn, _, _ = solver.solve_frame(q0, t0, xc, arms=arms)
                    for jj in ({i, j} if frac else {i}):
                        for v in VARS:
                            dv = xn.get(v, 0.0) - xc[v]
                            if abs(dv) > 1e-9:
                                need[v][jj] = np.clip(cur[v][jj] + dv * 1.1, -CAP[v], CAP[v])
        rep.append(dict(outer=it, bad=len(bad), hits=tot, bad_frames=bad[:40]))
        log('  skirt solver', it, len(bad), tot, bad[:20])
        score = (len(bad), sum(tot.values()))
        if best is None or score < best[0]:
            best = (score, {v: c.copy() for v, c in cur.items()})
        if not bad:
            break
    cur = best[1]
    Qo = Q.copy()
    for i in range(n):
        Qo[i] = solver.apply(Q[i], T[i], {v: cur[v][i] for v in VARS})
    curves_deg = {v: np.degrees(cur[v]).round(2).tolist() for v in VARS if np.abs(cur[v]).max() > 1e-6}
    return Qo, dict(iterations=rep, curves_deg=curves_deg,
                    max_deg={v: round(float(np.degrees(np.abs(cur[v]).max())), 2) for v in VARS})
