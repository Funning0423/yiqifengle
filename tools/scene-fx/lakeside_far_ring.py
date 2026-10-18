"""Lakeside far ring (场景特效bot r5 S2): the lakeside only had landscape to the north (LK_far_hills, z -108..-54); east,
south and west of the lake were open, so the free camera saw the map edge (free_cam_audit void cells). This closes it in
the meadow far-hills r2 style: a grass apron with a low shore around the lake, then three layers of soft rolling hills,
bluer with distance, joined behind / into the existing north hills.

    python3 lakeside_far_ring.py <LK_far_hills.glb> <out.glb>

The ring is appended to the single LK_far_hills primitive (same M_LK_palette material, same 'far' land fill, same journey
handling); the original vertices / indices keep their order and values. mesh.extras.qfFarRing records the original
counts, so running the script on its own output rebuilds the ring instead of stacking a second one.
Lake-local coordinates (the instance has an identity transform). Azimuth a = atan2(x - CX, z - CZ): 0 = south (+z)."""
import json, struct, sys, math
import numpy as np

CX, CZ = 0.0, -10.0
S = 72                      # 5 degree columns
SH, YF, Y0 = 0.15, 1.5, -0.6
LAKE = (-50.0, 50.0, -53.0, 37.0)            # LK_lake water plane (y 0)
SHORE_FAR = (-66.0, 66.0, -56.0, -47.0)      # LK_far_shore strip
HILLS_N = (-118.0, 118.0, -108.0, -54.0)     # LK_far_hills footprint
APRON_R = [35.0, 42.0, 48.0, 53.0, 58.0, 64.0, 72.0, 86.0, 100.0, 112.0, 125.0]
UV_GRASS, UV_NEAR, UV_MID, UV_FAR = (0.281, 0.656), (0.281, 0.844), (0.469, 0.844), (0.406, 0.844)
TAU = 2 * math.pi

def smooth(t):
    t = min(1.0, max(0.0, t)); return t * t * (3 - 2 * t)

def inrect(x, z, R, m=0.0):
    return R[0] - m <= x <= R[1] + m and R[2] - m <= z <= R[3] + m

def ridge(seed, base, amp, n):
    """Hump chain over azimuth: soft max of n irregular bumps (deterministic)."""
    rng = np.random.RandomState(seed)
    c = np.sort(rng.uniform(0, 360, n)); w = rng.uniform(14, 26, n); h = rng.uniform(0.45, 1.0, n)
    def f(d):
        v = 0.0
        for ci, wi, hi in zip(c, w, h):
            dd = (d - ci + 180) % 360 - 180
            v += math.exp(4.0 * hi * math.exp(-(dd / wi) ** 2))
        return base + amp * (math.log(v / n) / 4.0)
    return f

def wander(seed, amp):
    rng = np.random.RandomState(seed); p = rng.uniform(0, TAU, 3)
    return lambda d: amp * (0.6 * math.sin(math.radians(d) * 3 + p[0]) + 0.4 * math.sin(math.radians(d) * 7 + p[1]))

def north(d):  # 1 in the north sector (behind the existing hills), 0 elsewhere
    return smooth((abs(((d + 180) % 360) - 180) - 110.0) / 30.0)

NEAR_H, MID_H, FAR_H = ridge(11, 3.0, 4.5, 14), ridge(23, 12.0, 14.0, 11), ridge(37, 34.0, 18.0, 9)
NW, MW, FW = wander(5, 4.0), wander(6, 7.0), wander(7, 9.0)
# (name, uv, front r, crest r, back r, height above its base, fronts, backs)
LAYERS = [
    ('near', UV_NEAR, lambda d: 72.0, lambda d: 86.0 + NW(d), lambda d: 100.0, lambda d: NEAR_H(d) * (1 - north(d)), 3, 2),
    ('mid', UV_MID, lambda d: 125.0, lambda d: 145.0 + MW(d), lambda d: 165.0, lambda d: MID_H(d) * (1 - 0.25 * north(d)), 3, 2),
    ('far', UV_FAR, lambda d: 190.0, lambda d: 215.0 + FW(d), lambda d: 240.0, lambda d: FAR_H(d), 3, 2),
]

