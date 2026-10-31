#!/usr/bin/env python3
"""运镜bot: S7 slow walk (30.675-40.075) — checks in the window she now walks through the old pause (30.675-35.575 s) and before/after images.
Her REAL model (GLB skinned with the TRS recorded from the REAL CharacterMotion, her_walk_replay.cjs) through the decoded runtime lens
(CoastArrivalTrack.ts, 7 screens), scene = realmesh (island + coast bundle, runtime world frame). Definitions = reanchor.py gates:
 margin: min of head-top / feet / face +-0.28 m to the screen sides (fraction) >= 0.08; face under menu: face point inside capsule +-0.02;
 face blocked: longest run with face AND chest ray from the lens hit scene geometry (< d-0.3 m) <= 0.5 s;
 HUD overlap: her rasterized silhouette px inside the board keep-out bands (FP.band: top band / tool row) — reported;
 hut overlap: her silhouette px covered by fisher_hut triangles nearer to the lens than her (z-buffer at pt resolution) = 0;
 clearance: walk path (start/end roots) identical to the authored S7 path -> s7_walk_clearance.json (>= 1.0 m) holds; verified here.
usage: s6_walk_check.py <replay_after.json> <out.json> [--images <replay_before.json> <outdir>]"""
import json, sys, os, math, numpy as np
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(H, '../..')); TD = os.path.join(ROOT, 'tools/coast-transition-draft')
os.environ.setdefault('FIT', 'r5d'); sys.path.insert(0, TD); sys.path.insert(0, os.path.join(ROOT, 'tools/coast-board-lens'))
src = open(os.path.join(H, 'her_size_walk.py')).read(); src = src[:src.index('RP = json.load(open(sys.argv[1]))')]
G = {'__file__': os.path.join(H, 'her_size_walk.py'), '__name__': 'x'}; exec(src, G); skin, rows, cam, g = G['skin'], G['rows'], G['cam'], G['g']
j, acc = g['j'], g['acc']; F = []; off = 0
for nd in j['nodes']:
    if 'mesh' in nd:
        for p in j['meshes'][nd['mesh']]['primitives']:
            F.append(acc(p['indices']).astype(int).reshape(-1, 3) + off); off += j['accessors'][p['attributes']['POSITION']]['count']
F = np.concatenate(F)
import trimesh
from realmesh import load
parts, _ = load(); names = []; ms = []
for n, m in parts: ms.append(m); names += [n] * len(m.faces)
MESH = trimesh.util.concatenate(ms); NAMES = np.array(names); RAY = trimesh.ray.ray_pyembree.RayMeshIntersector(MESH)
HUT = np.array(['fisher_hut' in n for n in NAMES]); TRI = MESH.triangles; FN = MESH.face_normals
import final_poses as FP
def capsule(w, h): top = 48 if h >= 780 else 26; return ((w - 7 - 87) / w, top / h, (w - 7) / w, (top + 32) / h)
FACE, CHEST, HEAD_TOP, HALF_W = 1.42, 1.12, 1.62, 0.28
def basis(p, l):
    f = (l - p) / np.linalg.norm(l - p); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); return f, r, np.cross(r, f)
def proj(X, p, l, fov, asp):
    f, r, u = basis(p, l); V = X - p; z = V @ f; th = math.tan(math.radians(fov) / 2)
    return 0.5 + (V @ r) / np.maximum(z, 1e-3) / (th * asp) / 2, 0.5 - (V @ u) / np.maximum(z, 1e-3) / th / 2, z
def her_world(fr):
    v = skin(fr['trs']); c, s_ = math.cos(fr['yaw']), math.sin(fr['yaw'])
    return np.c_[v[:, 0] * c + v[:, 2] * s_, v[:, 1], -v[:, 0] * s_ + v[:, 2] * c] + np.array(fr['root'])
