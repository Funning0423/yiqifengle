# Stage 3 (python3): seated-drape shape keys for LOD0_G2_DRESS and LOD0_G2_APRON on top of the fitted skirt bones.
#   python3 compose.py <sim.npz> <fit.npz> <out.npz> [budget_bytes=20000]
# 1. LBS with the fitted bones (fit_bones.py) at sit_hold t=0 = P1.  Residual r = sim target - P1 on welded nodes,
#    Laplacian-smoothed (removes the sim's small crumples, keeps the knee / seat-edge bend: low-poly, clean folds).
# 2. Vertex set within the sparse budget (14 B per moved vertex: uint16 index + float32 xyz), tapered weight alpha.
# 3. Collision pass on the shaped dress, moving only vertices of the set (growing it with violators while the budget allows):
#    legs >= LEG_M, chair boxes >= CHAIR_M, floor >= FLOOR_M; correction field smoothed so folds stay soft.
# 4. Apron target rides on the shaped dress: rest-pose offset to the nearest dress nodes (gap kept >= APRON_GAP_M along
#    the dress normal), blended by the apron vertex's skirt skin weight (bib / straps stay pure LBS).
# 5. World deltas -> bind space through the blended skin matrix of the fitted seated pose (what LBS applies the morph through).
import sys, os
import numpy as np
from scipy.spatial import cKDTree
import sddata as D

LEG_M, CHAIR_M, FLOOR_M, APRON_GAP_M = 0.007, 0.003, 0.004, 0.006
CHAIR_EDGE_M, HAND_M, APRON_DRESS_M = 0.02, 0.004, 0.007
DRESS_HAND_M = HAND_M + APRON_DRESS_M   # the apron lies between the dress and the hands
# under the thighs / buttocks the body is only 9.7 mm above the seat top: smaller leg clearance in that band
SEAT_BAND_Y, SEAT_BAND_LEG_M = 0.40, 0.0035
BYTES_PER_V = 14
WAIST_KEEP_Y = 1.0           # rest height: the dress waistband keeps its skinned place (no residual above)
APRON_FOLLOW_TOP_Y = float(os.environ.get('SD_APRON_TOP', '1.25'))   # rest height: above it the apron keeps its own skinning
WAIST_BAND_Y, APRON_BAND_M = 0.98, 0.004   # apron waistband: final outward pass against the final dress
RES_FRAC = 0.6          # share of the vertex budget for the sim residual; the rest is for collision fixes


def node_graph(rep, n, F):
    E = D.edges_of(rep[F])
    E = E[E[:, 0] != E[:, 1]]
    nb = [[] for _ in range(n)]
    for a, b in E:
        nb[a].append(b)
        nb[b].append(a)
    return E, nb


def laplace(X, E, n, it, lam=0.5, fixed=None):
    X = X.copy()
    deg = np.bincount(E.ravel(), minlength=n).astype(float)
    for _ in range(it):
        s = np.zeros_like(X)
        np.add.at(s, E[:, 0], X[E[:, 1]])
        np.add.at(s, E[:, 1], X[E[:, 0]])
        avg = s / np.maximum(deg, 1)[:, None]
        upd = X + lam * (avg - X)
        if fixed is not None:
            upd[fixed] = X[fixed]
        X = upd
    return X


def node_mean(X, rep, n):
    s = np.zeros((n,) + X.shape[1:])
    np.add.at(s, rep, X)
    cnt = np.bincount(rep, minlength=n)
    return s / cnt.reshape((-1,) + (1,) * (X.ndim - 1)), cnt


def skin_linear(rig, md, W):
    Sk = W @ rig.ibm
    A = np.zeros((len(md['P']), 3, 3))
    for k in range(4):
        A += md['W'][:, k, None, None] * Sk[md['J'][:, k], :3, :3]
    return A


