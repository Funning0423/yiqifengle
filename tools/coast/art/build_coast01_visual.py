"""COAST01 visual pass asset builder (box side). before/ -> after/ ; deterministic (seeded).
Only edits: palette band 13 (unused) + terrain-only sand bands + drift swatch; mesh UV remaps; new board_rim / grasspatch / grasscap
geometry; layout TRS for rocks/plants near the rim. Slabs, reef plate positions, pieces, grid anchor untouched."""
import sys, json, shutil, os, math, colorsys
import numpy as np, trimesh
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from glb_tool import GLB, smooth_normals
SRC, DST = sys.argv[1].rstrip('/'), sys.argv[2].rstrip('/')
CFG = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
rng = np.random.default_rng(20261109)
for d in ['models', 'textures', 'data', 'board']: os.makedirs(DST + '/' + d, exist_ok=True)
for f in os.listdir(SRC + '/board'): shutil.copy(SRC + '/board/' + f, DST + '/board/' + f)
# ---------------- palette ----------------
pal = Image.open(SRC + '/textures/coast_palette_256.png').convert('RGBA'); sandp = Image.open(SRC + '/textures/coast_palette_sand_256.png').convert('RGBA')
SW = {}  # name -> (cell, rgb)
def sw(name, rgb):
    if name in SW: return SW[name][0]
    c = len(SW); assert c < 64, 'band 13 full'; SW[name] = (c, tuple(int(v) for v in rgb)); return c
def uv_of(name): c = SW[name][0]; return ((4 * c + 2) / 256.0, (208 + 8) / 256.0)
def warm_sand(rgb, k=CFG.get('sand_k', 1.0)):
    r, g, b = [v / 255 for v in rgb]; h, l, s = colorsys.rgb_to_hls(r, g, b)
    h2 = CFG.get('sand_hue', 38) / 360; s2 = min(1, s * CFG.get('sand_sat', 1.9) + 0.06); l2 = l * CFG.get('sand_l', 1.0)
    r, g, b = colorsys.hls_to_rgb(h + (h2 - h) * k, l2, s + (s2 - s) * k); return (round(r * 255), round(g * 255), round(b * 255))
px = pal.load()
for y in range(16, 32):
    for x in range(256): c = px[x, y]; px[x, y] = warm_sand(c[:3]) + (255,)
for y in range(48, 64):
    for x in range(0, 200): c = px[x, y]; px[x, y] = warm_sand(c[:3]) + (255,)
for y in range(176, 192):  # drift swatch (11,37) only
    for x in range(148, 152): px[x, y] = warm_sand((235, 232, 211), 0.8) + (255,)
SAND_MID = px[150, 24][:3]; SAND_LIGHT = px[200, 24][:3]; SAND_DARK = px[100, 24][:3]
# named swatches (band 13)
sw('berm', SAND_MID); sw('berm_crest', SAND_LIGHT); sw('berm_low', SAND_DARK)
sw('wet', CFG.get('wet', (206, 170, 112))); sw('wet_dark', tuple(CFG.get('wet_dark', (202, 170, 118))))
DW = CFG.get('dw', {'light': (204, 174, 132), 'mid': (166, 134, 98), 'dark': (120, 94, 70), 'end': (230, 204, 162), 'ring': (150, 116, 84)})
for k_ in ('light', 'mid', 'dark', 'end', 'ring'): sw('dw_' + k_, DW[k_])
sw('sh_cream', (252, 240, 218)); sw('sh_pink', (246, 182, 172)); sw('sh_coral', (242, 146, 106)); sw('sh_peach', (252, 206, 156)); sw('sh_lilac', (214, 186, 222))
sw('foamline', (252, 248, 236))
REEF = [tuple(c) for c in CFG.get('reef', [(128, 92, 68), (160, 116, 84), (190, 142, 100), (212, 166, 118), (230, 192, 140), (242, 212, 168)])]
for i, c in enumerate(REEF): sw('reef%d' % i, c)
sw('pool_deep', (70, 200, 210)); sw('pool_mid', (118, 218, 216)); sw('pool_edge', (176, 232, 222))
sw('peb_a', (198, 168, 134)); sw('peb_b', (228, 208, 178))
sw('dune_dark', (110, 142, 64)); sw('dune_mid', (146, 168, 78)); sw('dune_light', (184, 188, 100)); sw('straw', (218, 198, 124)); sw('thrift', (242, 152, 172))
SLAB = CFG.get('slab')  # optional slab recolor {cellname: rgb}
if SLAB:
    for k, v in SLAB.items(): sw('slab_' + k, v)
for P in (pal, sandp):
    q = P.load()
    for name, (c, rgb) in SW.items():
        for y in range(208, 224):
            for x in range(4 * c, 4 * c + 4): q[x, y] = rgb + (255,)
