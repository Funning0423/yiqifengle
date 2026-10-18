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
    wr = 0
    for group in (row.get('cockpit') or '').split(';'):
        raw = []
        for part in group.split('|'):
            if ':' not in part:
                continue
            a, b = part.split(':')[:2]
            try:
                raw.append((float(a), float(b)))
            except ValueError:
                pass
        mask = poly(raw, w, h)
        water = total = 0
        if len(mask) >= 3 and all(8 < p[0] < w - 8 and 8 < p[1] < h - 8 for p in mask):
            minx = max(0, int(min(p[0] for p in mask)) - 1)
            maxx = min(w - 1, int(max(p[0] for p in mask)) + 1)
            miny = max(0, int(min(p[1] for p in mask)) - 1)
            maxy = min(h - 1, int(max(p[1] for p in mask)) + 1)
            for y in range(miny, maxy + 1, 2):
                for x in range(minx, maxx + 1, 2):
                    if not inside(x, y, mask):
                        continue
                    total += 1
                    p = pix[x, y]
                    if p[2] > p[0] + 28 and p[2] > 120 and dist(p, sea) < 70:
                        water += 1
        if total:
            wr = max(wr, water / total)
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
                if p[0] > 150 and p[1] > 110 and p[2] < 155 and p[0] + p[1] > p[2] * 2.2:
                    count += 1
        row['girlPx'] = str(count)
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
for extra in ('water', 'clearRatio', 'luma'):
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
            if dist(p, q) > 36 and seaish(q):
                extra += 1
    plank[view] = extra

summary = {'waterMax': round(water_max, 4), 'clearMax': round(clear_max, 4), 'flickerCells': flicker[:12], 'flicker': len(flicker), 'plankPx': plank}
open(os.path.join(frames_dir, 'pixels.json'), 'w').write(json.dumps(summary))
side = csv_path.replace('metrics_', 'pixels_').replace('.csv', '.json')
open(side, 'w').write(json.dumps(summary))
print(json.dumps(summary))
