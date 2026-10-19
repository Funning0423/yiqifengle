"""Skycity floor seal (r5 S2): the south rim around the great tree's roots has no ground under the root arches, so low
camera rays from the departure / look-back shots fall straight through to the lake below (运镜bot lakeside-landing
RESULT.md section 5). This builds a thin, low-poly ground patch under those roots plus the narrow notches next to them.

    python3 skycity_floor_seal.py <dump.json from skycity_seal_io.cjs dump> <mesh.json>

Plan (0.5 m cells over the south rim, QA-decoder world space):
  floor  = a cell has an up-facing surface in y [-1.5, 1.5]
  seal   = root-covered cells within 2 m of floor (under the arches), then closing(floor + those, 3.5 m) with holes
           filled, minus floor (notches between the roots, cells left open inside a root patch)
  mesh   = marching squares over the blurred plan (seal + 1 cell tucked under the existing floor edge) at the nearest
           floor height - 3 cm, a 1.0 m rock skirt where the outline faces open air; grass / rock texels of M_sky_palette.
The mesh is written in skycity_float_root local space (inverse of its rotation)."""
import json, sys, math
import numpy as np
from scipy import ndimage

X0, X1, Z0, Z1, R = -45.0, 25.0, -50.0, -15.0, 0.5
SKIP = ('cloudsea', 'cumulus_far', 'cloud_small', 'Icosphere', '_after', 'birds', 'islets_far', 'canopy', 'starring',
        'ring_', 'pennant')
UV_GRASS, UV_ROCK = (0.062, 0.797), (0.313, 0.650)
SKIRT = 1.0