pal.save(DST + '/textures/coast_palette_256.png', optimize=True); sandp.save(DST + '/textures/coast_palette_sand_256.png', optimize=True)
palarr = np.asarray(Image.open(SRC + '/textures/coast_palette_256.png').convert('RGB')).astype(float)
def orig_rgb(uv):
    x = np.clip((uv[:, 0] * 256).astype(int), 0, 255); y = np.clip((uv[:, 1] * 256).astype(int), 0, 255); return palarr[y, x]
def set_uv(uv, mask, name): uv[mask] = uv_of(name)
def remap_reef(d):
    uv = d['TEXCOORD_0']; lum = orig_rgb(uv) @ np.array([0.3, 0.59, 0.11])
    edges = CFG.get('reef_edges', [70, 100, 125, 150, 175])
    k = np.digitize(lum, edges)
    for i in range(6): uv[k == i] = uv_of('reef%d' % i)
def remap_grass(d):
    uv = d['TEXCOORD_0']; c = orig_rgb(uv); lum = c @ np.array([0.3, 0.59, 0.11])
    greenish = (c[:, 1] > c[:, 0] + 8)
    uv[greenish & (lum < 95)] = uv_of('dune_dark'); uv[greenish & (lum >= 95) & (lum < 125)] = uv_of('dune_mid'); uv[greenish & (lum >= 125)] = uv_of('dune_light')
# ---------------- terrain sampler ----------------
tg = GLB(SRC + '/models/coast_terrain.glb'); T = tg.meshes['terrain']
TM = trimesh.Trimesh(T['POSITION'], T['indices'].reshape(-1, 3), process=False)
def ground(x, z):
    x = np.atleast_1d(np.asarray(x, float)); z = np.atleast_1d(np.asarray(z, float)); o = np.stack([x, np.full_like(x, 6.0), z], 1)
    loc, ri, _ = TM.ray.intersects_location(o, np.tile([0, -1.0, 0], (len(x), 1)), multiple_hits=False)
    out = np.full(len(x), -0.02); out[ri] = loc[:, 1]; return out
# ---------------- geometry helpers ----------------
class MB:  # mesh builder: faces carry a swatch name; output unwelded with smooth normals from welded topology
    def __init__(s): s.P = []; s.F = []; s.C = []
    def v(s, p): s.P.append(p); return len(s.P) - 1
    def tri(s, a, b, c, col): s.F.append((a, b, c)); s.C.append(col)
    def quad(s, a, b, c, d, col): s.tri(a, b, c, col); s.tri(a, c, d, col)
    def build(s, smooth=True):
        P = np.array(s.P, float); F = np.array(s.F, np.int64); C = list(s.C)
        fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); ar = np.linalg.norm(fn, axis=1); keep = ar > 1e-10
        F = F[keep]; C = [c for c, k in zip(C, keep) if k]; fn = fn[keep] / ar[keep][:, None]
        if smooth:
            n = smooth_normals(P, F.ravel()); key = {}; pos = []; nrm = []; uv = []; idx = []
            for f, c in zip(F, C):
                for vi in f:
                    k = (int(vi), c)
                    if k not in key: key[k] = len(pos); pos.append(P[vi]); nrm.append(n[vi]); uv.append(uv_of(c))
                    idx.append(key[k])
            return {'POSITION': np.array(pos, np.float32), 'NORMAL': np.array(nrm, np.float32), 'TEXCOORD_0': np.array(uv, np.float32), 'indices': np.array(idx, np.uint32)}
        pos = P[F.ravel()]; nrm = np.repeat(fn, 3, 0)
        uv = np.array([uv_of(c) for c in C for _ in range(3)], float)
        return {'POSITION': pos.astype(np.float32), 'NORMAL': nrm.astype(np.float32), 'TEXCOORD_0': uv.astype(np.float32), 'indices': np.arange(len(pos), dtype=np.uint32)}
def selm(a, n, th):  # superellipse point, half-size a
    c, s = math.cos(th), math.sin(th)
    r = a / (abs(c) ** n + abs(s) ** n) ** (1 / n); return r * c, r * s
def berm_profile():
    return CFG.get('berm', [[3.40, 0.072], [3.50, 0.088], [3.62, 0.098], [3.78, 0.102], [3.92, 0.096], [4.02, 0.082], [4.12, 0.052], [4.24, 0.012], [4.36, -0.05]])
def berm_height(x, z):
    """surface height of the new berm at (x,z) (for placing props on it); None outside"""
    th = math.atan2(z, x); prof = berm_profile()
    rs = []
    for a, h in prof:
        n = 20 if a < 3.9 else 12; px, pz = selm(a, n, th); rs.append((math.hypot(px, pz), h))
    r = math.hypot(x, z)
    if r < rs[0][0] or r > rs[-1][0]: return None
    for (r0, h0), (r1, h1) in zip(rs, rs[1:]):
        if r0 <= r <= r1: return h0 + (h1 - h0) * (r - r0) / (r1 - r0)
