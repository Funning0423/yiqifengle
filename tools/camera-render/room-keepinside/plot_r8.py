# 运镜bot r8: traces of r8_poses.cjs seq_sweep90_trace.json or blend_trace.cjs output (PIL only).
#   python3 plot_r8.py TRACE.json OUT.png "TITLE" "LABEL"
# Rows: input weight w / view blend s; view yaw vs input yaw vs look-at-her yaw; her centre on screen (NDC, frame edge 1);
# camera-added angular accel |dω_view/dt − s·dω_input/dt| (cap 110); its jerk; lens position lag and linear accel.
import json, sys, math
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); fr = d['frames']; out, title, label = sys.argv[2], sys.argv[3], sys.argv[4]
F = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 18); S = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 15)
dt = 1 / d['fps']; ASPECT = 390 / 844
sub = lambda a, b: [a[k] - b[k] for k in range(3)]; nrm = lambda a: math.sqrt(sum(v * v for v in a)); unit = lambda a: [v / nrm(a) for v in a]
cross = lambda a, b: [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; dot = lambda a, b: sum(a[k] * b[k] for k in range(3))
def camf(f): r = unit(cross(f, [0, 1, 0])); return [r, cross(r, f), f]
def omega(a, b):
    A, B = camf(a), camf(b); M = [[sum(B[q][r] * A[q][c] for q in range(3)) for c in range(3)] for r in range(3)]
    tr = M[0][0] + M[1][1] + M[2][2]; ang = math.acos(max(-1, min(1, (tr - 1) / 2))); ax = [M[2][1] - M[1][2], M[0][2] - M[2][0], M[1][0] - M[0][1]]; sn = nrm(ax)
    return [0, 0, 0] if sn < 1e-12 else [v / sn * ang / dt for v in ax]
yawOf = lambda f: math.degrees(math.atan2(f[0], f[2]))
n = len(fr); V = [unit(sub(f['target'], f['p'])) for f in fr]; G = [unit(f['goalDir']) for f in fr]
Hd = [unit(sub(f['herC'], f['p'])) if f.get('herC') else V[i] for i, f in enumerate(fr)]
def unwrap(a):
    o = [a[0]]
    for v in a[1:]:
        dd = v - o[-1]
        while dd > 180: dd -= 360
        while dd < -180: dd += 360
        o.append(o[-1] + dd)
    return o
yv, yg, yh = unwrap([yawOf(v) for v in V]), unwrap([yawOf(g) for g in G]), unwrap([yawOf(h) for h in Hd])
base = yg[0]; yv = [v - base + (yv[0] - v + v) * 0 for v in yv]; yv = [v for v in yv]; yg = [v - base for v in yg]; yh = [v - base for v in yh]
yv = [v - base for v in unwrap([yawOf(v) for v in V])]
ndc = []
for i, f in enumerate(fr):
    if not f.get('herC'): ndc.append(0); continue
    r, u, fw = camf(V[i]); dd = sub(f['herC'], f['p']); z = dot(dd, fw); ty = math.tan(math.radians(f['fov']) / 2)
    ndc.append(max(abs(dot(dd, r) / z / (ty * ASPECT)), abs(dot(dd, u) / z / ty)) if z > 0 else 9)
wv = [omega(V[i], V[i + 1]) for i in range(n - 1)]; wg = [omega(G[i], G[i + 1]) for i in range(n - 1)]
cam = [0] * n; camV = [[0, 0, 0]] * n
for i in range(1, n - 1):
    s = fr[i].get('s', 0); v = [(wv[i][k] - wv[i - 1][k] - s * (wg[i][k] - wg[i - 1][k])) / dt for k in range(3)]; camV[i] = v; cam[i] = math.degrees(nrm(v))
jerk = [0] * n
for i in range(2, n - 2): jerk[i] = math.degrees(nrm([(camV[i + 1][k] - camV[i - 1][k]) / 2 / dt for k in range(3)]))
lag = [math.dist(f['p'], f['goal']) for f in fr]; lin = [0] * n
for i in range(1, n - 1): lin[i] = nrm([(fr[i + 1]['p'][k] - 2 * fr[i]['p'][k] + fr[i - 1]['p'][k]) / dt / dt for k in range(3)])
T = [f['t'] for f in fr]; T1 = T[-1]; tStop = d.get('tStop')
W, H = 1400, 1590; im = Image.new('RGB', (W, H), 'white'); dr = ImageDraw.Draw(im)
dr.text((20, 8), title, fill='black', font=F); dr.text((20, 34), label, fill='#333', font=S)
x0, x1 = 110, 1360; top = 120; rh = 238
lo3, hi3 = min(yv + yg + yh) - 5, max(yv + yg + yh) + 5
rows = [('输入权重 w（蓝，0 = 绕她区）/ 视角混合 s（橙）', [(fr_w := [f.get('wIn', f.get('w', 0)) for f in fr]), '#1565c0'], [[f.get('s', 0) for f in fr], '#f57c00'], 0, 1.05, None),
        ('视角 yaw °（蓝 = 画面，灰 = 输入，绿 = 看向她）', [yv, '#1565c0'], [yg, '#999'], lo3, hi3, None),
        ('她身体中心在画面中的位置 |NDC|（1 = 出画，红线）', [ndc, '#1565c0'], None, 0, 2.5, 1.0),
        ('镜头自加角加速度 °/s²（上限 110）', [cam, '#1565c0'], None, 0, max(150, max(cam) * 1.05), 110),
        ('角加加速度 jerk °/s³', [jerk, '#1565c0'], None, 0, max(500, max(jerk) * 1.05), None),
        ('镜头位置滞后 m（蓝）/ 线加速度 m/s²（橙，上限 3）', [lag, '#1565c0'], [lin, '#f57c00'], 0, 3.5, 3)]
for i, (name, a, b, lo, hi, lim) in enumerate(rows):
    y0 = top + i * rh; y1 = y0 + rh - 56
    dr.rectangle((x0, y0, x1, y1), outline='#888'); dr.text((x0, y0 - 24), name, fill='black', font=F)
    dr.text((20, y1 - 10), '%.3g' % lo, fill='#444', font=S); dr.text((20, y0 - 2), '%.3g' % hi, fill='#444', font=S)
    X = lambda t: x0 + (x1 - x0) * t / T1; Y = lambda v: y1 - (y1 - y0) * (min(max(v, lo), hi) - lo) / (hi - lo)
    if lim is not None: dr.line((x0, Y(lim), x1, Y(lim)), fill='#e33', width=2)
    if tStop is not None: dr.line((X(tStop), y0, X(tStop), y1), fill='#999', width=1); dr.text((X(tStop) + 4, y0 + 2), '停手', fill='#666', font=S)
    if i == 1: dr.line([(X(t), Y(v)) for t, v in zip(T, yh)], fill='#2e7d32', width=2)
    if b: dr.line([(X(t), Y(v)) for t, v in zip(T, b[0])], fill=b[1], width=2)
    dr.line([(X(t), Y(v)) for t, v in zip(T, a[0])], fill=a[1], width=2)
    step = 0.2 if T1 < 4 else 1.0
    if i == len(rows) - 1:
        k = 0
        while k * step <= T1 + 1e-9: dr.text((X(k * step) - 10, y1 + 6), ('%.1fs' if step < 1 else '%.0fs') % (k * step), fill='#444', font=S); k += 1
ow = [v for v, w in zip(ndc, fr_w) if w <= 0.1]
dr.text((20, H - 54), '绕她区帧 %d，她中心出画 %d 帧，最差 |NDC| %.2f；自加角加速度峰值 %.0f °/s²；jerk 峰值 %.0f °/s³；线加速度峰值 %.2f m/s²' % (len(ow), sum(1 for v in ow if v > 1), max(ow) if ow else 0, max(cam), max(jerk), max(lin)), fill='black', font=F)
im.save(out); print('PLOT', out, 'orbitFrames', len(ow), 'centreOut', sum(1 for v in ow if v > 1), 'cam', round(max(cam)), 'jerk', round(max(jerk)), 'lin', round(max(lin), 2))
