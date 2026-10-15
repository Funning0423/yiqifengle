# Voice Bot SFX v2 (2026-10-15) - procedural synthesis, numpy only, 自制原创.
# Run: python3 synth_sfx_v2.py <outdir>   -> 44.1 kHz mono 16-bit WAV
import numpy as np, wave, sys, os
SR = 44100
rng = np.random.default_rng(20261015)
out = sys.argv[1] if len(sys.argv) > 1 else "wav"; os.makedirs(out, exist_ok=True)
def t(d): return np.arange(int(d*SR))/SR
def noise(n): return rng.standard_normal(n)
def bp(x, lo, hi):
    F = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1/SR)
    c = (lo*hi)**0.5; w = np.log(hi/lo)/2
    return np.fft.irfft(F*np.exp(-0.5*((np.log(fr+1)-np.log(c))/w)**2), len(x))
def lp(x, fc):
    F = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1/SR)
    return np.fft.irfft(F/(1+(fr/fc)**4), len(x))
def place(buf, s, at, g=1.0):
    i = int(at*SR); e = min(len(buf), i+len(s)); buf[i:e] += g*s[:e-i]
def norm(s): return s/(np.abs(s).max()+1e-9)
def room(s, rt=0.35, mix=0.15):
    n = int(rt*SR); x = np.arange(n)/SR
    ir = noise(n)*np.exp(-x*6.9/rt); ir[:int(0.008*SR)] = 0
    w = np.convolve(s, ir)[:len(s)]; return s + mix*norm(w)*np.abs(s).max()
def save(name, s, peak_db=-1.5, fade=0.005, fadein=True):
    s = norm(s)*10**(peak_db/20); f = int(fade*SR)
    if fadein: s[:f] *= np.linspace(0, 1, f)
    s[-f:] *= np.linspace(1, 0, f)
    with wave.open(os.path.join(out, name+".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((s*32767).astype(np.int16).tobytes())

def creak(d, f0=95, jitter=0.25, bright=3000):
    # stick-slip friction: pulse train with wandering rate, resonated
    x = t(d); f = f0*(1+jitter*np.sin(2*np.pi*x*rng.uniform(1.5, 3)/d) + 0.08*lp(noise(len(x)), 8)*5)
    ph = np.cumsum(f)/SR; pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    pulses *= 0.6+0.4*rng.random(len(x))
    s = bp(pulses, 400, bright) + 0.5*bp(pulses, 1200, 2600)
    env = np.sin(np.pi*np.clip(x/d, 0, 1))**0.6
    return s*env

# 1) windmill loop, 8.0 s exact loop (4 blades, 0.5 rev/s -> blade pass every 0.5 s)
def windmill():
    d = 8.0; n = int(d*SR); x = np.arange(n)/SR; buf = np.zeros(n)
    base = bp(noise(n), 200, 1200)  # air bed
    blade = 0.55+0.45*np.cos(2*np.pi*x/0.5)**8  # whoosh each 0.5 s
    buf += norm(base*blade)*0.5
    buf += norm(bp(noise(n), 60, 250))*0.12*(1+0.3*np.sin(2*np.pi*x/8))  # rumble, period = loop
    for i in range(4):  # wooden axle creak twice per rev, varied
        at = i*2.0+0.2+rng.uniform(0, 0.3)
        place(buf, norm(creak(rng.uniform(0.35, 0.6), rng.uniform(80, 120)))*0.35, at)
    # make seamless: wrap last 0.3 s tail
    return buf
w = windmill(); save("sfx_windmill_loop", w, peak_db=-3, fade=0.0005)

# 2) door opening (wooden door): latch click, hinge creak, air swoosh, soft stop
def door():
    d = 1.9; buf = np.zeros(int(d*SR))
    k = t(0.03); click = noise(len(k))*np.exp(-k*250); place(buf, bp(click, 1500, 6000), 0.02, 0.9)
    k = t(0.05); clack = np.sin(2*np.pi*420*k)*np.exp(-k*90); place(buf, clack, 0.09, 0.5)
    place(buf, norm(creak(1.1, 70, 0.45, 2200))*0.6, 0.18)
    sw = t(1.0); place(buf, norm(bp(noise(len(sw)), 150, 900))*np.sin(np.pi*sw/1.0)**2*0.35, 0.3)
    k = t(0.15); thud = np.sin(2*np.pi*90*k)*np.exp(-k*35); place(buf, thud, 1.35, 0.3)
    return room(buf, 0.45, 0.2)
save("sfx_door_open", door())

# 3) footsteps: grass / wood / stone, 4 variations each
def step(kind, v):
    d = 0.35; n = int(d*SR); x = np.arange(n)/SR; g = rng.uniform(0.85, 1.0)
    if kind == "grass":
        s = bp(noise(n), 1500*g, 7000)*np.exp(-x*14)*(x < 0.25)
        s += 0.4*bp(noise(n), 300, 1200)*np.exp(-x*40)
        for _ in range(25): place(s, bp(noise(400), 3000, 9000)*np.hanning(400), rng.uniform(0.01, 0.2), 0.3)
    elif kind == "wood":
        f = 140*g; s = np.sin(2*np.pi*f*x)*np.exp(-x*30)+0.5*np.sin(2*np.pi*2.7*f*x)*np.exp(-x*45)
        s += 0.6*bp(noise(n), 800, 3500)*np.exp(-x*80)
        if v % 2: place(s, norm(creak(0.12, 160, 0.3, 2500))*0.25, 0.04)
    else:  # stone
        s = bp(noise(n), 2000*g, 8000)*np.exp(-x*60) + 0.5*bp(noise(n), 400, 1500)*np.exp(-x*50)
        for _ in range(6): place(s, bp(noise(300), 3000, 9000)*np.hanning(300), rng.uniform(0.005, 0.06), 0.4)  # grit
    heel = int(0.0); s[:int(0.002*SR)] *= np.linspace(0, 1, int(0.002*SR))
    return s
for kind in ("grass", "wood", "stone"):
    for v in range(1, 5): save(f"sfx_step_{kind}_{v:02d}", step(kind, v), peak_db=-3)

# 4) treasure chest, metal: latch clank, rusty iron hinge, lid hits stop, coin shimmer
def chest():
    d = 2.4; buf = np.zeros(int(d*SR))
    def metal(f0, dec, ratios=(1, 2.76, 5.40, 8.93)):
        k = t(1.2); return sum(np.sin(2*np.pi*f0*r*k)*np.exp(-k*dec*r**0.5)/r**0.7 for r in ratios)
    place(buf, metal(620, 9)+bp(noise(int(1.2*SR)), 2000, 8000)*np.exp(-t(1.2)*120), 0.03, 0.8)  # latch
    place(buf, metal(910, 14), 0.11, 0.4)
    place(buf, norm(creak(0.9, 55, 0.5, 4500))*0.55, 0.28)  # iron hinge
    place(buf, metal(330, 6)*0.8+bp(noise(int(1.2*SR)), 150, 900)*np.exp(-t(1.2)*25)*0.6, 1.2, 0.7)  # lid stop
    for i in range(10):
        place(buf, metal(rng.uniform(2200, 3800), 18)*0.12, 1.35+i*0.07+rng.uniform(0, 0.04))
    return room(buf, 0.6, 0.2)
save("sfx_chest_metal_open", chest())
print("ok")