class Colliders:
    def __init__(self, c, W):
        body = c.md['BODY']
        PB = c.skin('BODY', W)
        legs = np.where(c.body_cls == 'legs')[0]
        F = body['F']
        keep = np.isin(F, legs).all(1)
        self.legs = D.SurfaceSDF(PB, F[keep], sub=3)
        hands = np.where(np.char.startswith(c.body_cls.astype(str), 'hand'))[0]
        # hands rest ON the lap: a cap from above (their underside height over x,z), robust where cloth would pass
        # through a thin hand (a signed distance flips sign there)
        keepH = np.isin(F, hands).all(1)
        HP = []
        for b in np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3]]):
            HP.append(PB[F[keepH, 0]] * b[0] + PB[F[keepH, 1]] * b[1] + PB[F[keepH, 2]] * b[2])
        self.hand_pts = np.concatenate(HP)
        self.hand_xz = cKDTree(self.hand_pts[:, [0, 2]])
        self.boxes = D.chair_boxes()

    def hand_cap(self, X, margin, r=0.012):
        """max allowed y per point (inf where no hand / forearm above it within r in x,z)."""
        cap = np.full(len(X), np.inf)
        for i, nb in enumerate(self.hand_xz.query_ball_point(X[:, [0, 2]], r)):
            if nb:
                ys = self.hand_pts[nb, 1]
                below = ys[ys > X[i, 1] - 0.03]
                if len(below):
                    cap[i] = below.min() - margin
        return cap

    def push(self, X, leg=LEG_M, chair=None, floor=FLOOR_M, hand=DRESS_HAND_M, extra=None):
        """displacement to a valid position; priority low -> high: hand cap, extra (dress under the apron), legs,
        seat footprint, chair, floor."""
        X0 = X
        X = X.copy()
        cap = self.hand_cap(X, hand)
        over = X[:, 1] > cap
        X[over, 1] = cap[over]
        if extra is not None:
            X = extra(X)
        s, n, dist = self.legs.query(X)
        lm = np.where(X[:, 1] < SEAT_BAND_Y, SEAT_BAND_LEG_M, leg)
        bad = (s < lm) & (dist < 0.06)
        X[bad] += n[bad] * (lm[bad] - s[bad])[:, None]
        # the dress never goes under the seat inside its footprint (it would pass through the slab)
        lo, hi = self.boxes['seat']
        under = (X[:, 0] > lo[0] - 0.01) & (X[:, 0] < hi[0] + 0.01) & (X[:, 2] > lo[2] - 0.01) & (X[:, 2] < hi[2] + 0.01) & (X[:, 1] < hi[1] + CHAIR_M) & (X[:, 1] > lo[1] - 0.06)
        X[under, 1] = hi[1] + CHAIR_M
        X += D.chair_push_faces(X, CHAIR_M, CHAIR_EDGE_M if chair is None else chair, self.boxes)
        fl = X[:, 1] < floor
        X[fl, 1] = floor
        return X - X0

    def violations(self, X, leg=0.0, chair=0.0):
        s, n, dist = self.legs.query(X)
        cs, _ = D.chair_sdf(X, self.boxes)
        return dict(legs=int(((s < leg) & (dist < 0.06)).sum()), chair=int((cs < chair).sum()), floor=int((X[:, 1] < 0).sum()),
                    leg_min_mm=float(s[dist < 0.06].min() * 1e3) if (dist < 0.06).any() else None, chair_min_mm=float(cs.min() * 1e3))


