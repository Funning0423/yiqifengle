# Owner-target face paint on e976 atlas:
# porcelain skin, narrow dark almond eyes, thin upper lash, NO highlight, NO blush,
# mouth/nose barely visible. Preserves UV blink cells + lemon collar swatches.
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

# porcelain cream (cooler/lighter than peach)
PORC = np.array([244, 236, 226], dtype=np.float32)
# lift existing skin toward porcelain (preserve lemon swatches on right)
arr = np.array(im, dtype=np.float32)
# lemon-ish mask (dress swatches) — leave alone
lemon = (arr[:,:,0] > 200) & (arr[:,:,1] > 180) & (arr[:,:,2] < 120)
# brown boot/hair swatches
swatch = (arr[:,:,0] < 120) & (arr[:,:,1] < 90) & (arr[:,:,2] < 70) & (arr[:,:,0] > 40)
# white bar
whitebar = (arr[:,:,0] > 245) & (arr[:,:,1] > 245) & (arr[:,:,2] > 245)
keep = lemon | swatch | whitebar
# blend non-keep toward porcelain
skin_mask = ~keep
# detect old feature residual later via cover boxes; first global porcelain lift on mid tones
lum = arr.mean(2)
faceish = skin_mask & (lum > 140) & (lum < 250)
arr[faceish] = arr[faceish] * 0.35 + PORC * 0.65
im = Image.fromarray(arr.astype(np.uint8))

skin = tuple(int(x) for x in PORC)
cover = Image.new('RGB', (S, S), skin)
mask = Image.new('L', (S, S), 0); md = ImageDraw.Draw(mask)
for box in [
    (40, 600, 480, 980),   # open face features
    (40, 40, 480, 340),    # half cell
    (520, 600, 1000, 900), # closed cell eyes
]:
    md.rounded_rectangle(box, radius=24, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(12))
im = Image.composite(cover, im, mask)
d = ImageDraw.Draw(im, 'RGBA')

# NO blush. Barely-visible nose (optional soft shade)
d.ellipse([252, 888, 268, 900], fill=(230, 214, 200, 35))
# barely-visible mouth
pts = [(256 + (k / 12 * 2 - 1) * 14, 940 + 0.8 * math.sin(k / 12 * math.pi)) for k in range(13)]
d.line(pts, fill=(170, 130, 120, 70), width=1, joint='curve')

# tiny soft brows (almost gone)
BROW = (90, 70, 60, 90)
for cx in (155, 360):
    pts = [(cx + (a - 0.5) * 70, 690 - 3 * math.sin(a * math.pi)) for a in [k / 14 for k in range(15)]]
    d.line(pts, fill=BROW, width=2, joint='curve')

# Narrow dark almond — NO white sclera fill dominance, NO highlight
LASH = (35, 28, 26)
IRIS = (48, 32, 28)
IRIS2 = (70, 48, 40)

def eye(cx, cy, sx, state='open'):
    # much smaller / narrower than e976 (~60) and prior samples (~58)
    w, h = 34, 18  # almond ~1.9:1
    dd = ImageDraw.Draw(im, 'RGBA')
    if state == 'closed':
        pts = [(cx + (k / 20 * 2 - 1) * w, cy + 2.2 * math.sin(k / 20 * math.pi)) for k in range(21)]
        dd.line(pts, fill=LASH + (220,), width=2, joint='curve')
        return
    n = 24
    poly = []
    for k in range(n):
        a = k / (n - 1)
        x = cx + (a * 2 - 1) * w * (1.02 if ((a < 0.5) == (sx < 0)) else 1.08)
        poly.append((x, cy - h * (0.55 * math.sin(a * math.pi) ** 0.85 + 0.05)))
    for k in range(n - 1, -1, -1):
        a = k / (n - 1)
        x = cx + (a * 2 - 1) * w * (1.02 if ((a < 0.5) == (sx < 0)) else 1.08)
        poly.append((x, cy + h * (0.42 * math.sin(a * math.pi) ** 1.1 + 0.04)))
    # dark fill (almost solid iris look — toy figure, no big whites)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    ld.polygon(poly, fill=IRIS + (255,))
    # subtle inner lighter (not a specular)
    iw, ih = w * 0.55, h * 0.70
    ld.ellipse([cx - iw, cy - ih * 0.9, cx + iw, cy + ih * 0.5], fill=IRIS2 + (90,))
    if state == 'half':
        # upper lid covers ~55%
        ld.polygon([
            (cx - w * 1.2, cy - h * 2), (cx + w * 1.2, cy - h * 2),
            (cx + w * 1.2, cy + h * 0.05), (cx - w * 1.2, cy + h * 0.05)
        ], fill=skin + (240,))
    im.paste(layer, (0, 0), layer)
    dd = ImageDraw.Draw(im, 'RGBA')
    # thin upper lash only
    lid = [(cx + (k / (n - 1) * 2 - 1) * w * 1.02,
            cy - h * (0.55 * math.sin(k / (n - 1) * math.pi) ** 0.85 + 0.08)) for k in range(n)]
    dd.line(lid, fill=LASH + (255,), width=2, joint='curve')
    # soft lower lid whisper
    low = [(cx + (k / (n - 1) * 2 - 1) * w * 0.95,
            cy + h * (0.42 * math.sin(k / (n - 1) * math.pi) ** 1.1 + 0.06)) for k in range(n)]
    dd.line(low, fill=(120, 90, 80, 70), width=1, joint='curve')

# slightly lower on face than anime placement
eye(155, 760, -1, 'open'); eye(360, 760, 1, 'open')
eye(155, 175, -1, 'half'); eye(360, 175, 1, 'half')
eye(675, 760, -1, 'closed'); eye(900, 760, 1, 'closed')

texdir = Path(DST).resolve().parent / 'tex'
texdir.mkdir(parents=True, exist_ok=True)
im.save(texdir / 'face_target_preview.png')
b = io.BytesIO(); im.save(b, 'JPEG', quality=93); g.replace_view(bv, b.getvalue()); g.save(DST)
print('target face painted', DST)
