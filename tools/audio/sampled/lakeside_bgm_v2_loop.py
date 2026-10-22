"""Lakeside 「风起」 BGM v2 — full-length seamless loop for main-line levels 13-16 (replaces bgm_lakeside).
Same arrangement/timbres as lakeside_windchime_demo_v2.py (v2 chime: -9 dB, melody gaps only, 1.4 s tail,
less room, high shelf), extended to 16 bars x 3.6 s = 57.6 s:
  pass A (bars 1-8): flute motif C5 F5 G5 A5 G5, clarinet answer C4 F4 G4 A4 F4
  pass B (bars 9-16): clarinet states the motif, flute answers resolving to F5
Seamless by construction: every note/tail that runs past 57.6 s wraps to the start (circular score),
room is a circular convolution, filters run on 3 tiled copies and the middle copy is kept. No fades.
Mastered like bgm_lakeside (-17.4 LUFS integrated) so its relation to amb_lake_loop / waterbirds is unchanged.
Usage: python3 lakeside_bgm_v2_loop.py VSCO_DIR WINDCHIME_WAV OUT_WAV
Sources: VSCO-2-CE (CC0) harp/flute/clarinet/viola/cello; Wikimedia 'Windchime.ogg' (public domain).
"""
import sys, glob, os, re, subprocess, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
SR=48000; rng=np.random.default_rng(11)
V, WC, OUT = sys.argv[1:4]
BAR=3.6; BARS=16; D=BAR*BARS; NS=int(round(D*SR))
N={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def midi(s):
    m=re.match(r'([A-G])(#?)(-?\d)',s); return 12*(int(m.group(3))+1)+N[m.group(1)]+(1 if m.group(2) else 0)
def load(p):
    sr,x=w.read(p); x=x.astype(float); x/=(2**31 if abs(x).max()>40000 else 32768)
    if x.ndim==1: x=np.stack([x,x],1)
    if sr!=SR: x=sg.resample_poly(x,SR,sr,axis=0)
    return x
def bank(pattern, rx):
    b={}
    for p in glob.glob(os.path.join(V,pattern)):
        m=re.search(rx,os.path.basename(p))
        if m: b.setdefault(midi(m.group(1)),p)
    return b
def note(b,n,dur=None,fade=0.8):
    k=min(b,key=lambda k:abs(k-n)); x=load(b[k]); r=2**((n-k)/12)
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
buf={k:np.zeros((NS,2)) for k in ('melody','strings','chime')}
mel=[]
def put(x,t,g,pan=0.0,stem='melody'):
    out=buf[stem]; l=np.cos((pan+1)*np.pi/4)*1.414; r=np.sin((pan+1)*np.pi/4)*1.414
    idx=(int(t*SR)+np.arange(len(x)))%NS          # circular: tails wrap into the loop start
    np.add.at(out[:,0],idx,x[:,0]*g*l); np.add.at(out[:,1],idx,x[:,1]*g*r)
sr,wc=w.read(WC); wc=wc.astype(float)/(32768 if wc.dtype.kind=='i' else 1)
if wc.ndim>1: wc=wc.mean(1)
if sr!=SR: wc=sg.resample_poly(wc,SR,sr)
st=wc[int(0.72*SR):int(6.0*SR)].copy(); st[:96]*=np.linspace(0,1,96); st[-2*SR:]*=np.linspace(1,0,2*SR)**2
st=sg.sosfilt(sg.butter(2,250,'high',fs=SR,output='sos'),st); st/=abs(st).max()
def chime_v2(n):
    r=440*2**((n-69)/12)/1592.0; y=sg.resample(st,int(len(st)/r)); y=sg.sosfilt(sg.butter(4,4500,'low',fs=SR,output='sos'),y)
    y=y[:int(1.4*SR)].copy(); f=int(0.9*SR); y[-f:]*=np.cos(np.linspace(0,np.pi/2,f))**2
    lp=sg.sosfilt(sg.butter(2,3000,'low',fs=SR,output='sos'),y); y=0.5*y+0.5*lp
    y=sg.sosfilt(sg.butter(2,5000,'low',fs=SR,output='sos'),y); return np.stack([y,y],1)
chords=[('F2','C3','A3'),('D2','A2','F3'),('A#1','F2','D3'),('C2','G2','E3'),('F2','C3','A3'),('A#1','F2','D3'),('C2','G2','E3'),('F2','C3','A3')]*2
for i,(b,m1,m2) in enumerate(chords):
    t=i*BAR+0.3; d=3.9
    put(note(vc,midi(b),d,1.5),t,0.20,-0.3,'strings'); put(note(vla,midi(m1),d,1.5),t,0.15,0.2,'strings'); put(note(vla,midi(m2),d,1.5),t,0.11,0.35,'strings')
    for k,n in enumerate([midi(b)+12,midi(m1)+12,midi(m2)+12,midi(m1)+24,midi(m2)+24]): put(note(harp,n),t+k*0.55,0.22 if k else 0.26,-0.4+0.2*k)
def phrase(bk,notes,durs,t,g,pan,fade):
    for n,d in zip(notes,durs): put(note(bk,midi(n),d,fade),t,g,pan); mel.append((t,t+d+fade)); t+=d
P=8*BAR
phrase(flute,['C5','F5','G5','A5','G5'],[1.2,1.2,1.2,1.8,3.0],3.9,0.16,0.15,0.9)
phrase(clar,['C4','F4','G4','A4','F4'],[1.2,1.2,1.2,1.8,4.0],18.3,0.17,-0.15,1.2)
phrase(clar,['C4','F4','G4','A4','G4'],[1.2,1.2,1.2,1.8,3.0],P+3.9,0.17,-0.15,1.2)
phrase(flute,['C5','F5','G5','A5','F5'],[1.2,1.2,1.2,1.8,3.6],P+18.3,0.15,0.15,0.9)
hits=[(2.1,'C6',-0.4),(14.7,'F6',0.35),(16.5,'G6',-0.25),(P+1.2,'F6',0.3),(P+15.1,'C6',-0.35),(P+16.7,'G6',0.25)]
for tt,n,p in hits: put(chime_v2(midi(n)),tt,0.07*10**(-9/20),p,'chime')
ov=sum(1 for h in hits for a,b in mel if h[0]<b and h[0]+1.4>a)
print('loop s',D,'chime hits',len(hits),'chime/melody overlaps',ov)
n=int(2.6*SR); ir=rng.normal(0,1,(n,2))*np.exp(-np.arange(n)/SR*6.9/2.6)[:,None]
ir=sg.sosfilt(sg.butter(2,[200,4000],'band',fs=SR,output='sos'),ir,axis=0)
cconv=lambda x: np.stack([np.fft.irfft(np.fft.rfft(x[:,c])*np.fft.rfft(ir[:,c],NS),NS) for c in (0,1)],1)
dry=sum(buf.values()); wets={k:cconv(v) for k,v in buf.items()}
sc=abs(dry).max()/abs(sum(wets.values())).max()
y=sum(buf[k]*0.78+wets[k]*sc*(0.12 if k=='chime' else 0.32) for k in buf)
y3=np.vstack([y,y,y]); y3=sg.sosfilt(sg.butter(2,3800,'low',fs=SR,output='sos'),y3,axis=0)*0.5+y3*0.5
y3=sg.sosfilt(sg.butter(2,40,'high',fs=SR,output='sos'),y3,axis=0); y=y3[NS:2*NS]
def lufs(x):
    p='/tmp/_bgmv2_n.wav'; w.write(p,SR,x.astype(np.float32))
    r=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',p,'-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS',r)[-1]),float(re.findall(r'Peak:\s+(-?[\d.inf]+) dBFS',r)[-1])
for _ in range(3):
    I,tp=lufs(np.vstack([y,y])); y*=10**((-17.4-I)/20)
I,tp=lufs(np.vstack([y,y])); print('LUFS',I,'TP',tp)
w.write(OUT,SR,y.astype(np.float32))
