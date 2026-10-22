"""Lakeside far ring (场景特效bot r5 S2, r3): the lakeside only had landscape to the north (LK_far_hills, z -108..-54); east,
south and west of the lake were open (free_cam_audit void cells). r3 closes it like the meadow far-hills r2:

  * LK_terrain.glb (land fill 'near', the island grass): a grass apron around the lake with an irregular shoreline inside
    the LK_lake plane (sand rim), low swells, then the near layer of round grassy knolls (r ~72..100). Same grass cell as
    the island, welded smooth normals, so it reads as one meadow with the island (no colour or fill seam).
  * LK_far_hills.glb (land fill 'far', cool haze): the original north hills, then a valley floor, the mid (teal) and far
    (blue) layers of round hills of irregular height / width, bluer with distance, never pale; faded into the north hills.
  * scene_r5h_slim_transforms.json: a few clusters of the existing tree / bush / rock GLBs on the apron and knolls
    (instances 'LK_ring_*'; they join the existing static-merge groups, 0 extra draw calls).

r2 note (the 'translucent band' at 180..225 deg): the near layer was a separate low strip in LK_far_hills on the pale
cell #4e9a5c, with a constant-radius foot ring where the UV switched from the grass cell -> a straight hard edge; it was
nearly constant in height, and in game it also took the far cool-haze fill unlike the island grass. r3 removes that strip.

    python3 lakeside_far_ring.py <src models dir> <dst models dir> [<transforms.json in> <transforms.json out>]

Appends to the single primitive of each GLB; original vertices / indices stay first, mesh.extras.qfFarRing records the
original counts, so running on its own output rebuilds instead of stacking. Lake-local coordinates (identity instances).
Azimuth a = atan2(x - CX, z - CZ): 0 = south (+z), 90 = east (+x)."""
import json, struct, sys, math, os
import numpy as np

CX, CZ = 0.0, -10.0
S = 96                      # 3.75 degree columns (round humps need >= 3 columns each)
YF, Y0 = 1.5, -0.6          # near-knoll foot / valley floor
LAKE = (-50.0, 50.0, -53.0, 37.0)            # LK_lake water plane (y 0)
SHORE_FAR = (-66.0, 66.0, -56.0, -47.0)      # LK_far_shore strip
HILLS_N = (-118.0, 118.0, -108.0, -54.0)     # original LK_far_hills footprint
ISLAND = (-36.3, 33.0, -20.4, 42.3)          # LK_terrain island (its own grass / banks)
# The home island (journey start) in lake-local coordinates (LakesideCameraLayout.lakesideJourney: root (-0.11, -0.58,
# 68.48) world, yaw 180) and the former island-bridge span (x 1.2, z 36..60, nothing drawn there since b16): the ring must stay under both, or it cuts through the
# island and the journey lens (test-lakeside-camera K2).  Height cap: -1.2 m (below the island's underside) within 4 m of
# the island, 0.0 within 3 m of the bridge axis, rising 0.6 m (island) / 0.35 m (bridge) per
# metre beyond, so the knolls come back up right behind the island.
HOME = (-14.5, 10.1, 50.1, 75.4)
BRIDGE = (1.2, 36.0, 60.0)
def rect_dist(x, z, R): return math.hypot(max(R[0] - x, 0.0, x - R[1]), max(R[2] - z, 0.0, z - R[3]))
# The skycity -> lakeside journey (lakesideJourney(S6)) puts the skycity deck (top y 0.21 .. 3.5, S6 at y 0.58) over the same
# south / south-east ring: lakeside_skycity_mask.json (lakeside_skycity_mask.cjs) lists its 2 m deck cells, the S0..S6 walk
# and the S6 -> moored-balloon line.  Within SKY_FLAT m of any of them the ring is held at SKY_Y (below every deck top);
# SKY_FLAT exceeds the ring's largest triangle so no triangle edge between a held and a free vertex crosses the deck.
SKY = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lakeside_skycity_mask.json')))
SKY_PTS = np.array([[c[0], c[1]] for c in SKY['deck']] + SKY['route'], np.float64)
SKY_Y, SKY_FLAT, SKY_RISE = -0.3, 12.0, 0.6
def sky_dist(x, z): return float(np.sqrt(((SKY_PTS[:, 0] - x) ** 2 + (SKY_PTS[:, 1] - z) ** 2).min())) - 1.0
def sky_cap(x, z): return SKY_Y + SKY_RISE * max(0.0, sky_dist(x, z) - SKY_FLAT)
def hcap(x, z):
    di = rect_dist(x, z, HOME); db = math.hypot(x - BRIDGE[0], max(BRIDGE[1] - z, 0.0, z - BRIDGE[2]))
    return min(-1.2 + 0.6 * max(0.0, di - 4.0), 0.0 + 0.35 * max(0.0, db - 3.0), sky_cap(x, z))
