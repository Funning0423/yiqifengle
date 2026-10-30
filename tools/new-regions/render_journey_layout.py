#!/usr/bin/env python3
"""Box-side schematic render of journey_*.layout.json (from test_journey_layout_r4.cjs, QF_R4_LAYOUT_OUT).
Not a Creator render: boxes/labels/seals at their harness geometry in screen pt (2x), day or night tint (K_UI),
inner frame drawn dashed red, 8 pt gaps annotated. Real-engine shots need a Mac web-test build.
usage: render_journey_layout.py <dir>  → writes journey_<mode>_<state>_<W>x<H>.png next to each json"""
import json, sys, glob, os
from PIL import Image, ImageDraw, ImageFont
K_UI = (0.621, 0.591, 0.562); S = 2
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
if not os.path.exists(FONT): FONT = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
def tint(c, night): return tuple(int(round(v * (K_UI[i] if night else 1))) for i, v in enumerate(c))
for fp in sorted(glob.glob(os.path.join(sys.argv[1], 'journey_*.layout.json'))):
    d = json.load(open(fp)); W, H, night, k = d['W'], d['H'], d['mode'] == 'night', d['ptPerLayoutPt']
    F = d['frame']; cx0, cy0 = (F['x0'] + F['x1']) / 2, (F['y0'] + F['y1']) / 2
    X = lambda x: (W / 2 + (x - cx0) / k) * S; Y = lambda y: (H / 2 + (y - cy0) / k) * S
    im = Image.new('RGB', (W * S, H * S), tint((40, 120, 140), night)); g = ImageDraw.Draw(im)
    rect = lambda b, **kw: g.rounded_rectangle([X(b['x0']), Y(b['y0']), X(b['x1']), Y(b['y1'])], **kw)
    rect(F, radius=28 * S, fill=tint((205, 178, 128), night))
    IN = d['innerFrame']; inner = {'x0': IN['x0'], 'x1': IN['x1'], 'y0': F['y0'] + 24 * k, 'y1': F['y1'] - 24 * k}
    rect(inner, radius=14 * S, fill=tint((243, 233, 210), night))
    for y in range(int(Y(inner['y0'])), int(Y(inner['y1'])), 12):  # dashed inner frame edges
        for x in (X(IN['x0']), X(IN['x1'])): g.line([x, y, x, y + 6], fill=(220, 40, 40), width=2)
    if d.get('bar'): rect(d['bar'], radius=5 * S, fill=tint((205, 185, 144), night))
    rect(d['card'], radius=16 * S, fill=tint((255, 246, 226), night))
    def text(l, rgb):
        f = ImageFont.truetype(FONT, int(round(l['pt'] * S)))
        cx = (X(l['x0']) + X(l['x1'])) / 2; cy = (Y(l['y0']) + Y(l['y1'])) / 2; g.text((cx, cy), l['s'], font=f, fill=tuple(rgb), anchor='mm')
    for l in d['card']['labels']:
        f = ImageFont.truetype(FONT, int(round(l['pt'] * S))); g.text((X(l['x0']), (Y(l['y0']) + Y(l['y1'])) / 2), l['s'], font=f, fill=tint((99, 63, 33), night) if not night else (30, 19, 8), anchor='lm')
    for c in d['cells']:
        rect(c, radius=12 * S, fill=tint((232, 219, 190) if c['state'] == 'far' else (251, 243, 224), night))
        if c['seal']:
            s = c['seal']; col = tint((150, 150, 150) if s['faint'] else (200, 140, 70), night)
            g.ellipse([X(s['x0']), Y(s['y0']), X(s['x1']), Y(s['y1'])], outline=col, width=3, fill=tint((215, 210, 200) if s['faint'] else (240, 200, 140), night))
        for l in c['labels']: text(l, l['rgb'])
    gp = d['gaps']; f = ImageFont.truetype(FONT, 8 * S)
    g.text((W * S / 2, (H - 14) * S), f"{d['mode']} {d['state']} {W}x{H}  gap grid {gp['gridL']}/{gp['gridR']} pt card {gp['cardL']}/{gp['cardR']} pt  (box schematic)", font=f, fill=(255, 255, 255), anchor='mm')
    im.save(fp.replace('.layout.json', '.png'))
# region-page schematics (chapter_<id>_<tag>.layout.json): frame, sprites as grey boxes, disabled button pill, labels
for fp in sorted(glob.glob(os.path.join(sys.argv[1], 'chapter_*.layout.json'))):
    d = json.load(open(fp)); W, H, night, k = d['W'], d['H'], d['mode'] == 'night', d['ptPer']
    F = d['frame']; cx0, cy0 = (F['x0'] + F['x1']) / 2, (F['y0'] + F['y1']) / 2
    X = lambda x: (W / 2 + (x - cx0) / k) * S; Y = lambda y: (H / 2 + (y - cy0) / k) * S
    im = Image.new('RGB', (W * S, H * S), tint((40, 120, 140), night)); g = ImageDraw.Draw(im)
    g.rounded_rectangle([X(F['x0']), Y(F['y0']), X(F['x1']), Y(F['y1'])], radius=28 * S, fill=tint((243, 233, 210), night), outline=tint((205, 178, 128), night), width=24 * S)
    for n in d['nodes']:
        if n.get('disabled'): g.rounded_rectangle([X(n['x0']), Y(n['y0']), X(n['x1']), Y(n['y1'])], radius=26 * S, fill=tint((230, 215, 184), night))
        elif n.get('sprite') and n['n'] in ('Window', 'Seal'): g.rectangle([X(n['x0']), Y(n['y0']), X(n['x1']), Y(n['y1'])], outline=tint((150, 150, 150), night), width=2)
    for n in d['nodes']:
        if n.get('label'):
            f = ImageFont.truetype(FONT, max(8, int(round(n['pt'] * S))))
            g.text(((X(n['x0']) + X(n['x1'])) / 2, (Y(n['y0']) + Y(n['y1'])) / 2), n['label'], font=f, fill=tuple(n['rgb']), anchor='mm')
    f = ImageFont.truetype(FONT, 8 * S)
    g.text((W * S / 2, (H - 14) * S), f"{d['region']} region page {d['mode']} {d['state']} {W}x{H} (box schematic)", font=f, fill=(255, 255, 255), anchor='mm')
    im.save(fp.replace('.layout.json', '.png'))
