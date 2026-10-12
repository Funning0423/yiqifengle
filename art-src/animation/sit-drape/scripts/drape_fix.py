# Constraint projection on cloth shapes (Blender python: numpy + mathutils BVH).  fix(): collision only, smoothed (used
# for the shape key); project(): also limits edge stretch (used on the cloth sim reference).  Used on the raw cloth sim output and on
# the fitted bone + shape-key reconstruction: every cloth vertex is pushed out of the chair's convex parts, out of the
# body (torso + legs, along the skin face normal) and above the floor by a small margin; edges may not stretch more than
# MAX_STRETCH over their rest length; pinned vertices (waist band) never move.  The apron / bow are also kept on the
# outer side of the dress.
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import sitlib as SL

M_CHAIR = 0.0015
M_BODY = 0.0015
M_LAYER = 0.0012
M_FLOOR = 0.002
MAX_STRETCH = 1.06
FIXED_Y = 1.135
SEAT_COLUMN_Y = 0.005
BODY_FREE_Y = 1.085      # above it the dress already overlaps the hips in the bind pose (covered body)


class Projector:
    def __init__(self, ch, chair, mesh):
        self.ch, self.chair, self.mesh = ch, chair, mesh
        md = ch.md[mesh]
        self.inv, self.Fw, _ = SL.weld(md['P'], md['F'])
        n = self.inv.max() + 1
        self.rep = np.zeros(n, int)
        self.rep[self.inv] = np.arange(len(self.inv))
        e = np.sort(np.concatenate([self.Fw[:, [0, 1]], self.Fw[:, [1, 2]], self.Fw[:, [2, 0]]]), 1)
        e = np.unique(e[e[:, 0] != e[:, 1]], axis=0)
        self.E = e
        P0 = md['P'][self.rep]
        self.L0 = np.linalg.norm(P0[e[:, 0]] - P0[e[:, 1]], axis=1)
        B = ch.md['BODY']
        skip = np.zeros(len(B['P']), bool)
        skip[ch.ids['arm']] = True
        skip[ch.ids['head']] = True
        self.body_F = B['F'][~skip[B['F']].any(1)]
        self.bfree = md['P'][self.rep, 1] < BODY_FREE_Y
        # cloth collides with the seat extruded down to the floor: a skirt can drape over the seat edge but never pass
        # under the 39 mm seat slab (a vertex-only test would let triangles straddle it)
        self.cparts = []
        for p in chair.parts:
            if p['name'] == 'seat':
                keep = p['n'][:, 1] > -0.3
                p = dict(p, n=np.vstack([p['n'][keep], [[0.0, -1.0, 0.0]]]), b=np.concatenate([p['b'][keep], [SEAT_COLUMN_Y]]),
                         name='seat_column')
            self.cparts.append(p)

    def body_tree(self, Bw):
        return BVHTree.FromPolygons([Vector(v) for v in Bw], self.body_F.tolist())

    def chair_push(self, X, margin=M_CHAIR):
        moved = np.zeros(len(X), bool)
        for p in self.cparts:
            d = X @ p['n'].T + p['b']
            k = d.argmax(1)
            m = d[np.arange(len(X)), k]
            ins = m < margin
            if ins.any():
                X[ins] += (margin - m[ins])[:, None] * p['n'][k[ins]]
                moved |= ins
        return moved

    def surface_push(self, X, tree, margin, maxd=0.03, idx=None):
        """push points that are on the inner side of a closed / oriented surface (or closer than margin) out along
        the nearest face normal."""
        moved = np.zeros(len(X), bool)
        ids = range(len(X)) if idx is None else idx
        for i in ids:
            r = tree.find_nearest(Vector(X[i]), maxd)
            if r[0] is None:
                continue
            q, n = np.array(r[0]), np.array(r[1])
            s = float((X[i] - q) @ n)
            if s < margin:
                X[i] = X[i] + (margin - s) * n
                moved[i] = True
        return moved

    def poke_push(self, X, free, pts, margin, maxd=0.02):
        """body points that poke through the cloth between its vertices: move the closest cloth face outward (along its
        normal, the dress normals face away from the body) until the point is margin inside."""
        Fw = self.Fw
        tree = BVHTree.FromPolygons([Vector(v) for v in X], Fw.tolist())
        acc = np.zeros_like(X)
        cnt = np.zeros(len(X))
        for p in pts:
            r = tree.find_nearest(Vector(p), maxd)
            if r[0] is None:
                continue
            q, n, fi = np.array(r[0]), np.array(r[1]), r[2]
            s = float((p - q) @ n)
            if s > -margin:
                for v in Fw[fi]:
                    if free[v]:
                        acc[v] += (s + margin) * n
                        cnt[v] += 1
        m = cnt > 0
        X[m] += acc[m] / cnt[m][:, None]
        return int(m.sum())

    def stretch(self, X, free, iters=3):
        E, L0 = self.E, self.L0
        for _ in range(iters):
            d = X[E[:, 1]] - X[E[:, 0]]
            L = np.linalg.norm(d, axis=1)
            over = L > L0 * MAX_STRETCH
            if not over.any():
                return
            e, dd, LL, l0 = E[over], d[over], L[over], L0[over]
            corr = (dd * ((LL - l0 * MAX_STRETCH) / LL)[:, None])
            wa, wb = free[e[:, 0]].astype(float), free[e[:, 1]].astype(float)
            s = wa + wb
            ok = s > 0
            acc = np.zeros_like(X)
            cnt = np.zeros(len(X))
            np.add.at(acc, e[ok, 0], corr[ok] * (wa[ok] / s[ok])[:, None])
            np.add.at(acc, e[ok, 1], -corr[ok] * (wb[ok] / s[ok])[:, None])
            np.add.at(cnt, e[ok, 0], wa[ok] > 0)
            np.add.at(cnt, e[ok, 1], wb[ok] > 0)
            m = cnt > 0
            X[m] += acc[m] / cnt[m][:, None]

    def violation(self, Xo, Bw, layer=None):
        """largest collision push (chair, body below the waist band, layer) for one pass, no stretch: m."""
        X = Xo[self.rep].copy()
        free = self.ch.md[self.mesh]['P'][self.rep, 1] < FIXED_Y
        Y = X.copy()
        Yf = Y[free]
        self.chair_push(Yf, margin=0.0)
        Y[free] = Yf
        self.surface_push(Y, self.body_tree(Bw), 0.0, idx=np.where(free & self.bfree)[0])
        if layer is not None:
            lt = BVHTree.FromPolygons([Vector(v) for v in layer[0]], np.asarray(layer[1]).tolist())
            self.surface_push(Y, lt, 0.0, maxd=0.02, idx=np.where(free)[0])
        return float(np.linalg.norm(Y - X, axis=1).max())

    def collide(self, X, free, bnear, near, tree, pk, lt, iters=4):
        """collision pushes only (welded order, in place): chair / seat column, body, body points poking through,
        layer, floor."""
        for it in range(iters):
            Xf = X[near]
            self.chair_push(Xf)
            X[near] = Xf
            self.surface_push(X, tree, M_BODY, idx=bnear)
            if pk is not None:
                self.poke_push(X, free & self.bfree, pk, M_BODY)
            if lt is not None:
                self.surface_push(X, lt, M_LAYER, maxd=0.02, idx=near)
            low = X[:, 1] < M_FLOOR
            X[low & free, 1] = M_FLOOR
        Xf = X[near]
        self.chair_push(Xf)
        X[near] = Xf

    def smooth_delta(self, D, free, iters=2):
        """uniform Laplacian smoothing of a displacement field over the welded edges (fixed vertices stay 0)."""
        E = self.E
        for _ in range(iters):
            acc = np.zeros_like(D)
            cnt = np.zeros(len(D))
            np.add.at(acc, E[:, 0], D[E[:, 1]])
            np.add.at(acc, E[:, 1], D[E[:, 0]])
            np.add.at(cnt, E[:, 0], 1)
            np.add.at(cnt, E[:, 1], 1)
            D = 0.5 * D + 0.5 * acc / np.maximum(cnt, 1)[:, None]
            D[~free] = 0
        return D

    def fix(self, Xo, Bw, layer=None, rounds=3, poke=True):
        """smallest smooth collision fix (no stretch limit): push out, spread the push over the neighbours, push out
        again from the smoothed shape.  GLB order in / out."""
        X0 = Xo[self.rep].copy()
        free = self.ch.md[self.mesh]['P'][self.rep, 1] < FIXED_Y
        near = np.where(free)[0]
        bnear = np.where(free & self.bfree)[0]
        pk = Bw[np.concatenate([self.ch.ids['leg'], self.ch.ids['hips']])] if poke else None
        tree = self.body_tree(Bw)
        lt = None
        if layer is not None:
            lt = BVHTree.FromPolygons([Vector(v) for v in layer[0]], np.asarray(layer[1]).tolist())
        X = X0.copy()
        self.collide(X, free, bnear, near, tree, pk, lt)
        for _ in range(rounds):
            X = X0 + self.smooth_delta(X - X0, free)
            self.collide(X, free, bnear, near, tree, pk, lt, iters=2)
        return X[self.inv]

    def project(self, Xo, Bw, layer=None, iters=8, tree=None, poke=True):
        """Xo: [V,3] world positions in GLB vertex order -> projected copy (GLB order). layer: (dress world P, F) to
        stay outside of.  The waist band (rest height >= FIXED_Y) never moves."""
        X = Xo[self.rep].copy()
        free = self.ch.md[self.mesh]['P'][self.rep, 1] < FIXED_Y
        pk = Bw[np.concatenate([self.ch.ids['leg'], self.ch.ids['hips']])] if poke else None
        tree = tree or self.body_tree(Bw)
        lt = None
        if layer is not None:
            lt = BVHTree.FromPolygons([Vector(v) for v in layer[0]], np.asarray(layer[1]).tolist())
        fixed = X.copy()
        near = np.where(free)[0]
        bnear = np.where(free & self.bfree)[0]
        for it in range(iters):
            self.stretch(X, free)
            X[~free] = fixed[~free]
            Xf = X[near]
            self.chair_push(Xf)
            X[near] = Xf
            self.surface_push(X, tree, M_BODY, idx=bnear)
            if pk is not None and it >= iters // 2:
                self.poke_push(X, free & self.bfree, pk, M_BODY)
            if lt is not None:
                self.surface_push(X, lt, M_LAYER, maxd=0.02, idx=near)
            low = X[:, 1] < M_FLOOR
            X[low & free, 1] = M_FLOOR
        Xf = X[near]
        self.chair_push(Xf)
        X[near] = Xf
        return X[self.inv]
