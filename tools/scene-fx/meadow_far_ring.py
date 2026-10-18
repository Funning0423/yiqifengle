#!/usr/bin/env python3
"""S2-1 (场景特效bot r5): rebuild scene_root/meadow_far_hills in env_meadow.glb as a 360-degree low-poly hill ring.

Old mesh: a double-sided painted disc/thick ring (r 65..215), with the -Z sector (az 135..225) sunk to y -10..-31,
so the horizon had a hole there (运镜bot free-camera spec: lens az 15..65, pitch 15..25 sees empty below the horizon).

New mesh (meadow model coordinates, glTF Y-up, az = atan2(x, z)):
  * water apron r 12 -> foot (y -0.6, under the terrain; the terrain dips below it toward its edges, like the journey sea)
  * sand shore, deep-green lower slopes, teal upper slopes / crests (aerial tint without fog), a coloured back slope
    that comes down into an outer water ring out to r 205. Every azimuth has volume: front, crest, back, no open edge.
  * a second, farther and lighter ridge (r 196..262, 16..40 m) peeks over the first one and closes grazing horizon rays;
    everything stays inside meadow_sky_dome (r 280)
  * crest r ~140..152, crest height 9..27 m. The board-facing sector (az ~165..215) stays lower (9..13 m) so the
    match-3 board's sky composition stays open, but it is still continuous solid hills.
  * Clearances (journey copies keep this node hidden in code, but the shape is kept safe anyway): foot r >= 112
    clears the island footprint (island centre at local r 52 bridge / 79 sail, radius ~16 m). The far ridge (r <= 262)
    would leave the island sky dome if ever shown in a journey copy; journey copies keep it hidden (RegionJourneyAdapter).
Same mesh index/name/material (M_meadow_palette, palette UVs only), one primitive, flat-shaded, deterministic.
Usage: python3 meadow_far_ring.py IN.glb OUT.glb
"""
import json, struct, sys, math
import numpy as np

S = 120  # azimuth segments (3 deg)
TAU = 2 * math.pi

def periodic(a, terms):
    return sum(A * math.sin(k * a + p) for k, A, p in terms)

def wrapdeg(d):
    return (d + 180.0) % 360.0 - 180.0

PEAKS = [(22, 9, 9), (58, 7, 7), (98, 11, 10), (132, 6, 8), (238, 9, 9), (272, 12, 11), (306, 7, 8), (338, 10, 9)]

def crest_h(a):
    d = math.degrees(a) % 360
    h = 13.0 + 2.6 * periodic(a, [(2, 1.0, 0.4), (3, 0.7, 1.9), (5, 0.6, 0.3), (7, 0.45, 2.2), (11, 0.35, 0.9), (13, 0.25, 4.1)])
    for c, amp, w in PEAKS:
        h += amp * math.exp(-0.5 * (wrapdeg(d - c) / w) ** 2)
    # board-facing sector: keep low but solid
    low = math.exp(-0.5 * (wrapdeg(d - 190) / 22) ** 2)
    h = h * (1 - 0.42 * low)
    return max(8.5, min(27.0, h))

FAR_PEAKS = [(5, 10, 10), (80, 12, 12), (150, 8, 10), (205, 9, 9), (255, 13, 12), (322, 11, 10)]

def far_h(a):
    # second, farther ridge (r 196..262): peeks over the first ridge for depth and closes grazing horizon rays
    d = math.degrees(a) % 360
    h = 24.0 + 4.0 * periodic(a, [(2, 1.0, 2.6), (3, 0.8, 0.5), (6, 0.5, 1.7), (10, 0.35, 3.3)])
    for c, amp, w in FAR_PEAKS:
        h += amp * math.exp(-0.5 * (wrapdeg(d - c) / w) ** 2)
    low = math.exp(-0.5 * (wrapdeg(d - 190) / 22) ** 2)
    h = h * (1 - 0.25 * low)
    return max(16.0, min(40.0, h))

def foot_r(a):
    return 120.0 + 4.0 * periodic(a, [(3, 1.0, 0.7), (5, 0.6, 2.4), (9, 0.4, 1.1)])

def crest_r(a):
    return foot_r(a) + 24.0 + 4.0 * periodic(a, [(4, 1.0, 1.3), (7, 0.5, 0.2)])

def hsh(i, k):
    x = math.sin(i * 12.9898 + k * 78.233) * 43758.5453
    return x - math.floor(x)

# palette rows (16 px rows in meadow_palette_256): row 0 green, 1 sand, 7 teal haze (old far hills), 9 sea blue, 11 deep green
def uv(row, u):
    return (min(0.97, max(0.03, u)), (row + 0.5) / 16.0)

SUN = np.array([0.45, 0.75, 0.48]); SUN /= np.linalg.norm(SUN)

