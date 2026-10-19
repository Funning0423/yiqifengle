#!/usr/bin/env python3
"""运镜bot r10 spec comparison plot (PIL only). Input: r10_check.cjs --trace JSON (pitch 10, dist 3.35 sweep).
python3 plot_r10.py TRACE.json OUT.png "label line" """
import json, sys
from PIL import Image, ImageDraw, ImageFont
T = json.load(open(sys.argv[1])); out = sys.argv[2]; label = sys.argv[3] if len(sys.argv) > 3 else ''
F = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', s)
Wd, X0, X1 = 1500, 110, 1460; PH, GAP, TOP = 300, 70, 230
X_LO, X_HI = -100.0, 100.0
def wrap(d):
    d = (d + 180) % 360 - 180
    return d
def xs(th): return X0 + (wrap(th) - X_LO) / (X_HI - X_LO) * (X1 - X0)
panels = [
    ('blend weight w(θ)   (r9: direction-only slerp weight)', 'w', 0, 1.05, [], None),
    ('camera-added angle = view heading − room-view heading (deg)', 'added', -100, 100, [0], None),
    ('view curvature |dΩ/dθ| (1/deg), clipped at 0.3   — κ = 110/30² = 0.122', 'curv', 0, 0.3, [110/900], 'κ'),
    ('her centre on screen, NDC x   (|x| ≤ 1 = in frame)', 'cx', -3, 3, [-1, 1], None),
]
H = TOP + len(panels) * (PH + GAP) + 40
im = Image.new('RGB', (Wd, H), 'white'); d = ImageDraw.Draw(im)
d.text((X0, 18), 'r10 spec: aim-point + position + framing blend vs r9-style direction blend (pitch 10°, dist 3.35)', fill='black', font=F(26))
import textwrap
for j, ln in enumerate(textwrap.wrap(label, 130)): d.text((X0, 58 + 24 * j), ln, fill=(60, 60, 60), font=F(18))
d.text((X0, 120), 'blue = r10 (smootherstep W50, envelope k3, satW30)    red = r9-style approximation (static roomGoalAt + 60° smoothstep slerp, no followers)', fill=(60, 60, 60), font=F(17))
d.text((X0, 146), 'shaded = r10 band 0<w<1; dashed green = r10 w = w* (0.32): her centre is guaranteed in frame only while w ≤ w*', fill=(60, 60, 60), font=F(17))
def series(rows, key, lo, hi, y0):
    pts = []
    for r in sorted(rows, key=lambda r: wrap(r['th'])):
        x = wrap(r['th'])
        if x < X_LO or x > X_HI: continue
        v = r[key]; v = max(lo, min(hi, v))
        pts.append((xs(r['th']), y0 + PH - (v - lo) / (hi - lo) * PH))
    return pts
band = [wrap(r['th']) for r in T['r10'] if 0 < r['w'] < 1]
wstar = 0.3174
for i, (title, key, lo, hi, refs, reflab) in enumerate(panels):
    y0 = TOP + i * (PH + GAP)
    # band shading
    for r in T['r10']:
        if 0 < r['w'] < 1 and X_LO <= wrap(r['th']) <= X_HI:
            x = xs(r['th']); d.line([(x, y0), (x, y0 + PH)], fill=(235, 240, 250), width=3)
    d.rectangle([X0, y0, X1, y0 + PH], outline='black')
    d.text((X0, y0 - 26), title, fill='black', font=F(19))
    for v in (lo, (lo + hi) / 2, hi):
        y = y0 + PH - (v - lo) / (hi - lo) * PH; d.text((10, y - 9), f'{v:g}', fill='black', font=F(15))
    for v in refs:
        y = y0 + PH - (v - lo) / (hi - lo) * PH; d.line([(X0, y), (X1, y)], fill=(120, 120, 120), width=1)
        if reflab: d.text((X1 - 40, y - 22), reflab, fill=(120, 120, 120), font=F(16))
    # w* markers
    prev = None
    for r in sorted(T['r10'], key=lambda r: wrap(r['th'])):
        if prev is not None and (prev['w'] - wstar) * (r['w'] - wstar) < 0 and X_LO <= wrap(r['th']) <= X_HI:
            x = xs(r['th'])
            for yy in range(int(y0), int(y0 + PH), 12): d.line([(x, yy), (x, yy + 6)], fill=(0, 150, 0), width=2)
        prev = r
    for rows, col in ((T['r9'], (210, 40, 40)), (T['r10'], (30, 80, 210))):
        p = series(rows, key, lo, hi, y0)
        for a, b in zip(p, p[1:]):
            if abs(a[0] - b[0]) < 40: d.line([a, b], fill=col, width=3)
    for v in range(-100, 101, 20):
        x = xs(v); d.line([(x, y0 + PH), (x, y0 + PH + 6)], fill='black'); d.text((x - 16, y0 + PH + 8), f'{v % 360}°', fill='black', font=F(14))
d.text((X0, H - 34), 'x axis: input yaw θ (deg). Orbit core [330°, 14°] (w = 0). Room look w = 1 beyond 50° of band on each side.', fill=(60, 60, 60), font=F(16))
im.save(out); print(out, im.size)
