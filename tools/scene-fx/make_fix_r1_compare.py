# QA only (场景特效bot r5 S3 fix_r1): side-by-side before/after stills with SHA labels, optional zoom insets.
#   python3 make_fix_r1_compare.py spec.json
# spec: {out, title, note?, rows:[{before, after, label?, zoom?:[x0,y0,x1,y1] (source px, shown under both), beforeZoom?/afterZoom?: high-res
#   render of that same rect (blender_fix_r1_scene.py border), tagBefore?/tagAfter?/shaBefore?/shaAfter? per row}], shaBefore, shaAfter, width?}
import json, sys
from PIL import Image, ImageDraw, ImageFont
F = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'; FB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
J = json.load(open(sys.argv[1])); W = J.get('width', 540)
def font(p, s):
    try: return ImageFont.truetype(p, s)
    except Exception: return ImageFont.load_default()
f, fb = font(F, 20), font(FB, 24)
def tile(path, tag, sha, zoom, zimg=None):
    im = Image.open(path).convert('RGB'); s = W / im.width; main = im.resize((W, round(im.height * s)), Image.LANCZOS)
    parts = [main]
    if zoom:
        z = Image.open(zimg).convert('RGB') if zimg else im.crop(tuple(zoom)); zs = W / z.width; parts.append(z.resize((W, round(z.height * zs)), Image.LANCZOS))
        d = ImageDraw.Draw(main); d.rectangle([zoom[0] * s, zoom[1] * s, zoom[2] * s, zoom[3] * s], outline=(255, 60, 40), width=3)
    h = sum(p.height for p in parts) + 4 * (len(parts) - 1); t = Image.new('RGB', (W, h), (30, 30, 30)); y = 0
    for p in parts: t.paste(p, (0, y)); y += p.height + 4
    d = ImageDraw.Draw(t); txt = tag + '  ' + sha; bb = d.textbbox((0, 0), txt, font=fb)
    d.rectangle([8, 8, 20 + bb[2], 18 + bb[3]], fill=(0, 0, 0)); d.text((14, 10), txt, font=fb, fill=(255, 255, 255))
    return t
rows = []
for r in J['rows']:
    a = tile(r['before'], r.get('tagBefore', 'BEFORE'), r.get('shaBefore', J['shaBefore']), r.get('zoom'), r.get('beforeZoom'))
    b = tile(r['after'], r.get('tagAfter', 'AFTER'), r.get('shaAfter', J['shaAfter']), r.get('zoom'), r.get('afterZoom'))
    row = Image.new('RGB', (2 * W + 8, max(a.height, b.height) + (32 if r.get('label') else 0)), (245, 245, 245)); y0 = 0
    if r.get('label'): ImageDraw.Draw(row).text((8, 2), r['label'], font=f, fill=(30, 30, 30)); y0 = 32
    row.paste(a, (0, y0)); row.paste(b, (W + 8, y0)); rows.append(row)
note = J.get('note', '')
TW = 2 * W - 8
def wrap(txt, fnt):
    out, cur = [], ''
    for ch in txt:
        if ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(cur + ch, font=fnt) > TW: out.append(cur); cur = ch
        else: cur += ch
    return out + [cur]
lines = wrap(J['title'], fb)
nl = len(lines)
for n in ([note] if isinstance(note, str) and note else (note or [])): lines += wrap(n, f)
head = 6 + 34 * nl + 28 * (len(lines) - nl) + 8
o = Image.new('RGB', (2 * W + 8, head + sum(r.height + 8 for r in rows)), (245, 245, 245)); d = ImageDraw.Draw(o)
for i, l in enumerate(lines[:nl]): d.text((8, 6 + 34 * i), l, font=fb, fill=(20, 20, 20))
for i, l in enumerate(lines[nl:]): d.text((8, 6 + 34 * nl + 28 * i), l, font=f, fill=(60, 60, 60))
y = head
for r in rows: o.paste(r, (0, y)); y += r.height + 8
o.save(J['out']); print('wrote', J['out'], o.size)