def ring_points(i):
    a = (i % S) * TAU / S
    h = crest_h(a); rf = foot_r(a); rc = crest_r(a); h2 = far_h(a)
    j = lambda k, s: (hsh(i % S, k) - 0.5) * s
    prof = [
        (12.0, -0.6, 'water'),  # under the terrain; shows only where the terrain dips below the water (same places the sea covers in a journey)
        (rf - 12.0, -0.6, 'water'),
        (rf - 5.0, -0.6, 'sand'),
        (rf - 1.5, 0.35, 'low'),
        (rf + (rc - rf) * 0.35 + j(3, 3), h * (0.30 + j(13, 0.08)), 'low'),
        (rf + (rc - rf) * 0.75 + j(4, 3), h * (0.80 + j(14, 0.08)), 'up'),
        (rc + j(5, 2), h, 'crest'),
        (rc + 9.0 + j(6, 3), h * (0.55 + j(16, 0.1)), 'back'),
        (rc + 21.0 + j(7, 2), -0.6, 'water'),
        (196.0 + j(8, 4), -0.6, 'far'),
        (212.0 + j(9, 4), h2 * (0.45 + j(19, 0.1)), 'far'),
        (228.0 + j(10, 3), h2, 'farcrest'),
        (244.0 + j(11, 4), h2 * (0.45 + j(21, 0.1)), 'farback'),
        (262.0, -0.6, 'water'),
    ]
    return [(r * math.sin(a), y, r * math.cos(a)) for r, y, _ in prof], [t for _, _, t in prof]

def build():
    P, N, T = [], [], []
    rings = [ring_points(i) for i in range(S)]
    tags = rings[0][1]
    for i in range(S):
        A, B = rings[i][0], rings[(i + 1) % S][0]
        for k in range(len(tags) - 1):
            q = [np.array(A[k]), np.array(B[k]), np.array(B[k + 1]), np.array(A[k + 1])]
            tris = [(0, 1, 2), (0, 2, 3)] if (i + k) % 2 == 0 else [(0, 1, 3), (1, 2, 3)]
            band = tags[k]  # band = tag of the inner ring of the quad ('sand' = the narrow wet-sand shore strip)
            for t in tris:
                v = [q[t[0]], q[t[1]], q[t[2]]]
                n = np.cross(v[1] - v[0], v[2] - v[0])
                ln = np.linalg.norm(n)
                if ln < 1e-9:
                    continue
                n /= ln
                if n[1] < 0:  # keep winding so the normal points up/outward-visible side
                    v = [v[0], v[2], v[1]]; n = -n
                lit = max(0.0, float(n @ SUN))
                jit = (hsh(i * 7 + k, len(P)) - 0.5) * 0.06
                if band == 'water':
                    c = uv(9, 0.56 + jit * 0.3)
                elif band == 'sand':
                    c = uv(1, 0.30 + 0.2 * lit + jit)
                elif band == 'low':
                    c = uv(11, 0.50 + 0.35 * lit + jit)
                elif band == 'up':
                    c = uv(7, 0.30 + 0.35 * lit + jit)
                elif band == 'crest':
                    c = uv(7, 0.38 + 0.40 * lit + jit)
                elif band == 'far':  # far ridge: lighter teal (distance, no fog)
                    c = uv(7, 0.55 + 0.25 * lit + jit)
                elif band == 'farcrest':
                    c = uv(7, 0.62 + 0.25 * lit + jit)
                elif band == 'farback':
                    c = uv(7, 0.40 + 0.25 * lit + jit)
                else:  # back slope: darker but coloured
                    c = uv(7, 0.18 + 0.25 * lit + jit)
                for p in v:
                    P.append(p); N.append(n); T.append(c)
    return (np.array(P, np.float32), np.array(N, np.float32), np.array(T, np.float32))

def rebuild(b):
    """env_meadow.glb bytes -> bytes with the new meadow_far_hills mesh (all other bufferViews byte-identical)."""
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    binl = struct.unpack('<I', b[20 + jl:24 + jl])[0]
    bin_ = b[28 + jl:28 + jl + binl]
    node = [n for n in j['nodes'] if n['name'] == 'meadow_far_hills'][0]
    prim = j['meshes'][node['mesh']]['primitives'][0]
    assert len(j['meshes'][node['mesh']]['primitives']) == 1
    P, N, T = build()
    I = np.arange(len(P), dtype=np.uint32 if len(P) > 65535 else np.uint16)
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
    info = {'tris': len(P) // 3, 'verts': len(P), 'bytes': total, 'min': [round(float(x), 2) for x in P.min(0)], 'max': [round(float(x), 2) for x in P.max(0)]}
    return res, info

def main(src, dst):
    res, info = rebuild(open(src, 'rb').read())
    open(dst, 'wb').write(res)
    print(json.dumps(info))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
