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
import sys
import numpy as np
from scipy.spatial import cKDTree
import sddata as D

LEG_M, CHAIR_M, FLOOR_M, APRON_GAP_M = 0.007, 0.004, 0.004, 0.006
BYTES_PER_V = 14


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
        allb = D.SurfaceSDF(PB, F, sub=2)
        self.body = allb
        self.boxes = D.chair_boxes()

    def push(self, X, leg=LEG_M, chair=CHAIR_M, floor=FLOOR_M):
        d = np.zeros_like(X)
        s, n, dist = self.legs.query(X)
        bad = (s < leg) & (dist < 0.06)
        d[bad] += n[bad] * (leg - s[bad])[:, None]
        d += D.chair_push(X, chair, self.boxes)
        fl = X[:, 1] < floor
        d[fl, 1] += floor - X[fl, 1]
        return d

    def violations(self, X, leg=0.0, chair=0.0):
        s, n, dist = self.legs.query(X)
        cs, _ = D.chair_sdf(X, self.boxes)
        return dict(legs=int(((s < leg) & (dist < 0.06)).sum()), chair=int((cs < chair).sum()), floor=int((X[:, 1] < 0).sum()),
                    leg_min_mm=float(s[dist < 0.06].min() * 1e3) if (dist < 0.06).any() else None, chair_min_mm=float(cs.min() * 1e3))


def compose_dress(c, W, tgt, budget, smooth_it=25, col=None):
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
    rs = laplace(r, E, n, smooth_it)
    vmax = budget // BYTES_PER_V
    mag = np.linalg.norm(rs, axis=1)
    # threshold so that the tapered set fits with ~25% headroom for collision growth
    order = np.argsort(-mag)
    csum = np.cumsum(cnt[order])
    k = int(np.searchsorted(csum, vmax * 0.75))
    lo = mag[order[min(k, n - 1)]]
    hi = lo + 0.01
    alpha = np.clip((mag - lo) / (hi - lo), 0, 1)
    alpha = laplace(alpha[:, None], E, n, 3)[:, 0]
    alpha[alpha < 0.02] = 0
    X = Pn + alpha[:, None] * rs
    inset = alpha > 0
    col = col or Colliders(c, W)
    corr = np.zeros_like(X)
    for it in range(30):
        d = col.push(X + corr)
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
        d = col.push(X + corr)
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
    k = 6
    dist, idx = tree.query(mdA['P'], k=k)
    w = 1 / np.maximum(dist, 1e-4)
    w /= w.sum(1, keepdims=True)
    # rest offset in the local frame of each dress node: normal component + tangential component carried rigidly
    off = mdA['P'][:, None, :] - rest_nodes[idx]
    gn = np.einsum('vkc,vkc->vk', off, Nrest[idx])
    tang = off - gn[..., None] * Nrest[idx]
    gn = np.maximum(gn, APRON_GAP_M)
    cand = dres['Xn'][idx] + gn[..., None] * Nnew[idx] + tang
    tgtA = (w[..., None] * cand).sum(1)
    names = np.array(c.rig.names)
    skirt_w = np.zeros(len(PA))
    for kk in range(4):
        skirt_w += mdA['W'][:, kk] * np.char.startswith(names[mdA['J'][:, kk]].astype(str), 'skirt')
    near = dist[:, 0] < 0.05
    b = np.clip((skirt_w - 0.2) / 0.6, 0, 1) * near
    XA = PA + b[:, None] * (tgtA - PA)
    for it in range(10):
        d = col.push(XA)
        d[b == 0] = 0
        XA += d
    return dict(PA=PA, XA=XA, blend=b)


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
    rep = dres['rep']
    XD = dres['Xn'][rep]
    dD = to_bind(c, W, 'DRESS', XD - dres['P1'])
    dD[~dres['inset'][rep]] = 0
    dA = to_bind(c, W, 'APRON', ap['XA'] - ap['PA'])
    print('APRON moved', int((np.linalg.norm(dA, axis=1) > 1e-5).sum()), 'of', len(dA))
    np.savez(a[2], dress_delta=dD, apron_delta=dA, dress_world=XD, apron_world=ap['XA'], T=fit['T'], Rq=fit['Rq'])


if __name__ == '__main__':
    main()
