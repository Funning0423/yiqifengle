#!/usr/bin/env python3
"""Coast transition camera DRAFT previs (blockout only, path-anchor frame).
Frame P: origin = hut door threshold (D), +z = along sand path toward sea, +y up,
+x = her right when facing the sea.  Anchors: D=(0,0,0), S0=step top (z=6),
S1=step foot (z=7.2,y=-0.6), E=terrace edge (z=13.2,y=-0.6).
Not runtime code. Re-anchor later by mapping D,S0,E onto the real mesh."""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageDraw
OUT = os.path.dirname(os.path.abspath(__file__)) + '/out'; os.makedirs(OUT, exist_ok=True)
STEP_H = 0.2; N_STEPS = 3; DROP = STEP_H * N_STEPS
A = dict(D=(0, 0, 0), S0=(0, 0, 6.0), S1=(0, -DROP, 7.2), E=(0, -DROP, 13.2), LH=(9.0, 7.0, 60.0), BOARD=(0, -DROP, 18.0))
FACE_Y, CHEST_Y, HEAD_TOP, HALF_W = 1.42, 1.12, 1.62, 0.28   # her proportions (island rig, assumed)
# ---- blockout boxes (min,max) ----
BOX = [((-2.0, 0, -4.2), (2.0, 2.6, -0.4), 'hut'),            # hut body (door recessed 0.4)
       ((-2.6, 0, 1.5), (-1.7, 0.9, 2.6), 'rockL1'), ((2.4, 0, 3.6), (3.4, 1.1, 4.8), 'rockR1'),  # gull rock R1
       ((-3.2, -DROP, 9.0), (-2.2, 0.5, 10.4), 'reefL'), ((3.6, -DROP, 11.0), (4.6, 0.4, 12.0), 'reefR'),
       ((6.0, 0, -2.0), (8.0, 4.0, 2.0), 'palmclump')]
for i in range(N_STEPS):  # risers are terrain, modelled as slabs
    z0 = 6.0 + i * 0.4
    BOX.append(((-8.0, -DROP - 0.5, z0), (8.0, -STEP_H * (i + 1), z0 + 0.4), f'step{i}'))  # sand steps span the beach width
def ground(x, z):
    if z < 6.0: return 0.0
    if z < 7.2: return -STEP_H * min(N_STEPS, int((z - 6.0) / 0.4) + 1)
    return -DROP
# ---- her timeline ----
T = [0, 1.0, 1.8, 6.8, 8.6, 13.6, 14.2, 16.2]
SHOTS = ['S1 map-collapse handover', 'S2 turn to beach', 'S3 sand-path follow', 'S4 step-down truck',
         'S5 terrace follow', 'S6 stop + look lighthouse', 'S7 rise to 55° board']
def her(t):
    if t < 1.8:  # standing at door; turn 90° (facing +x -> +z) during 1.0-1.8
        u = min(1, max(0, (t - 1.0) / 0.8)); u = u * u * (3 - 2 * u)
        return np.array([0, 0, 0.35]), 90 * (1 - u)
    if t < 6.8: return np.array([0, 0, 0.35 + 5.65 * (t - 1.8) / 5.0 ]), 0       # ~1.13-1.2 m/s, see note
    if t < 8.6:
        z = 6.0 + 1.2 * (t - 6.8) / 1.8; return np.array([0, ground(0, z), z]), 0
    if t < 13.6:
        z = 7.2 + 6.0 * (t - 8.6) / 5.0; return np.array([0, -DROP, min(z, 13.2 - 0.25)]), 0
    return np.array([0, -DROP, 12.95]), 0
def smooth_her(t, k=0.12):  # 0.24 s box filter = foot-plant smoothing the follow rig uses on root
    return np.mean([her(t + d)[0] for d in np.linspace(-k, k, 7)], axis=0)
# ---- camera keys: (time, mode, offset-or-world, look) ; 'rel' offsets are from her smoothed root ----
ISLAND_LIVE = dict(pos=(1.2, 7.5, 6.5), look=(0, 0.6, 0.5), fov=45)  # PLACEHOLDER; runtime = live island lens at handover
KEYS = [  # t, rel_offset(from her root, P frame), look_offset_rel, fov, world_weight
    (0.0, None, None, 45, 1.0),
    (1.0, (1.5, 1.75, 3.0), (0, 0.9, 0), 44, 0.0),    # S1 end: seaward front-right 3/4 medium, she faces +x
    (1.8, (1.4, 1.7, 3.0), (0, 0.9, 0), 44, 0.0),     # S2: hold while she turns to face lens/sea
    (6.2, (1.3, 1.7, 3.0), (-0.3, 0.9, 0), 44, 0.0), # S3: leading dolly, retreats down path; she on left third
    (7.7, (3.6, 2.6, 0.2), (0, 0.8, 0.0), 45, 0.0),   # S4: truck to right profile across the step-down
    (9.6, (1.8, 2.9, -3.2), (0.0, 0.8, 0.6), 46, 0.0),# S5: swing to rear-right 3/4, tilt down: terrace from frame bottom
    (13.6, (1.4, 2.7, -3.6), (0.1, 0.8, 1.8), 46, 0.0),
    (14.2, (1.6, 2.5, -4.1), (0.3, 1.0, 1.8), 46, 0.0),# S6: 0.5 m pull-back, look up-right: lighthouse upper-right
    (16.2, None, None, 45, 1.0)]                       # S7: rise to 55° board pose