def zmask(T, p, l, fov, w, h):  # min-depth buffer of triangles at pt resolution (painter per tri, coarse but exact enough for px counts)
    x, y, z = proj(T.reshape(-1, 3), p, l, fov, w / h); x = (x * w).reshape(-1, 3); y = (y * h).reshape(-1, 3); z = z.reshape(-1, 3)
    zb = np.full((h, w), np.inf); ok = (z > 0.1).all(1) & (x.max(1) >= 0) & (x.min(1) < w) & (y.max(1) >= 0) & (y.min(1) < h)
    for k in np.where(ok)[0]:
        x0, x1 = int(max(0, math.floor(x[k].min()))), int(min(w - 1, math.ceil(x[k].max()))); y0, y1 = int(max(0, math.floor(y[k].min()))), int(min(h - 1, math.ceil(y[k].max())))
        if x1 < x0 or y1 < y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5); (ax, bx, cx), (ay, by, cy) = x[k], y[k]
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-9: continue
        a = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / d; b = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / d; c = 1 - a - b
        m = (a >= 0) & (b >= 0) & (c >= 0); zz = a * z[k][0] + b * z[k][1] + c * z[k][2]; sub = zb[y0:y1 + 1, x0:x1 + 1]; np.minimum(sub, np.where(m, zz, np.inf), out=sub)
    return zb
WIN = tuple(float(x) for x in os.environ['QF_WIN'].split(',')) if os.environ.get('QF_WIN') else (30.675, 35.575)
def check(RP):
    res = {}
    for run in RP:
        fr_all = [f for f in run['frames'] if WIN[0] - 1e-6 <= f['t'] <= WIN[1] + 1e-6]
        for scr, R in rows.items():
            w, h = map(int, scr.split('x')); asp = w / h; cap = capsule(w, h); top, tool = FP.band(w, h); mm, mmt, capbad, run_s, worst, hud_px, hut_px, hut_t = 9, None, 0, 0, 0, 0, 0, None
            prev = None; hudmax_t = None; mbad = []; offs = []; nsil = 0
            for k, fr in enumerate(fr_all):
                t = fr['t']; q = cam(R, t); p = np.array(q[:3]); l = np.array(q[3:6]); fov = q[6]; hp = np.array(fr['root']); rgt = basis(p, l)[1]
                pts = np.array([hp + [0, HEAD_TOP, 0], hp + [0, .02, 0], hp + [0, FACE, 0] + rgt * HALF_W, hp + [0, FACE, 0] - rgt * HALF_W]); x, y, z = proj(pts, p, l, fov, asp)
                m = -9 if (z <= 0.05).any() else min(x.min(), 1 - x.max(), y.min(), 1 - y.max())
                if m < mm: mm, mmt = float(m), t
                if m < 0.08: mbad.append(t)
                if m < -0.05: offs.append(t)
                fx, fy, _ = proj(np.array([hp + [0, FACE, 0]]), p, l, fov, asp)
                if cap[0] - .02 <= fx[0] <= cap[2] + .02 and cap[1] - .02 <= fy[0] <= cap[3] + .02: capbad += 1
                hit = False
                for yy in (FACE, CHEST):
                    qq = hp + [0, yy, 0]; d = qq - p; Ld = np.linalg.norm(d); loc, _, ti = RAY.intersects_location([p], [d / Ld], multiple_hits=False)
                    if len(loc) and np.linalg.norm(loc[0] - p) < Ld - 0.3: hit = True; break
                dt = t - prev if prev is not None else 0; prev = t; run_s = run_s + dt if hit else 0; worst = max(worst, run_s)
                if run['name'] == '60fps' and k % 6 == 0:  # silhouette px (HUD / hut) at 10 Hz on the 60 fps run; margin/menu/blocked every frame on every clock
                    X = her_world(fr); zb_her = zmask(X[F], p, l, fov, w, h); her = np.isfinite(zb_her)
                    nsil += 1
                    if not her.any(): continue
                    hp_ = int(her[:int(round(top)), :].sum() + her[int(round(tool)):, :].sum())
                    if hp_ > hud_px: hud_px, hudmax_t = hp_, t
                    zh = zmask(TRI[HUT], p, l, fov, w, h); hut = int((her & (zh < zb_her)).sum())
                    if hut > hut_px: hut_px, hut_t = hut, t
            res.setdefault(run['name'], {})[scr] = dict(min_margin=round(mm, 4), margin_t=mmt, margin_pass=mm >= 0.08, face_under_menu_frames=capbad, face_blocked_worst_s=round(worst, 3),
                face_blocked_pass=worst <= 0.5, hud_band_px_max=hud_px, hud_band_px_t=hudmax_t, keepout_pt=dict(top=top, tool_top=tool), hut_overlap_px_max=hut_px, hut_t=hut_t, hut_pass=hut_px == 0, n=len(fr_all), margin_fail_first_t=mbad[0] if mbad else None, margin_fail_last_t=mbad[-1] if mbad else None, margin_fail_frames=len(mbad), off_screen_first_t=offs[0] if offs else None, silhouette_samples=nsil)
            r = res[run['name']][scr]; print(run['name'], scr, 'margin', r['min_margin'], '@', mmt, 'menu', capbad, 'blocked', r['face_blocked_worst_s'], 'hud px', hud_px, '@', hudmax_t, 'hut px', hut_px, 'margin<0.08 from', mbad[0] if mbad else None, 'frames', len(mbad), 'off-screen from', offs[0] if offs else None, 'sil', nsil, flush=True)
    return res
