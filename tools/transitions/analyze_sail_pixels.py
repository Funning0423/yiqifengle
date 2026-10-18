#!/usr/bin/env python3
"""Attach per-shot pixel metrics to a sail QA csv. Reads frames/<tag>/shots.json + pngs."""
import csv, json, os, sys
from PIL import Image

frames_dir, csv_path = sys.argv[1], sys.argv[2]
shots = json.load(open(os.path.join(frames_dir, 'shots.json')))
rows = list(csv.DictReader(open(csv_path)))
if not rows:
    print(json.dumps({'status': 'empty'}))
    raise SystemExit(0)

def luma(px):
    return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]

def sea_ref(im):
    w, h = im.size
    xs, ys = range(int(w * 0.15), int(w * 0.85), 6), range(int(h * 0.55), int(h * 0.82), 6)
    blues = []
    for y in ys:
        for x in xs:
            p = im.getpixel((x, y))
            if p[2] > p[0] + 15 and p[2] > 80 and luma(p) < 210:
                blues.append(p[:3])
    if not blues:
        return (140, 190, 210)
    blues.sort(key=lambda p: p[2])
    return blues[len(blues) // 2]

def dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])

def poly(pts, w, h):
    if len(pts) < 3:
        return []
    kept = [(x, y) for x, y in pts if -20 <= x <= w + 20 and -20 <= y <= h + 20]
    if len(kept) < 3:
        return []
    # Cocos worldToScreen for this capture is framebuffer pixels, origin at the bottom.
    flipped = [(x, h - y) for x, y in kept]
    if any(p[0] < 16 or p[0] > w - 16 or p[1] < 16 or p[1] > h - 16 for p in flipped):
        return []
    cx = sum(p[0] for p in flipped) / len(flipped)
    cy = sum(p[1] for p in flipped) / len(flipped)
    return [(cx + (x - cx) * 0.72, cy + (y - cy) * 0.72) for x, y in flipped]

def bone_box(row, h):
    def num(key):
        try:
            return float(row.get(key) or 'nan')
        except ValueError:
            return float('nan')
    hx, hy, fx, fy = num('hsx'), num('hsy'), num('fsx'), num('fsy')
    if not all(v == v for v in (hx, hy, fx, fy)):
        return None
    return (hx, h - hy, fx, h - fy)

