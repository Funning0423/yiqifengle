#!/usr/bin/env python3
"""S2-1 (场景特效bot r5): rebuild scene_root/meadow_far_hills in env_meadow.glb as a 360-degree ring of soft hills.

Old mesh: a double-sided painted disc/thick ring (r 65..215), with the -Z sector (az 135..225) sunk to y -10..-31,
so the horizon had a hole there (运镜bot free-camera spec: lens az 15..65, pitch 15..25 sees empty below the horizon).

r2 (after review): three overlapping layers of rounded, irregular hills (Animal-Crossing-like rolling hills), smooth
normals, no water anywhere (the meadow has no sea behind it):
  * grass apron r 12 -> near foot: kept 0.4 m under the meadow_terrain interior (sampled from the same GLB; the
    terrain's outer fall-off beyond 58 m, which drops to -4..-10 m, is covered instead, and the river runs in under it), easing up from
    y -0.6 to 1.5 at the near-hill foot, so the terrain edge runs into a gently rising meadow instead of a flat plain;
    it keeps every below-horizon ray landing on something (free-camera audit: 0 void cells)
  * near layer  r ~108..168, crest  6..17 m, green  (palette row 11)
  * mid layer   r ~168..218, crest 11..25 m, teal   (palette row 7, darker half: coloured, never pale)
  * far layer   r ~218..262, crest 17..36 m, blue   (palette row 9, mid part: lighter and bluer, never white)
  Each layer's ridge is a sum of wrapped bumps of random width plus low sines, and the crest radius wanders, so no
  azimuth has a straight horizontal edge. Each layer gets lighter toward its top; farther layers are lighter/bluer.
  Back slopes are full-coloured, valleys join the next layer at ground level (no gaps, no open edges).
  The board-facing sector (az ~188, the match-3 board camera looks that way) is a bit lower, still the same hills.
Everything stays inside meadow_sky_dome (r 280), max y < 40. Journey copies keep this node hidden (RegionJourneyAdapter).
Same mesh index/name/material (M_meadow_palette, palette UVs only), one indexed primitive, deterministic.
Usage: python3 meadow_far_ring.py IN.glb OUT.glb
"""
import json, struct, sys, math
import numpy as np

S = 160  # azimuth segments (2.25 deg)
TAU = 2 * math.pi
BOARD_AZ = 188.0

def wrapdeg(d):
    return (d + 180.0) % 360.0 - 180.0

def ridge(seed, floor, spacing, amin, amax):
    """Periodic ridge height (deg -> m): a row of rounded humps (random height/width, jittered spacing) combined with a
    smooth max, so the silhouette is a chain of overlapping round hills with real dips between them, never flat."""
    rs = np.random.RandomState(seed); n = int(round(360.0 / spacing)); sp = 360.0 / n
    humps = [((k + rs.uniform(-0.3, 0.3)) * sp, rs.uniform(amin, amax), sp * rs.uniform(0.38, 0.62)) for k in range(n)]
    def h(d):
        e = [A * math.exp(-0.5 * (wrapdeg(d - c) / w) ** 2) for c, A, w in humps]
        m = max(e); kk = 0.6  # smooth max (soft union of the humps)
        return floor + m + math.log(sum(math.exp(kk * (x - m)) for x in e)) / kk * 0.25
    return h

def wander(seed, amp, ks):
    rs = np.random.RandomState(seed); ph = rs.uniform(0, TAU, len(ks)); w = rs.uniform(0.5, 1.0, len(ks))
    return lambda d: amp * sum(wi * math.sin(k * math.radians(d) + p) for k, p, wi in zip(ks, ph, w)) / len(ks)

def board_dip(d, depth):
    return 1.0 - depth * math.exp(-0.5 * (wrapdeg(d - BOARD_AZ) / 26.0) ** 2)