def compose_dress(c, W, tgt, budget, smooth_it=None, col=None, extra=None):
    md = c.md['DRESS']
    P1 = c.skin('DRESS', W)
    rep, n = D.weld(md['P'])
    _, cnt = node_mean(md['P'], rep, n)
    E, nb = node_graph(rep, n, md['F'])
    Pn, _ = node_mean(P1, rep, n)
    Tn, _ = node_mean(tgt, rep, n)
    pin = np.zeros(n, bool)
    pin[rep[md['dom'] == 'hips']] = True
    r = Tn - Pn
    rest_y = node_mean(md['P'], rep, n)[0][:, 1]
    r *= np.clip((WAIST_KEEP_Y - rest_y) / 0.06, 0, 1)[:, None]
    rs = laplace(r, E, n, smooth_it or int(os.environ.get('SD_SMOOTH', '25')))
    vmax = budget // BYTES_PER_V
    mag = np.linalg.norm(rs, axis=1)
    # threshold so that the tapered set fits with ~25% headroom for collision growth
    order = np.argsort(-mag)
    csum = np.cumsum(cnt[order])
    k = int(np.searchsorted(csum, vmax * RES_FRAC))
    lo = mag[order[min(k, n - 1)]]
    hi = lo + 0.01
    alpha = np.clip((mag - lo) / (hi - lo), 0, 1)
    alpha = laplace(alpha[:, None], E, n, 3)[:, 0]
    alpha[alpha < 0.02] = 0
    sel = np.where(alpha > 0)[0]
    sel = sel[np.argsort(-alpha[sel])]
    over = sel[np.cumsum(cnt[sel]) > int(vmax * RES_FRAC)]
    alpha[over] = 0
    X = Pn + alpha[:, None] * rs
    inset = alpha > 0
    # the lap under the apron is hidden: smooth it hard so the coarse apron sheet can lie over it without folds poking through
    mdA = c.md['APRON']
    rest_nodes, _ = node_mean(md['P'], rep, n)
    sA, _, dA = D.SurfaceSDF(mdA['P'], mdA['F'], sub=3).query(rest_nodes)
    covered = (dA < 0.025) & inset & (rest_nodes[:, 1] < rest_nodes[:, 1].max() - 0.03)
    X = laplace(X, E, n, 60, fixed=~covered)
    col = col or Colliders(c, W)
    corr = np.zeros_like(X)
    for it in range(30):
        d = col.push(X + corr, extra=extra)
        mv = np.linalg.norm(d, axis=1) > 1e-5
        newv = mv & ~inset
        if newv.any():
            room = vmax - cnt[inset].sum()
            cand = np.where(newv)[0]
            cand = cand[np.argsort(-np.linalg.norm(d[cand], axis=1))]
            take = cand[np.cumsum(cnt[cand]) <= room]
            inset[take] = True
        d[~inset] = 0
        corr += d
        corr_s = laplace(corr, E, n, 2, fixed=~inset)
        corr = np.where(inset[:, None], corr_s, 0)
        if not mv.any():
            break
    # final hard pass without smoothing so nothing is left inside
    for it in range(10):
        d = col.push(X + corr, extra=extra)
        d[~inset] = 0
        if np.abs(d).max() < 1e-6:
            break
        corr += d
    Xf = X + corr
    Xf[~inset] = Pn[~inset]
    nv = int(cnt[inset].sum())
    stats = dict(nodes_in_set=int(inset.sum()), verts_in_set=nv, bytes=nv * BYTES_PER_V, res_lo_mm=float(lo * 1e3),
                 fit_err_mean_mm=float(np.linalg.norm(Xf - Tn, axis=1).mean() * 1e3),
                 before=col.violations(Pn), after=col.violations(Xf))
    return dict(P1=P1, Xn=Xf, rep=rep, n=n, inset=inset, E=E, stats=stats, col=col, Pn=Pn)


def bary_grid(sub):
    return np.array([(i / sub, j / sub, 1 - (i + j) / sub) for i in range(sub + 1) for j in range(sub + 1 - i)])


def tri_sample_push(X, F, sdf, margin, movable, iters=40, sub=4, near=0.06):
    """triangle-level clearance: samples on every triangle keep >= margin from the sdf surface; each sample's correction
    is spread to its triangle's vertices by barycentric weight (cloth-style), averaged per vertex."""
    B = bary_grid(sub)
    for it in range(iters):
        P = np.einsum('sk,fkc->fsc', B, X[F])
        s, n, d = sdf.query(P.reshape(-1, 3))
        s, n, d = s.reshape(len(F), -1), n.reshape(len(F), len(B), 3), d.reshape(len(F), -1)
        bad = (s < margin) & (d < near)
        if not bad.any():
            return X, 0
        corr = np.where(bad[..., None], n * (margin - s)[..., None], 0)
        acc = np.zeros_like(X)
        wsum = np.zeros(len(X))
        for k in range(3):
            w = B[None, :, k] * bad
            np.add.at(acc, F[:, k], (w[..., None] * corr).sum(1) / np.maximum((B ** 2).sum(1).max(), 1e-9))
            np.add.at(wsum, F[:, k], w.sum(1))
        step = acc / np.maximum(wsum, 1e-9)[:, None]
        step[~movable] = 0
        X = X + 1.2 * step
    return X, int(bad.sum())


