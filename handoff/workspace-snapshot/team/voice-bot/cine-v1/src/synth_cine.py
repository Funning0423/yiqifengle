# Voice Bot - cutscene foley generator v0.1. Reads 运镜bot's <clip>.timing.json and writes a track
# exactly durationSec long, with every sound placed on the frames in the timing file.
# Re-run on a new timing.json (e.g. M1 v2) and the track follows automatically.
# Usage: python3 src/synth_cine.py <timing.json> [<timing.json> ...]
import numpy as np, wave, json, os, sys
SR = 44100; OUT = "wav"; os.makedirs(OUT, exist_ok=True)
def fftconv(a, k):
    K = 1 << (len(a)+len(k)).bit_length(); return np.fft.irfft(np.fft.rfft(a, K)*np.fft.rfft(k, K), K)[:len(a)+len(k)-1]
def band(n, lo, hi, rng):
    x = rng.standard_normal(n); F = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1/SR)
    F[(f < lo) | (f > hi)] = 0; y = np.fft.irfft(F, n); return y/(np.abs(y).max()+1e-9)

def footstep(rng, soft=1.0):
    # indoor wooden floor, soft shoes: heel thump + small floorboard knock + tiny scuff
    d = 0.22; t = np.arange(int(d*SR))/SR
    thump = np.sin(2*np.pi*rng.uniform(95, 130)*t)*np.exp(-t*38)
    knock = sum(a*np.sin(2*np.pi*f*t)*np.exp(-t*dec) for f, a, dec in
                [(rng.uniform(480, 560), .5, 70), (rng.uniform(820, 950), .3, 95), (rng.uniform(1500, 1750), .12, 140)])
    scuff = band(len(t), 1800, 7000, rng)*np.exp(-t*60)*0.25
    s = thump + 0.6*knock + scuff; s *= np.minimum(t/0.0015, 1)
    return soft*s/np.abs(s).max()

def creak(rng, d=0.45, pitch=1.0):
    # small wooden chair creak: stick-slip pulses through wood resonances
    n = int(d*SR); s = np.zeros(n); tt = 0.0
    while tt < d:
        u = tt/d; i = int(tt*SR)
        if i < n: s[i] += np.sin(np.pi*u)**0.8*(0.6+0.4*rng.random())
        tt += 1/max(pitch*(70+60*np.sin(np.pi*u))*(1+0.15*rng.standard_normal()), 25)
    k = np.zeros(int(0.04*SR)); tk = np.arange(len(k))/SR
    for f, a, dec in [(420, 1, 70), (980, .6, 90), (1900, .3, 140)]: k += a*np.sin(2*np.pi*f*pitch*tk)*np.exp(-tk*dec)
    y = fftconv(s, k)[:n]; return y/np.abs(y).max()

def rustle(n, env, rng):
    # cloth (skirt / apron) rustle: bright noise with fast random flutter, shaped by env
    x = band(n, 1500, 7500, rng); fl = np.abs(band(n, 4, 30, rng))
    return x*(0.4+0.6*fl)*env

def render(path):
    tj = json.load(open(path)); fps = tj['fps']; dur = tj['durationSec']
    TAIL = 0.35   # GGbot: track may run past the clip end and is left to finish naturally, so keep the last sounds' tails
    N = int(round((dur+TAIL)*SR))
    ev = tj.get('events', {}); rng = np.random.default_rng(abs(hash(tj['clip'])) % 2**32)
    L = np.zeros((2, N))
    def put(sig, frame, g=1.0, pan=0.0):
        i = int(round(frame/fps*SR)); e = min(N, i+len(sig))
        if i >= N: return
        l, r = np.cos((pan+1)*np.pi/4), np.sin((pan+1)*np.pi/4)
        L[0, i:e] += g*l*sig[:e-i]; L[1, i:e] += g*r*sig[:e-i]
    tf = np.arange(N)/SR*fps     # time in frames
    def ramp(a, b, c, d):        # 0 before a, up to 1 at b, hold, down to 0 at d
        return np.clip(np.minimum((tf-a)/max(b-a, 1e-3), (d-tf)/max(d-c, 1e-3)), 0, 1)
    # cloth rustle bed: faint from frame 0 (so the track never opens on dead silence), swelling during movement
    env = 0.08 + 0.0*tf
    if 'standUpStartFrame' in ev:
        a, off, b = ev['standUpStartFrame'], ev.get('seatOffFrame', ev['standUpStartFrame']+40), ev.get('standUpEndFrame', tj['lastFrame'])
        env = env + 0.9*ramp(a, a+10, off, b)
        put(creak(rng, 0.5, 1.0), a+2, 0.45, -0.2)                 # weight shifts forward on the seat
        put(creak(rng, 0.35, 1.15), off-4, 0.55, -0.2)             # chair releases as she leaves the seat
    if 'turnStartFrame' in ev:
        env = env + 0.8*ramp(ev['turnStartFrame'], ev['turnStartFrame']+8, ev['turnEndFrame']-8, ev['turnEndFrame'])
    L += np.array([rustle(N, env, rng), rustle(N, env, rng)])*0.12
    for fe in ev.get('footEvents', []):
        pan = -0.25 if fe['side'] == 'L' else 0.25
        if fe['type'] == 'contact': put(footstep(rng), fe['frame'], 0.9, pan)
        elif fe['type'] == 'lift': put(band(int(0.06*SR), 2500, 7000, rng)*np.exp(-np.arange(int(0.06*SR))/SR*50), fe['frame'], 0.08, pan)
    # gentle room reflection (small wooden room)
    ir = rng.standard_normal(int(0.35*SR))*np.exp(-np.arange(int(0.35*SR))/SR*18); ir[:int(0.006*SR)] = 0
    for c in range(2):
        w = fftconv(L[c], ir)[:N]; L[c] += 0.12*w/(np.abs(w).max()+1e-9)*np.abs(L[c]).max()
    f = int(0.02*SR); L[:, -f:] *= np.linspace(1, 0, f)
    L = L/np.abs(L).max()*10**(-6/20)
    name = 'sfx_' + tj['clip']
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((L.T*32767).astype(np.int16).tobytes())
    print(name, N, 'samples =', N/SR, 's (clip', dur, 's + tail', TAIL, 's)')
for p in sys.argv[1:]: render(p)