# layer: (name, row, u0, u1, foot r(d), crest r(d), back r(d), height(d), front t-samples, back t-samples)
NEAR_H = ridge(11, 3.5, 9.0, 4.0, 12.0)
MID_H = ridge(23, 8.0, 12.0, 6.0, 15.0)
FAR_H = ridge(37, 14.0, 16.0, 8.0, 21.0)
NW, MW, FW = wander(41, 7.0, [3, 5, 8]), wander(43, 6.0, [2, 5, 9]), wander(47, 5.0, [3, 4, 7])
LAYERS = [
    ('near', 11, 0.74, 0.90, lambda d: 110.0 + NW(d) * 0.4, lambda d: 140.0 + NW(d), lambda d: 168.0,
     lambda d: NEAR_H(d) * board_dip(d, 0.35), 6, 3),
    ('mid', 7, 0.16, 0.34, lambda d: 168.0, lambda d: 194.0 + MW(d), lambda d: 218.0,
     lambda d: MID_H(d) * board_dip(d, 0.22), 5, 2),
    ('far', 9, 0.62, 0.73, lambda d: 218.0, lambda d: 241.0 + FW(d), lambda d: 262.0,
     lambda d: FAR_H(d) * board_dip(d, 0.12), 5, 2),
]
Y0 = -0.6   # valley / ground level under the mid and far layers
YF = 1.5    # the near hills start here: the grass apron eases up to it, so there is no flat plain in front of them
APRON_R = [12.0, 40.0, 56.0, 68.0, 80.0, 92.0, 102.0]

# Where meadow_river leaves the terrain square it now runs into a small pond at the hill foot (both ends). pond =
# (centre x, centre z, half-axis x, half-axis z, water y just under the river's last vertices); chan = short water strip
# from the river end to the pond (x0, x1, centre z, half width); corridor = river centre z at the terrain edge.
RIVER_ENDS = [
    dict(name='east', az0=57.0, az1=78.0, pond=(86.5, 33.0, 6.5, 5.5, -5.36), chan=(79.0, 82.0, 32.4, 4.2), zc=(30.0, 32.4)),
    dict(name='west', az0=284.0, az1=305.0, pond=(-84.5, 43.4, 6.5, 5.5, -5.05), chan=(-79.0, -82.0, 43.6, 4.2), zc=(46.0, 43.6)),
]
SUB_AZ = 2          # sub-grid: 1.125 deg columns
SUB_DR_NEAR, SUB_DR_FAR = 3.0, 6.0  # radial step near the pond (r >= 66) / further in

def corridor_w(x, z):
    """0..1: how much the terrain clamp applies along a river corridor (eased at the sides, the inner start and past the
    terrain edge, so switching it on/off never makes a cliff in the apron)."""
    w = 0.0
    for e in RIVER_ENDS:
        sx = 1.0 if e['pond'][0] > 0 else -1.0
        ax = sx * x
        if 50.0 <= ax <= 82.0:
            t = (ax - 50.0) / 30.0
            zc = e['zc'][0] + (e['zc'][1] - e['zc'][0]) * min(1.0, t)
            w = max(w, smooth((12.0 - abs(z - zc)) / 5.0) * smooth((ax - 50.0) / 4.0) * smooth((82.0 - ax) / 3.0))
    return w

def in_corridor(x, z):
    return corridor_w(x, z) > 0.0

def _pond_dist(e, x, z):
    cx, cz, rx, rz, wy = e['pond']; x0, x1, zc, hw = e['chan']
    ex = math.hypot((x - cx) / rx, (z - cz) / rz)
    dp = (ex - 1.0) * min(rx, rz)
    lo, hi = min(x0, x1), max(x0, x1)
    dc = max(abs(z - zc) - hw, lo - x, x - hi)
    return min(dp, dc), wy

def valley(x, z):
    """Pond basin + channel: bed under the water, shore just above it, banks rising back up to the apron."""
    y = 1e9
    for e in RIVER_ENDS:
        d, wy = _pond_dist(e, x, z)
        if d > 14.0: continue
        if d < -1.0: v = wy - 0.7
        elif d < 0.0: v = wy - 0.7 + 0.8 * (d + 1.0)
        else: v = wy + 0.1 + 6.5 * smooth(d / 9.0)
        y = min(y, v)
    return y

def water_near(x, z, y):
    for e in RIVER_ENDS:
        d, wy = _pond_dist(e, x, z)
        if d < 3.0 and y < wy + 1.0: return 1.0
    return 0.0

def smooth(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)

