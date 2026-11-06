# Refine e976 face atlas in place: clearer almond eyes (between e976 & round2 size, less shiny),
# soft nose/mouth, gentle blush. Keeps original UV layout / blink cells / collar yellow.
import sys, math, io, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gltfio import G

SRC, DST = sys.argv[1], sys.argv[2]
g = G(SRC)
data, bv = g.image_bytes('T_G2_FACE_1024')
im = Image.open(io.BytesIO(data)).convert('RGB')
S = im.size[0]
skin = np.array(im.getpixel((256, 780)), dtype=np.float32)

# Soft-cover old eye/brow/nose/mouth in open + half + closed cells, keep collar/skin elsewhere
cover = Image.new('RGB', (S, S), tuple(int(x) for x in skin))
mask = Image.new('L', (S, S), 0); md = ImageDraw.Draw(mask)
for box in [
    (55, 630, 235, 840), (280, 630, 460, 840),  # open eyes+brows
    (200, 820, 330, 970),  # nose+mouth open
    (55, 60, 235, 300), (280, 60, 460, 300),  # half cell
    (560, 630, 760, 840), (790, 630, 990, 840),  # closed cell eyes
]:
    md.rounded_rectangle(box, radius=20, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(10))
im = Image.composite(cover, im, mask)
d = ImageDraw.Draw(im, 'RGBA')

# gentle blush (softer / lower than doll circles)
bl = Image.new('L', (S, S), 0); bd = ImageDraw.Draw(bl)
for cx in (150, 365):
    bd.ellipse([cx - 58, 810, cx + 58, 868], fill=75)
bl = bl.filter(ImageFilter.GaussianBlur(16))
im.paste(Image.new('RGB', (S, S), (242, 168, 158)), (0, 0), bl)
d = ImageDraw.Draw(im, 'RGBA')

# soft nose (paint only)
for i, a in enumerate([0.35, 0.22, 0.14]):
    y = 860 + i * 12
    d.ellipse([254, y - 5, 268, y + 6], fill=(220, 178, 162, int(70 * a)))
d.ellipse([252, 908, 272, 918], fill=(224, 182, 166, 60))

# soft small mouth
pts = [(256 + (k / 16 * 2 - 1) * 22, 932 + 1.6 * math.sin(k / 16 * math.pi)) for k in range(17)]
d.line(pts, fill=(170, 102, 98, 205), width=2, joint='curve')

# thin soft brows
BROW = (72, 52, 46)
for cx in (148, 368):
    pts = [(cx + (a - 0.5) * 100, 658 - 5 * math.sin(a * math.pi)) for a in [k / 17 for k in range(18)]]
    d.line(pts, fill=BROW + (215,), width=3, joint='curve')

# Eyes: between e976 (~60px round shiny) and round2 (larger); almond, one highlight, upper lash
LASH = (42, 30, 28); IRIS_D = (70, 44, 34); IRIS_L = (125, 85, 55); WHITE = (252, 248, 244)

def eye(cx, cy, sx, state='open'):
    # ~52x42 — between original and round2, not tiny dots
    w, h = 58, 46
    dd = ImageDraw.Draw(im, 'RGBA')
    if state == 'closed':
        pts = [(cx + (k / 24 * 2 - 1) * w, cy + 3 * math.sin(k / 24 * math.pi)) for k in range(25)]
        dd.line(pts, fill=LASH, width=3, joint='curve'); return
    n = 28; poly = []
    for k in range(n):
        a = k / (n - 1)
        x = cx + (a * 2 - 1) * w * (1.04 if ((a < 0.5) == (sx < 0)) else 1.10)
        poly.append((x, cy - h * (0.48 * math.sin(a * math.pi) ** 0.9 + 0.08)))
    for k in range(n - 1, -1, -1):
        a = k / (n - 1)
        x = cx + (a * 2 - 1) * w * (1.04 if ((a < 0.5) == (sx < 0)) else 1.10)
        poly.append((x, cy + h * (0.38 * math.sin(a * math.pi) ** 1.05 + 0.06)))
    emask = Image.new('L', (S, S), 0); ImageDraw.Draw(emask).polygon(poly, fill=255)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    ld.polygon(poly, fill=WHITE + (255,))
    iw, ih = w * 0.60, h * 0.86
    gw, gh = max(2, int(2 * iw) + 2), max(2, int(2 * ih) + 2)
    garr = np.zeros((gh, gw, 4), np.uint8)
    yy, xx = np.mgrid[0:gh, 0:gw]
    e = ((xx - iw) / (iw + 1e-6)) ** 2 + ((yy - ih) / (ih + 1e-6)) ** 2 <= 1
    t = (yy / max(1, gh - 1))[..., None]
    col = np.array(IRIS_D) * (1 - 0.32 * t) + np.array(IRIS_L) * (0.32 * t)
    garr[..., :3] = col.astype(np.uint8); garr[..., 3] = (e * 255).astype(np.uint8)
    ir = Image.fromarray(garr)
    iy = cy - ih * 0.52 if state == 'open' else cy - ih * 0.12
    layer.paste(ir, (int(cx - iw), int(iy)), ir); ld = ImageDraw.Draw(layer)
    # single modest highlight (not anime twin sparkles)
    hs = 6
    ld.ellipse([cx - iw * 0.22 - hs, iy + ih * 0.22 - hs, cx - iw * 0.22 + hs, iy + ih * 0.22 + hs], fill=(255, 255, 255, 185))
    if state == 'half':
        sk = tuple(int(x) for x in skin)
        ld.polygon([(cx - w * 1.3, cy - h * 2), (cx + w * 1.3, cy - h * 2), (cx + w * 1.3, cy + 2), (cx - w * 1.3, cy + 2)], fill=sk + (230,))
    a = Image.composite(layer.getchannel('A'), Image.new('L', (S, S), 0), emask)
    im.paste(layer, (0, 0), a)
    dd = ImageDraw.Draw(im, 'RGBA')
    lid = [(cx + (k / (n - 1) * 2 - 1) * w * 1.04, cy - h * (0.48 * math.sin(k / (n - 1) * math.pi) ** 0.9 + 0.10) - 1) for k in range(n)]
    top = []
    for k, (x, y) in enumerate(lid):
        o = (k / (n - 1)) if sx > 0 else 1 - k / (n - 1)
        top.append((x, y - 1.2 - 1.8 * o ** 1.3))
    dd.polygon(lid + top[::-1], fill=LASH)

eye(148, 748, -1, 'open'); eye(368, 748, 1, 'open')
eye(148, 165, -1, 'half'); eye(368, 165, 1, 'half')
eye(670, 748, -1, 'closed'); eye(900, 748, 1, 'closed')

im.save(Path(DST).parent / 'tex' / 'face_sample_preview.png')
b = io.BytesIO(); im.save(b, 'JPEG', quality=92); g.replace_view(bv, b.getvalue()); g.save(DST)
print('sample face painted', DST)