def make_berm(mb):
    prof = berm_profile(); N = CFG.get("berm_n", 144); rings = []
    ths = [2 * math.pi * i / N for i in range(N)]
    for k, (a, h) in enumerate(prof):
        n = 20 if a < 3.9 else 12; ring = []
        xs, zs = zip(*[selm(a, n, t) for t in ths]); xs = np.array(xs); zs = np.array(zs)
        hh = np.full(N, h) + (rng.normal(0, 0.006, N) if 0 < k < len(prof) - 1 else 0)
        if a >= 4.1:
            g = ground(xs, zs)
            hh = g - 0.035 if k == len(prof) - 1 else np.maximum(hh, g + 0.012)
        for i in range(N): ring.append(mb.v((xs[i], hh[i], zs[i])))
        rings.append(ring)
    cols = CFG.get('berm_cols', ['berm_low', 'berm', 'berm', 'berm_crest', 'berm_crest', 'berm', 'berm', 'berm', 'berm'])
    for k in range(len(rings) - 1):
        for i in range(N):
            j = (i + 1) % N; a, b, c, d = rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]
            mb.quad(a, d, c, b, cols[k])  # CCW seen from above (+y)
def make_log(mb, p0, p1, r, y, bow, seed):
    lr = np.random.default_rng(seed); A = np.array(p0, float); B = np.array(p1, float); L = np.linalg.norm(B - A); t_ = (B - A) / L
    side = np.array([-t_[1], t_[0]])  # in xz plane, outward = +side*bow sign handled by caller
    NA, NS = 12, 18; rings = []
    for s in range(NS + 1):
        u = s / NS; c2 = A + (B - A) * u + side * bow * math.sin(math.pi * u)
        taper = min(1.0, (min(u, 1 - u) / 0.06) ** 0.5) if CFG.get('taper', True) else 1
        rr = r * (1 + 0.10 * math.sin(7.3 * u + seed) + lr.normal(0, 0.025)) * (0.55 + 0.45 * taper)
        yy = y + 0.015 * math.sin(3.1 * u + seed)
        ring = []
        for a in range(NA):
            ang = 2 * math.pi * a / NA; up = math.cos(ang); out = math.sin(ang)
            ring.append(mb.v((c2[0] + side[0] * out * rr, yy + up * rr * 0.92, c2[1] + side[1] * out * rr)))
        rings.append((ring, c2, yy))
    for s in range(NS):
        for a in range(NA):
            b = (a + 1) % NA; i0, i1, i2, i3 = rings[s][0][a], rings[s][0][b], rings[s + 1][0][b], rings[s + 1][0][a]
            ang = 2 * math.pi * (a + 0.5) / NA; up = math.cos(ang)
            col = 'dw_light' if up > 0.45 else ('dw_mid' if up > -0.35 else 'dw_dark')
            if s in (0, NS - 1) and up > -0.35: col = 'dw_ring'
            mb.quad(i0, i3, i2, i1, col)
    for end, flip in ((0, False), (NS, True)):
        ring, c2, yy = rings[end]; cen = mb.v((c2[0] - (t_[0] if not flip else -t_[0]) * 0.03, yy, c2[1] - (t_[1] if not flip else -t_[1]) * 0.03))
        for a in range(NA):
            b = (a + 1) % NA
            if flip: mb.tri(cen, ring[a], ring[b], 'dw_end')
            else: mb.tri(cen, ring[b], ring[a], 'dw_end')
def make_fan_shell(mb, x, y, z, R, yaw, tilt, col, rib):
    NR, NP = 4, 10; ca, sa = math.cos(yaw), math.sin(yaw); idx = {}
    def tf(px, py, pz):
        py2 = py * math.cos(tilt) - pz * math.sin(tilt); pz2 = py * math.sin(tilt) + pz * math.cos(tilt)
        return (x + ca * px - sa * pz2, y + py2, z + sa * px + ca * pz2)
    apex = mb.v(tf(0, 0.02 * R / 0.15, -R * 0.45))
    grid = []
    for i in range(1, NR + 1):
        rho = R * i / NR; row = []
        for j in range(NP + 1):
            ph = -1.15 + 2.3 * j / NP; ridge = 0.5 + 0.5 * math.cos(j * math.pi)
            h = 0.32 * R * (1 - (i / NR) ** 2 * 0.85) * (0.8 + 0.2 * ridge) + 0.01
            row.append(mb.v(tf(rho * math.sin(ph), h, -R * 0.45 + rho * math.cos(ph))))
        grid.append(row)
    for j in range(NP): mb.tri(apex, grid[0][j + 1], grid[0][j], col)
    for i in range(NR - 1):
        for j in range(NP): mb.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j], rib if (j % 2) else col)