def terrain_sampler(b):
    """meadow_terrain (81x81 grid, +-80 m, no node transform) from the same GLB -> f(x, z): the lowest terrain height
    within 6 m (None outside the terrain square). The apron is kept 0.4 m under that, so it never pokes through the
    meadow; it only shows where the terrain edge has dipped away."""
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bin_ = b[28 + jl:]
    node = [n for n in j['nodes'] if n['name'] == 'meadow_terrain'][0]
    assert not any(k in node for k in ('translation', 'rotation', 'scale', 'matrix'))
    a = j['accessors'][j['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']]
    bv = j['bufferViews'][a['bufferView']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    V = np.frombuffer(bin_, np.float32, a['count'] * 3, o).reshape(-1, 3) if not bv.get('byteStride') else None
    assert V is not None
    lo, hi, cell = -80.0, 80.0, 2.0
    n = int(round((hi - lo) / cell)) + 1
    G = np.full((n, n), np.inf)
    ix = np.clip(np.round((V[:, 0] - lo) / cell).astype(int), 0, n - 1); iz = np.clip(np.round((V[:, 2] - lo) / cell).astype(int), 0, n - 1)
    np.minimum.at(G, (ix, iz), V[:, 1].astype(np.float64))
    def f(x, z):
        if abs(x) > hi + 6 or abs(z) > hi + 6: return None
        i0, i1 = int((x - 6 - lo) // cell), int((x + 6 - lo) // cell) + 1
        k0, k1 = int((z - 6 - lo) // cell), int((z + 6 - lo) // cell) + 1
        w = G[max(0, i0):max(0, min(n, i1 + 1)), max(0, k0):max(0, min(n, k1 + 1))]
        return float(w.min()) if w.size and np.isfinite(w).any() else None
    return f

def prof(t):  # rounded hill flank, 0 at foot -> 1 at crest, zero slope at the crest
    return math.sin(0.5 * math.pi * t) ** 1.6

def uv(row, u):
    return (min(0.97, max(0.03, u)), (row + 0.5) / 16.0)

def build(terrain=None):
    P, T, I = [], [], []
    def strip(rings, uvs):  # rings[k][i] positions for ring k at azimuth i; returns appended indices (closed loop)
        base = len(P); R = len(rings)
        for k in range(R):
            for i in range(S): P.append(rings[k][i]); T.append(uvs[k][i])
        for k in range(R - 1):
            for i in range(S):
                a, b = base + k * S + i, base + k * S + (i + 1) % S
                c, e = base + (k + 1) * S + (i + 1) % S, base + (k + 1) * S + i
                # winding: normal up (inner ring k, outer ring k+1, azimuth increasing toward +x from +z)
                if (i + k) % 2: I.extend([a, e, b, b, e, c])
                else: I.extend([a, e, c, a, c, b])
    D = [i * 360.0 / S for i in range(S)]
    pt = lambda r, y, d: (r * math.sin(math.radians(d)), y, r * math.cos(math.radians(d)))
    # grass apron: under the terrain, then easing up to the near-hill foot (YF). The two river-end sectors get a finer
    # sub-grid (RIVER_ENDS) so the river can run on into a small pond at the hill foot instead of under the grass.
    g = LAYERS[0]
    RR = lambda k, d: g[4](d) if k == len(APRON_R) else min(APRON_R[k], g[4](d) - 2.0)
    def apron_y(r, d):
        x, z = r * math.sin(math.radians(d)), r * math.cos(math.radians(d))
        y = Y0 + (YF - Y0) * smooth((r - 56.0) / (g[4](d) - 56.0))
        # the meadow interior (river / pond beds) and the river corridors push the apron under the terrain; over the rest
        # of the edge fall-off (Chebyshev > 58 m, where the terrain drops toward -10) the apron covers it
        # (along a corridor the clamp eases out past the terrain edge: further out the 6 m window would still see the
        # river bed and sink the pond shore under the water)
        if terrain:
            t = terrain(x, z)
            if t is not None:
                if max(abs(x), abs(z)) < 58.0: y = min(y, t - 0.4)
                else:
                    w = corridor_w(x, z)
                    if w > 0.0: y = y + (min(y, t - 0.4) - y) * w
        return (x, min(y, valley(x, z)), z)
    def apron_uv(p):
        w = water_near(p[0], p[2], p[1])
        return uv(g[1], g[2] - 0.2 * w)  # a little darker (wet) right at the pond shore, same palette row
    NA = len(APRON_R) + 1
    K0 = 2  # the sub-grid starts at ring r 56 (the corridors start at x 50)
    A = [[apron_y(RR(k, d), d) for d in D] for k in range(NA - 1)]
    A.append([pt(g[4](d), YF, d) for d in D])  # the last ring IS the near-hill foot ring (same points, no gap)
    sectors = {}
    for e in RIVER_ENDS:
        i0 = int(math.floor(e['az0'] / (360.0 / S))); i1 = int(math.ceil(e['az1'] / (360.0 / S)))
        for i in range(i0, i1): sectors[i % S] = (i0, i1)
    base = len(P)
    for k in range(NA):
        for i in range(S): P.append(A[k][i]); T.append(apron_uv(A[k][i]))
    for k in range(NA - 1):
        for i in range(S):
            if i in sectors and k >= K0: continue  # replaced by the river-end sub-grid
            a, b = base + k * S + i, base + k * S + (i + 1) % S
            c, e2 = base + (k + 1) * S + (i + 1) % S, base + (k + 1) * S + i
            if (i + k) % 2: I.extend([a, e2, b, b, e2, c])
            else: I.extend([a, e2, c, a, c, b])
    done = set()
    for e in RIVER_ENDS:
        i0 = int(math.floor(e['az0'] / (360.0 / S))); i1 = int(math.ceil(e['az1'] / (360.0 / S)))
        if (i0, i1) in done: continue
        done.add((i0, i1)); m = SUB_AZ; cols = (i1 - i0) * m
        lerp = lambda p0, p1, t: tuple(p0[q] + (p1[q] - p0[q]) * t for q in range(3))
        rows = []  # (k, frac) radial samples from ring 1 to the foot
        for k in range(K0, NA - 1):
            dr = APRON_R[k + 1] - APRON_R[k] if k + 1 < len(APRON_R) else 10.0
            q = max(1, int(math.ceil(dr / (SUB_DR_NEAR if APRON_R[k] >= 66 else SUB_DR_FAR))))
            for t in range(q): rows.append((k, t / q))
        rows.append((NA - 1, 0.0))
        G = []
        for (k, fr) in rows:
            row = []
            for c in range(cols + 1):
                ci, ct = i0 + c // m, (c % m) / m
                if c == cols: ci, ct = i1, 0.0
                ia, ib = ci % S, (ci + 1) % S
                border_r = (k, fr) == (K0, 0.0) or k == NA - 1
                border_a = c == 0 or c == cols
                if border_r:  # on a coarse ring that neighbours stay on: exactly on the coarse edge
                    pnt = lerp(A[k][ia], A[k][ib], ct)
                elif border_a:  # on the sector side: exactly on the coarse radial edge
                    pnt = lerp(A[k][ia], A[k + 1][ia], fr)
                else:
                    d = (ci + ct) * 360.0 / S
                    r = RR(k, d) + (RR(k + 1, d) - RR(k, d)) * fr
                    pnt = apron_y(r, d)
                row.append(pnt)
            G.append(row)
        gb = len(P)
        for row in G:
            for pnt in row: P.append(pnt); T.append(apron_uv(pnt))
        W = cols + 1
        for rr in range(len(G) - 1):
            for c in range(cols):
                a, b = gb + rr * W + c, gb + rr * W + c + 1
                c2, e2 = gb + (rr + 1) * W + c + 1, gb + (rr + 1) * W + c
                if (rr + c) % 2: I.extend([a, e2, b, b, e2, c2])
                else: I.extend([a, e2, c2, a, c2, b])
    # pond water (same palette row as meadow_river's water: row 9, deep toward the middle). One fan per pond whose
    # outline is the union of the pond ellipse and the short channel box under the river end (star-shaped from the pond
    # centre), so no two water sheets overlap (coplanar sheets z-fight / shade black).
    for e in RIVER_ENDS:
        cx, cz, rx, rz, wy = e['pond']; x0, x1, zc, hw = e['chan']
        lo, hi = min(x0, x1), max(x0, x1)
        def inside(x, z):
            return (math.hypot((x - cx) / (rx * 1.06), (z - cz) / (rz * 1.06)) <= 1.0 or
                    (lo <= x <= hi and abs(z - zc) <= hw))
        n = 28; c0 = len(P); P.append((cx, wy, cz)); T.append(uv(9, 0.42))
        for q in range(n):
            a = q * TAU / n; ca, sa = math.cos(a), math.sin(a); r = 0.0
            while inside(cx + (r + 0.05) * ca, cz + (r + 0.05) * sa): r += 0.05
            P.append((cx + r * ca, wy, cz + r * sa)); T.append(uv(9, 0.82))
        for q in range(n):
            a, b = c0 + 1 + q, c0 + 1 + (q + 1) % n
            I.extend([c0, b, a])
    for name, row, u0, u1, rf, rc, rb, hh, nf, nb_ in LAYERS:
        rings, uvs = [], []
        ts = [k / nf for k in range(nf + 1)] + [1 + k / nb_ for k in range(1, nb_ + 1)]
        for t in ts:
            ring, uvr = [], []
            for d in D:
                yb = YF if (name == 'near' and t <= 1) else Y0  # near front starts on the apron, every back slope ends in the valley
                h = hh(d) - yb
                if t <= 1: r = rf(d) + (rc(d) - rf(d)) * t; f = prof(t)
                else: tb = t - 1; r = rc(d) + (rb(d) - rc(d)) * tb; f = prof(1 - tb)
                ring.append(pt(r, yb + h * f, d)); uvr.append(uv(row, u0 + (u1 - u0) * f))
            rings.append(ring); uvs.append(uvr)
        strip(rings, uvs)
    P = np.array(P, np.float64); I = np.array(I, np.int64).reshape(-1, 3)
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    down = fn[:, 1] < 0  # every surface here faces up (pond fans / mirrored channel strips are wound either way)
    I[down] = I[down][:, [0, 2, 1]]; fn[down] *= -1
    N = np.zeros_like(P)
    for k in range(3): np.add.at(N, I[:, k], fn)
    ln = np.linalg.norm(N, axis=1, keepdims=True)
    N = np.where(ln > 1e-12, N / np.maximum(ln, 1e-12), np.array([0.0, 1.0, 0.0]))  # unreferenced coarse vertices
    return P.astype(np.float32), N.astype(np.float32), np.array(T, np.float32), I.reshape(-1)

def rebuild(b):
    """env_meadow.glb bytes -> bytes with the new meadow_far_hills mesh (all other bufferViews byte-identical)."""
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    binl = struct.unpack('<I', b[20 + jl:24 + jl])[0]
    bin_ = b[28 + jl:28 + jl + binl]
    node = [n for n in j['nodes'] if n['name'] == 'meadow_far_hills'][0]
    prim = j['meshes'][node['mesh']]['primitives'][0]
    assert len(j['meshes'][node['mesh']]['primitives']) == 1
    P, N, T, I = build(terrain_sampler(b))
    I = I.astype(np.uint32 if len(P) > 65535 else np.uint16)
    acc = {prim['attributes']['POSITION']: P, prim['attributes']['NORMAL']: N, prim['attributes']['TEXCOORD_0']: T, prim['indices']: I}
    newbv = {}
    for ai, arr in acc.items():
        a = j['accessors'][ai]
        assert a.get('byteOffset', 0) == 0
        a['count'] = int(arr.shape[0])
        if arr.ndim == 1:
            a['componentType'] = 5125 if arr.dtype == np.uint32 else 5123
            a.pop('min', None); a.pop('max', None)
            if 'min' in j['accessors'][ai]: pass
        else:
            a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
        newbv[a['bufferView']] = arr.tobytes()
    used = {}
    for ai, a in enumerate(j['accessors']):
        if 'bufferView' in a: used.setdefault(a['bufferView'], []).append(ai)
    for bv in newbv:
        assert len(used[bv]) == 1, 'shared bufferView %d' % bv
    out = bytearray()
    for bi, bv in enumerate(j['bufferViews']):
        data = newbv.get(bi)
        if data is None:
            o = bv.get('byteOffset', 0); data = bin_[o:o + bv['byteLength']]
        while len(out) % 4: out.append(0)
        bv['byteOffset'] = len(out); bv['byteLength'] = len(data)
        out += data
    while len(out) % 4: out.append(0)
    j['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(out)
    res = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
    info = {'tris': len(I) // 3, 'verts': len(P), 'bytes': total, 'min': [round(float(x), 2) for x in P.min(0)], 'max': [round(float(x), 2) for x in P.max(0)]}
    return res, info

def main(src, dst):
    res, info = rebuild(open(src, 'rb').read())
    open(dst, 'wb').write(res)
    print(json.dumps(info))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
