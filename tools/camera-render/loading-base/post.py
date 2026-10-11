# Post: soft focus + warm cream grade + title-band veil + bottom cream mist, then size-targeted JPEG/WebP export.
# python3 post.py RAW.png MASK.png OUTDIR
import sys, os, io, json, subprocess, numpy as np, cv2
TMP = os.environ.get('LB_TMP', '/tmp')  # 中间文件目录，可用 LB_TMP 覆盖
from PIL import Image
raw, maskp, out = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 750, 1624
CREAM = np.array([246, 236, 214.]); MIST = np.array([250, 243, 229.]); VEIL = np.array([253, 248, 237.])
def build(bg_sigma, girl_sigma, cream_mix, lift, veil_peak, mist_peak, sat):
    im = np.array(Image.open(raw).convert('RGB')).astype(np.float32)
    m = (np.array(Image.open(maskp).convert('L')).astype(np.float32) / 255.)
    m = cv2.GaussianBlur(cv2.dilate(m, np.ones((15, 15))), (0, 0), 10)[..., None]   # feathered girl matte
    bg = cv2.GaussianBlur(im, (0, 0), bg_sigma); fg = cv2.GaussianBlur(im, (0, 0), girl_sigma)
    x = fg * m + bg * (1 - m)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    # bottom 25%: extra-heavy blur so rug stripes/floor seams vanish before the mist
    heavy = cv2.GaussianBlur(x, (0, 0), 26); t = np.clip((y - 0.64) / 0.12, 0, 1)
    x = x * (1 - t) + heavy * t
    # grade: desaturate a touch, warm toward cream, lift shadows
    g = x.mean(-1, keepdims=True); x = g + (x - g) * sat
    x = x * (1 - cream_mix) + CREAM * cream_mix
    x = lift + x * (1 - lift / 255.)
    # title band 18-32% (logo y=316, title y=452): soft bright veil, peak 17-33%, ramps 10%->17% and 33%->41%
    v = np.clip(np.minimum((y - 0.10) / 0.07, (0.41 - y) / 0.08), 0, 1); v = (v * v * (3 - 2 * v)) * veil_peak
    x = x * (1 - v) + VEIL * v
    # bottom mist: starts at 66%, reaches mist_peak by 78% (progress bar centre y=1292 = 79.6%), bar/hint area stays flat cream
    s = np.clip((y - 0.66) / 0.12, 0, 1); s = s * s * (3 - 2 * s) * mist_peak
    x = x * (1 - s) + MIST * s
    return Image.fromarray(np.clip(x, 0, 255).astype(np.uint8))
def jpeg_bytes(img, q):
    b = io.BytesIO(); img.save(b, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=2); return b.getvalue()
def best_jpeg(img, limit):
    for q in range(95, 30, -1):
        d = jpeg_bytes(img, q)
        if len(d) <= limit: return q, d
def best_webp(img, limit):
    img.save(os.path.join(TMP, '_lb.png'))
    for q in range(95, 20, -3):
        subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', '-sharp_yuv', os.path.join(TMP, '_lb.png'), '-o', os.path.join(TMP, '_lb.webp')], check=True)
        d = open(os.path.join(TMP, '_lb.webp'), 'rb').read()
        if len(d) <= limit: return q, d
def bottom_stats(img):
    a = np.array(img.convert('L')).astype(float)[int(H * 0.75):]
    return dict(min=int(a.min()), max=int(a.max()), std=round(float(a.std()), 2))
V = {
  'final':     dict(bg_sigma=7.0, girl_sigma=2.2, cream_mix=0.16, lift=14, veil_peak=0.42, mist_peak=0.88, sat=0.86),
  'alt_softer_brighter': dict(bg_sigma=10.0, girl_sigma=3.2, cream_mix=0.22, lift=22, veil_peak=0.50, mist_peak=0.90, sat=0.80),
}
ONLY = os.environ.get('LB_VARIANTS'); PREFIX = os.environ.get('LB_PREFIX', 'loading_base_')
if ONLY: V = {k: V[k] for k in ONLY.split(',')}
MAIN_Q = int(os.environ.get('LB_JPEG_Q', '85'))   # main JPEG quality (in-scene layer, cap 90 KB)
rep = {}
os.makedirs(out, exist_ok=True)
for name, p in V.items():
    img = build(**p); img.save(os.path.join(TMP, f'lb_{name}.png'))
    q = MAIN_Q; d = jpeg_bytes(img, q); assert len(d) <= 90_000, len(d)
    open(f'{out}/{PREFIX}{name}.jpg', 'wb').write(d)
    wq, wd = best_webp(img, len(d)); wq = min(wq, 85)
    subprocess.run(['cwebp', '-quiet', '-q', str(wq), '-m', '6', '-sharp_yuv', os.path.join(TMP, f'lb_{name}.png'), '-o', f'{out}/{PREFIX}{name}.webp'], check=True)
    wd = open(f'{out}/{PREFIX}{name}.webp', 'rb').read()
    r = dict(params=p, jpeg_q=q, jpeg_bytes=len(d), webp_q=wq, webp_bytes=len(wd), bottom25_luma=bottom_stats(img))
    if name == 'final':   # first-screen.js budget variant (base alone <= ~50 KB so base+title+track <= 60 KB)
        q2, d2 = best_jpeg(img, 48_000); q2 = min(q2, 80); d2 = jpeg_bytes(img, q2); open(f'{out}/{PREFIX}final_fs50k.jpg', 'wb').write(d2)
        r.update(fs50k_jpeg_q=q2, fs50k_bytes=len(d2))
    rep[name] = r
json.dump(rep, open(f'{out}/{PREFIX}post_report.json', 'w'), indent=1, ensure_ascii=False); print(json.dumps(rep, indent=1))