def make_cone_shell(mb, x, y, z, Lh, yaw, col, col2):
    ca, sa = math.cos(yaw), math.sin(yaw); NA, NS = 8, 6; rings = []
    for s in range(NS + 1):
        u = s / NS; rr = 0.42 * Lh * math.sin(math.pi * min(0.999, 0.15 + 0.85 * u)) * (1 - 0.6 * u) + 0.004
        cx = -0.5 * Lh + Lh * u; ring = []
        for a in range(NA):
            ang = 2 * math.pi * a / NA + u * 2.5; py = math.cos(ang) * rr * 0.8 + rr * 0.55; pz = math.sin(ang) * rr
            ring.append(mb.v((x + ca * cx - sa * pz, y + py, z + sa * cx + ca * pz)))
        rings.append(ring)
    for s in range(NS):
        for a in range(NA):
            b = (a + 1) % NA; mb.quad(rings[s][a], rings[s][b], rings[s + 1][b], rings[s + 1][a], col if s % 2 == 0 else col2)
    for end in (0, NS):
        r_ = rings[end]; cx = -0.5 * Lh + Lh * end / NS; cen = mb.v((x + ca * cx, y + 0.01, z + sa * cx))
        for a in range(NA):
            b = (a + 1) % NA
            if end == 0: mb.tri(cen, r_[a], r_[b], col2)
            else: mb.tri(cen, r_[b], r_[a], col2)
def make_ribbon(mb, pts, w, lift, col):
    pts = np.array(pts, float); L = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]; t_ = b - a; t_ /= np.linalg.norm(t_); nx, nz = -t_[1], t_[0]
        taper = min(1, min(i, len(pts) - 1 - i) / 3 + 0.25)
        L.append(((p[0] + nx * w * taper / 2, p[1] + nz * w * taper / 2), (p[0] - nx * w * taper / 2, p[1] - nz * w * taper / 2)))
    xs = np.array([q[0] for l in L for q in l]); zs = np.array([q[1] for l in L for q in l]); g = ground(xs, zs) + lift
    ids = [mb.v((xs[k], g[k], zs[k])) for k in range(len(xs))]
    for i in range(len(L) - 1):
        a, b, c, d = ids[2 * i], ids[2 * i + 1], ids[2 * i + 3], ids[2 * i + 2]
        mb.quad(a, b, c, d, col)
# ---------------- board: new rim (berm + driftwood + shells + ripple marks) ----------------
bg = GLB(SRC + '/models/coast_board.glb')
mb = MB(); make_berm(mb)
LO = CFG.get('log_off', 3.70); LR = CFG.get('log_r', 0.15); E = CFG.get('log_ext', 4.02)
logs = [((-E - 0.05, -LO), (E + 0.10, -LO - 0.03), 0.045, -0.035, 1),   # far (sea side, z-)
        ((LO, -E), (LO + 0.04, E + 0.06), 0.075, 0.03, 2),                 # right
        ((E + 0.08, LO), (-E - 0.02, LO + 0.02), 0.045, -0.03, 3),          # near (camera side, z+)
        ((-LO - 0.02, E + 0.05), (-LO, -E - 0.08), 0.075, 0.035, 4)]        # left
for p0, p1, y, bow, seed in logs:
    # bow sign: positive side vector points left of travel; we travel CCW so 'side' points inward -> use negative bow for outward
    make_log(mb, p0, p1, LR, y, -abs(bow), seed)
def make_drift(mb, cx, cz, along, inward, L, h):
    """sand drift heaped over a log: asymmetric mound (inner flank short, outer flank long)"""
    NA, NB = 14, 10; ids = []
    for i in range(NA + 1):
        u = -1 + 2 * i / NA; row = []
        for j in range(NB + 1):
            w = -1 + 2 * j / NB; half = 0.24 if w < 0 else 0.46  # w<0 = toward the board
            hh = h * (1 - u * u) ** 0.8 * (1 - w * w) ** 0.9
            x = cx + along[0] * u * L / 2 + inward[0] * (-w * half); z = cz + along[1] * u * L / 2 + inward[1] * (-w * half)
            base = 0.06 if abs(w) < 0.999 and abs(u) < 0.999 else -0.03
            row.append(mb.v((x, base + hh, z)))
        ids.append(row)
    for i in range(NA):
        for j in range(NB):
            a, b, c, d = ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1]
            col = 'berm_crest' if (5 <= i <= NA - 6 and 4 <= j <= NB - 4) else 'berm'
            mb.quad(a, d, c, b, col)
    return ids