class HeightField:
    """top of a set of triangle surfaces seen from above: query(P) -> (P.y - top, +y, near) like SurfaceSDF.query,
    so tri_sample_push lifts vertically.  bridge > 0 takes the max over that x,z radius (a sheet spans a gap)."""

    def __init__(self, surfaces, sub=4, r=0.008, bridge=0.0, below=0.06, above=0.03):
        B = bary_grid(sub)
        self.pts = np.concatenate([np.einsum('sk,fkc->fsc', B, V[F]).reshape(-1, 3) for V, F in surfaces])
        self.tree = cKDTree(self.pts[:, [0, 2]])
        self.r, self.bridge, self.below, self.above = r, bridge, below, above

    def top(self, P):
        h = np.full(len(P), -np.inf)
        for i, nb in enumerate(self.tree.query_ball_point(P[:, [0, 2]], max(self.r, self.bridge))):
            if nb:
                ys = self.pts[nb, 1]
                ok = (ys > P[i, 1] - self.below) & (ys < P[i, 1] + self.above)
                if ok.any():
                    h[i] = ys[ok].max()
        return h

    def query(self, P):
        h = self.top(P)
        s = np.where(np.isfinite(h), P[:, 1] - h, np.inf)
        n = np.tile([0.0, 1.0, 0.0], (len(P), 1))
        return s, n, np.where(np.isfinite(h), 0.0, np.inf)


def drape_lap(c, W, mdA, PA, XA, dres, col, low):
    """up-facing apron (the lap): start from its skinned sheet (keeps its width; following the dress pulls it into the gap
    between the thighs), lay it on the bridged top of dress + thighs, then lift every triangle clear of them."""
    mdD = c.md['DRESS']
    FD = dres['rep'][mdD['F']]
    body = c.md['BODY']
    PB = c.skin('BODY', W)
    legs = np.where(c.body_cls == 'legs')[0]
    FL = body['F'][np.isin(body['F'], legs).all(1)]
    surf = [(dres['Xn'], FD), (PB, FL)]
    nrm = D.vertex_normals(PA, mdA['F'])
    EA = D.edges_of(mdA['F'])
    nA = len(PA)
    nrm = laplace(nrm, EA, nA, 4)
    up = np.clip((nrm[:, 1] / np.maximum(np.linalg.norm(nrm, axis=1), 1e-9) - 0.45) / 0.3, 0, 1) * low
    gap = APRON_DRESS_M + 0.002
    hb = HeightField(surf, bridge=0.035, below=0.08, above=0.08).top(PA)
    tgt = PA.copy()
    ok = np.isfinite(hb)
    tgt[ok, 1] = hb[ok] + gap
    w = up * ok
    X = XA + w[:, None] * (tgt - XA)
    X = XA + laplace(X - XA, EA, nA, 6, lam=0.5, fixed=~low)
    hf = HeightField(surf, below=0.05, above=0.03)
    lap = (up > 0) | (laplace(up[:, None], EA, nA, 2)[:, 0] > 0.05)
    for rnd in range(4):
        X, left = tri_sample_push(X, mdA['F'], hf, gap, lap & low, iters=15, near=1.0)
        X = XA + laplace(X - XA, EA, nA, 2, lam=0.4, fixed=~low)
    X, left = tri_sample_push(X, mdA['F'], hf, gap, lap & low, iters=30, near=1.0)
    print('APRON lap drape: verts', int((up > 0).sum()), 'height violations left', left)
    return X, lap