def screen_pose(im, gx, iy, bones=None):
    """Dress blob vs the seated skeleton. A standing bind-pose mesh sits off the locked bones."""
    w0, h0 = im.size
    scale_img = 844.0 / h0
    if h0 > 900:
        im = im.resize((max(1, int(w0 * scale_img)), 844), Image.Resampling.BOX)
        if gx == gx:
            gx *= scale_img
        if iy == iy:
            iy *= scale_img
        if bones:
            bones = tuple(v * scale_img if v == v else v for v in bones)
    w, h = im.size
    scale = 1.0
    preds = (
        lambda r, g, b: r > 185 and g > 190 and b < 85 and abs(r - g) < 50,
        lambda r, g, b: r > 130 and g > 145 and b < 110 and g > b + 35 and g + 10 > r,
    )
    px = im.load()
    anchor = gx == gx and iy == iy and 0 <= gx < w and 0 <= iy < h
    dx, dy = 22 * scale, 36 * scale
    for pred in preds:
        pts = [(x, y) for y in range(0, h, 1) for x in range(0, w, 1) if pred(*px[x, y])]
        if len(pts) > 8000:
            pts = pts[::3]
        cells = {}
        clusters = []
        for p in pts:
            key = (int(p[0] / dx), int(p[1] / dy))
            hit = None
            for ox in (-1, 0, 1):
                for oy in (-1, 0, 1):
                    for idx in cells.get((key[0] + ox, key[1] + oy), ()):
                        c = clusters[idx]
                        if abs(p[0] - c[0]) < dx and abs(p[1] - c[1]) < dy:
                            hit = c
                            break
                    if hit:
                        break
                if hit:
                    break
            if hit is None:
                clusters.append([float(p[0]), float(p[1]), [p]])
                cells.setdefault(key, []).append(len(clusters) - 1)
            else:
                hit[2].append(p)
                hit[0] = (hit[0] * (len(hit[2]) - 1) + p[0]) / len(hit[2])
                hit[1] = (hit[1] * (len(hit[2]) - 1) + p[1]) / len(hit[2])
        kept = []
        for c in clusters:
            xs = [p[0] for p in c[2]]
            ys = [p[1] for p in c[2]]
            hh = max(ys) - min(ys)
            ww = max(xs) - min(xs)
            if len(c[2]) < 25 * scale:
                continue
            if not (8 * scale <= ww <= 70 * scale and 14 * scale <= hh <= 110 * scale):
                continue
            if c[1] < h * 0.42 or not (0.08 * w <= c[0] <= 0.92 * w):
                continue
            kept.append((len(c[2]), hh, max(ww, 8 * scale), c[0], c[1]))
        if not kept:
            continue
        if anchor:
            near = [k for k in kept if abs(k[3] - gx) < 90 * scale and abs(k[4] - iy) < 140 * scale]
            if near:
                kept = near
        _count, hh, ww, cx, cy = max(kept, key=lambda k: k[0])
        if bones and all(v == v for v in bones):
            hx, hy, fx, fy = bones
            # Distance from the dress to the seated head–foot segment.
            vx, vy = fx - hx, fy - hy
            seg = vx * vx + vy * vy
            t = 0 if seg < 1 else max(0, min(1, ((cx - hx) * vx + (cy - hy) * vy) / seg))
            dist = ((cx - (hx + vx * t)) ** 2 + (cy - (hy + vy * t)) ** 2) ** 0.5
            return 'stand' if dist > 48 else 'sit'
        aspect = hh / max(ww, 1)
        # No skeleton projection (qa2 stills): standing day dress is narrower than the sit close-up.
        stand_at = 2.15 if pred is preds[0] else 1.60
        sit_at = 2.05 if pred is preds[0] else 1.50
        if aspect >= stand_at and hh >= 40 * scale:
            return 'stand'
        if aspect <= sit_at:
            return 'sit'
        return 'mid'
    return ''

def inside(x, y, pts):
    c = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-6) + xi):
            c = not c
        j = i
    return c