def apron_y(x, z, r):
    if inrect(x, z, LAKE):  # under the water: just below it near the edge (a clean shoreline), deep further in
        dl = min(x - LAKE[0], LAKE[1] - x, z - LAKE[2], LAKE[3] - z)
        return -0.1 if dl < 4.0 else -2.5
    if inrect(x, z, SHORE_FAR) or inrect(x, z, HILLS_N): return -2.5
    if r <= 100.0: return SH + (YF - SH) * smooth((r - 58.0) / 14.0)
    return YF + (Y0 - YF) * smooth((r - 100.0) / 12.0)

def covered(x, z):
    return (inrect(x, z, LAKE) and min(x - LAKE[0], LAKE[1] - x, z - LAKE[2], LAKE[3] - z) > 4.0) or \
        inrect(x, z, SHORE_FAR, -1.0) or inrect(x, z, HILLS_N, -2.0)

def build():
    P, UV, COL, I = [], [], [], []
    D = [i * 360.0 / S for i in range(S)]
    pt = lambda r, y, d: (CX + r * math.sin(math.radians(d)), y, CZ + r * math.cos(math.radians(d)))
    def grid(rows, uvs, cols, cull=None):
        base = len(P); R = len(rows)
        for k in range(R):
            for i in range(S): P.append(rows[k][i]); UV.append(uvs[k][i]); COL.append(cols[k][i])
        for k in range(R - 1):
            for i in range(S):
                a, b = base + k * S + i, base + k * S + (i + 1) % S
                c, e = base + (k + 1) * S + (i + 1) % S, base + (k + 1) * S + i
                if cull and cull(k, i): continue
                if (i + k) % 2: I.extend([a, e, b, b, e, c])
                else: I.extend([a, e, c, a, c, b])
    # grass apron (+ shore); quads wholly under the lake / far shore / north hills are dropped
    rows = [[pt(r, 0, d) for d in D] for r in APRON_R]
    rows = [[(p[0], apron_y(p[0], p[2], r), p[2]) for p in row] for row, r in zip(rows, APRON_R)]
    cov = [[covered(p[0], p[2]) for p in row] for row in rows]
    grid(rows, [[UV_GRASS] * S for _ in rows], [[255] * S for _ in rows],
         cull=lambda k, i: cov[k][i] and cov[k][(i + 1) % S] and cov[k + 1][i] and cov[k + 1][(i + 1) % S])
    # the valley floor between the mid and far layers
    rows = [[pt(r, Y0, d) for d in D] for r in (165.0, 190.0)]
    grid(rows, [[UV_MID] * S] * 2, [[200] * S] * 2)
    for name, uvc, rf, rc, rb, hh, nf, nb in LAYERS:
        ts = [k / nf for k in range(nf + 1)] + [1 + k / nb for k in range(1, nb + 1)]
        rows, cols = [], []
        for t in ts:
            row, col = [], []
            for d in D:
                yb = YF if (name == 'near' and t <= 1) else Y0
                h = hh(d) + (YF - Y0 if name == 'near' else 0.0)
                if t <= 1: r = rf(d) + (rc(d) - rf(d)) * t; f = math.sin(0.5 * math.pi * t) ** 1.6
                else: tb = t - 1; r = rc(d) + (rb(d) - rc(d)) * tb; f = math.sin(0.5 * math.pi * (1 - tb)) ** 1.6
                top = Y0 + h
                y = yb + (top - yb) * f
                row.append(pt(r, y, d)); col.append(int(round(205 + 50 * f)))
            rows.append(row); cols.append(col)
        grid(rows, [[uvc] * S for _ in rows], cols)
    P = np.array(P, np.float64); I = np.array(I, np.int64).reshape(-1, 3)
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    down = fn[:, 1] < 0
    I[down] = I[down][:, [0, 2, 1]]; fn[down] *= -1
    used = np.zeros(len(P), bool); used[I.reshape(-1)] = True
    # drop unreferenced vertices
    remap = -np.ones(len(P), np.int64); remap[used] = np.arange(used.sum())
    N = np.zeros_like(P)
    for k in range(3): np.add.at(N, I[:, k], fn)
    N = N[used]; N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    return (P[used].astype(np.float32), N.astype(np.float32), np.array(UV, np.float32)[used],
            np.array(COL, np.uint8)[used], remap[I].reshape(-1))