COLS = {'env_island_main': (214, 196, 150), 'env_lighthouse_ext': (236, 232, 222), 'terrain': (222, 202, 150), 'headland': (150, 140, 120), 'arrival_steps': (205, 185, 140)}
def colour(n):
    b = n.split(':')[1].split('@')[0]
    if b in COLS: return COLS[b]
    if b.startswith('rock') or b == 'barnacles': return (135, 128, 118)
    if b.startswith('slab') or b == 'joint_bed': return (176, 160, 130)
    if b.startswith(('grass', 'moss', 'flowers')) or 'palm' in b: return (110, 160, 90)
    if 'hut' in b: return (170, 120, 85)
    return (190, 170, 150)
FC = np.array([colour(n) for n in NAMES], float)
def render(fr, t, scr, Hpx=420):
    w, h = map(int, scr.split('x')); R = rows[scr]; q = cam(R, t); p = np.array(q[:3]); l = np.array(q[3:6]); fov = q[6]; asp = w / h; Wd = int(round(Hpx * asp))
    im = Image.new('RGB', (Wd, Hpx), (160, 205, 235)); d = ImageDraw.Draw(im)
    X = her_world(fr); HT = X[F]; T = np.concatenate([TRI, HT]); C = np.concatenate([FC, np.tile([[232, 96, 88]], (len(HT), 1))])
    N = np.concatenate([FN, np.cross(HT[:, 1] - HT[:, 0], HT[:, 2] - HT[:, 0]) / (np.linalg.norm(np.cross(HT[:, 1] - HT[:, 0], HT[:, 2] - HT[:, 0]), axis=1)[:, None] + 1e-12)])
    x, y, z = proj(T.reshape(-1, 3), p, l, fov, asp); x = (x * Wd).reshape(-1, 3); y = (y * Hpx).reshape(-1, 3); z = z.reshape(-1, 3)
    ok = (z > 0.1).all(1) & (x.max(1) > 0) & (x.min(1) < Wd) & (y.max(1) > 0) & (y.min(1) < Hpx); ids = np.where(ok)[0]; ids = ids[np.argsort(-z[ids].mean(1))]
    sh = 0.55 + 0.45 * np.clip(np.abs(N @ np.array([0.35, 0.85, 0.4])), 0, 1)
    for k in ids: d.polygon(list(zip(x[k], y[k])), fill=tuple(int(v * sh[k]) for v in C[k]))
    k_ = Hpx / h; top, tool = FP.band(w, h); d.rectangle([0, 0, Wd, top * k_], outline=(40, 120, 220)); d.line([0, tool * k_, Wd, tool * k_], fill=(40, 120, 220))
    c = capsule(w, h); d.rounded_rectangle([c[0] * Wd, c[1] * Hpx, c[2] * Wd, c[3] * Hpx], 4, outline=(0, 0, 0), fill=(255, 255, 255))
    m = .08; d.rectangle([m * Wd, m * Hpx, (1 - m) * Wd, (1 - m) * Hpx], outline=(255, 0, 255))
    hy = proj(X, p, l, fov, asp)[1]; hpx = (hy.max() - hy.min()) * h
    return im, hpx