DR = CFG.get('drifts', [(-1, 0, -1.6, 1.5), (-1, 0, 1.9, 1.2), (1, 0, -0.6, 1.4), (1, 0, 2.6, 1.1), (0, 1, -2.3, 1.3), (0, 1, 1.2, 1.6), (0, -1, -0.9, 1.2), (0, -1, 2.2, 1.4)])
for sx, sz, t, Ld in DR:
    if sx: cx, cz, along, inward = sx * LO, t, (0, 1), (-sx, 0)
    else: cx, cz, along, inward = t, sz * LO, (1, 0), (0, -sz)
    make_drift(mb, cx, cz, along, inward, Ld, CFG.get('drift_h', 0.2))
rim_mesh = mb.build(True)
# shells on berm outer slope + corners (single extra mesh merged into board_rim)
sb = MB(); placed = []
shell_cols = ['sh_cream', 'sh_pink', 'sh_coral', 'sh_peach', 'sh_lilac']
cand = [(-4.08, -2.2), (-4.1, 0.9), (-4.05, 2.9), (4.08, -1.6), (4.1, 1.4), (4.06, 3.0), (-3.2, 4.08), (-0.4, 4.1), (1.2, 4.08), (2.6, 4.1),
        (-2.6, -4.08), (0.3, -4.06), (2.4, -4.1), (-4.02, -3.95), (4.0, 4.0), (-4.0, 4.02), (3.98, -3.98)]
for k, (x, z) in enumerate(cand):
    h = berm_height(x, z); h = h if h is not None else float(ground(x, z)[0])
    col = shell_cols[k % len(shell_cols)]; yaw = rng.uniform(0, 2 * math.pi)
    if k % 3 == 2: make_cone_shell(sb, x, h - 0.03, z, rng.uniform(0.34, 0.40), yaw, col, 'sh_cream' if col != 'sh_cream' else 'sh_peach')
    else: make_fan_shell(sb, x, h - 0.02, z, rng.uniform(0.19, 0.23), yaw, rng.uniform(-0.25, 0.1), col, 'sh_cream' if col != 'sh_cream' else 'sh_pink')
    placed.append((x, z))
# ripple marks (浪痕) on sand outside the berm: left/right sides + near corners; avoid prop footprints later in layout pass
rb = MB(); ripples = []
def wavy(x0, z0, x1, z1, amp, wl, n=40):
    out = []
    for i in range(n + 1):
        u = i / n; x = x0 + (x1 - x0) * u; z = z0 + (z1 - z0) * u; L = math.hypot(x1 - x0, z1 - z0); nx, nz = -(z1 - z0) / L, (x1 - x0) / L
        o = amp * math.sin(2 * math.pi * u * L / wl); out.append((x + nx * o, z + nz * o))
    return out
for sgn in (-1, 1):
    ripples.append(wavy(sgn * 4.62, -3.3, sgn * 4.62, -1.9, 0.05, 0.55, 24)); ripples.append(wavy(sgn * 4.62, 0.4, sgn * 4.62, 2.0, 0.05, 0.55, 24))
    ripples.append(wavy(sgn * 4.86, -2.9, sgn * 4.86, -2.0, 0.045, 0.5, 18)); ripples.append(wavy(sgn * 4.86, 0.7, sgn * 4.86, 1.7, 0.045, 0.5, 18))
for dz in (4.58, 4.78, 4.98):
    ripples.append(wavy(-0.75 + (dz - 4.58), dz, 0.55 - (dz - 4.58), dz, 0.032, 0.6, 22))
for k, r in enumerate(ripples): make_ribbon(rb, r, CFG.get('ripple_w', 0.07), 0.014, 'wet')
parts = [rim_mesh, sb.build(True), rb.build(False)]
def merge(parts):
    out = {k: np.concatenate([p[k] for p in parts]) for k in ('POSITION', 'NORMAL', 'TEXCOORD_0')}; off = 0; ids = []
    for p in parts: ids.append(p['indices'] + off); off += len(p['POSITION'])
    out['indices'] = np.concatenate(ids).astype(np.uint32); return out
bg.meshes['board_rim'] = merge(parts)
# reef plate: wet sand (positions untouched)
ruv = bg.meshes['reef_base']['TEXCOORD_0']; ruv[:] = uv_of('wet')
if SLAB:
    for n in [m for m in bg.names() if m.startswith('slab_')]:
        uv = bg.meshes[n]['TEXCOORD_0']; c = orig_rgb(uv); lum = c @ np.array([0.3, 0.59, 0.11])
        uv[lum >= 185] = uv_of('slab_top'); uv[lum < 185] = uv_of('slab_side')