APRON_R = [34.0, 38.0, 42.0, 45.0, 48.0, 51.0, 54.0, 58.0, 62.0, 67.0, 72.0]
def cell(c, r): return ((c + 0.5) / 16.0, (r + 0.5) / 16.0)
UV_GRASS, UV_SAND, UV_MID, UV_FAR = cell(4, 10), cell(12, 14), cell(7, 13), cell(6, 13)
TAU = 2 * math.pi

def smooth(t):
    t = min(1.0, max(0.0, t)); return t * t * (3 - 2 * t)
def wrapdeg(d): return (d + 180.0) % 360.0 - 180.0
def inrect(x, z, R, m=0.0): return R[0] - m <= x <= R[1] + m and R[2] - m <= z <= R[3] + m
def polar(x, z): return math.hypot(x - CX, z - CZ), math.degrees(math.atan2(x - CX, z - CZ)) % 360.0
def pt(r, y, d): return (CX + r * math.sin(math.radians(d)), y, CZ + r * math.cos(math.radians(d)))

def ridge(seed, floor, spacing, amin, amax):
    """meadow r2 ridge: a row of round humps (random height / width, jittered spacing) under a soft max."""
    rs = np.random.RandomState(seed); n = int(round(360.0 / spacing)); sp = 360.0 / n
    humps = [((k + rs.uniform(-0.3, 0.3)) * sp, rs.uniform(amin, amax), sp * rs.uniform(0.38, 0.62)) for k in range(n)]
    def h(d):
        e = [A * math.exp(-0.5 * (wrapdeg(d - c) / w) ** 2) for c, A, w in humps]
        m = max(e); kk = 0.6
        return floor + m + math.log(sum(math.exp(kk * (x - m)) for x in e)) / kk * 0.25
    return h
def wander(seed, amp, ks):
    rs = np.random.RandomState(seed); ph = rs.uniform(0, TAU, len(ks)); w = rs.uniform(0.5, 1.0, len(ks))
    return lambda d: amp * sum(wi * math.sin(k * math.radians(d) + p) for k, p, wi in zip(ks, ph, w)) / len(ks)
def north(d):  # 1 behind the existing north hills, 0 elsewhere
    return smooth((abs(wrapdeg(d)) - 110.0) / 30.0)

NEAR_H, MID_H, FAR_H = ridge(11, 0.6, 14.0, 2.0, 9.0), ridge(23, 4.0, 13.0, 3.0, 19.0), ridge(37, 13.0, 17.0, 6.0, 26.0)
NW, MW, FW = wander(41, 6.0, [3, 5, 8]), wander(43, 8.0, [2, 5, 9]), wander(47, 9.0, [3, 4, 7])
# (name, uv, foot r, crest r, back r, crest height above Y0, fronts, backs, base y of the front)
LAYERS = {
    'near': (UV_GRASS, lambda d: 72.0, lambda d: 85.0 + NW(d), lambda d: 100.0,
             lambda d: (YF - Y0) + NEAR_H(d) * (1 - north(d)), 3, 2, YF),
    'mid': (UV_MID, lambda d: 125.0, lambda d: 145.0 + MW(d), lambda d: 165.0, lambda d: MID_H(d) * (1 - 0.25 * north(d)), 3, 2, Y0),
    'far': (UV_FAR, lambda d: 190.0, lambda d: 215.0 + FW(d), lambda d: 240.0, lambda d: FAR_H(d), 3, 2, Y0),
}
def prof(t): return math.sin(0.5 * math.pi * t) ** 1.6
def layer_y(name, r, d):
    uv, rf, rc, rb, hh, nf, nb, yb = LAYERS[name]
    top = Y0 + hh(d)
    if r <= rc(d): f = prof((r - rf(d)) / (rc(d) - rf(d))); return yb + (top - yb) * f
    f = prof(1 - (r - rc(d)) / (rb(d) - rc(d))); return Y0 + (top - Y0) * f