by_frame = {int(r['frame']): r for r in rows}
prev_cells = None
peaks = {}
water_max = 0
clear_max = 0
for shot in shots:
    n = int(shot.get('n') or 0)
    if n <= 0 or (n - 1) not in by_frame:
        continue
    row = by_frame[n - 1]
    path = os.path.join(frames_dir, shot['file'])
    if not os.path.exists(path):
        continue
    im = Image.open(path).convert('RGB')
    w, h = im.size
    pix = im.load()
    sea = sea_ref(im)
    # Disks on the sample points. The filled quad covers the sea beside the hull when the lens looks along the boat.
    wr = 0
    hits = seen = 0
    for group in (row.get('cockpit') or '').split(';'):
        for pi, part in enumerate(group.split('|')):
            if pi:
                continue
            if ':' not in part:
                continue
            a, b = part.split(':')[:2]
            try:
                sx, sy = float(a), h - float(b)
            except ValueError:
                continue
            if not (12 <= sx < w - 12 and 12 <= sy < h - 12):
                continue
            for y in range(int(sy) - 4, int(sy) + 5, 2):
                for x in range(int(sx) - 4, int(sx) + 5, 2):
                    if (x - sx) ** 2 + (y - sy) ** 2 > 16:
                        continue
                    seen += 1
                    p = pix[x, y]
                    if p[2] > p[0] + 28 and p[2] > 120 and dist(p, sea) < 70:
                        hits += 1
    wr = (hits / seen) if seen else 0
    try:
        gx, gy = float(row.get('gsx') or 'nan'), float(row.get('gsy') or 'nan')
    except ValueError:
        gx = gy = float('nan')
    if gx == gx and gy == gy:
        iy = h - gy
        count = 0
        for y in range(max(0, int(iy - 70)), min(h, int(iy + 50))):
            for x in range(max(0, int(gx - 40)), min(w, int(gx + 40))):
                p = pix[x, y]
                if p[0] > 110 and p[1] > 80 and p[2] < 180 and p[0] > p[2] + 12 and p[1] > p[2]:
                    count += 1
        row['girlPx'] = str(count)
        row['screenPose'] = screen_pose(im, gx, iy, bone_box(row, h))
    else:
        row['screenPose'] = screen_pose(im, float('nan'), float('nan'), bone_box(row, h))
    if float(row.get('real') or 0) > 1:
        water_max = max(water_max, wr)
    # Clear-color holes: near-black or the camera clear, outside the top/bottom chrome.
    cr = row.get('clear') or '0:0:0'
    try:
        clear = tuple(int(float(x)) for x in cr.split(':')[:3])
    except ValueError:
        clear = (0, 0, 0)
    if max(clear) <= 1:
        clear = tuple(int(c * 255) for c in clear)
    holes = seen = 0
    for y in range(int(h * 0.08), int(h * 0.88), 4):
        for x in range(0, w, 4):
            seen += 1
            if dist(pix[x, y], clear) < 8:
                holes += 1
    hr = holes / seen if seen else 0
    clear_max = max(clear_max, hr)
    cells = []
    gw, gh = 8, 16
    cw, ch = w / gw, h / gh
    for gy in range(gh):
        for gx in range(gw):
            acc = npx = 0
            for y in range(int(gy * ch), int((gy + 1) * ch), 3):
                for x in range(int(gx * cw), int((gx + 1) * cw), 3):
                    if 0 <= x < w and 0 <= y < h:
                        acc += luma(pix[x, y])
                        npx += 1
            cells.append(acc / npx if npx else 0)
    beat = row.get('beat') or ''
    if prev_cells and len(prev_cells) == len(cells) and beat == prev_cells[0]:
        for i, (a, b) in enumerate(zip(prev_cells[1], cells)):
            d = b - a
            key = (beat, i)
            hist = peaks.setdefault(key, [])
            hist.append(d)
    prev_cells = (beat, cells)
    row['water'] = f'{wr:.4f}'
    row['clearRatio'] = f'{hr:.4f}'
    row['luma'] = f'{sum(cells)/len(cells):.2f}'

flicker = []
for (beat, i), hist in peaks.items():
    count = 0
    for k in range(1, len(hist)):
        a, b = hist[k - 1], hist[k]
        if abs(a) > 18 and abs(b) > 12 and a * b < 0 and abs(b) > abs(a) * 0.55:
            count += 1
    if count >= 2:
        flicker.append({'beat': beat, 'cell': i, 'peaks': count})

fieldnames = list(rows[0].keys())
for extra in ('water', 'clearRatio', 'luma', 'screenPose'):
    if extra not in fieldnames:
        fieldnames.append(extra)
with open(csv_path, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
def seaish(p):
    return p[2] > p[0] + 12 and p[2] > 60 and luma(p) < 210

plank = {}
for view in ('side-a', 'side-b', 'stern-a', 'stern-b', 'three-a', 'three-b'):
    on_p = os.path.join(frames_dir, view + '-on.png')
    off_p = os.path.join(frames_dir, view + '-off.png')
    if not (os.path.exists(on_p) and os.path.exists(off_p)):
        continue
    on, off = Image.open(on_p).convert('RGB'), Image.open(off_p).convert('RGB')
    if on.size != off.size:
        plank[view] = -1
        continue
    pa, pb = on.load(), off.load()
    w, h = on.size
    extra = 0
    for y in range(h):
        for x in range(w):
            p, q = pa[x, y], pb[x, y]
            if (not seaish(p)) and seaish(q) and dist(p, q) > 36:
                extra += 1
    plank[view] = extra

summary = {'waterMax': round(water_max, 4), 'clearMax': round(clear_max, 4), 'flickerCells': flicker[:12], 'flicker': len(flicker), 'plankPx': plank}
open(os.path.join(frames_dir, 'pixels.json'), 'w').write(json.dumps(summary))
side = csv_path.replace('metrics_', 'pixels_').replace('.csv', '.json')
open(side, 'w').write(json.dumps(summary))
print(json.dumps(summary))
