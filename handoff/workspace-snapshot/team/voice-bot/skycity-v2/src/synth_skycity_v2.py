# Voice Bot - Sky City v0.2: wind loop with edge fades + loopable BGM (numpy only, all original)
import numpy as np, wave, os
SR = 44100; rng = np.random.default_rng(11); OUT = "wav"; os.makedirs(OUT, exist_ok=True)
def hz(n): return 440*2**((n-69)/12)
def save(name, st, peak_db=-1.5):
    st = st/np.abs(st).max()*10**(peak_db/20)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(st.shape[0]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st.T*32767).astype(np.int16).tobytes())

# ---------- 1. Wind loop, 30 s, seamless ----------
# FFT filtering of noise is circular, and every modulation has a period that divides 30 s,
# so sample N-1 flows straight into sample 0.
D = 30.0; N = int(D*SR); x = np.arange(N)/SR; fr = np.fft.rfftfreq(N, 1/SR)
def circ_band(c, width, seed):
    n = np.random.default_rng(seed).standard_normal(N)
    m = np.exp(-0.5*((np.log(fr+1)-np.log(c))/width)**2)
    y = np.fft.irfft(np.fft.rfft(n)*m, N); return y/np.abs(y).std()
def lfo(k, ph): return 0.5+0.5*np.sin(2*np.pi*k*x/D+ph)   # k cycles per loop -> seamless
wind = []
for ch in range(2):
    s = 0.0*x
    bands = [(250, .5, 1.0, 1), (500, .45, .8, 2), (900, .4, .6, 3), (1600, .35, .35, 5), (2800, .3, .15, 7)]
    for i, (c, w, g, k) in enumerate(bands):
        env = 0.25 + 0.75*lfo(k, rng.uniform(0, 6.28))**2 * lfo(1, ch*0.7+i)
        s += g*circ_band(c, w, 100*ch+i)*env
    # faint high "whistle" through the towers: narrow band that swells twice per loop
    s += 0.12*circ_band(1300, .04, 50+ch)*lfo(2, 1.0+ch)**3
    s += 0.08*circ_band(1950, .03, 60+ch)*lfo(3, 2.5+ch)**4
    wind.append(s)
wind = np.array(wind)
save("amb_skycity_wind_loop", wind, -3)
fe = int(0.08*SR); wf = wind.copy(); wf[:, :fe] *= np.sin(np.linspace(0, np.pi/2, fe))**2; wf[:, -fe:] *= np.cos(np.linspace(0, np.pi/2, fe))**2
save("amb_skycity_wind_loop_xf", wf, -3)

# ---------- 2. BGM sketch, ~60 s, A minor, 64 BPM, 16 bars ----------
BPM = 64; B = 60/BPM; BAR = 4*B; CYC = 16*BAR; TOT = 3*CYC; M = int(TOT*SR)
L = np.zeros((2, M))
def add(sig, at, pan=0.0, g=1.0):
    i = int(at*SR); e = min(M, i+len(sig)); l = np.cos((pan+1)*np.pi/4); r = np.sin((pan+1)*np.pi/4)
    L[0, i:e] += g*l*sig[:e-i]; L[1, i:e] += g*r*sig[:e-i]
def piano(n, d=3.0, vel=1.0):
    f = hz(n); t = np.arange(int(d*SR))/SR; s = 0
    for h, a in enumerate([1, .5, .25, .14, .08, .05], 1):
        fh = f*h*np.sqrt(1+0.0004*h*h)
        s += a*np.sin(2*np.pi*fh*t)*np.exp(-t*(1.2+0.9*h)*(f/260)**0.3)
    s *= np.minimum(t/0.003, 1); s[-2000:] *= np.linspace(1, 0, 2000); return vel*s
def flute(n, d, vel=1.0):
    f = hz(n); t = np.arange(int((d+0.25)*SR))/SR
    vib = 1+0.004*np.sin(2*np.pi*5.2*t)*np.clip((t-0.35)/0.4, 0, 1)
    ph = 2*np.pi*np.cumsum(f*vib)/SR
    s = np.sin(ph)+0.22*np.sin(2*ph)+0.06*np.sin(3*ph)
    br = rng.standard_normal(len(t)); br = np.convolve(br, np.ones(8)/8, 'same')*0.05
    env = np.minimum(t/0.08, 1)*np.clip((d+0.25-t)/0.25, 0, 1)*(1-0.15*np.clip(t/d, 0, 1))
    return vel*(s+br)*env