# ---- shoreline: inside the lake plane east / west (and under the island south) the land rises out of the water along an
# irregular curve a few metres in from the plane's straight edge; toward the north corners it eases back to the edge.
SHW = wander(53, 1.0, [3, 5, 7, 11])
def rect_exit(d):
    """distance from (CX, CZ) along azimuth d to the LK_lake rectangle edge, and which edge ('x' = east/west/south)."""
    sx, sz = math.sin(math.radians(d)), math.cos(math.radians(d)); best, side = 1e9, 'x'
    if sx > 1e-9: best = min(best, (LAKE[1] - CX) / sx)
    if sx < -1e-9: best = min(best, (LAKE[0] - CX) / sx)
    if sz > 1e-9:
        t = (LAKE[3] - CZ) / sz
        if t < best: best = t
    if sz < -1e-9:
        t = (LAKE[2] - CZ) / sz
        if t < best: best, side = t, 'n'
    return best, side
def shore_r(d):
    re, side = rect_exit(d)
    k = 1.0 - smooth((abs(wrapdeg(d)) - 100.0) / 22.0)       # fade out toward the north corners (far shore there)
    return re - k * (3.0 + 2.6 * (1.0 + SHW(d)))
def swell(x, z):  # low rolling slopes on the apron
    return 0.55 * (math.sin(x * 0.11 + 1.3) * math.cos(z * 0.09 - 0.4) + 0.6 * math.sin(x * 0.045 - z * 0.06 + 2.0))
def land_y(x, z):
    """apron height (also where the tree clusters stand)."""
    r, d = polar(x, z)
    if inrect(x, z, SHORE_FAR) or inrect(x, z, HILLS_N): return -2.5
    s = r - shore_r(d) if inrect(x, z, LAKE) or r < shore_r(d) + 12 else 99.0
    if s < 0.0: return max(-0.6, 0.06 + 0.3 * s)               # under the water
    base = 0.15 + (YF - 0.15) * smooth((r - 56.0) / 16.0)
    if r >= 72.0: return YF
    lift = 0.06 + 0.2 * smooth(s / 3.0)                         # sand rim, then grass
    return min(base, lift + (base - 0.06) * smooth((s - 2.0) / 6.0)) + max(0.0, swell(x, z)) * smooth((s - 4.0) / 8.0) * smooth((70.0 - r) / 8.0)
def covered(x, z):  # under the water far from the shore, or under the north hills / far shore
    r, d = polar(x, z)
    return (inrect(x, z, LAKE) and r - shore_r(d) < -3.5) or inrect(x, z, SHORE_FAR, -1.0) or inrect(x, z, HILLS_N, -2.0)

class Mesh:
    """grid builder: vertices split only where the palette cell changes (a UV never interpolates across cells), normals
    welded by position so the split never shows as a shading crease."""
    def __init__(self): self.P, self.UV, self.C, self.I = [], [], [], []; self.key = {}
    def v(self, p, uv, c):
        k = (round(p[0], 4), round(p[1], 4), round(p[2], 4), uv)
        if k not in self.key: self.key[k] = len(self.P); self.P.append(p); self.UV.append(uv); self.C.append(c)
        return self.key[k]
    def grid(self, rows, uvf, colf, cull=None):
        R = len(rows)
        for k in range(R - 1):
            for i in range(S):
                j = (i + 1) % S; q = (rows[k][i], rows[k][j], rows[k + 1][j], rows[k + 1][i])
                if cull and cull(q): continue
                cx, cz = sum(p[0] for p in q) / 4, sum(p[2] for p in q) / 4
                uv = uvf(k, cx, cz); a, b, c, e = [self.v(p, uv, colf(p)) for p in q]
                if (i + k) % 2: self.I.extend([a, e, b, b, e, c])
                else: self.I.extend([a, e, c, a, c, b])
    def arrays(self):
        P = np.array(self.P, np.float64); I = np.array(self.I, np.int64).reshape(-1, 3)
        fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
        down = fn[:, 1] < 0; I[down] = I[down][:, [0, 2, 1]]; fn[down] *= -1
        pk = {}; pid = np.array([pk.setdefault((round(p[0], 4), round(p[1], 4), round(p[2], 4)), len(pk)) for p in self.P])
        NP = np.zeros((len(pk), 3))
        for k in range(3): np.add.at(NP, pid[I[:, k]], fn)
        N = NP[pid]; N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
        return P.astype(np.float32), N.astype(np.float32), np.array(self.UV, np.float32), np.array(self.C, np.uint8), I.reshape(-1)

