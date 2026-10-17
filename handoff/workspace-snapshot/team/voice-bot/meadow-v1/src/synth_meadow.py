# Voice Bot - Windmill meadow ambience v0.1 (numpy only, all original). Run from meadow-v1/: python3 src/synth_meadow.py
import numpy as np, wave, os
SR = 44100; OUT = "wav"; os.makedirs(OUT, exist_ok=True)
def save(name, st, peak_db=-3):
    st = np.atleast_2d(st); st = st/np.abs(st).max()*10**(peak_db/20)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(st.shape[0]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st.T*32767).astype(np.int16).tobytes())
def fftconv(a, k):
    K = 1 << (len(a)+len(k)).bit_length(); return np.fft.irfft(np.fft.rfft(a, K)*np.fft.rfft(k, K), K)[:len(a)+len(k)-1]
D = 30.0; N = int(D*SR); x = np.arange(N)/SR; fr = np.fft.rfftfreq(N, 1/SR)
def circ(c, width, seed):           # circular band-limited noise -> seamless loop
    n = np.random.default_rng(seed).standard_normal(N)
    m = np.exp(-0.5*((np.log(fr+1)-np.log(c))/width)**2)
    y = np.fft.irfft(np.fft.rfft(n)*m, N); return y/y.std()
def lfo(k, ph): return 0.5+0.5*np.sin(2*np.pi*k*x/D+ph)   # integer k -> seamless
def place_circ(buf, sig, at):       # add an event, wrapping past the end back to the start
    i = int(at*SR) % N; e = i+len(sig)
    if e <= N: buf[i:e] += sig
    else: buf[i:] += sig[:N-i]; buf[:e-N] += sig[N-i:]

def grass(ch, calm=1.0):
    # gusts roll across the field 3x per loop; grass rustle = bright noise with fast flutter riding the gust
    gust = 0.25+0.75*(lfo(3, ch*0.5)**2*lfo(1, 1.3+ch*0.3))
    flutter = 0.6+0.4*circ(6, .6, 700+ch)/3            # slow random flutter (circular)
    rustle = circ(3500, .45, 710+ch)*flutter*gust**1.5
    body = circ(400, .55, 720+ch)*(0.5+0.5*gust) + 0.6*circ(150, .5, 730+ch)
    return body + 0.55*calm*rustle

def creak(seed, d=0.9, pitch=1.0):
    # wooden axle: stick-slip pulse train with a drifting rate through wood resonances
    rng = np.random.default_rng(seed); n = int(d*SR); s = np.zeros(n); t = 0.0
    while t < d:
        u = t/d; rate = pitch*(55+70*np.sin(np.pi*u))*(1+0.15*rng.standard_normal())
        i = int(t*SR)
        if i < n: s[i] += np.sin(np.pi*u)**0.7*(0.6+0.4*rng.random())
        t += 1/max(rate, 20)
    k = np.zeros(int(0.05*SR)); tk = np.arange(len(k))/SR
    for f, a, dec in [(380, 1, 60), (870, .7, 80), (1650, .4, 120), (2900, .2, 160)]:
        k += a*np.sin(2*np.pi*f*pitch*tk)*np.exp(-tk*dec)
    y = fftconv(s, k)[:n]; return y/np.abs(y).max()

def crickets(ch):
    s = np.zeros(N); rng = np.random.default_rng(300+ch)
    for j, (f, rate, k) in enumerate([(4300, 18, 5), (4700, 22, 6), (3900, 15, 3)]):
        rate = round(rate*D)/D; gate = (np.sin(2*np.pi*rate*x) > 0.3).astype(float)
        gate = np.convolve(gate, np.ones(60)/60, 'same')
        phrase = np.clip(np.sin(2*np.pi*k*x/D+rng.uniform(0, 6)), 0, 1)**2
        s += (0.6 if j else 1.0)*np.sin(2*np.pi*round(f*D)/D*x)*gate*phrase
    return s

def mill(ch, slow=1.0, g=0.18):
    # one sail rotation every 7.5 s (4 per loop) -> 2 creaks per rotation, distant (soft, panned)
    s = np.zeros(N); per = 7.5*slow
    times = [r*per+o for r in range(int(D/per)) for o in (0.6, 4.1)]
    for j, t0 in enumerate(times): place_circ(s, creak(800+j, 0.8+0.2*(j % 3), 0.9+0.05*(j % 2)), t0+0.004*ch)
    return g*s/np.abs(s).max()

day = np.array([grass(c)/3 + mill(c, 1.0, 0.35)*(0.8 if c else 1.0) for c in (0, 1)])
night = np.array([0.6*grass(c, 0.5)/3 + mill(c, 1.0, 0.18) + 0.08*crickets(c) for c in (0, 1)])
save("amb_meadow_wind_day", day); save("amb_meadow_wind_night", night)

# wind chimes (meadow.bells): 5 tuned metal tubes, bar-mode partials, struck in a soft cluster
TUNE = [76, 79, 81, 84, 88]   # E5 G5 A5 C6 E6, open pentatonic
def tube(n, d=3.5):
    f = 440*2**((n-69)/12); t = np.arange(int(d*SR))/SR
    s = sum(a*np.sin(2*np.pi*f*r*t)*np.exp(-t*dec) for r, a, dec in [(1, 1, 1.1), (2.76, .5, 2.5), (5.40, .25, 5), (8.93, .1, 9)])
    return s*np.minimum(t/0.002, 1)
def chimes(seed, hits):
    rng = np.random.default_rng(seed); d = 4.5; out = np.zeros((2, int(d*SR))); at = 0.02
    for h in range(hits):
        n = TUNE[rng.integers(len(TUNE))]; sig = tube(n)*rng.uniform(.4, 1); pan = rng.uniform(-.6, .6)
        i = int(at*SR); e = min(out.shape[1], i+len(sig))
        out[0, i:e] += np.cos((pan+1)*np.pi/4)*sig[:e-i]; out[1, i:e] += np.sin((pan+1)*np.pi/4)*sig[:e-i]
        at += rng.uniform(0.05, 0.35)
    ir = np.random.default_rng(seed).standard_normal(int(1.2*SR))*np.exp(-np.arange(int(1.2*SR))/SR*5.7)
    for c in range(2):
        w = fftconv(out[c], ir)[:out.shape[1]]; out[c] += 0.2*w/np.abs(w).max()*np.abs(out[c]).max()
    f = int(0.3*SR); out[:, -f:] *= np.linspace(1, 0, f); return out
for i, (seed, hits) in enumerate([(41, 4), (42, 6), (43, 9)], 1): save(f"amb_meadow_bells_{i:02d}", chimes(seed, hits))