def main(src, dst):
    b = open(src, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bin_ = b[28 + jl:28 + jl + struct.unpack('<I', b[20 + jl:24 + jl])[0]]
    assert len(j['meshes']) == 1 and len(j['meshes'][0]['primitives']) == 1
    prim = j['meshes'][0]['primitives'][0]; at = prim['attributes']
    def acc(i, dt, c):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        assert not bv.get('byteStride')
        return np.frombuffer(bin_, dt, a['count'] * c, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, c).copy()
    P0, N0, T0 = acc(at['POSITION'], np.float32, 3), acc(at['NORMAL'], np.float32, 3), acc(at['TEXCOORD_0'], np.float32, 2)
    C0, I0 = acc(at['COLOR_0'], np.uint8, 4), acc(prim['indices'], np.uint16, 1).reshape(-1)
    ex = j['meshes'][0].get('extras', {}).get('qfFarRing')
    if ex:  # strip the previous ring
        P0, N0, T0, C0 = P0[:ex['baseVerts']], N0[:ex['baseVerts']], T0[:ex['baseVerts']], C0[:ex['baseVerts']]
        I0 = I0[:ex['baseIndices']]
    nv0, ni0 = len(P0), len(I0)
    P, N, T, C, I = build()
    C4 = np.concatenate([np.repeat(C[:, None], 3, 1), np.full((len(C), 1), 255, np.uint8)], 1)
    PA, NA, TA, CA = np.concatenate([P0, P]), np.concatenate([N0, N]), np.concatenate([T0, T]), np.concatenate([C0, C4])
    IA = np.concatenate([I0.astype(np.int64), I + nv0])
    assert len(PA) <= 65535
    IA = IA.astype(np.uint16)
    blobs = [PA.tobytes(), NA.tobytes(), TA.tobytes(), IA.tobytes(), CA.tobytes()]  # same bufferView order as the source
    out, views, off = b'', [], 0
    for k, bl in enumerate(blobs):
        pad = (4 - off % 4) % 4; out += b'\0' * pad; off += pad
        v = dict(j['bufferViews'][k]); v['byteOffset'] = off; v['byteLength'] = len(bl); views.append(v); out += bl; off += len(bl)
    j['bufferViews'] = views; j['buffers'][0]['byteLength'] = len(out)
    for name, arr in (('POSITION', PA), ('NORMAL', NA), ('TEXCOORD_0', TA), ('COLOR_0', CA)):
        j['accessors'][at[name]]['count'] = len(arr)
    j['accessors'][at['POSITION']]['min'] = PA.min(0).astype(float).tolist(); j['accessors'][at['POSITION']]['max'] = PA.max(0).astype(float).tolist()
    j['accessors'][prim['indices']]['count'] = len(IA)
    j['meshes'][0].setdefault('extras', {})['qfFarRing'] = {'baseVerts': nv0, 'baseIndices': ni0}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); out += b'\0' * ((4 - len(out) % 4) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + \
        struct.pack('<II', len(out), 0x004E4942) + out
    open(dst, 'wb').write(glb)
    print(json.dumps({'baseTris': ni0 // 3, 'ringTris': len(I) // 3, 'totalTris': len(IA) // 3, 'verts': len(PA), 'bytes': len(glb),
                      'min': np.round(PA.min(0), 2).tolist(), 'max': np.round(PA.max(0), 2).tolist()}))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