D = [i * 360.0 / S for i in range(S)]
def layer_rows(name):
    uv, rf, rc, rb, hh, nf, nb, yb = LAYERS[name]
    rows = []
    for t in [k / nf for k in range(nf + 1)] + [1 + k / nb for k in range(1, nb + 1)]:
        row = []
        for d in D:
            r = rf(d) + (rc(d) - rf(d)) * t if t <= 1 else rc(d) + (rb(d) - rc(d)) * (t - 1)
            x, y, z = pt(r, layer_y(name, r, d), d)
            row.append((x, min(y, hcap(x, z)) if name == 'near' else min(y, sky_cap(x, z)), z))
        rows.append(row)
    return rows
def under_north(q): return all(inrect(p[0], p[2], HILLS_N, -3.0) for p in q) and all(p[1] < 8.0 for p in q)

def apron_radii(d):
    """apron rows at azimuth d: shore-following rows (so the sand rim is a clean band along the waterline), then fixed rows
    out to the near-knoll foot (r 72); kept strictly increasing."""
    rs = shore_r(d)
    want = [34.0, rs - 4.0, rs - 1.2, rs + 1.0, rs + 2.6, rs + 5.5, 58.0, 62.0, 67.0, 72.0]
    out = []
    for k, r in enumerate(want):
        lo = out[-1] + 1.2 if out else 0.0
        hi = 72.0 - 1.2 * (len(want) - 1 - k)
        out.append(min(max(r, lo), hi))
    return out
SAND_ROWS = (2, 3)   # quads between rows 2-3 and 3-4 (shore - 1.2 .. shore + 2.6)

def build_land():
    m = Mesh()
    RR = [apron_radii(d) for d in D]; K = len(RR[0])
    rows = [[None] * S for _ in range(K)]
    for i, d in enumerate(D):
        for k in range(K):
            x, _, z = pt(RR[i][k], 0, d); rows[k][i] = (x, min(YF if k == K - 1 else land_y(x, z), hcap(x, z)), z)
    m.grid(rows, lambda k, x, z: UV_SAND if k in SAND_ROWS and inrect(x, z, LAKE, 3.0) else UV_GRASS, lambda p: 255,
           cull=lambda q: all(covered(p[0], p[2]) for p in q))
    m.grid(layer_rows('near'), lambda k, x, z: UV_GRASS, lambda p: int(round(236 + 19 * smooth((p[1] - YF) / 6.0))), cull=under_north)
    return m.arrays()

def build_hills():
    m = Mesh()
    for (r0, r1, uv) in ((100.0, 125.0, UV_MID), (165.0, 190.0, UV_MID)):
        m.grid([[pt(r, Y0, d) for d in D] for r in (r0, r1)], lambda k, x, z, uv=uv: uv, lambda p: 200, cull=under_north)
    for name in ('mid', 'far'):
        m.grid(layer_rows(name), lambda k, x, z, uv=LAYERS[name][0]: uv, lambda p: int(round(205 + 50 * smooth((p[1] - Y0) / 30.0))))
    return m.arrays()