bg.save(DST + '/models/coast_board.glb')
# ---------------- reuse: warm reef rocks + dune grass ----------------
ru = GLB(SRC + '/models/coast_reuse.glb')
for n in ('env_prop_rock_01', 'env_prop_rock_02', 'env_prop_rock_03'): remap_reef(ru.meshes[n])
for n in ('env_prop_grass_tuft_01', 'env_prop_grass_tuft_02'): remap_grass(ru.meshes[n])
ru.save(DST + '/models/coast_reuse.glb')
rk = GLB(SRC + '/models/coast_rocks.glb')
for n in rk.names():
    if n.startswith('rock_'): remap_reef(rk.meshes[n])
rk.save(DST + '/models/coast_rocks.glb')
shutil.copy(SRC + '/models/coast_terrain.glb', DST + '/models/coast_terrain.glb')
# ---------------- props: grasspatch -> tide pool, grasscap -> beach plant clump ----------------
pr = GLB(SRC + '/models/coast_props.glb')
def tide_pool():
    m = MB(); N = 20; rings = []
    spec = [(0.0, 0.035, 'pool_deep'), (0.42, 0.035, 'pool_deep'), (0.62, 0.037, 'pool_mid'), (0.74, 0.04, 'pool_edge'), (0.80, 0.07, 'wet'), (0.92, 0.075, 'wet'), (1.04, -0.16, 'wet')]
    for k, (r, h, _) in enumerate(spec):
        ring = []
        for i in range(N):
            a = 2 * math.pi * i / N; wob = 1 + 0.08 * math.sin(3 * a + 1.3) + 0.05 * math.cos(5 * a)
            ring.append(m.v((r * wob * math.cos(a), h, r * wob * 0.8 * math.sin(a))))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(N):
            j = (i + 1) % N; m.quad(rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j], spec[k + 1][2] if k > 0 else 'pool_deep')
    # pebbles around the lip
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.3; r = 0.86; cx, cz = r * math.cos(a), r * 0.8 * math.sin(a); s = 0.07 + 0.03 * (i % 3)
        top = m.v((cx, 0.075 + s * 0.9, cz)); ring = [m.v((cx + s * math.cos(b), 0.05, cz + s * 0.8 * math.sin(b))) for b in np.linspace(0, 2 * math.pi, 7)[:-1]]
        for q in range(6): m.tri(top, ring[(q + 1) % 6], ring[q], 'peb_a' if i % 2 else 'peb_b')
    return m.build(False)
def beach_clump():
    m = MB(); N = 14; rings = []
    for k, (r, h) in enumerate([(0.0, 0.16), (0.35, 0.14), (0.62, 0.08), (0.85, 0.02), (1.0, -0.16)]):
        ring = []
        for i in range(N):
            a = 2 * math.pi * i / N; wob = 1 + 0.07 * math.sin(2 * a + 0.7)
            ring.append(m.v((r * wob * math.cos(a), h, r * wob * math.sin(a))))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(N):
            j = (i + 1) % N; m.quad(rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j], 'berm_crest' if k < 1 else 'berm')
    lr = np.random.default_rng(7)
    tufts = [(0.0, 0.0, 1.0), (0.42, 0.18, 0.8), (-0.38, 0.26, 0.85), (0.15, -0.45, 0.75), (-0.3, -0.32, 0.7), (0.5, -0.2, 0.6)]
    for ti, (tx, tz, sc) in enumerate(tufts):
        base_h = 0.16 - 0.1 * math.hypot(tx, tz)
        for bl in range(5):
            a = 2 * math.pi * bl / 5 + lr.uniform(0, 0.6); lean = 0.12 * sc; h = (0.34 + lr.uniform(0, 0.12)) * sc; w = 0.05 * sc
            bx, bz = tx + 0.03 * math.cos(a), tz + 0.03 * math.sin(a); ox, oz = math.cos(a + 1.57) * w, math.sin(a + 1.57) * w
            b0 = m.v((bx - ox, base_h - 0.02, bz - oz)); b1 = m.v((bx + ox, base_h - 0.02, bz + oz)); tip = m.v((bx + math.cos(a) * lean * 2, base_h + h, bz + math.sin(a) * lean * 2))
            mid = m.v((bx + math.cos(a) * lean, base_h + h * 0.55, bz + math.sin(a) * lean))
            c1 = ['dune_dark', 'dune_mid', 'dune_mid', 'dune_light', 'dune_mid'][bl]; c2 = 'straw' if bl in (1, 3) else 'dune_light'
            m.tri(b0, b1, mid, c1); m.tri(b1, b0, mid, c1); m.tri(mid, b1, tip, c2); m.tri(b1, mid, tip, c2)
        if ti in (1, 3):  # a few sea-thrift blooms
            fx, fz = tx + 0.08, tz + 0.05; fy = base_h + 0.22 * sc; s = 0.055
            top = m.v((fx, fy + s, fz)); ring = [m.v((fx + s * math.cos(b), fy, fz + s * math.sin(b))) for b in np.linspace(0, 2 * math.pi, 7)[:-1]]
            bot = m.v((fx, fy - s * 0.6, fz))
            for q in range(6): m.tri(top, ring[(q + 1) % 6], ring[q], 'thrift'); m.tri(bot, ring[q], ring[(q + 1) % 6], 'thrift')
    return m.build(False)
