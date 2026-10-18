# 运镜bot r5: plot blend_trace.cjs output (PIL only). python3 plot_blend.py TRACE.json OUT.png
import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); fr = d['frames']
try: F = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 18)
except Exception: F = ImageFont.load_default()
W, H = 1500, 1000; im = Image.new('RGB', (W, H), 'white'); dr = ImageDraw.Draw(im)
dr.text((20, 8), '房间看出模式：yaw 0→360° 以 %d°/s 扫过，%d fps（pitch 10°，臂 3.35 m，含世界碰撞盒）' % (d['rate'], d['fps']), fill='black', font=F)
T = fr[-1]['t']
rows = [('混合权重 w', 'w', 0, 1, None), ('镜头速度 m/s', 'speed', 0, 3, None), ('线加速度 m/s²（上限 3）', 'lin', 0, 3.5, 3), ('角加速度 °/s²（上限 110）', 'ang', 0, 130, 110), ('离内壁 m（下限 0.25）/ 离她 m（下限 1.0）', 'wall', 0, 3, 0.25)]
x0, x1 = 90, 960; top = 50; rh = 180
for i, (name, k, lo, hi, lim) in enumerate(rows):
    y0 = top + i * rh; y1 = y0 + rh - 40
    dr.rectangle((x0, y0, x1, y1), outline='#888'); dr.text((x0, y0 - 2 - 18), name, fill='black', font=F)
    for v in (lo, hi): dr.text((20, (y1 if v == lo else y0) - 9), '%g' % v, fill='#444', font=F)
    X = lambda t: x0 + (x1 - x0) * t / T; Y = lambda v: y1 - (y1 - y0) * (min(max(v, lo), hi) - lo) / (hi - lo)
    if lim is not None: dr.line((x0, Y(lim), x1, Y(lim)), fill='#e33', width=1)
    pts = [(X(f['t']), Y(f[k])) for f in fr if k in f]; dr.line(pts, fill='#1565c0', width=2)
    if k == 'wall':
        dr.line((x0, Y(1.0), x1, Y(1.0)), fill='#f90', width=1); dr.line([(X(f['t']), Y(f['her'])) for f in fr], fill='#f90', width=2)
    if i == len(rows) - 1:
        for s in range(0, int(T) + 1, max(1, int(T // 8))): dr.text((X(s) - 6, y1 + 4), '%ds' % s, fill='#444', font=F)
# top view
P = d['polygon']; cx0, cy0, sc = 1230, 520, 110
M = lambda x, z: (cx0 + x * sc, cy0 + (z + 2.6) * sc)
dr.text((1000, 50), '俯视：内壁（灰）、keepInside 圆角框（绿）、镜头轨迹（蓝→红 = 时间）', fill='black', font=F)
dr.polygon([M(x, z) for x, z in P], outline='#777')
k = d['keep']; r = k.get('cornerM', 0)
dr.rounded_rectangle((M(k['min'][0], k['min'][2]), M(k['max'][0], k['max'][2])), radius=r * sc, outline='#2a2', width=2)
n = len(fr)
for i in range(1, n):
    c = int(255 * i / n); dr.line((M(fr[i - 1]['p'][0], fr[i - 1]['p'][2]), M(fr[i]['p'][0], fr[i]['p'][2])), fill=(c, 60, 255 - c), width=3)
hx, hz = d['her'][0], d['her'][2]; dr.ellipse((M(hx, hz)[0] - 7, M(hx, hz)[1] - 7, M(hx, hz)[0] + 7, M(hx, hz)[1] + 7), fill='#f90'); dr.text((M(hx, hz)[0] + 9, M(hx, hz)[1] - 10), '她', fill='black', font=F)
c = d['center']; dr.ellipse((M(c[0], c[2])[0] - 5, M(c[0], c[2])[1] - 5, M(c[0], c[2])[0] + 5, M(c[0], c[2])[1] + 5), outline='black'); dr.text((M(c[0], c[2])[0] + 8, M(c[0], c[2])[1]), '房间中心点', fill='black', font=F)
dr.text((1000, 900), '+x →　　+z ↓（门在下方）', fill='#444', font=F)
im.save(sys.argv[2]); print('saved', sys.argv[2])
