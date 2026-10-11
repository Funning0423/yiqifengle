import numpy as np, scipy.signal as ss, scipy.io.wavfile as wf
SR=32000; rng=np.random.default_rng(3)
# --- waves: 8 s seamless loop, two overlapping swells, circular construction
L=8*SR; t=np.arange(L)/SR
def circ_noise(seed):
    r=np.random.default_rng(seed); X=r.standard_normal(L//2+1)+1j*r.standard_normal(L//2+1)
    f=np.fft.rfftfreq(L,1/SR); X/=np.maximum(f,20)**0.8   # brownish, periodic by construction
    return np.fft.irfft(X,n=L)
n=circ_noise(1); n/=np.abs(n).max()
hiss=circ_noise(2); 
def band_circ(x,lo,hi):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=((f>lo)&(f<hi)); return np.fft.irfft(X,n=len(x))
rumble=band_circ(n,40,400); wash=band_circ(hiss,600,6000)
rumble/=np.abs(rumble).max(); wash/=np.abs(wash).max()
# swell envelopes periodic over 8 s: crest at 2.5 s and 6.5 s (different sizes)
def swell(c,w,a): d=((t-c+4)%8)-4; return a*np.exp(-(d/w)**2*0.5)*(1+0.6*(d>0))*np.exp(-np.maximum(d,0)*0.9)
env_r=0.35+swell(2.4,0.9,0.8)+swell(6.3,0.8,0.6)
env_w=0.12+swell(2.7,0.6,1.0)+swell(6.6,0.55,0.75)
waves=0.6*rumble*env_r+0.45*wash*env_w
waves/=np.abs(waves).max()/0.85
wf.write("amb_waves_loop.wav",SR,(waves*32767).astype(np.int16))
# --- seagulls: 3 short calls (FM chirps with downward "kyaa" glide)
def gull(f0,f1,dur,n_notes,gap):
    out=[]
    for k in range(n_notes):
        nn=int(dur*SR); tt=np.arange(nn)/SR; f=f0+(f1-f0)*(tt/dur)**0.6 + 60*np.sin(2*np.pi*28*tt)
        ph=2*np.pi*np.cumsum(f)/SR
        x=np.sin(ph)+0.5*np.sin(2*ph)+0.25*np.sin(3*ph)+0.12*np.sin(4*ph)
        x*= np.sin(np.pi*np.minimum(1,tt/dur))**0.7
        x+=0.08*rng.standard_normal(nn)*np.sin(np.pi*tt/dur)
        b,a=ss.butter(2,[700/(SR/2),5500/(SR/2)],'band'); x=ss.lfilter(b,a,x)
        out.append(x*(1-0.18*k)); out.append(np.zeros(int(gap*SR)))
    y=np.concatenate(out); return y/np.abs(y).max()*0.8
for i,(f0,f1,d,nn,g) in enumerate([(1900,1150,0.28,3,0.09),(2200,1300,0.22,2,0.07),(1700,1050,0.36,1,0.0)]):
    y=gull(f0,f1,d,nn,g); y=np.concatenate([y,np.zeros(int(0.15*SR))])
    wf.write(f"amb_gull_{i+1}.wav",SR,(y*32767).astype(np.int16))
