import numpy as np, scipy.io.wavfile as w, scipy.signal as sg
SR=48000; rng=np.random.default_rng(7)
def hz(n): return 440*2**((n-69)/12)
N={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def m(s): return 12*(int(s[-1])+1)+N[s[0]]+(1 if '#' in s else 0)
def env(n,a,r):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/r); return e
def lp(x,f,o=4): return sg.sosfilt(sg.butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sg.sosfilt(sg.butter(o,f,'high',fs=SR,output='sos'),x)
def bp(x,a,b): return sg.sosfilt(sg.butter(2,[a,b],'band',fs=SR,output='sos'),x)
_,wc=w.read('/workspace/snow/wc.wav'); wc=wc.astype(float)/32768
strike=wc[int(0.72*SR):int(6.0*SR)].copy(); strike*=np.r_[np.linspace(0,1,96),np.ones(len(strike)-96)]; strike*=np.r_[np.ones(len(strike)-SR*2),np.linspace(1,0,SR*2)**2]
strike=hp(strike,250); strike/=abs(strike).max()
_,hw=w.read('/workspace/snow/hw.wav'); hw=hw.astype(float)/32768
def chime(note):
    r=hz(m(note))/1592.0; n=int(len(strike)/r)
    y=sg.resample(strike,n); return lp(y,5000)
def piano(f,d=4):
    n=int(d*SR); t=np.arange(n)/SR; y=0
    for k in range(1,9):
        fk=f*k*np.sqrt(1+0.0004*k*k)
        if fk>5000: break
        y=y+np.sin(2*np.pi*fk*t)*np.exp(-t*(0.6+0.5*k))/k**1.3
    return y*env(n,0.004,9)
def harp(f,d=4):
    n=int(d*SR); p=int(SR/f); buf=rng.uniform(-1,1,p); buf=lp(buf,3000,2); y=np.zeros(n)
    for i in range(n):
        y[i]=buf[i%p]; buf[i%p]=0.4985*(buf[i%p]+buf[(i+1)%p])
    return lp(y,4000)*np.minimum(1,np.arange(n)/48)
def acc(f,d):
    n=int(d*SR); t=np.arange(n)/SR; y=0
    for dt in (0,0.0025):
        ph=2*np.pi*f*(1+dt)*t; y=y+sg.sawtooth(ph,0.5)*0.5+np.sin(ph)
    a=np.minimum(1,t/0.12)*np.minimum(1,(d-t)/0.4).clip(0)
    return lp(y,1800)*a
def flute(f,d):
    n=int(d*SR); t=np.arange(n)/SR; vib=1+0.004*np.sin(2*np.pi*5*t)*np.minimum(1,t/0.6)
    ph=2*np.pi*np.cumsum(f*vib)/SR; y=np.sin(ph)+0.15*np.sin(2*ph)+0.04*np.sin(3*ph)
    br=bp(rng.normal(0,1,n),f*0.8,f*1.6)*0.05
    a=np.minimum(1,t/0.15)*np.minimum(1,(d-t)/0.6).clip(0)
    return (y+br)*a
def pad(fs,d,att=2.0,cut=1400):
    n=int(d*SR); t=np.arange(n)/SR; y=0
    for f in fs:
        for dt in (-0.003,0,0.003): y=y+sg.sawtooth(2*np.pi*f*(1+dt)*t+rng.uniform(0,6))
    a=np.minimum(1,t/att)*np.minimum(1,(d-t)/2.5).clip(0)
    return lp(y,cut)*a/len(fs)
def put(buf,x,t,g):
    i=int(t*SR); j=min(len(buf),i+len(x)); buf[i:j]+=x[:j-i]*g
def reverb(x,rt=2.8,mix=0.3):
    n=int(rt*SR); ir=rng.normal(0,1,n)*np.exp(-np.arange(n)/SR*6.9/rt); ir=lp(ir,3500)
    wet=sg.fftconvolve(x,ir)[:len(x)]; wet/=abs(wet).max()+1e-9
    return x/ (abs(x).max()+1e-9)*(1-mix)+wet*mix
def wind(dur,seed_off):
    a=hw[int(seed_off*SR):int((seed_off+dur)*SR)]
    low=lp(a,250)*1.0; gust=bp(a,250,1400)*0.5
    lfo=0.6+0.4*np.sin(2*np.pi*np.arange(len(a))/SR/9.0)
    return low+gust*lfo
def finish(x,dur,name):
    n=int(dur*SR); x=x[:n]; t=np.arange(n)/SR
    x*=np.minimum(1,t/1.5)*np.minimum(1,((dur-t)/3.0)).clip(0)**1.5
    x=hp(x,40); x/=abs(x).max(); x*=0.5
    w.write(name,SR,(np.c_[x,x]*32767).astype(np.int16))
# --- snow pass: C major, 66 bpm
D=29; b=60/66; S=np.zeros(D*SR+SR*8)
put(S,pad([hz(48),hz(55),hz(64)],14,4,900),1.0,0.35)
put(S,pad([hz(45),hz(52),hz(60)],8,3,900),14.0,0.3)   # Am color
put(S,pad([hz(48),hz(55),hz(62),hz(67)],13,3,900),20.5,0.3) # Cadd9
mot=['G5','C6','D6','E6','D6']; t0=4.0
for k,nn in enumerate(mot): put(S,chime(nn),t0+k*b*2,0.55)
for k,nn in enumerate(mot): put(S,chime(nn),16.0+k*b*2.5,0.45)
put(S,chime('G5'),25.0,0.35)
S=reverb(S,3.5,0.35)
W=wind(len(S)/SR,30); W/=abs(W).max()
finish(S/abs(S).max()*0.8+W*0.45,D,'/workspace/fq/snow.wav')
# --- finale excerpt: G major, 72 bpm
D=30; b=60/72; F=np.zeros(D*SR+SR*8)
mg=['D5','G5','A5','B5','A5']  # motif in G: 5-1-2-3-2
put(F,pad([hz(43),hz(55),hz(62)],28,3,1100),0.5,0.25)
for k,nn in enumerate(['D6','G6','A6']): put(F,chime(nn),1.5+k*b*1.5,0.4)            # chime (snow)
for k,nn in enumerate(['B4','D5','G5','A5','B5']): put(F,piano(hz(m(nn))),5.5+k*b*0.75,0.35) # piano (sky)
for k,nn in enumerate(['G3','D4','G4','B4','D5','G4']): put(F,harp(hz(m(nn))),9.0+k*b*0.5,0.4) # harp (lake)
put(F,acc(hz(m('G4')),2.6),12.0,0.18); put(F,acc(hz(m('B4')),2.0),12.0,0.14); put(F,acc(hz(m('D5')),2.6),13.4,0.12)
# ensemble theme 15.0
tt=15.0; lens=[1,1,1,1.5,2.5]
for nn,l in zip(mg,lens):
    put(F,flute(hz(m(nn)),l*b+0.3),tt,0.30); put(F,piano(hz(m(nn))-0,3),tt,0.25); put(F,harp(hz(m(nn))/2,3),tt,0.3); tt+=l*b
put(F,pad([hz(43),hz(50),hz(59),hz(67)],6,1.5,1400),15.0,0.35)
put(F,acc(hz(m('G3')),5),15.0,0.12)
# solo flute last phrase
tt=21.6
for nn,l in zip(['E5','D5','B4','D5'],[1,1,1.2,3.5]): put(F,flute(hz(m(nn)),l*b+0.3),tt,0.32); tt+=l*b
put(F,chime('G6'),27.0,0.2)
F=reverb(F,3.0,0.3)
W=wind(len(F)/SR,40); W/=abs(W).max(); W*=np.clip((np.arange(len(F))/SR-20)/6,0.25,1)
finish(F/abs(F).max()*0.8+W*0.3,D,'/workspace/fq/finale.wav')