pr.meshes['grasspatch'] = tide_pool(); pr.meshes['grasscap'] = beach_clump()
pr.save(DST + '/models/coast_props.glb')
# ---------------- layout ----------------
L = json.load(open(SRC + '/data/coast_layout.json')); E_ = L['layout']
def setp(i, x=None, y=None, z=None, s=None):
    e = E_[i]; p = list(e['p'])
    if x is not None: p[0] = round(x, 3)
    if z is not None: p[2] = round(z, 3)
    if y is not None: p[1] = round(y, 3)
    e['p'] = p
    if s is not None: e['s'] = round(s, 4)
def g1(x, z): return float(ground(x, z)[0])
ROCK_H = {'reuse_rock_0': 0.51 * 1.84991 - 0.1777, 'reuse_rock_s0': 0.51 * 1.84991 - 0.1777, 'reuse_rock_1': 0.68 * 1.07753 - 0.15926, 'reuse_rock_s1': 0.68 * 1.07753 - 0.15926,
          'reuse_rock_2': 1.48 * 0.56613 - 0.15944, 'reuse_rock_s2': 1.48 * 0.56613 - 0.15944}
RS = CFG.get('rock_scale', 0.6); SINK = CFG.get('rock_sink', 0.3)
for i, e in enumerate(E_):
    m = e['mesh']
    if m in ROCK_H:
        x, z = e['p'][0], e['p'][2]
        big = e['s'] >= 0.8
        s = e['s'] * (RS if big else 0.85)
        setp(i, y=g1(x, z) - SINK * ROCK_H[m] * s, s=s)
# side clusters: grasscap that sat on a rock top -> beach clump on the sand beside the rock (toward the camera)
for i, e in enumerate(E_):
    if e['mesh'] == 'grasscap':
        x, z = e['p'][0], e['p'][2]; nx = x - math.copysign(0.25, x); nz = z + 0.9
        setp(i, x=nx, z=nz, y=g1(nx, nz) - 0.02, s=e['s'] * 1.1)
# giant lower-half tufts slightly smaller
for i in range(206, 220):
    if E_[i]['mesh'].startswith('reuse_grass'): setp(i, s=E_[i]['s'] * 0.72, y=g1(E_[i]['p'][0], E_[i]['p'][2]) - 0.02)
# lower-half grass patches: two in the tuft beds become beach clumps; the rest are tide pools
E_[187]['mesh'] = 'grasscap'; E_[188]['mesh'] = 'grasscap'
for i in (187, 188): x, z = E_[i]['p'][0], E_[i]['p'][2]; setp(i, y=g1(x, z) - 0.02, s=E_[i]['s'] * 0.8)
for i in (189, 190, 191, 192, 193):
    x, z = E_[i]['p'][0], E_[i]['p'][2]; k = 0.8 * E_[i]['s']
    gx = ground([x - k, x + k], [z, z]); gz = ground([x, x], [z - k, z + k]); gc = float(ground(x, z)[0])
    a = (gx[1] - gx[0]) / (2 * k); b = (gz[1] - gz[0]) / (2 * k)
    E_[i]['rz'] = 0.0; E_[i]['tilt'] = [round(-math.degrees(math.atan(b)), 2), round(math.degrees(math.atan(a)), 2)]
    setp(i, y=gc - 0.02 * E_[i]['s'])
# props crowding the new rim -> pushed out / set on the berm
moves = {131: (-2.3, 4.08, 'berm'), 149: (2.5, 4.07, 'berm'), 143: (3.72, 4.14, 'berm'), 140: (1.85, 4.6, 'g'), 129: (-0.95, 4.6, 'g'), 139: (4.6, 4.8, 'g'),
         142: (1.95, 5.25, 'g'), 144: (3.3, 6.0, 'g'), 124: (-1.6, 4.92, 'g'), 125: (-1.6, 4.92, 'g'), 148: (4.85, 3.5, 'g'), 178: (4.85, 3.15, 'g')}
for i, (x, z, how) in moves.items():
    e = E_[i]; dy = e['p'][1] - g1(e['p'][0], e['p'][2])
    if how == 'berm': h = berm_height(x, z); y = (h if h is not None else g1(x, z)) - 0.02
    else: y = g1(x, z) + (dy if e['mesh'] not in ROCK_H else -SINK * ROCK_H[e['mesh']] * e['s'])
    setp(i, x=x, z=z, y=y)
