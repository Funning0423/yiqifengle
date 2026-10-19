# Asset tool (场景特效bot r5 S3 fix_r1, not shipped): bring the two sky textures to the L3 cap (max side 1024, docs/r5/scene-lod-scale.md).
#   python3 sky_tex_downscale.py meadow in.jpg out.jpg [--no-dither] [--deband]
#                                                         4096x1024 -> 1024x512 (4x2 box: 1024x256 blurred the big painted cloud in the meadow board view), box filter in float, RPDF dither +-0.5 LSB, JPEG q92 4:4:4
#   python3 sky_tex_downscale.py night  in.png out.png --deband
#                                                        2048x1024 -> 1024x512, same, plus stars kept: texels whose source block holds a
#                                                        star (>= 18 above its 7x7 median) take the block max, so stars do not dim to 1/4
import sys, numpy as np
from PIL import Image, ImageFilter
kind, src, dst = sys.argv[1:4]; DITHER = '--no-dither' not in sys.argv
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.float64); H, W, _ = a.shape
fx, fy = W // 1024, max(1, H // 512); h, w = H // fy, W // fx  # max side 1024; keep up to 512 rows (meadow 4x2, night 2x2)
box = a.reshape(h, fy, w, fx, 3).mean(axis=(1, 3))
if kind == 'night':
    lum = a.mean(axis=2); med = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.MedianFilter(7))).astype(np.float64)
    star = (lum - med) >= 18
    blk = star.reshape(h, fy, w, fx).any(axis=(1, 3)); mx = a.reshape(h, fy, w, fx, 3).max(axis=(1, 3))
    box[blk] = mx[blk]; print('star texels kept', int(blk.sum()))
def deband(box):
    """Gradient scheme: the sky rows are horizontally uniform, so take each channel's per-row median (clouds/stars/moon are
    a minority of a row), find runs of one 8-bit level, and where neighbouring runs differ by <= 1 LSB replace the staircase
    by a straight ramp through the run centres. The per-row float correction (|c| < 1 LSB) is added to every texel, then
    dithered: the 1-LSB bands of the source become a smooth ramp, clouds/stars/moon keep their pixels."""
    out = box.copy(); hh = box.shape[0]
    for c in range(3):
        p = np.round(np.median(box[:, :, c], axis=1)); runs = []; s0 = 0
        for y in range(1, hh + 1):
            if y == hh or p[y] != p[s0]: runs.append((s0, y - 1, p[s0])); s0 = y
        ky, kv = [], []
        for i, (a0, a1, v) in enumerate(runs): ky.append((a0 + a1) / 2.0); kv.append(v)
        corr = np.zeros(hh)
        for i in range(len(runs) - 1):
            (a0, a1, v0), (b0, b1, v1) = runs[i], runs[i + 1]
            if abs(v1 - v0) > 1: continue
            # ramp from the centre of run i to the centre of run i+1 (only on the gentle steps)
            for y in range(int(np.ceil(ky[i])), int(np.floor(ky[i + 1])) + 1):
                t = (y - ky[i]) / max(1e-9, ky[i + 1] - ky[i]); corr[y] = v0 + (v1 - v0) * t - p[y]
        out[:, :, c] += np.clip(corr, -1, 1)[:, None]
    return out
if '--deband' in sys.argv: box = deband(box)
rng = np.random.default_rng(20261019)
d = rng.random((h, w, 1)) - 0.5  # RPDF +-0.5 LSB, same offset on all channels (no colour noise); PNG stays small
out = np.clip(np.floor(box + 0.5 + (d if DITHER else 0)), 0, 255).astype(np.uint8)
o = Image.fromarray(out, 'RGB')
if dst.lower().endswith('.png'): o.save(dst, optimize=True)
else: o.save(dst, quality=92, subsampling=0, optimize=True)
print(kind, (W, H), '->', (w, h), dst)
# fix_r1 settings (banding = longest run of one 8-bit colour on a 1170 px tall bilinear view of the gradient rows, median of 64 columns):
#   meadow: no --deband (source 150 px, out 146 px median / 155 p90; --deband made it worse, the clouds dominate the row medians); JPEG 87 -> 38 KB
#   night:  --deband (source 190 px, out 98 px: the 1-LSB night bands get shorter than in the original); PNG 109 -> 122 KB