def append(src, dst, part):
    b = open(src, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bin_ = b[28 + jl:28 + jl + struct.unpack('<I', b[20 + jl:24 + jl])[0]]
    assert len(j['meshes']) == 1 and len(j['meshes'][0]['primitives']) == 1
    prim = j['meshes'][0]['primitives'][0]; at = prim['attributes']
    def acc(i, dt, c):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        assert not bv.get('byteStride') and a.get('byteOffset', 0) == 0
        return np.frombuffer(bin_, dt, a['count'] * c, bv.get('byteOffset', 0)).reshape(-1, c).copy()
    P0, N0, T0 = acc(at['POSITION'], np.float32, 3), acc(at['NORMAL'], np.float32, 3), acc(at['TEXCOORD_0'], np.float32, 2)
    C0, I0 = acc(at['COLOR_0'], np.uint8, 4), acc(prim['indices'], np.uint16, 1).reshape(-1)
    ex = j['meshes'][0].get('extras', {}).get('qfFarRing')
    if ex:
        P0, N0, T0, C0, I0 = P0[:ex['baseVerts']], N0[:ex['baseVerts']], T0[:ex['baseVerts']], C0[:ex['baseVerts']], I0[:ex['baseIndices']]
    nv0, ni0 = len(P0), len(I0)
    P, N, T, C, I = part()
    C4 = np.concatenate([np.repeat(C[:, None], 3, 1), np.full((len(C), 1), 255, np.uint8)], 1)
    PA, NA, TA, CA = np.concatenate([P0, P]), np.concatenate([N0, N]), np.concatenate([T0, T]), np.concatenate([C0, C4])
    IA = np.concatenate([I0.astype(np.int64), I + nv0]); assert len(PA) <= 65535; IA = IA.astype(np.uint16)
    data = {at['POSITION']: PA, at['NORMAL']: NA, at['TEXCOORD_0']: TA, at['COLOR_0']: CA, prim['indices']: IA}
    bvof = {j['accessors'][ai]['bufferView']: arr for ai, arr in data.items()}
    assert sorted(bvof) == list(range(len(j['bufferViews'])))
    out = b''; views = []
    for k in range(len(j['bufferViews'])):
        bl = bvof[k].tobytes(); out += b'\0' * ((4 - len(out) % 4) % 4)
        v = dict(j['bufferViews'][k]); v['byteOffset'] = len(out); v['byteLength'] = len(bl); views.append(v); out += bl
    j['bufferViews'] = views; j['buffers'][0]['byteLength'] = len(out)
    for ai, arr in data.items(): j['accessors'][ai]['count'] = len(arr)
    j['accessors'][at['POSITION']]['min'] = PA.min(0).astype(float).tolist(); j['accessors'][at['POSITION']]['max'] = PA.max(0).astype(float).tolist()
    j['meshes'][0].setdefault('extras', {})['qfFarRing'] = {'baseVerts': nv0, 'baseIndices': ni0}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); out += b'\0' * ((4 - len(out) % 4) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + \
        struct.pack('<II', len(out), 0x004E4942) + out
    open(dst, 'wb').write(glb)
    return {'file': os.path.basename(dst), 'baseTris': ni0 // 3, 'ringTris': len(I) // 3, 'totalTris': len(IA) // 3, 'verts': len(PA),
            'bytes': len(glb), 'max': np.round(PA.max(0), 2).tolist()}

# ---- tree / bush / rock clusters (existing GLBs): (azimuth, radius, [(glb, dazimuth, dradius, scale)])
CLUSTERS = [  # spread so that each free-camera azimuth around the landing (E / S / W) has something in its middle ground
    (20, 62, [('LK_tree_conifer.glb', -2.0, 0.0, 1.6), ('LK_tree_conifer.glb', 1.8, 2.5, 1.2), ('LK_bush.glb', 0.5, -3.0, 1.3)]),
    (47, 58, [('LK_tree_round.glb', 0.0, 0.0, 1.9), ('LK_tree_conifer.glb', 3.0, 3.0, 1.4), ('LK_rock.glb', -3.5, -4.0, 1.6)]),
    (86, 56, [('LK_rock.glb', 0.0, -5.0, 1.8), ('LK_rock.glb', 2.5, -5.5, 1.1), ('LK_bush.glb', -1.5, -1.0, 1.2)]),
    (108, 77, [('LK_tree_conifer.glb', 0.0, 0.0, 1.8), ('LK_tree_conifer.glb', 2.2, 2.0, 1.3), ('LK_tree_round.glb', -2.5, 1.0, 1.6)]),
    (-19, 64, [('LK_tree_round.glb', 0.0, 0.0, 2.0), ('LK_tree_conifer.glb', -2.5, 2.0, 1.5), ('LK_bush.glb', 2.0, -2.5, 1.1)]),
    (-47, 60, [('LK_tree_conifer.glb', 0.0, 0.0, 1.5), ('LK_tree_conifer.glb', -2.0, 3.0, 1.9), ('LK_tree_round.glb', 2.5, 1.5, 1.5)]),
    (-88, 55, [('LK_rock.glb', 0.0, -5.0, 1.5), ('LK_bush.glb', 1.5, -1.5, 1.3), ('LK_rock.glb', -2.0, -4.0, 1.0)]),
    (-110, 78, [('LK_tree_round.glb', 0.0, 0.0, 1.8), ('LK_tree_conifer.glb', 2.5, 1.5, 1.6)]),
    (33, 70, [('LK_tree_conifer.glb', 0.0, 0.0, 1.7), ('LK_tree_conifer.glb', 2.0, 1.5, 1.3)]),   # flank the home island
    (-33, 72, [('LK_tree_round.glb', 0.0, 0.0, 1.5)]),
    (0, 95, [('LK_tree_conifer.glb', 0.0, 0.0, 1.9), ('LK_tree_conifer.glb', 7.0, -1.0, 1.4), ('LK_tree_round.glb', -8.0, 0.0, 1.7)]),  # behind it
]
def ground(x, z):
    r, d = polar(x, z)
    if r >= 72.0 and r <= 100.0: return min(layer_y('near', r, d), hcap(x, z))
    return min(land_y(x, z), hcap(x, z))
def instances():
    out, rs = [], np.random.RandomState(7)
    for ci, (az, r, items) in enumerate(CLUSTERS):
        for k, (g, da, dr, sc) in enumerate(items):
            d = (az + da) % 360.0; rr = r + dr
            if g == 'LK_rock.glb': rr = shore_r(d) + 1.2 + dr * 0.1   # rocks sit on the sand rim
            else: rr = max(rr, shore_r(d) + 4.5 + abs(dr))             # trees / bushes on dry grass, never in the water
            x, _, z = pt(rr, 0, d)
            while g != 'LK_rock.glb' and inrect(x, z, ISLAND, 1.5): rr += 1.0; x, _, z = pt(rr, 0, d)  # not under the island
            while rect_dist(x, z, HOME) <= 8.0 or sky_dist(x, z) <= SKY_FLAT + 4.0:  # swing away from the home island (south), keeping the radius
                d = (d + (2.0 if wrapdeg(d) >= 0 else -2.0)) % 360.0; x, _, z = pt(rr, 0, d)
            assert rect_dist(x, z, HOME) > 8.0 and sky_dist(x, z) > SKY_FLAT + 4.0 and math.hypot(x - BRIDGE[0], max(BRIDGE[1] - z, 0.0, z - BRIDGE[2])) > 6.0, ('too near the home island / bridge', g, x, z)
            if g != 'LK_rock.glb': assert ground(x, z) > 0.1, (g, x, z)
            y = ground(x, z) - (0.05 if g == 'LK_rock.glb' else 0.12)
            yaw = rs.uniform(0, TAU); sy = sc * rs.uniform(0.92, 1.12)
            out.append({'name': 'LK_ring_%s_%02d_%d' % (g[3:-4], ci, k), 'glb': g, 'group': 'bg', 'pos': [round(x, 4), round(y, 4), round(z, 4)],
                        'rot_quat_xyzw': [0.0, round(math.sin(yaw / 2), 5), 0.0, round(math.cos(yaw / 2), 5)],
                        'scale': [round(sc, 4), round(sy, 4), round(sc, 4)], 'animated': False})
    return out

def main(argv):
    src, dst = argv[0], argv[1]
    info = [append(os.path.join(src, 'LK_terrain.glb'), os.path.join(dst, 'LK_terrain.glb'), build_land),
            append(os.path.join(src, 'LK_far_hills.glb'), os.path.join(dst, 'LK_far_hills.glb'), build_hills)]
    if len(argv) >= 4:
        T = json.load(open(argv[2]))
        T['instances'] = [i for i in T['instances'] if not i['name'].startswith('LK_ring_')] + instances()
        T['instance_count'] = len(T['instances'])
        open(argv[3], 'w').write(json.dumps(T, separators=(',', ':'), ensure_ascii=False))
        info.append({'instances': len(T['instances']), 'ring': len(instances())})
    print(json.dumps(info))

if __name__ == '__main__':
    main(sys.argv[1:])
