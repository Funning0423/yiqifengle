# Voice Bot - Island ambience v1 (numpy only, all original). Run from island-v1/: python3 src/synth_island.py
import numpy as np, wave, os
SR = 44100; OUT = "wav"; os.makedirs(OUT, exist_ok=True)
def save(name, st, peak_db):
    st = np.atleast_2d(st); st = st/np.abs(st).max()*10**(peak_db/20)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(st.shape[0]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st.T*32767).astype(np.int16).tobytes())
D = 30.0; N = int(D*SR); x = np.arange(N)/SR; fr = np.fft.rfftfreq(N, 1/SR)
def circ(c, width, seed):  # circular band-limited noise -> loops seamlessly
    n = np.random.default_rng(seed).standard_normal(N)
    m = np.exp(-0.5*((np.log(fr+1)-np.log(c))/width)**2)
    y = np.fft.irfft(np.fft.rfft(n)*m, N); return y/y.std()
def per(k, ph=0): return (x*k/D+ph) % 1.0   # phase 0..1, k cycles per loop

def waves(ch, calm=1.0):
    # 4 waves per 30 s (7.5 s each), slightly different shapes; each: swell -> crash -> foam wash back
    s = np.zeros(N)
    for i, (k, ph, g) in enumerate([(4, 0.0, 1.0), (4, 0.43, 0.6), (2, 0.71, 0.45)]):
        p = per(k, ph+0.03*ch)
        swell = np.exp(-((p-0.35)/0.12)**2)                          # rising body
        crash = np.exp(-((p-0.42)/0.03)**2)                           # break
        foam = np.where(p > 0.42, np.exp(-(p-0.42)/0.18), 0)*0.7      # hiss tail / wash back
        s += g*(swell*circ(180, .6, 10*i+ch)*1.0 + crash*circ(900, .7, 20*i+ch)*0.8
                + foam*circ(3000, .5, 30*i+ch)*0.5*calm)
    s += 0.25*circ(120, .5, 90+ch)    # distant sea bed
    return s

def crickets(ch):
    s = np.zeros(N); rng = np.random.default_rng(300+ch)
    for j, (f, rate, k) in enumerate([(4300, 18, 5), (4700, 22, 6), (3900, 15, 3)]):
        # chirp trains: carrier gated at `rate` Hz, phrases swelling k times per loop (k integer -> seamless)
        rate = round(rate*D)/D; gate = (np.sin(2*np.pi*rate*x) > 0.3).astype(float)
        gate = np.convolve(gate, np.ones(60)/60, 'same')
        phrase = np.clip(np.sin(2*np.pi*k*x/D+rng.uniform(0, 6)), 0, 1)**2
        fc = round(f*D)/D
        s += (0.6 if j else 1.0)*np.sin(2*np.pi*fc*x)*gate*phrase
    return s

def low_wind(ch):
    e = 0.5+0.5*np.sin(2*np.pi*2*x/D+ch*0.8)
    return (circ(220, .5, 400+ch)*0.7+circ(600, .4, 410+ch)*0.3)*(0.4+0.6*e)

day = np.array([waves(c) + 0.15*circ(1500, .5, 500+c)*(0.6+0.4*np.sin(2*np.pi*3*x/D+c)) for c in (0, 1)])
night = np.array([0.7*waves(c, 0.6) + 0.07*crickets(c)*waves(c).std() + 0.35*low_wind(c) for c in (0, 1)])
save("amb_island_waves_day", day, -6); save("amb_island_waves_night", night, -6)

# seagull one-shots: nasal "kee-ow" glides, a few calls each, original synth
def gull(seed):
    rng = np.random.default_rng(seed); out = np.zeros(int(2.4*SR)); at = 0.05
    for c in range(rng.integers(2, 4)):
        d = rng.uniform(0.28, 0.45); t = np.arange(int(d*SR))/SR; u = t/d
        f0 = rng.uniform(1700, 2100)*(1+0.25*np.sin(np.pi*u))*(1-0.35*u**1.5)
        ph = 2*np.pi*np.cumsum(f0)/SR
        s = sum(a*np.sin(h*ph) for h, a in [(1, 1), (2, .6), (3, .35), (4, .15)])
        s *= 1+0.3*np.sin(2*np.pi*rng.uniform(30, 45)*t)                  # throaty roughness
        s += 0.15*np.random.default_rng(seed+c).standard_normal(len(t))
        env = np.minimum(u/0.08, 1)*np.clip((1-u)/0.3, 0, 1)
        i = int(at*SR); out[i:i+len(s)] += s*env*rng.uniform(0.7, 1); at += d+rng.uniform(0.08, 0.2)
    n = int(at*SR+0.6*SR); out = out[:n]
    # distance: soft lowpass + small reverb
    k = np.exp(-np.arange(int(0.6*SR))/SR*8)*np.random.default_rng(seed).standard_normal(int(0.6*SR))
    K = 1 << (n+len(k)).bit_length(); wet = np.fft.irfft(np.fft.rfft(out, K)*np.fft.rfft(k, K), K)[:n]; out = out+0.25*wet/np.abs(wet).max()*np.abs(out).max()
    out = np.convolve(out, np.ones(3)/3, 'same'); out[-2000:] *= np.linspace(1, 0, 2000); return out
for i in range(1, 4): save(f"amb_island_gull_{i:02d}_day", gull(70+i), -6)