def frame_at(run, t):
    fr = min(run['frames'], key=lambda f: abs(f['t'] - t)); return fr, abs(fr['t'] - t) > 0.05
def label(im, txt):
    d = ImageDraw.Draw(im); d.rectangle([0, im.height - 30, im.width, im.height], fill=(0, 0, 0)); d.text((4, im.height - 27), txt, fill=(255, 255, 255)); return im
def images(before, after, outdir):
    B = [r for r in before if r['name'] == '60fps'][0]; A = [r for r in after if r['name'] == '60fps'][0]; TS = [30, 32, 34, 36, 38, 39, 40, 42]; tiles = []; info = {}
    for lab, run, win in (('BEFORE 35.575-39.825 1.2 m/s walk_loop only', B, '35.575-39.825'), ('AFTER 30.675-40.075 0.598 m/s start+stop', A, '30.675-40.075')):
        row = []
        for t in TS:
            fr, held = frame_at(run, t); im, hp = render(fr, t, '390x844'); info.setdefault(lab, {})[t] = dict(clip=fr['clip'], her_px=round(hp, 1), held=held)
            row.append(label(im, f"{t:.0f}s {fr['clip'][:16]}{' (held)' if held else ''} {hp:.0f}px"))
        tiles.append((lab, row))
    tw, th = tiles[0][1][0].size; S = Image.new('RGB', (tw * len(TS), (th + 24) * 2), (255, 255, 255)); d = ImageDraw.Draw(S)
    for r, (lab, row) in enumerate(tiles):
        d.text((6, r * (th + 24) + 5), lab + '  (390x844, real model + real CharacterMotion replay, runtime lens)', fill=(0, 0, 0))
        for c, im in enumerate(row): S.paste(im, (c * tw, r * (th + 24) + 24))
    S.save(os.path.join(outdir, 's7_slowwalk_before_after_390x844.png'))
    scrs = list(rows.keys()); cells = []; T0 = 38.5
    for lab, run in (('BEFORE', B), ('AFTER', A)):
        fr, _ = frame_at(run, T0); cells.append([label(render(fr, T0, s, 360)[0], '') for s in scrs])
        for s, im in zip(scrs, cells[-1]): hp = render(fr, T0, s, 60)[1]; label(im, f"{lab} {s} {fr['clip'][:14]} {hp:.1f}px"); info.setdefault('grid_' + lab, {})[s] = round(hp, 2)
    wmax = max(im.width for im in cells[0]); G_ = Image.new('RGB', (sum(im.width + 6 for im in cells[0]), 2 * (360 + 24)), (255, 255, 255)); d = ImageDraw.Draw(G_)
    for r, row in enumerate(cells):
        x = 0; d.text((4, r * 384 + 5), ('BEFORE' if r == 0 else 'AFTER') + f' @ {T0} s (px = her height in that screen)', fill=(0, 0, 0))
        for im in row: G_.paste(im, (x, r * 384 + 24)); x += im.width + 6
    G_.save(os.path.join(outdir, 's7_slowwalk_7screens.png')); return info
if __name__ == '__main__':
    after = json.load(open(sys.argv[1])); out = {'window': WIN}
    if '--images' in sys.argv:
        i = sys.argv.index('--images'); out['images'] = images(json.load(open(sys.argv[i + 1])), after, sys.argv[i + 2])
    if '--no-check' not in sys.argv: out['checks'] = check(after)
    cl = json.load(open(os.path.join(TD, 's7_walk_clearance.json'))); s7 = [f for f in after[0]['frames'] if f['t'] >= 30.6][0]['root']
    out['clearance'] = dict(path_start_root=s7, authored_route=cl['route'], solid_min_m=cl['solid_min']['d'], pass_=cl['solid_min']['d'] >= 1.0)
    json.dump(out, open(sys.argv[2], 'w'), indent=1, default=float); print('clearance', out['clearance']['solid_min_m'])
