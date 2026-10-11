"""Diff + contact sheets for render_first_screen.cjs output (GGbot). Usage: python3 compare_renders.py <render dir>"""
import sys, json, numpy as np
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]
B = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 26, index=2)
R = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 18, index=2)
arr = lambda p: np.asarray(Image.open(p).convert('RGB')).astype(int)
rep = {}
for n in ['16x9', '19.5x9', '4x3']:
    a, e, l = arr(f'{D}/fs_{n}.png'), arr(f'{D}/fs_after_end_{n}.png'), arr(f'{D}/layer0_{n}.png')
    d = np.abs(a - l).max(2)
    rep[n] = {'fs_vs_layer0': {'mean': round(float(np.abs(a - l).mean()), 3), 'p99': float(np.percentile(d, 99)), 'max': int(d.max())},
              'fs_vs_after_end_max': int(np.abs(a - e).max()), 'black_px': int((a.sum(2) < 30).sum())}
    s = rep[n]['fs_vs_layer0']
    amp = Image.fromarray(np.clip(d * 10, 0, 255).astype(np.uint8)).convert('RGB')
    cols = [(Image.open(f'{D}/fs_{n}.png').convert('RGB'), '① 首帧 first-screen.js（真 WebGL）'), (Image.open(f'{D}/layer0_{n}.png').convert('RGB'), '② 加载层接手帧（风车/填充/提示 = 透明）'),
            (amp, '③ ①−② 差异 ×10'), (Image.open(f'{D}/layer_intro_{n}.png').convert('RGB'), '④ 接手 0.25 s 后（淡入完）'), (Image.open(f'{D}/layer50_{n}.png').convert('RGB'), '⑤ 50%')]
    W, H = cols[0][0].size; tw, th = W // 2, H // 2
    out = Image.new('RGB', (len(cols) * (tw + 16) + 16, th + 120), (250, 246, 236)); dr = ImageDraw.Draw(out)
    dr.text((16, 10), f'{n}  画布 {W}×{H}  ①vs②：平均 {s["mean"]}/255，99 分位 {s["p99"]}，最大 {s["max"]}（只在缩放边缘）；end() 后画面不变（最大差 {rep[n]["fs_vs_after_end_max"]}）', font=B, fill=(63, 94, 99))
    for i, (im, lab) in enumerate(cols):
        x = 16 + i * (tw + 16); out.paste(im.resize((tw, th), Image.LANCZOS), (x, 100)); dr.text((x, 62), lab, font=R, fill=(99, 63, 33))
    out.save(f'{D}/compare_{n}.jpg', quality=88)
json.dump(rep, open(f'{D}/diff_stats.json', 'w'), indent=1); print(json.dumps(rep))
