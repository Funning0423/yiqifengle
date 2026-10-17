# Voice Bot SFX v1 - procedural synthesis, numpy only. Run: python3 synth_sfx.py <outdir>
import numpy as np, wave, sys, os
SR = 44100
rng = np.random.default_rng(7)
out = sys.argv[1] if len(sys.argv) > 1 else "wav"
os.makedirs(out, exist_ok=True)

def t(d): return np.arange(int(d*SR))/SR
def hz(n): return 440*2**((n-69)/12)  # midi -> Hz

def bell(f, d, bright=1.0, decay=4.0, att=0.004):
    x = t(d)
    mod = np.sin(2*np.pi*f*3.5*x) * bright*1.2*np.exp(-x*decay*2)   # soft FM shimmer
    s = np.sin(2*np.pi*f*x + mod) + 0.25*np.sin(2*np.pi*2*f*x)*np.exp(-x*decay*1.5)
    env = np.minimum(x/att, 1) * np.exp(-x*decay)
    return s*env

def pluck(f, d, decay=10):
    x = t(d)
    s = np.sin(2*np.pi*f*x) + 0.4*np.sin(2*np.pi*2*f*x)*np.exp(-x*30) + 0.15*np.sin(2*np.pi*3*f*x)*np.exp(-x*40)
    return s*np.minimum(x/0.002, 1)*np.exp(-x*decay)

def pad(fs, d, att=0.3):
    x = t(d); s = 0
    for f in fs:
        for det in (-0.6, 0.6):
            s = s + np.sin(2*np.pi*(f+det)*x)
    env = np.minimum(x/att, 1)*np.minimum((d-x)/0.6, 1)
    return s/len(fs)/2*np.clip(env, 0, 1)

def bandnoise(d, lo, hi):
    n = rng.standard_normal(int(d*SR)); F = np.fft.rfft(n)
    fr = np.fft.rfftfreq(len(n), 1/SR)
    mask = np.exp(-0.5*((np.log(fr+1)-np.log((lo*hi)**0.5))/(np.log(hi/lo)/2))**2)
    return np.fft.irfft(F*mask, len(n))

def wind(d, lo=500, hi=2500, peak=0.4):
    # breathy gust: two bands crossfaded so it "rises", bell-shaped envelope
    x = t(d); a = bandnoise(d, lo, hi); b = bandnoise(d, lo*2, hi*2)
    sweep = np.clip(x/d, 0, 1)
    s = a*(1-sweep) + b*sweep
    env = np.exp(-0.5*((x/d-peak)/0.22)**2)
    s = s*env; return s/(np.abs(s).max()+1e-9)

def place(buf, sig, at, g=1.0):
    i = int(at*SR); end = min(len(buf), i+len(sig)); buf[i:end] += g*sig[:end-i]; return buf

def reverb(sig, rt=1.2, mix=0.22):
    n = int(rt*SR); x = np.arange(n)/SR
    ir = rng.standard_normal(n)*np.exp(-x*6.9/rt); ir[:int(0.012*SR)] = 0
    L = len(sig)+n; N = 1 << (L-1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(sig, N)*np.fft.rfft(ir, N), N)[:L]
    wet /= (np.abs(wet).max()+1e-9); dry = np.concatenate([sig, np.zeros(n)])
    y = dry*(1-mix) + wet*mix*np.abs(sig).max()
    # trim trailing silence
    nz = np.where(np.abs(y) > 1e-3*np.abs(y).max())[0]; return y[:nz[-1]+1]

def save(name, sig, peak_db=-1.5, fade=0.01):
    sig = sig - sig.mean(); f = int(fade*SR); sig[-f:] *= np.linspace(1, 0, f)
    sig = sig/np.abs(sig).max()*10**(peak_db/20)
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig*32767).astype(np.int16).tobytes())

# F major pentatonic, airy and open (F G A C D)
P = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89]

# 1 normal match: two soft bell notes + a small breath of wind
b = np.zeros(int(0.9*SR)); place(b, bell(hz(81), 0.6), 0); place(b, bell(hz(84), 0.6), 0.06, 0.8)
place(b, wind(0.45, 1200, 4000, 0.3), 0, 0.18); save("sfx_match_normal", reverb(b, 0.8, 0.18))

# 2-4 combos: longer, higher, brighter arpeggios, more wind
for lvl, notes, gap, wg in [(1, [77, 81, 84], 0.055, 0.22), (2, [77, 81, 84, 86, 89], 0.05, 0.3),
                            (3, [77, 81, 84, 86, 89, 91, 93], 0.045, 0.4)]:
    d = len(notes)*gap + 1.0; b = np.zeros(int(d*SR))
    for i, n in enumerate(notes): place(b, bell(hz(n), 0.7, 1.0+0.2*lvl), i*gap, 0.85)
    place(b, wind(0.4+0.2*lvl, 900, 3500, 0.35), 0, wg)
    if lvl == 3: place(b, pad([hz(65), hz(69), hz(72)], 1.0, 0.05), 0, 0.25)
    save(f"sfx_combo_{lvl}", reverb(b, 1.0, 0.22))

# 5 chest open: soft wooden thump, wind gust swells, glitter arpeggio, warm chord
b = np.zeros(int(2.2*SR))
place(b, pluck(hz(41), 0.35, 14)+0.5*bandnoise(0.35, 150, 600)*np.exp(-t(0.35)*25), 0, 0.9)
place(b, wind(1.2, 600, 3000, 0.45), 0.05, 0.35)
for i, n in enumerate([72, 77, 81, 84, 89, 93, 96]): place(b, bell(hz(n), 0.8, 1.3, 5), 0.25+i*0.06, 0.55)
place(b, pad([hz(53), hz(60), hz(65), hz(69)], 1.5, 0.2), 0.3, 0.35); save("sfx_chest_open", reverb(b, 1.4, 0.25))

# 6 button click: tiny soft wooden pluck
b = np.zeros(int(0.15*SR)); place(b, pluck(hz(84), 0.12, 45), 0); place(b, bandnoise(0.02, 2000, 6000)*np.linspace(1, 0, int(0.02*SR)), 0, 0.15)
save("sfx_ui_click", b, -3)

# 7 level clear: short pentatonic jingle over warm pad + rising wind
mel = [(72, 0.0), (74, 0.16), (77, 0.32), (81, 0.48), (79, 0.72), (81, 0.88), (84, 1.04)]
b = np.zeros(int(3.2*SR))
for n, at in mel: place(b, bell(hz(n), 1.0 if n != 84 else 1.8, 1.0, 3.5 if n != 84 else 1.8), at, 0.8)
place(b, pad([hz(53), hz(60), hz(65), hz(69), hz(72)], 2.6, 0.4), 0.2, 0.4)
place(b, wind(2.0, 500, 2500, 0.55), 0, 0.3); save("sfx_level_clear", reverb(b, 1.6, 0.25))