BOARD_POSE = dict(pos=(0, -DROP + 14 * math.sin(math.radians(55)), 18 - 14 * math.cos(math.radians(55))), look=(0, -DROP, 16.0))
def ease(u): return u * u * u * (u * (6 * u - 15) + 10)
def cam(t):
    for a, b in zip(KEYS, KEYS[1:]):
        if a[0] <= t <= b[0]: break
    u = ease((t - a[0]) / (b[0] - a[0])); h = smooth_her(t)
    def pose(k):
        if k[1] is None:
            w = ISLAND_LIVE if k[0] == 0 else BOARD_POSE
            return np.array(w['pos'], float), np.array(w['look'], float)
        return h + np.array(k[1]), h + np.array(k[2])
    if a[1] is not None and b[1] is not None:  # orbit-interpolate around her (azimuth, radius, height): no chord through her
        def cyl(o): return math.atan2(o[0], o[2]), math.hypot(o[0], o[2]), o[1]
        (aa, ra, ya), (ab, rb, yb) = cyl(a[1]), cyl(b[1]); da = (ab - aa + math.pi) % (2 * math.pi) - math.pi
        az, r, y = aa + da * u, ra + (rb - ra) * u, ya + (yb - ya) * u
        lk = np.array(a[2]) + (np.array(b[2]) - np.array(a[2])) * u
        return h + np.array([r * math.sin(az), y, r * math.cos(az)]), h + lk, a[3] + (b[3] - a[3]) * u
    pa, la = pose(a); pb, lb = pose(b)
    return pa + (pb - pa) * u, la + (lb - la) * u, a[3] + (b[3] - a[3]) * u
# ---- geometry helpers ----
def box_dist(p, b):
    lo, hi = np.array(b[0]), np.array(b[1]); d = np.maximum(np.maximum(lo - p, 0), p - hi); return float(np.linalg.norm(d))
def seg_hits_box(p, q, b):
    lo, hi = np.array(b[0]), np.array(b[1]); d = q - p; t0, t1 = 0.0, 1.0
    for i in range(3):
        if abs(d[i]) < 1e-9:
            if p[i] < lo[i] or p[i] > hi[i]: return False
        else:
            a, c = (lo[i] - p[i]) / d[i], (hi[i] - p[i]) / d[i]; a, c = min(a, c), max(a, c); t0, t1 = max(t0, a), min(t1, c)
            if t0 > t1: return False
    return t1 > 0.0 and t0 < 0.97
def basis(p, l):
    f = (l - p) / np.linalg.norm(l - p); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f); return f, r, u
def project(pt, p, l, fov, asp):
    f, r, u = basis(p, l); v = pt - p; z = v @ f
    if z <= 0.05: return None
    th = math.tan(math.radians(fov) / 2) * max(1.0, 0.62 / asp) if asp < 0.62 else math.tan(math.radians(fov) / 2)  # fit-width: hold hfov of aspect 0.62
    return (0.5 + (v @ r) / z / (th * asp) / 2, 0.5 - (v @ u) / z / th / 2, z)
SCREENS = [(390, 844), (414, 896), (360, 780), (375, 667), (320, 568), (390, 520), (768, 1024)]
def capsule(w, h):  # WeChat menu button (CSS px), notch screens taller status bar
    top = 48 if h >= 780 else 26; return ((w - 7 - 87) / w, top / h, (w - 7) / w, (top + 32) / h)
bad = []; FPS = 60; ts = np.arange(0, 16.2 + 1e-9, 1 / FPS)
# ---- gates ----
yaws = []; res = {}; blocked = {}; minclear = (9, None); maxwalk = None
for t in ts:
    p, l, fov = cam(t); f, _, _ = basis(p, l); yaws.append(math.degrees(math.atan2(f[0], f[2])))
    c = min([box_dist(p, b) for b in BOX] + [p[1] - ground(p[0], p[2])])
    if c < minclear[0]: minclear = (c, round(t, 3))