def stacks(meshes):
    names = [n for n, ts in meshes.items() if not any(s in n for s in SKIP) and len(ts)]
    T = np.concatenate([np.array(meshes[n], np.float64).reshape(-1, 3, 3) for n in names])
    TN = np.concatenate([np.full(len(meshes[n]), k) for k, n in enumerate(names)])
    lo, hi = T.min(1), T.max(1)
    keep = (hi[:, 0] >= X0) & (lo[:, 0] <= X1) & (hi[:, 2] >= Z0) & (lo[:, 2] <= Z1)
    T = T[keep]; TN = TN[keep]; lo, hi = lo[keep], hi[keep]
    nx, nz = int(round((X1 - X0) / R)), int(round((Z1 - Z0) / R))
    bins = {}
    for k in range(len(T)):
        for i in range(max(0, int((lo[k, 0] - X0) // R)), min(nx, int((hi[k, 0] - X0) // R) + 1)):
            for j in range(max(0, int((lo[k, 2] - Z0) // R)), min(nz, int((hi[k, 2] - Z0) // R) + 1)):
                bins.setdefault((j, i), []).append(k)
    out = {}
    for (j, i), ks in bins.items():
        x, z = X0 + (i + 0.5) * R, Z0 + (j + 0.5) * R
        A, B, C = T[ks, 0], T[ks, 1], T[ks, 2]
        d = (B[:, 0] - A[:, 0]) * (C[:, 2] - A[:, 2]) - (C[:, 0] - A[:, 0]) * (B[:, 2] - A[:, 2])
        ok = np.abs(d) > 1e-12; d = np.where(ok, d, 1)
        l1 = ((x - A[:, 0]) * (C[:, 2] - A[:, 2]) - (C[:, 0] - A[:, 0]) * (z - A[:, 2])) / d
        l2 = ((B[:, 0] - A[:, 0]) * (z - A[:, 2]) - (x - A[:, 0]) * (B[:, 2] - A[:, 2])) / d
        m = ok & (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
        if not m.any(): continue
        y = A[m, 1] + l1[m] * (B[m, 1] - A[m, 1]) + l2[m] * (C[m, 1] - A[m, 1])
        e1, e2 = B[m] - A[m], C[m] - A[m]
        ny = e1[:, 2] * e2[:, 0] - e1[:, 0] * e2[:, 2]
        out[(j, i)] = list(zip(y.tolist(), (ny > 0).tolist(), [names[q] for q in TN[np.array(ks)[m]]]))
    return out, nx, nz

def plan(st, nx, nz):
    F = np.zeros((nz, nx), bool); FY = np.full((nz, nx), np.nan); ABOVE = np.zeros((nz, nx), bool)
    BUILT = np.zeros((nz, nx), bool)  # under a ruin (the lighthouse has no floor inside its footprint)
    for (j, i), ys in st.items():
        fl = [y for y, up, n in ys if -1.5 <= y <= 1.5 and up]
        if fl: F[j, i] = True; FY[j, i] = max(fl)
        if any(y > 1.5 for y, up, n in ys): ABOVE[j, i] = True
        if any(y > 1.5 and n == 'env_sky_ruins' for y, up, n in ys): BUILT[j, i] = True
    r = 7
    disk = lambda q: np.hypot(*np.mgrid[-q:q + 1, -q:q + 1]) <= q
    seal0 = ABOVE & ~F & ndimage.binary_dilation(F, structure=disk(4))  # under the root arches, next to the floor
    seal0 |= BUILT & ~F & ndimage.binary_dilation(F, structure=disk(8))
    U = F | seal0
    Cl = ndimage.binary_closing(np.pad(U, r + 1), structure=disk(r))[r + 1:-r - 1, r + 1:-r - 1]
    seal = ndimage.binary_fill_holes(Cl) & ~F  # + the notches between roots / holes left inside the root patches
    lab, n = ndimage.label(seal)
    for k in range(1, n + 1):  # drop 1-3 cell specks along the open rim (closing artefacts, nothing leaks there)
        c = lab == k
        if c.sum() < 4 and not (c & ABOVE).any(): seal[c] = False
    tuck = ndimage.binary_dilation(seal) & F  # one cell under the existing floor edge, so the seam can't be seen through
    # backing under the floor next to the lighthouse hole: there the floor meets the tower base with open seams
    tuck |= BUILT & F & ndimage.binary_dilation(seal & BUILT, structure=disk(4))
    S = seal | tuck
    # height: nearest floor cell's height (3 cm under it)
    idx = ndimage.distance_transform_edt(~F, return_distances=False, return_indices=True)
    H = FY[idx[0], idx[1]] - 0.03
    return S, seal, F, H

def mesh(S, F, H, rot):
    """Marching squares over the blurred seal mask (samples = cell centres), so the open rim is a smooth low-poly
    outline instead of 0.5 m stairs. Rock skirt (SKIRT m) under every outline segment that faces open air."""
    nz, nx = S.shape
    f = ndimage.gaussian_filter(S.astype(np.float64), 0.8)
    f[~ndimage.binary_dilation(S)] = 0.0  # never grow more than one cell past the plan
    lvl = 0.5
    P, UV, I = [], [], []
    vid = {}
    def sp(j, i):  # sample point (cell centre)
        return (X0 + (i + 0.5) * R, float(H[j, i]), Z0 + (j + 0.5) * R)
    def corner(j, i):
        k = ('c', j, i)
        if k not in vid: P.append(sp(j, i)); UV.append(UV_GRASS); vid[k] = len(P) - 1
        return vid[k]
    def edge(a, b):  # interpolated point on the sample edge a-b (a inside, b outside)
        k = ('e',) + tuple(sorted((a, b)))
        if k not in vid:
            fa, fb = f[a], f[b]; t = (fa - lvl) / (fa - fb)
            pa, pb = sp(*a), sp(*b)
            P.append(tuple(pa[q] + (pb[q] - pa[q]) * t for q in range(3))); UV.append(UV_GRASS); vid[k] = len(P) - 1
        return vid[k]
    segs = []  # outline segments (vertex ids) with the outside sample, for the skirt
    for j in range(nz - 1):
        for i in range(nx - 1):
            cs = [(j, i), (j, i + 1), (j + 1, i + 1), (j + 1, i)]  # ccw seen from +y? (x right, z down the rows)
            ins = [f[c] >= lvl for c in cs]
            if not any(ins): continue
            poly, cut = [], []
            for q in range(4):
                a, b = cs[q], cs[(q + 1) % 4]
                if ins[q]: poly.append(corner(*a))
                if ins[q] != ins[(q + 1) % 4]:
                    e = edge(a, b) if ins[q] else edge(b, a); poly.append(e); cut.append((e, b if ins[q] else a))
            n_in = sum(ins)
            if n_in == 2 and ins[0] == ins[2]:  # saddle: keep the two inside corners apart (no bridge)
                for q in range(4):
                    if not ins[q]: continue
                    a, prv, nxt = cs[q], cs[(q - 1) % 4], cs[(q + 1) % 4]
                    e1, e2 = edge(a, nxt), edge(a, prv)
                    I.extend([corner(*a), e1, e2]); segs.append((e1, e2, nxt))
                continue
            for q in range(1, len(poly) - 1): I.extend([poly[0], poly[q], poly[q + 1]])
            if len(cut) == 2: segs.append((cut[0][0], cut[1][0], cut[0][1]))
    # skirt where the outline faces open air (the floor side of the outline is tucked under the existing ground)
    for a, b, out in segs:
        oj, oi = out
        if F[oj, oi]: continue
        pa, pb = P[a], P[b]
        q0 = len(P)
        for pnt in (pa, pb, (pb[0], pb[1] - SKIRT, pb[2]), (pa[0], pa[1] - SKIRT, pa[2])):
            P.append(pnt); UV.append(UV_ROCK)
        I.extend([q0, q0 + 1, q0 + 2, q0, q0 + 2, q0 + 3])
        segs  # (winding fixed below)
    P = np.array(P); I = np.array(I).reshape(-1, 3)
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    top = fn[:, 1] ** 2 > 0.25 * (fn ** 2).sum(1)
    flip = top & (fn[:, 1] < 0)
    # skirt faces: outward = away from the inside of the seal (f high) -> test f half a cell along the normal
    for q in np.where(~top)[0]:
        m = P[I[q]].mean(0); n2 = fn[q][[0, 2]]; n2 = n2 / (np.linalg.norm(n2) + 1e-12)
        x, z = m[0] + n2[0] * 0.3, m[2] + n2[1] * 0.3
        jj, ii = int(round((z - Z0) / R - 0.5)), int(round((x - X0) / R - 0.5))
        if 0 <= jj < nz and 0 <= ii < nx and f[jj, ii] >= lvl: flip[q] = True
    I[flip] = I[flip][:, [0, 2, 1]]
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    N = np.zeros_like(P)
    for k in range(3): np.add.at(N, I[:, k], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    # world (QA decoder space) -> skycity_float_root local: inverse rotation
    x, y, z, w = rot
    Rm = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                   [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                   [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    P = P @ Rm; N = N @ Rm  # row-vector form of Rm^T @ p
    return P, N, np.array(UV), I

def main(src, dst):
    d = json.load(open(src))
    st, nx, nz = stacks(d['meshes'])
    S, seal, F, H = plan(st, nx, nz)
    P, N, UV, I = mesh(S, F, H, d['floatRootRotation'])
    json.dump({'P': P.reshape(-1).tolist(), 'N': N.reshape(-1).tolist(), 'UV': UV.reshape(-1).tolist(),
               'I': I.reshape(-1).astype(int).tolist()}, open(dst, 'w'))
    print(json.dumps({'sealCells': int(seal.sum()), 'tuckCells': int((S & ~seal).sum()), 'verts': len(P), 'tris': len(I),
                      'yRange': [round(float(P[:, 1].min()), 2), round(float(P[:, 1].max()), 2)]}))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