def compose_apron(c, W, dres, col):
    """apron target from the shaped dress: rest offset to the dress, gap >= APRON_GAP_M."""
    mdA, mdD = c.md['APRON'], c.md['DRESS']
    rep, n = dres['rep'], dres['n']
    rest_nodes, _ = node_mean(mdD['P'], rep, n)
    tree = cKDTree(rest_nodes)
    FD = rep[mdD['F']]
    Nrest = D.vertex_normals(rest_nodes, FD)
    Nnew = D.vertex_normals(dres['Xn'], FD)
    PA = c.skin('APRON', W)
    # attachment: each apron vertex rides on its rest-pose closest point of the dress (face + barycentric), offset along the
    # dress normal (smoothed hard: folds and the belly crease must not flip it) by its rest gap (>= APRON_GAP_M)
    B = bary_grid(6)
    smp = np.einsum('sk,fkc->fsc', B, rest_nodes[FD]).reshape(-1, 3)
    _, si = cKDTree(smp).query(mdA['P'])
    fi, bi = si // len(B), si % len(B)
    E = dres['E']
    Ns = laplace(Nnew, E, n, 15)
    Ns /= np.maximum(np.linalg.norm(Ns, axis=1, keepdims=True), 1e-9)
    Nr = laplace(Nrest, E, n, 15)
    Nr /= np.maximum(np.linalg.norm(Nr, axis=1, keepdims=True), 1e-9)
    bw = B[bi]
    p0 = np.einsum('vk,vkc->vc', bw, rest_nodes[FD[fi]])
    n0 = np.einsum('vk,vkc->vc', bw, Nr[FD[fi]])
    gap = np.maximum(np.einsum('vc,vc->v', mdA['P'] - p0, n0), APRON_GAP_M)
    p1 = np.einsum('vk,vkc->vc', bw, dres['Xn'][FD[fi]])
    n1 = np.einsum('vk,vkc->vc', bw, Ns[FD[fi]])
    n1 /= np.maximum(np.linalg.norm(n1, axis=1, keepdims=True), 1e-9)
    tgtA = p1 + gap[:, None] * n1
    dist = np.linalg.norm(mdA['P'] - p0, axis=1)[:, None]
    ytop = rest_nodes[:, 1].max()
    b = (dist[:, 0] < 0.035) * np.clip((APRON_FOLLOW_TOP_Y - mdA['P'][:, 1]) / 0.08, 0, 1)
    EA = D.edges_of(mdA['F'])
    nA = len(PA)
    DA = laplace(b[:, None] * (tgtA - PA), EA, nA, 10, lam=0.5, fixed=b == 0)
    XA = PA + DA
    dsdf = D.SurfaceSDF(dres['Xn'], FD, sub=3)
    low = mdA['P'][:, 1] < ytop
    for it in range(20):
        d = col.push(XA, hand=HAND_M)
        s, nn, dd = dsdf.query(XA + d)
        bad = (s < APRON_DRESS_M) & (dd < 0.03)
        d[bad] += nn[bad] * (APRON_DRESS_M - s[bad])[:, None]
        d[~low] = 0
        if np.abs(d).max() < 1e-6:
            break
        XA += d
    # triangle-level: the apron sheet clears the thighs by the dress clearance + the dress-apron gap, so the dress fits under it
    for rnd in range(6):
        XA, left = tri_sample_push(XA, mdA['F'], col.legs, LEG_M + APRON_DRESS_M + 0.002, low, iters=10)
        XA = PA + laplace(XA - PA, EA, nA, 3, lam=0.4, fixed=~low)
    XA, left = tri_sample_push(XA, mdA['F'], col.legs, LEG_M + APRON_DRESS_M + 0.002, low)
    area = lambda V: np.linalg.norm(np.cross(V[mdA['F'][:, 1]] - V[mdA['F'][:, 0]], V[mdA['F'][:, 2]] - V[mdA['F'][:, 0]]), axis=1)
    print('APRON tri-sample leg violations left', left, 'min area ratio %.3f' % (area(XA) / area(PA)).min())
    XA, leftD = tri_sample_push(XA, mdA['F'], dsdf, 0.004, low, iters=60, near=0.03)
    print('APRON tri-sample dress violations left', leftD)
    for it in range(10):
        s, nn, dd = dsdf.query(XA)
        bad = (s < APRON_DRESS_M) & (dd < 0.03) & low
        if not bad.any():
            break
        XA[bad] += nn[bad] * (APRON_DRESS_M - s[bad])[:, None]
    if os.environ.get('SD_LAP', '1') == '1':
        XA, lap = drape_lap(c, W, mdA, PA, XA, dres, col, low)
        cap = col.hand_cap(XA, HAND_M)
        over = lap & (XA[:, 1] > cap)
        XA[over, 1] = cap[over]
        print('APRON lap verts capped under the hands', int(over.sum()))
    s, nn, dd = dsdf.query(XA)
    print('APRON clearance to dress mm (near verts): min %.1f' % (s[dd < 0.03].min() * 1e3), col.violations(XA))
    return dict(PA=PA, XA=XA, blend=b)