yaws = np.unwrap(np.radians(yaws)); yr = np.degrees(np.gradient(yaws, 1 / FPS)); ya = np.gradient(yr, 1 / FPS)
walking = (ts >= 1.8) & (ts < 13.6)
def stats(m): return dict(max_rate=round(float(np.abs(yr[m]).max()), 1), p99_acc=round(float(np.percentile(np.abs(ya[m]), 99)), 1))
gate = dict(yaw_standing=stats(~walking), yaw_walking=stats(walking), min_clearance_m=round(minclear[0], 3), min_clearance_t=minclear[1])
gate['yaw_standing']['pass'] = gate['yaw_standing']['max_rate'] <= 90 and gate['yaw_standing']['p99_acc'] <= 200
gate['yaw_walking']['pass'] = gate['yaw_walking']['max_rate'] <= 120 and gate['yaw_walking']['p99_acc'] <= 300
gate['clearance_pass'] = minclear[0] >= 1.1
p0, l0, _ = cam(0.0); gate['first_frame_eq_live'] = bool(np.allclose(p0, ISLAND_LIVE['pos']) and np.allclose(l0, ISLAND_LIVE['look']))
# continuity: max per-frame lens step (no jump cuts)
P = np.array([cam(t)[0] for t in ts]); gate['max_lens_step_m_per_frame'] = round(float(np.linalg.norm(np.diff(P, axis=0), axis=1).max()), 4)
gate['hard_cuts'] = 0
scr = []
for (w, h) in SCREENS:
    asp = w / h; cap = capsule(w, h); run = 0; worst_block = 0; mm = 9; mmt = None; capbad = 0
    for t in ts:
        p, l, fov = cam(t); hp = smooth_her(t)
        pts = [hp + [0, HEAD_TOP, 0], hp + [0, 0.02, 0], hp + [HALF_W, FACE_Y, 0], hp + [-HALF_W, FACE_Y, 0]]
        pr = [project(q, p, l, fov, asp) for q in pts]
        if any(x is None for x in pr): mm = -1; mmt = t; continue
        xs = [x[0] for x in pr]; ys = [x[1] for x in pr]
        m = min(min(xs), 1 - max(xs), min(ys), 1 - max(ys))
        if m < mm: mm, mmt = m, t
        if m < 0.08: bad.append((w, round(float(t),2), round(m,3), [round(min(xs),2),round(max(xs),2),round(min(ys),2),round(max(ys),2)]))
        fx, fy, _ = project(hp + [0, FACE_Y, 0], p, l, fov, asp)
        if cap[0] - 0.02 <= fx <= cap[2] + 0.02 and cap[1] - 0.02 <= fy <= cap[3] + 0.02: capbad += 1
        bl = any(seg_hits_box(p, hp + [0, y, 0], b) for b in BOX for y in (FACE_Y, CHEST_Y))
        run = run + 1 / FPS if bl else 0; worst_block = max(worst_block, run)
    scr.append(dict(screen=f'{w}x{h}', min_margin=round(mm, 3), at_t=round(mmt, 2), margin_pass=mm >= 0.08,
                    face_under_menu_frames=capbad, worst_block_s=round(worst_block, 2), block_pass=worst_block <= 0.5))
