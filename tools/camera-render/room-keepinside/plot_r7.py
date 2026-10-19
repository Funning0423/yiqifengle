# 运镜bot r7: lag / bias / accel / jerk traces of r7_poses.cjs seq_sweep90_trace.json (PIL only).
#   python3 plot_r7.py TRACE.json OUT.png LABEL [BIAS_VARIANT.json:name ...]
import json, sys, math
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); fr = d['frames']; out = sys.argv[2]; label = sys.argv[3]
var = [(json.load(open(a.split(':')[0]))['frames'], a.split(':')[1]) for a in sys.argv[4:]]
try: F = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 18)
except Exception: F = ImageFont.load_default()
dt = 1 / d['fps']
def deriv(fr):
    P = [f['p'] for f in fr]; n = len(P); acc = [0] * n; jerk = [0] * n; lag = []
    for i in range(1, n - 1): acc[i] = math.sqrt(sum(((P[i + 1][k] - 2 * P[i][k] + P[i - 1][k]) / dt / dt) ** 2 for k in range(3)))
    A = [[(P[i + 1][k] - 2 * P[i][k] + P[i - 1][k]) / dt / dt for k in range(3)] if 0 < i < n - 1 else [0, 0, 0] for i in range(n)]
    for i in range(2, n - 2): jerk[i] = math.sqrt(sum(((A[i + 1][k] - A[i - 1][k]) / 2 / dt) ** 2 for k in range(3)))
    lag = [math.dist(f['p'], f['goal']) for f in fr]; bias = [math.hypot(*f['bias']) for f in fr]
    return lag, bias, acc, jerk
def bias_jerk(fr):   # third derivative of the bias angle vector (deg/s³)
    B = [f['bias'] for f in fr]; m = 0
    for i in range(2, len(B) - 2):
        j = [(B[i + 2][k] - 2 * B[i + 1][k] + 2 * B[i - 1][k] - B[i - 2][k]) / 2 / dt ** 3 for k in range(2)]; m = max(m, math.hypot(*j))
    return m
lag, bias, acc, jerk = deriv(fr)
W, H = 1400, 1060; im = Image.new('RGB', (W, H), 'white'); dr = ImageDraw.Draw(im)
dr.text((20, 8), '90°/s 拖动（yaw 330→15，绕她区）→ 停手 → 静止 1.4 s，60 fps；' + label, fill='black', font=F)
T = fr[-1]['t']; x0, x1 = 110, 1360; top = 70; rh = 245
rows = [('镜头位置滞后 m（停手后 1.5 s 内 <0.2 m，红线 0.2）', lag, 0, 1.6, 0.2, None),
        ('瞄准偏置 °（出厂关闭 = 0；灰/紫 = 试验 6°/2° 上限，未采用）', bias, 0, 7, 6, 'bias'),
        ('线加速度 m/s²（上限 3）', acc, 0, 3.5, 3, None),
        ('线加加速度 jerk m/s³', jerk, 0, max(5, max(jerk) * 1.1), None, None)]
cols = ['#888', '#8e24aa']
for i, (name, ys, lo, hi, lim, tag) in enumerate(rows):
    y0 = top + i * rh; y1 = y0 + rh - 50
    dr.rectangle((x0, y0, x1, y1), outline='#888'); dr.text((x0, y0 - 24), name, fill='black', font=F)
    dr.text((20, y1 - 10), '%g' % lo, fill='#444', font=F); dr.text((20, y0 - 2), '%.3g' % hi, fill='#444', font=F)
    X = lambda t: x0 + (x1 - x0) * t / T; Y = lambda v: y1 - (y1 - y0) * (min(max(v, lo), hi) - lo) / (hi - lo)
    if lim is not None: dr.line((x0, Y(lim), x1, Y(lim)), fill='#e33', width=2)
    dr.line((X(d['tStop']), y0, X(d['tStop']), y1), fill='#999', width=1); dr.text((X(d['tStop']) + 4, y0 + 2), '停手', fill='#666', font=F)
    if tag == 'bias':
        for (vf, vn), c in zip(var, cols):
            vb = [math.hypot(*f['bias']) for f in vf]; dr.line([(X(f['t']), Y(v)) for f, v in zip(vf, vb)], fill=c, width=2)
            dr.text((x1 - 520, y0 + 8 + 22 * cols.index(c)), '%s：峰值 %.2f°，偏置角 jerk 峰值 %.0f°/s³' % (vn, max(vb), bias_jerk(vf)), fill=c, font=F)
    dr.line([(X(f['t']), Y(v)) for f, v in zip(fr, ys)], fill='#1565c0', width=2)
    if i == len(rows) - 1:
        for s in range(0, int(T * 10) + 1, 2): dr.text((X(s / 10) - 10, y1 + 6), '%.1fs' % (s / 10), fill='#444', font=F)
ts = d['tStop']; t02 = next((f['t'] - ts for k, f in enumerate(fr) if f['t'] >= ts - 1e-9 and all(v < 0.2 for v in lag[k:])), None)
dr.text((20, H - 30), '停手时滞后 %.2f m；<0.2 m 用时 %s s；线加速度峰值 %.2f m/s²；jerk 峰值 %.1f m/s³' % (lag[[f['t'] for f in fr].index(min((f['t'] for f in fr if f['t'] >= ts - 1e-9)))], '%.2f' % t02 if t02 is not None else '—', max(acc), max(jerk)), fill='black', font=F)
im.save(out); print('PLOT', out, 'lagStop', 't02', t02, 'acc', max(acc), 'jerk', max(jerk), 'biasJerk', [bias_jerk(v[0]) for v in var])