for i in (135, 136, 137, 138): setp(i, z=E_[i]['p'][2] + 0.55)
setp(135, y=g1(2.95, 4.95) + 0.03)
for i in (136, 137, 138): setp(i, y=g1(E_[i]['p'][0], E_[i]['p'][2]) + 0.02)
def fit_on_ground(i, loc):
    """grid-search tilt (rz=0) + y so the buried skirt (local y<0) stays below the sand and the centre stays above it"""
    e = E_[i]; s_ = e['s']; x, z = e['p'][0], e['p'][2]; best = None
    sk = loc[loc[:, 1] < 0]; rr = np.hypot(loc[:, 0], loc[:, 2]); top = loc[(rr < 0.35) & (loc[:, 1] > 0)]
    def R(ax, az):
        ax, az = math.radians(ax), math.radians(az)
        Rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]]); Rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
        return Rz @ Rx * s_
    gsk_cache = {}
    for ax in range(-14, 15, 2):
        for az in range(-14, 15, 2):
            M = R(ax, az); S = sk @ M.T; Tp = top @ M.T
            gs = ground(S[:, 0] + x, S[:, 2] + z); gt = ground(Tp[:, 0] + x, Tp[:, 2] + z)
            y = float(np.min(gs - S[:, 1])) - 0.012   # skirt everywhere >= 12 mm under the sand
            clear = float(np.min(Tp[:, 1] + y - gt))
            sc = clear - 0.002 * (abs(ax) + abs(az))
            if best is None or sc > best[0]: best = (sc, ax, az, y, clear)
    _, ax, az, y, clear = best
    e['rz'] = 0.0; e['tilt'] = [float(ax), float(az)]; setp(i, y=y)
    return round(clear, 3)
fits = {}
for i, e in enumerate(E_):
    if e['mesh'] in ('grasscap', 'grasspatch'): fits[i] = fit_on_ground(i, pr.meshes[e['mesh']]['POSITION'].astype(float))
for i in [k for k, v in fits.items() if v < 0.02]:  # bumpy spot: try nearby spots / smaller pool
    e = E_[i]; x0, z0, s0 = e['p'][0], e['p'][2], e['s']; best = None
    for dx in (-0.6, -0.3, 0, 0.3, 0.6):
        for dz in (-0.6, -0.3, 0, 0.3, 0.6):
            for sc in (1.0, 0.82, 0.68):
                setp(i, x=x0 + dx, z=z0 + dz, s=s0 * sc); c = fit_on_ground(i, pr.meshes[e['mesh']]['POSITION'].astype(float))
                key = (c >= 0.02, sc, -abs(dx) - abs(dz), c)
                if best is None or key > best[0]: best = (key, dx, dz, sc)
    _, dx, dz, sc = best; setp(i, x=x0 + dx, z=z0 + dz, s=s0 * sc); fits[i] = fit_on_ground(i, pr.meshes[e['mesh']]['POSITION'].astype(float)); fits[i] = (fits[i], dx, dz, sc)
RSRC = {'reuse_rock_0': ('env_prop_rock_01', 1.84991, -0.1777), 'reuse_rock_s0': ('env_prop_rock_01', 1.84991, -0.1777), 'reuse_rock_1': ('env_prop_rock_02', 1.07753, -0.15926), 'reuse_rock_s1': ('env_prop_rock_02', 1.07753, -0.15926), 'reuse_rock_2': ('env_prop_rock_03', 0.56613, -0.15944), 'reuse_rock_s2': ('env_prop_rock_03', 0.56613, -0.15944)}
for i, e in enumerate(E_):
    if e['mesh'] in RSRC:
        sname, k, oy = RSRC[e['mesh']]; ay = e['rz']; Ry = np.array([[math.cos(ay), 0, math.sin(ay)], [0, 1, 0], [-math.sin(ay), 0, math.cos(ay)]])
        V = (ru.meshes[sname]['POSITION'].astype(float) * k + [0, oy, 0]) @ (Ry * e['s']).T; low = V[V[:, 1] <= np.percentile(V[:, 1], 12)]
        gg = ground(low[:, 0] + e['p'][0], low[:, 2] + e['p'][2]); need = float(np.min(gg - low[:, 1])) - 0.01
        if e['p'][1] > need: setp(i, y=need)
print('fit centre clearance', fits)
json.dump(L, open(DST + '/data/coast_layout.json', 'w'), separators=(',', ':'))
json.dump({k: v for k, v in SW.items()}, open(DST + '/swatches.json', 'w'))
print('swatches', len(SW), 'rim verts', len(bg.meshes['board_rim']['POSITION']), 'sand mid', SAND_MID)