gate['screens'] = scr; print('320 bad', bad[:3], bad[-3:], len(bad))
json.dump(gate, open(OUT + '/gates.json', 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
# shot table json (rel frame)
json.dump(dict(frame='P: origin hut door, +z path to sea, +x her right facing sea', anchors=A, shots=[dict(id=SHOTS[i], t0=T[i], t1=T[i + 1]) for i in range(7)],
               keys=[dict(t=k[0], rel=k[1], look_rel=k[2], fov=k[3], world=k[4]) for k in KEYS], board_pose=BOARD_POSE), open(OUT + '/shots.json', 'w'), indent=1, default=float)
print(json.dumps(gate, default=lambda o: o.item()))
# ---- render contact sheet: rows=shots(mid time), cols=screens ----
COL = dict(hut=(150, 110, 80), palmclump=(70, 120, 70))
def faces(b):
    lo, hi = b[0], b[1]; c = [(x, y, z) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
    idx = [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)]
    return [[np.array(c[i]) for i in q] for q in idx]
def render(t, w, h, H=300):
    W = int(H * w / h); im = Image.new('RGB', (W, H), (150, 200, 235)); d = ImageDraw.Draw(im); asp = w / h
    p, l, fov = cam(t); polys = []
    gnd = [((-8, 0, -6), (8, 0, 6)), ((-8, -DROP, 7.2), (8, -DROP, 14))]
    sea = ((-40, -DROP - 0.3, 14), (40, -DROP - 0.3, 80))
    for (lo, hi), colr in [(sea, (60, 130, 190))] + [(g, (225, 205, 150)) for g in gnd[:1]] + [(gnd[1], (170, 150, 120))]:
        q = [np.array([lo[0], lo[1], lo[2]]), np.array([hi[0], lo[1], lo[2]]), np.array([hi[0], lo[1], hi[2]]), np.array([lo[0], lo[1], hi[2]])]
        polys.append((q, colr))
    for b in BOX:
        colr = COL.get(b[2], (200, 185, 140) if 'step' in b[2] else (120, 115, 110))
        for fq in faces(b): polys.append((fq, colr))
    hp = smooth_her(t); _, yaw = her(t)
    for fq in faces((tuple(hp + [-.2, 0, -.14]), tuple(hp + [.2, 1.25, .14]))): polys.append((fq, (230, 90, 80)))  # her body box
    lh = np.array(A['LH']); polys.append(([lh + [-.8, -7.6, 0], lh + [.8, -7.6, 0], lh + [.4, 2, 0], lh + [-.4, 2, 0]], (245, 245, 245)))
    def split(q, n):
        a, b, c, d_ = [np.array(v, float) for v in q]; res = []
        for i in range(n):
            for j in range(n):
                def P_(u, v): return (a * (1 - u) + b * u) * (1 - v) + (d_ * (1 - u) + c * u) * v
                u0, u1, v0, v1 = i / n, (i + 1) / n, j / n, (j + 1) / n
                res.append([P_(u0, v0), P_(u1, v0), P_(u1, v1), P_(u0, v1)])
        return res
    fine = []
    for q, colr in polys:
        ext = max(np.linalg.norm(np.array(q[0]) - np.array(q[2])), 0.01)
        n = int(min(40, max(1, ext / (0.4 if ext < 30 else 3))))
        fine += [(sq, colr) for sq in split(q, n)]
    out = []
    for q, colr in fine:
        pr = [project(v, p, l, fov, asp) for v in q]
        if any(x is None for x in pr): continue
        out.append((sum(x[2] for x in pr) / 4, [(x[0] * W, x[1] * H) for x in pr], colr))
    for _, pts, colr in sorted(out, key=lambda o: -o[0]): d.polygon(pts, fill=colr, outline=(60, 60, 60))
    hd = project(hp + [0, FACE_Y + 0.08, 0], p, l, fov, asp)
    if hd: rr = max(2, 0.17 / hd[2] / math.tan(math.radians(fov) / 2) / 2 * H); d.ellipse([hd[0] * W - rr, hd[1] * H - rr, hd[0] * W + rr, hd[1] * H + rr], fill=(250, 215, 180), outline=(0, 0, 0))
    c = capsule(w, h); d.rounded_rectangle([c[0] * W, c[1] * H, c[2] * W, c[3] * H], 4, outline=(0, 0, 0), fill=(255, 255, 255))
    m = 0.08; d.rectangle([m * W, m * H, (1 - m) * W, (1 - m) * H], outline=(255, 0, 255))
    return im
if '--norender' not in sys.argv:
    mids = [round((T[i] + T[i + 1]) / 2, 2) for i in range(7)]
    tiles = [[render(t, w, h) for (w, h) in SCREENS] for t in mids]
    Wt = sum(x.width for x in tiles[0]) + 8 * 8; sheet = Image.new('RGB', (Wt + 150, 7 * 308 + 30), 'white'); d = ImageDraw.Draw(sheet)
    x = 150
    for j, (w, h) in enumerate(SCREENS): d.text((x, 8), f'{w}x{h}', fill='black'); x += tiles[0][j].width + 8
    for i, row in enumerate(tiles):
        d.text((6, 30 + i * 308 + 140), f'{SHOTS[i]}\nt={mids[i]}s', fill='black'); x = 150
        for im in row: sheet.paste(im, (x, 30 + i * 308)); x += im.width + 8
    sheet.save(OUT + '/contact_sheet_7shots_x_7screens.png')
    strip = [render(t, 390, 844, 260) for t in np.arange(0, 16.21, 0.9)]
    s2 = Image.new('RGB', (len(strip) * (strip[0].width + 4), 280), 'white'); d = ImageDraw.Draw(s2)
    for i, im in enumerate(strip): s2.paste(im, (i * (im.width + 4), 18)); d.text((i * (im.width + 4) + 2, 2), f't={i * 0.9:.1f}', fill='black')
    s2.save(OUT + '/timeline_strip_390x844.png')