def under_apron(c, XA, W):
    """dress stays >= APRON_DRESS_M behind the apron sheet wherever the apron covers it (apron normals oriented outward
    from the rest pose: the rest dress lies on their negative side)."""
    mdA = c.md['APRON']
    sdf = D.SurfaceSDF(XA, mdA['F'], sub=10)
    rest = D.SurfaceSDF(mdA['P'], mdA['F'], sub=10)
    s0, _, d0 = rest.query(c.md['DRESS']['P'])
    sign = -1.0 if np.median(s0[d0 < 0.02]) > 0 else 1.0

    def f(X):
        s, n, d = sdf.query(X)
        s, n = s * sign, n * sign
        bad = (d < 0.02) & (s > -APRON_DRESS_M) & (s < 0.03)
        X = X.copy()
        X[bad] -= n[bad] * (s[bad] + APRON_DRESS_M)[:, None]
        return X
    return f


def finalize_apron(c, dres, XA, PA):
    """apron waistband vs the FINAL dress (pass 2 moved it): triangle-level clearance, only the band (rest y above
    WAIST_BAND_Y, rigid on the hips) moves outward; the lap and the bib keep their place."""
    mdA, mdD = c.md['APRON'], c.md['DRESS']
    rep = dres['rep']
    rest_nodes, _ = node_mean(mdD['P'], rep, dres['n'])
    band = (mdA['P'][:, 1] > WAIST_BAND_Y) & (mdA['P'][:, 1] < rest_nodes[:, 1].max())
    dsdf = D.SurfaceSDF(dres['Xn'], rep[mdD['F']], sub=4)
    EA = D.edges_of(mdA['F'])
    for rnd in range(4):
        XA, left = tri_sample_push(XA, mdA['F'], dsdf, APRON_BAND_M, band, iters=30, sub=6, near=0.04)
        XA = PA + laplace(XA - PA, EA, len(XA), 2, lam=0.4, fixed=~band)
    XA, left = tri_sample_push(XA, mdA['F'], dsdf, APRON_BAND_M, band, iters=40, sub=6, near=0.04)
    print('APRON band: tri-sample dress violations left', left, 'band verts', int(band.sum()))
    return XA


def to_bind(c, W, key, delta):
    A = skin_linear(c.rig, c.md[key], W)
    return np.einsum('nij,nj->ni', np.linalg.inv(A), delta)


def main():
    a = sys.argv[1:]
    sim, fit = np.load(a[0]), np.load(a[1])
    budget = int(a[3]) if len(a) > 3 else 20000
    c = D.Char()
    T0, R0, S0 = c.local('sit_hold', 0.0)
    W = c.world(fit['T'], fit['Rq'], S0)
    dres = compose_dress(c, W, sim['settled'], budget)
    print('DRESS', dres['stats'])
    ap = compose_apron(c, W, dres, dres['col'])
    # pass 2: apron fixed, the dress keeps clear of the apron TRIANGLES (they are long; vertex clearance is not enough)
    dres = compose_dress(c, W, sim['settled'], budget, col=dres['col'], extra=under_apron(c, ap['XA'], W))
    print('DRESS pass 2', dres['stats'])
    ap['XA'] = finalize_apron(c, dres, ap['XA'], ap['PA'])
    rep = dres['rep']
    XD = dres['Xn'][rep]
    dD = to_bind(c, W, 'DRESS', XD - dres['P1'])
    dD[~dres['inset'][rep]] = 0
    dA = to_bind(c, W, 'APRON', ap['XA'] - ap['PA'])
    print('APRON moved', int((np.linalg.norm(dA, axis=1) > 1e-5).sum()), 'of', len(dA))
    np.savez(a[2], dress_delta=dD, apron_delta=dA, dress_world=XD, apron_world=ap['XA'], T=fit['T'], Rq=fit['Rq'])


if __name__ == '__main__':
    main()
