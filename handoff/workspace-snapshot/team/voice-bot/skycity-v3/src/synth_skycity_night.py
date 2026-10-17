# Voice Bot - Sky City night wind loop v0.1 (numpy only, original). Run from skycity-v3/: python3 src/synth_skycity_night.py
# Same seamless method as skycity-v1 wind (circular FFT noise, all LFO periods divide 30 s),
# but calmer and darker, with a very faint high "star" shimmer.
import numpy as np, wave, os
SR = 44100; OUT = "wav"; os.makedirs(OUT, exist_ok=True)
D = 30.0; N = int(D*SR); x = np.arange(N)/SR; fr = np.fft.rfftfreq(N, 1/SR)
def circ(c, width, seed):
    n = np.random.default_rng(seed).standard_normal(N)
    m = np.exp(-0.5*((np.log(fr+1)-np.log(c))/width)**2)
    y = np.fft.irfft(np.fft.rfft(n)*m, N); return y/y.std()
def lfo(k, ph): return 0.5+0.5*np.sin(2*np.pi*k*x/D+ph)
out = []
for ch in range(2):
    s = 0.0*x
    for i, (c, w, g, k) in enumerate([(180, .5, 1.0, 1), (380, .45, .7, 2), (700, .4, .4, 3), (1300, .35, .15, 5)]):
        s += g*circ(c, w, 900+10*ch+i)*(0.35+0.65*lfo(k, 0.9*i+ch*0.6)**2)
    s += 0.06*circ(1100, .04, 950+ch)*lfo(2, 2.0+ch)**4          # one soft, low whistle
    tw = 0.0*x                                                    # faint star shimmer: soft high sine pings
    for j, f in enumerate([2637, 3136, 3520, 3951, 4699]):
        f = round(f*D)/D; tw += np.sin(2*np.pi*f*x)*np.clip(np.sin(2*np.pi*(j+3)*x/D+j*1.7+ch), 0, 1)**12
    out.append(s + 0.35*tw)
st = np.array(out); st = st/np.abs(st).max()*10**(-3/20)
with wave.open(f"{OUT}/amb_skycity_wind_night.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st.T*32767).astype(np.int16).tobytes())
