# MOCK ONLY: overlay 棋盘UI美术bot's slices (a-loading/slices, layout from a-loading/README) on our base to check legibility,
# and build the WeChat first-screen composite (base + logo + title + EMPTY track) to check the <=60 KB budget.
# python3 mock.py BASE.jpg OUTDIR TAG
import sys, io, os, numpy as np
from PIL import Image, ImageDraw, ImageFont
A = os.environ.get('LB_UI_DIR', '/workspace/yiqifengle/previews/棋盘UI美术bot/a-loading'); import math, types  # 棋盘UI美术bot 切图目录，可用 LB_UI_DIR 覆盖
# constants copied from a-loading/src/gen.py (importing gen needs the 25 MB font file)
gen = types.SimpleNamespace(BL=480, ribbon_y=lambda x: 44 / 2 + 5.0 * math.sin(2 * math.pi * x / 135.0))
S = A + '/slices'; base, out, tag = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 750, 1624; BY = 1270; PAD = 8   # track top 1270 => centre 1292 (README)
L = lambda n: Image.open(f'{S}/{n}.png').convert('RGBA')
title, logo, track, fill, pin = L('title'), L('logo'), L('bar_track'), L('bar_fill'), L('pinwheel')
BX = (W - track.width) // 2
font = ImageFont.truetype(os.environ.get('LB_FONT', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'), 28, index=2)
tagf = ImageFont.truetype(os.environ.get('LB_FONT', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'), 18, index=2)
def frame(p, angle, tip, label=True, bar=True, hint=True):
    im = Image.open(base).convert('RGBA')
    im.alpha_composite(logo, ((W - logo.width) // 2 + 18, 316 - logo.height // 2))
    im.alpha_composite(title, ((W - title.width) // 2, 452 - title.height // 2))
    im.alpha_composite(track, (BX, BY))
    if bar:
        fx = PAD + round(gen.BL * p / 100)
        im.alpha_composite(fill.crop((0, 0, fx, fill.height)), (BX, BY))
        pr = pin.rotate(angle, resample=Image.BICUBIC); hy = BY + gen.ribbon_y(gen.BL * p / 100)
        im.alpha_composite(pr, (round(BX + fx - pr.width / 2), round(hy - pr.height / 2)))
    d = ImageDraw.Draw(im)
    if hint:
        w = d.textlength(tip, font=font)
        d.text(((W - w) / 2 + 1, BY + 71), tip, font=font, fill=(255, 250, 238, 180)); d.text(((W - w) / 2, BY + 70), tip, font=font, fill=(63, 94, 99, 255))
    if label: d.text((18, H - 34), 'MOCK · 底图=运镜bot 离线渲染 cameraHome（Blender，非实机）· 切图=棋盘UI美术bot', font=tagf, fill=(63, 94, 99, 150))
    return im.convert('RGB')
os.makedirs(out, exist_ok=True)
panels = [frame(0, 0, '风从海上来……'), frame(50, 35, '她在窗前坐下……'), frame(100, 70, '灯塔小屋准备好了')]
panels[1].save(f'{out}/mock_composite_{tag}_050.jpg', quality=88)
strip = Image.new('RGB', (W * 3 + 40, H), (255, 255, 255))
for i, p in enumerate(panels): strip.paste(p, (i * (W + 20), 0))
strip.resize((strip.width // 2, H // 2), Image.LANCZOS).save(f'{out}/mock_composite_{tag}_0-50-100.jpg', quality=85)
# first-screen composite: base + logo + title + empty track, no hint text, no label, no Cocos logo
fs = frame(0, 0, '', label=False, bar=False, hint=False)
for q in range(92, 40, -1):
    b = io.BytesIO(); fs.save(b, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=2)
    if len(b.getvalue()) <= 58_000: break
open(f'{out}/firstscreen_composite_{tag}.jpg', 'wb').write(b.getvalue()); print('firstscreen', tag, 'q', q, len(b.getvalue()))
