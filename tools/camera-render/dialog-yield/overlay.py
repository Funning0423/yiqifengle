# 运镜bot r5 dialog yield: draw the IMPLEMENT.md bubble / tail / name capsule (1 line, compact tier) on bl_dialog.py renders.
# python3 overlay.py RAW_DIR OUT_DIR  (reads <W>x<H>_<closed|open>.png/.json)
import json, os, sys, math
from PIL import Image, ImageDraw, ImageFont
raw, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
def layout(W, H, g, hx):
    reg = H >= 700 and W >= 360; lh, pt, pb = (26, 24, 20) if reg else (24, 22, 18)
    bw = min(W - 28, 480); x0 = (W - bw) / 2; x1 = x0 + bw; bottom = H - 34 - 16; Wt = 64
    tx = min(x1 - 41, max(max(x0 + 41, x0 + 20 + Wt + 8 + 11), hx)); keep = g[3] + 13
    if tx + 11 > g[0] - 13 and tx - 11 < g[2] + 13: keep = max(keep, g[3] + 25)
    if x0 + 20 + Wt > g[0] - 13 and x0 + 20 < g[2] + 13: keep = max(keep, g[3] + 29)
    fit = math.floor((bottom - keep - pt - pb) / lh); n = min(3, max(1, fit)); top = bottom - (pt + n * lh + pb)
    R = dict(bubble=(x0, top, x1, bottom), tail=(tx - 11, top - 12, tx + 11, top), name=(x0 + 20, top - 16, x0 + 20 + Wt, top + 16))
    def gap(a, b): return math.hypot(max(0, a[0] - b[2], b[0] - a[2]), max(0, a[1] - b[3], b[1] - a[3]))
    k = min(R, key=lambda k: gap(g, R[k])); return fit, n, R, gap(g, R[k]), k
try: font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 26)
except Exception: font = ImageFont.load_default()
tiles = []
for scr in ('390x520', '320x568'):
    for st in ('closed', 'open'):
        info = json.load(open(os.path.join(raw, f'{scr}_{st}.json'))); W, H, S = info['W'], info['H'], info['scale']
        im = Image.open(os.path.join(raw, f'{scr}_{st}.png')).convert('RGB'); d = ImageDraw.Draw(im, 'RGBA')
        g = info['girl_bbox_pt']; fit, n, R, gap, by = layout(W, H, g, info['girl_head_pt'][0]); ok = fit >= 1 and gap >= 13
        col = (40, 200, 90, 255) if ok else (230, 40, 40, 255)
        sc = lambda r: [v * S for v in r]
        d.rectangle(sc(g), outline=(255, 210, 0, 255), width=3)
        d.rectangle(sc((g[0] - 13, g[1] - 13, g[2] + 13, g[3] + 13)), outline=(255, 210, 0, 120), width=1)
        d.rounded_rectangle(sc(R['bubble']), radius=18 * S, fill=(255, 250, 240, 150), outline=col, width=4)
        d.rectangle(sc(R['tail']), outline=col, width=3); d.rounded_rectangle(sc(R['name']), radius=16 * S, fill=(255, 220, 170, 170), outline=col, width=3)
        cam = info['camera']; dy = cam['target'][1] - 0.86
        lab = f"{scr} 对话{'关' if st == 'closed' else '开'}  俯 {'0' if st == 'closed' else ('%.2f°' % (2.6 if scr == '390x520' else 2.103))} (目标 {dy:+.3f} m)\nfit={fit} 行  间距 {gap:.1f} pt ({by})  {'OK' if ok else '不够'}"
        d.rectangle((0, 0, W * S, 70), fill=(0, 0, 0, 150)); d.multiline_text((12, 6), lab, fill=(255, 255, 255, 255), font=font, spacing=4)
        im.save(os.path.join(out, f'CHECK_{scr}_{st}.png')); tiles.append(im); print(scr, st, 'fit', fit, 'gap %.1f' % gap, by, g)
h = max(t.height for t in tiles); sheet = Image.new('RGB', (sum(t.width for t in tiles) + 30, h), (30, 30, 30)); x = 0
for t in tiles: sheet.paste(t, (x, 0)); x += t.width + 10
sheet = sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS); sheet.save(os.path.join(out, 'CHECK_sheet_closed_vs_open.jpg'), quality=85)
