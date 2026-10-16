#!/usr/bin/env python3
"""出门过场音轨 sfx_exit_outbound（对齐 B5.3）。纯 numpy 合成，原创。
用法: PYTHONHASHSEED=0 python3 synth_exit_outbound.py <timing.json> <exit_cur.csv> <out.wav>
只读 timing 的 fps/lastFrame/events，以及 csv 的 t,cx,cy,cz,rx,rz（镜头速度、人物位移）。"""
import sys, json, wave, numpy as np
SR = 44100; rng = np.random.default_rng(20261016)
T = json.load(open(sys.argv[1])); E = T['events']; fps = T['fps']
D = T['lastFrame'] / fps; N = int(round(D * SR)); t = np.arange(N) / SR
fr = lambda k: E[k] / fps
door, walkEnd, peak, crane = fr('doorKeyFrame'), fr('walkEndFrame'), fr('peakSpeedFrame'), fr('craneStartFrame')
wFull0, wFull1, base, settle = fr('windFullStartFrame'), fr('windFullEndFrame'), fr('windBaseFrame'), fr('settledIslandFrame')
C = np.genfromtxt(sys.argv[2], delimiter=',', names=True)
ct = C['t']; P = np.stack([C['cx'], C['cy'], C['cz']], 1)
sp = np.r_[0, np.linalg.norm(np.diff(P, axis=0), axis=1) / np.diff(ct)]
sp = np.convolve(sp, np.ones(9) / 9, 'same'); spn = sp / sp.max()
cam = np.interp(t, ct, spn)
def ss(a, b, x): u = np.clip((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)
def lp(x, a):  # one-pole
    y = np.empty_like(x); s = 0.
    for i, v in enumerate(x): s += a * (v - s); y[i] = s
    return y
def bandnoise(lo, hi, n):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    X *= np.exp(-0.5 * ((np.log(np.maximum(f, 1)) - np.log(np.sqrt(lo * hi))) / (np.log(hi / lo) / 2)) ** 2)
    y = np.fft.irfft(X, n); return y / np.abs(y).max()
L = np.zeros(N); R = np.zeros(N)
# 风：两层带通噪声，包络 = 基底(第4帧起) -> 跟镜头速度 -> 448–503 满风 -> 599 前收到尾音
w_lo = bandnoise(120, 700, N); w_hi = bandnoise(600, 3500, N)
gust = 0.75 + 0.25 * np.interp(t, np.arange(0, D + 2, 0.7), rng.random(int((D + 2) / 0.7) + 1))
gust = np.convolve(gust, np.ones(4410) / 4410, 'same')
env = 0.12 + 0.10 * ss(0, base + 0.3, t)                  # 开头就有底噪，不是静音
env = env + 0.25 * cam * (t < crane)                     # 走路段跟着速度
env = np.maximum(env, 0.35 + 0.65 * ss(crane - 4.0, wFull0, t))   # 起风 -> 满风
env = env * (1 - 0.82 * ss(wFull1, settle - 0.15, t))   # 满风后在 599 前降到 ~18%
env = env * (1 - ss(settle - 0.12, settle, t) * 0.0)    # 保留尾巴(由交接淡出处理)
env = np.convolve(env, np.ones(2205) / 2205, 'same') * gust
bright = 0.25 + 0.75 * ss(crane - 1.5, wFull0 + 0.3, t) * (1 - ss(wFull1, settle, t))
wind = w_lo * env + 0.55 * w_hi * env * bright
pan = 0.15 * np.sin(2 * np.pi * t / 6.3)
L += wind * (1 - pan); R += wind * (1 + pan)
# 镜头起升重音 455：低频呼啸上扫
acc = (t >= crane - 0.25) * np.exp(-np.maximum(t - crane, 0) / 0.9) * ss(crane - 0.25, crane + 0.05, t)
sweep = bandnoise(250, 2500, N) * acc * 0.55
L += sweep; R += sweep
# 门 76：木门 thump + 铰链短吱
def place(sig, at, gl=1., gr=1.):
    i = int(at * SR); j = min(N, i + len(sig)); L[i:j] += gl * sig[:j - i]; R[i:j] += gr * sig[:j - i]
k = np.arange(int(0.5 * SR)) / SR
thump = (np.sin(2 * np.pi * 85 * k) + 0.5 * np.sin(2 * np.pi * 143 * k)) * np.exp(-k / 0.07) * 0.9
thump += bandnoise(300, 2000, len(k)) * np.exp(-k / 0.02) * 0.4
kk = np.arange(int(0.35 * SR)) / SR
creak = np.sin(2 * np.pi * np.cumsum(620 + 180 * np.sin(2 * np.pi * 9 * kk)) / SR) * np.sin(np.pi * kk / kk[-1]) * 0.12
place(creak, door - 0.33, 0.9, 1.1); place(thump, door)
# 脚步：0.7 m/s 走路，按人物位移约每 0.55 m 一步，强度跟镜头速度（峰值 248），260 停
H = np.stack([C['rx'], C['rz']], 1); dist = np.r_[0, np.cumsum(np.linalg.norm(np.diff(H, axis=0), axis=1))]
steps = []; nxt = 0.3
for ti, d in zip(ct, dist):
    if ti > walkEnd: break
    if d >= nxt: steps.append(ti); nxt += 0.55
ks = np.arange(int(0.12 * SR)) / SR
for i, st in enumerate(steps):
    a = 0.35 + 0.65 * np.interp(st, ct, spn)
    if st > walkEnd - 0.6: a *= 0.7
    s = bandnoise(150, 1800, len(ks)) * np.exp(-ks / 0.025) + 0.6 * np.sin(2 * np.pi * 110 * ks) * np.exp(-ks / 0.03)
    place(s * 0.5 * a, st, 1.15 if i % 2 else 0.85, 0.85 if i % 2 else 1.15)
# 交接：最后 0.35 s 用余弦淡到 0，衔接 599 开始的 sfx_transition_island_to_meadow（无硬切、无叠加）
fade = 0.5 * (1 + np.cos(np.pi * ss(settle - 0.35, settle, t) ))
fade = np.where(t < settle - 0.35, 1, 0.5 * (1 + np.cos(np.pi * np.clip((t - (settle - 0.35)) / 0.35, 0, 1))))
L *= fade; R *= fade
x = np.stack([L, R], 1); x = x / np.abs(x).max() * 0.5
w = wave.open(sys.argv[3], 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((x * 32767).astype('<i2').tobytes()); w.close()
json.dump({'durationSec': D, 'steps': [round(s, 3) for s in steps], 'door': door, 'peak': peak, 'walkEnd': walkEnd, 'crane': crane,
           'windFull': [wFull0, wFull1], 'settle': settle}, open(sys.argv[3] + '.events.json', 'w'), indent=1)
