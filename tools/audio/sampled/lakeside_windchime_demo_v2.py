"""Lakeside 「风起」 sampled-instrument demo v2 (30 s, F major) — sparse, quiet, clean wind chime.
MODE v1 reproduces the 01 arrangement (for stem measurement); v2 = chime accent only:
-9 dB, scheduled only in melody gaps (from the flute/clarinet note timeline), 1.4 s tail, less room, high shelf cut.
Usage: python3 lakeside_windchime_demo_v2.py VSCO_DIR WINDCHIME_WAV OUT_WAV [v1|v2] [STEM_DIR]
All timbres come from recorded samples: VSCO-2-CE (CC0) harp/flute/clarinet/viola/cello
and Wikimedia 'Windchime.ogg' (public domain). Processing only: resample pitch, gain, EQ,
fades, and a convolution room (noise-decay IR = processing, not an instrument timbre).
Usage: python3 lakeside_windchime_demo.py VSCO_DIR WINDCHIME_WAV OUT_WAV
"""
import sys, glob, os, re, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
SR=48000; rng=np.random.default_rng(11)
V, WC, OUT = sys.argv[1:4]
MODE=sys.argv[4] if len(sys.argv)>4 else "v2"; STEMS=sys.argv[5] if len(sys.argv)>5 else None
N={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def midi(s):
    m=re.match(r'([A-G])(#?)(-?\d)',s); return 12*(int(m.group(3))+1)+N[m.group(1)]+(1 if m.group(2) else 0)
def load(p):
    sr,x=w.read(p); x=x.astype(float)
    if x.dtype.kind!='f': pass
    x/= (2**31 if abs(x).max()>40000 else 32768)
    if x.ndim==1: x=np.stack([x,x],1)
    if sr!=SR: x=sg.resample_poly(x,SR,sr,axis=0)
    return x
def bank(pattern, rx):
    b={}
    for p in glob.glob(os.path.join(V,pattern)):
        m=re.search(rx,os.path.basename(p))
        if m: b.setdefault(midi(m.group(1)),p)
    return b
def note(b,n,dur=None,fade=0.8,start=0.0):
    k=min(b,key=lambda k:abs(k-n)); x=load(b[k]); x=x[int(start*SR):]
    r=2**((n-k)/12)
    if r!=1: x=sg.resample(x,int(len(x)/r),axis=0)
    if dur:
        L=min(len(x),int((dur+fade)*SR)); x=x[:L].copy(); f=int(min(fade*SR,L//2))
        x[-f:]*=(np.cos(np.linspace(0,np.pi/2,f))**2)[:,None]
    x[:64]*=np.linspace(0,1,64)[:,None]
    return x
harp=bank('Strings/Harp/*.wav',r'KSHarp_([A-G]#?\d)')
flute=bank('Woodwinds/Flute/susvib/*_v1_1.wav',r'susvib_([A-G]#?\d)')
clar=bank('Woodwinds/Clarinet/susLong/*_v1_rr1_sum.wav',r'susLong_([A-G]#?\d)')
vla=bank('Strings/Viola Section/susvib/*_v1_1.wav',r'susvib_([A-G]#?\d)')
vc=bank('Strings/Cello Section/susvib/*_v1_1.wav',r'susvib_([A-G]#?\d)')
D=30.0; buf={k:np.zeros((int((D+4)*SR),2)) for k in ('melody','strings','chime')}
mel_notes=[]
def put(x,t,g,pan=0.0,stem='melody'):
    out=buf[stem]; i=int(t*SR); j=min(len(out),i+len(x)); l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    out[i:j,0]+=x[:j-i,0]*g*l*1.414; out[i:j,1]+=x[:j-i,1]*g*r*1.414
# wind chime strike from the PD recording, retuned to motif tones
sr,wc=w.read(WC); wc=wc.astype(float)/32768
if wc.ndim>1: wc=wc.mean(1)
if sr!=SR: wc=sg.resample_poly(wc,SR,sr)
st=wc[int(0.72*SR):int(6.0*SR)].copy(); st[:96]*=np.linspace(0,1,96); st[-2*SR:]*=np.linspace(1,0,2*SR)**2
st=sg.sosfilt(sg.butter(2,250,'high',fs=SR,output='sos'),st); st/=abs(st).max()
def chime(n):
    r=440*2**((n-69)/12)/1592.0; y=sg.resample(st,int(len(st)/r)); y=sg.sosfilt(sg.butter(4,4500,'low',fs=SR,output='sos'),y)
    return np.stack([y,y],1)
F,C,G,A=0,0,0,0
# chords (bar = 4 s, 60 bpm feel): F  Dm  Bb  C  F  Bb  C  F
chords=[('F2','C3','A3'),('D2','A2','F3'),('A#1','F2','D3'),('C2','G2','E3'),('F2','C3','A3'),('A#1','F2','D3'),('C2','G2','E3'),('F2','C3','A3')]
for i,(b,m1,m2) in enumerate(chords):
    t=i*3.6+0.3; d=3.9 if i<7 else 5.0
    put(note(vc,midi(b),d,1.5),t,0.20,-0.3,'strings'); put(note(vla,midi(m1),d,1.5),t,0.15,0.2,'strings'); put(note(vla,midi(m2),d,1.5),t,0.11,0.35,'strings')
    # harp: slow rolled arpeggio up
    tones=[midi(b)+12,midi(m1)+12,midi(m2)+12,midi(m1)+24,midi(m2)+24]
    for k,n in enumerate(tones):
        if t+k*0.55<D-2: put(note(harp,n),t+k*0.55,0.22 if k else 0.26,-0.4+0.2*k)
# motif 「风起」 in F: C F G A G
mot=['C5','F5','G5','A5','G5']; dur=[1.2,1.2,1.2,1.8,3.0]
t=3.9
for n,d in zip(mot,dur): put(note(flute,midi(n),d,0.9),t,0.16,0.15); mel_notes.append((t,t+d+0.9)); t+=d
t=18.3; mot2=['C4','F4','G4','A4','F4']; dur2=[1.2,1.2,1.2,1.8,4.0]
for n,d in zip(mot2,dur2): put(note(clar,midi(n),d,1.2),t,0.17,-0.15); mel_notes.append((t,t+d+1.2)); t+=d
CH_TAIL=1.4
def chime_v2(n):
    y=chime(n)[:,0]; L=int(CH_TAIL*SR); y=y[:L].copy(); f=int(0.9*SR); y[-f:]*=np.cos(np.linspace(0,np.pi/2,f))**2
    # gentle high shelf: -6 dB above ~3 kHz (blend with 3 kHz low-pass), plus 5 kHz LP
    lp=sg.sosfilt(sg.butter(2,3000,'low',fs=SR,output='sos'),y); y=0.5*y+0.5*lp
    y=sg.sosfilt(sg.butter(2,5000,'low',fs=SR,output='sos'),y)
    return np.stack([y,y],1)
if MODE=='v1':
    hits=[(1.2,'C6'),(9.6,'F6'),(10.4,'G6'),(14.0,'A6'),(15.1,'G6'),(25.2,'C6'),(26.0,'F6'),(27.4,'G6')]
    for tt,n in hits: put(chime(midi(n)),tt,0.07,rng.uniform(-0.6,0.6),'chime')
    ch_len=len(chime(midi('C6')))/SR; CH_WET=0.32
else:
    # gaps: before flute (0-3.9), between flute end and clarinet (13.2-18.3); downbeats 0.3+3.6k
    hits=[(2.1,'C6',-0.4),(14.7,'F6',0.35),(16.5,'G6',-0.25)]
    for tt,n,p in hits: put(chime_v2(midi(n)),tt,0.07*10**(-9/20),p,'chime')
    ch_len=CH_TAIL; CH_WET=0.12
overl=sum(1 for h in hits for a,b in mel_notes if h[0]<b and h[0]+ch_len>a)
print('MODE',MODE,'chime hits',len(hits),'overlaps with melody notes',overl,'chime sounding length s',round(ch_len,2))
# room: decaying-noise IR convolution (processing only)
n=int(2.6*SR); ir=rng.normal(0,1,(n,2))*np.exp(-np.arange(n)/SR*6.9/2.6)[:,None]
ir=sg.sosfilt(sg.butter(2,[200,4000],'band',fs=SR,output='sos'),ir,axis=0)
out=sum(buf.values())
wetf=lambda x: np.stack([sg.fftconvolve(x[:,c],ir[:,c])[:len(x)] for c in (0,1)],1)
wets={k:wetf(v) for k,v in buf.items()}
sc=abs(out).max()/abs(sum(wets.values())).max()
stems={k:buf[k]*0.78+wets[k]*sc*(CH_WET if k=='chime' else 0.32) for k in buf}
def post(y):
    y=sg.sosfilt(sg.butter(2,3800,'low',fs=SR,output='sos'),y,axis=0)*0.5+y*0.5
    y=y[:int(D*SR)].copy(); t=np.arange(len(y))/SR
    y*=np.minimum(1,t/1.0)[:,None]; fo=t>D-4; y[fo]*=(np.cos((t[fo]-(D-4))/4*np.pi/2)**2)[:,None]
    return y
stems={k:post(v) for k,v in stems.items()}
y=sum(stems.values())
g=0.7/abs(y).max(); y*=g
w.write(OUT,SR,(y*32767).astype(np.int16))
if STEMS:
    os.makedirs(STEMS,exist_ok=True)
    for k,v in stems.items(): w.write(os.path.join(STEMS,MODE+'_'+k+'.wav'),SR,(np.clip(v*g,-1,1)*32767).astype(np.int16))