def strings(ns, d):
    t = np.arange(int(d*SR))/SR; s = 0
    for n in ns:
        for det in (-.15, 0, .15):
            f = hz(n)*2**(det/12); s += np.sin(2*np.pi*f*t)+0.3*np.sin(4*np.pi*f*t)
    env = np.minimum(t/1.2, 1)*np.clip((d-t)/1.0, 0, 1)
    return s*env/len(ns)/3
chords = {"Am": [57, 60, 64], "F": [53, 57, 60], "C": [48, 55, 64], "G": [50, 55, 59],
          "E": [52, 56, 59], "Dm": [50, 57, 62], "Em": [52, 55, 59]}
prog = ["Am", "F", "C", "G", "Am", "F", "C", "E", "Am", "F", "Dm", "E", "F", "G", "Em", "Am"]
for b, c in [(b+16*r, c) for r in range(3) for b, c in enumerate(prog)]:
    t0 = b*BAR; c = prog[b % 16]; bb = b % 16; ns = chords[c]; root = ns[0]-12
    add(piano(root, 4, .7), t0, -0.2)                       # bass note
    for i, n in enumerate([ns[0], ns[1], ns[2], ns[1]+12, ns[2], ns[1], ns[2], ns[1]]):
        add(piano(n, 2.2, .35 if i else .45), t0+i*B/2, 0.25)   # broken-chord eighths
    if bb >= 4 or b >= 16: add(strings([n+12 for n in ns], BAR+0.8), t0, 0, 0.18 if bb < 12 else 0.26)
# original melody: (midi, start beat in bar, beats)
mel = {4: [(69, 0, 1), (72, 1, 1), (76, 2, 2)], 5: [(77, 0, 1.5), (76, 1.5, .5), (72, 2, 2)],
       6: [(76, 0, 1), (79, 1, 1), (76, 2, 1), (74, 3, 1)], 7: [(71, 0, 3), (68, 3, 1)],
       8: [(69, 0, 1), (72, 1, 1), (76, 2, 1.5), (81, 3.5, .5)], 9: [(81, 0, 2), (79, 2, 1), (77, 3, 1)],
       10: [(77, 0, 1.5), (76, 1.5, .5), (74, 2, 1), (72, 3, 1)], 11: [(71, 0, 2), (76, 2, 2)],
       12: [(72, 0, 1), (77, 1, 1), (81, 2, 2)], 13: [(79, 0, 1.5), (81, 1.5, .5), (83, 2, 2)],
       14: [(83, 0, 1), (79, 1, 1), (76, 2, 2)], 15: [(81, 0, 4)]}
for r in range(3):
  for b, notes in mel.items():
    for n, st, d in notes: add(flute(n, d*B*0.95, 0.55), r*CYC+b*BAR+st*B, -0.05)
# light wind bed from the loop, swelling in and out
wb = np.tile(wind, (1, 8))[:, :M]; env = 0.04+0.05*np.sin(np.pi*np.arange(M)/(M/3))**2
L += wb/np.abs(wb).max()*env
# stereo reverb
def verb(sig, rt=2.6, seed=0):
    n = int(rt*SR); t = np.arange(n)/SR
    ir = np.random.default_rng(seed).standard_normal(n)*np.exp(-t*6.9/rt); ir[:int(.02*SR)] = 0
    K = 1 << (len(sig)+n-1).bit_length()
    return np.fft.irfft(np.fft.rfft(sig, K)*np.fft.rfft(ir, K), K)[:len(sig)]
wet = np.array([verb(L[0], seed=1), verb(L[1], seed=2)]); wet *= np.abs(L).max()/np.abs(wet).max()
mix = 0.72*L+0.38*wet
n0 = int(round(CYC*SR)); mix = mix[:, n0:2*n0]
save("bgm_skycity_loop", mix, -1.5)
