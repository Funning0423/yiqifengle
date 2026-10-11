import numpy as np, scipy.signal as ss, scipy.io.wavfile as wf
SR=44100; BPM=92; BEAT=60/BPM; BAR=4*BEAT; NB=32; L=int(round(NB*BAR*SR))
rng=np.random.default_rng(42)
def m2f(m): return 440*2**((m-69)/12)
# F major. chords per bar (8-bar cycle): F C Dm Bb | F Am Bb C
prog=[[53,57,60],[48,52,55],[50,53,57],[46,50,53],[53,57,60],[45,48,52],[46,50,53],[48,52,55]]
# B section: Dm Bb F C | Gm Bb C C(sus)
progB=[[50,53,57],[46,50,53],[53,57,60],[48,52,55],[43,46,50],[46,50,53],[48,52,55],[48,53,55]]
chords=prog+progB+prog+progB[:4]+prog[4:]
def buf(): return np.zeros((2,L+SR*4),np.float32)
def add(b,x,t,pan=0.0,g=1.0):
    s=int(t*SR); n=len(x); l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    b[0,s:s+n]+=x*g*l; b[1,s:s+n]+=x*g*r
def adsr(n,a,d,s,r):
    a,d,r=int(a*SR),int(d*SR),int(r*SR); e=np.ones(n,np.float32)*s
    e[:a]=np.linspace(0,1,a); e[a:a+d]=np.linspace(1,s,d)[:max(0,min(d,n-a))]; e[-r:]*=np.linspace(1,0,r); return e
def pad_note(f,dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=np.zeros(n,np.float32)
    for det in (-0.12,0,0.11):
        ff=f*2**(det/12)
        for h,a in ((1,1),(2,0.35),(3,0.15),(4,0.07)): x+=a*np.sin(2*np.pi*ff*h*t+rng.uniform(0,6))
    return x*adsr(n,0.8,0.5,0.75,0.9)*(1+0.08*np.sin(2*np.pi*0.3*t))
def pluck(f,dur,bright=0.5):
    n=int(dur*SR); p=int(SR/f); x=np.zeros(n,np.float32); x[:p]=rng.uniform(-1,1,p)*np.hanning(p)
    for i in range(p,n): x[i]=0.996*(bright*x[i-p]+(1-bright)*0.5*(x[i-p]+x[i-p-1]))
    return x*adsr(n,0.002,0.1,0.8,0.3)
def kalimba(f,dur):
    n=int(dur*SR); t=np.arange(n)/SR
    x=np.sin(2*np.pi*f*t)*np.exp(-t*3.2)+0.25*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*14)+0.1*np.sin(2*np.pi*f*2*t)*np.exp(-t*6)
    return (x*np.minimum(1,t/0.003)).astype(np.float32)
def bell(f,dur):
    n=int(dur*SR); t=np.arange(n)/SR; mod=np.sin(2*np.pi*f*3.5*t)*2.2*np.exp(-t*4)
    return (np.sin(2*np.pi*f*t+mod)*np.exp(-t*2.2)*np.minimum(1,t/0.004)).astype(np.float32)
pads,bass,mel,arp,perc,wind=buf(),buf(),buf(),buf(),buf(),buf()
for b,ch in enumerate(chords):
    t0=b*BAR
    for i,m in enumerate(ch): add(pads,pad_note(m2f(m+12),BAR+0.9),t0,pan=(i-1)*0.5,g=0.06)
    root=ch[0]-12 if ch[0]>=48 else ch[0]
    for k,(off,ln) in enumerate([(0,1.5),(1.5,0.5),(2,2)]):
        n=int(ln*BEAT*SR); t=np.arange(n)/SR; f=m2f(root-12 if k!=1 else root-5)
        x=(np.sin(2*np.pi*f*t)+0.2*np.sin(2*np.pi*2*f*t))*adsr(n,0.01,0.2,0.7,0.12)
        add(bass,x.astype(np.float32),t0+off*BEAT,g=0.22)
    # arpeggio plucks (8ths) from bar 3 onward, lighter in first 2 bars
    if b>=2:
        notes=[ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+24,ch[2]+12,ch[1]+12,ch[0]+24,ch[2]+12]
        for k,m in enumerate(notes):
            add(arp,pluck(m2f(m),0.9,0.45),t0+k*BEAT/2+rng.uniform(0,0.006),pan=(-0.4 if k%2 else 0.4),g=0.09*(1.0 if k%4==0 else 0.75))
    # shaker 16ths from bar 9, soft
    if 8<=b<30:
        for k in range(16):
            n=int(0.06*SR); x=rng.standard_normal(n).astype(np.float32)*np.exp(-np.arange(n)/SR*60)
            add(perc,x,t0+k*BEAT/4+(0.012 if k%2 else 0),pan=0.3,g=0.018*(1.3 if k%4==2 else 0.8))
        # soft kick-ish thump on beats 1 and 3
        for k in (0,2):
            n=int(0.25*SR); t=np.arange(n)/SR; x=np.sin(2*np.pi*(55+60*np.exp(-t*30))*t)*np.exp(-t*12)
            add(perc,x.astype(np.float32),t0+k*BEAT,g=0.12)
# melody: F major pentatonic-ish, (bar, beat, midi, beats)
A=[(0,0,72,1.5),(0,1.5,74,0.5),(0,2,77,2),(1,0,76,1),(1,1,74,1),(1,2,72,2),(2,0,74,1.5),(2,1.5,72,0.5),(2,2,69,1),(2,3,72,1),(3,0,70,3),
   (4,0,72,1.5),(4,1.5,74,0.5),(4,2,77,1),(4,3,79,1),(5,0,81,2),(5,2,79,1),(5,3,76,1),(6,0,77,1.5),(6,1.5,76,0.5),(6,2,74,2),(7,0,72,2),(7,2,76,2)]
B=[(0,0,77,1),(0,1,76,1),(0,2,74,2),(1,0,74,1),(1,1,72,1),(1,2,70,2),(2,0,72,1),(2,1,74,1),(2,2,77,1),(2,3,81,1),(3,0,79,3),
   (4,0,79,1),(4,1,77,1),(4,2,74,2),(5,0,74,1),(5,1,77,1),(5,2,79,2),(6,0,81,1.5),(6,1.5,79,0.5),(6,2,77,1),(6,3,76,1),(7,0,77,3)]
sections=[(0,A,"k"),(8,B,"k"),(16,A,"b"),(24,B,"k")]
for sb,ph,inst in sections:
    for (bb,bt,m,ln) in ph:
        if sb==24 and bb>=4: continue
        t=(sb+bb)*BAR+bt*BEAT
        if inst=="k": add(mel,kalimba(m2f(m),ln*BEAT+1.2),t,pan=-0.1,g=0.16)
        else:
            add(mel,bell(m2f(m),ln*BEAT+1.5),t,pan=0.1,g=0.10); add(mel,kalimba(m2f(m-12),ln*BEAT+1.0),t+0.01,pan=-0.2,g=0.08)
# final 4 bars: reprise A tail (bars 4-7 of A) so loop returns to start smoothly
for (bb,bt,m,ln) in A:
    if bb>=4: add(mel,kalimba(m2f(m),ln*BEAT+1.2),(24+bb)*BAR+bt*BEAT,pan=-0.1,g=0.14)
# wind swells (the "breeze"): filtered noise, every 8 bars
for b in range(0,NB,8):
    n=int(6*BAR*SR); x=rng.standard_normal(n).astype(np.float32)
    bb,aa=ss.butter(2,[300/(SR/2),1400/(SR/2)],'band'); x=ss.lfilter(bb,aa,x).astype(np.float32)
    env=np.sin(np.linspace(0,np.pi,n))**2; add(wind,x*env,(b+1)*BAR,pan=rng.uniform(-0.6,0.6),g=0.05)
def wrap(b):  # fold tail past loop end back to the start -> seamless loop
    o=b[:,:L].copy(); tail=b[:,L:]; o[:,:tail.shape[1]]+=tail[:,:L]; return o
def reverb(x,dur=2.4,wet=0.25):
    n=int(dur*SR); t=np.arange(n)/SR; ir=np.stack([rng.standard_normal(n)*np.exp(-t*3.0/dur*2.3) for _ in range(2)]).astype(np.float32)
    bb,aa=ss.butter(1,5000/(SR/2)); ir=ss.lfilter(bb,aa,ir,axis=1); ir/=np.sqrt((ir**2).sum(1,keepdims=True))
    # circular convolution for seamless loop
    X=np.fft.rfft(x,axis=1); I=np.fft.rfft(np.pad(ir,((0,0),(0,L-n))),axis=1); y=np.fft.irfft(X*I,n=L,axis=1)
    return (1-wet)*x+wet*y*0.9
stems={k:wrap(v) for k,v in dict(pads=pads,bass=bass,mel=mel,arp=arp,perc=perc,wind=wind).items()}
mix=reverb(stems["pads"],3.0,0.35)+stems["bass"]+reverb(stems["mel"],2.4,0.3)+reverb(stems["arp"],2.0,0.25)+reverb(stems["perc"],1.2,0.12)+reverb(stems["wind"],2.0,0.3)
bb,aa=ss.butter(2,35/(SR/2),'high'); mix=ss.lfilter(bb,aa,mix,axis=1)
# re-wrap filter transient: run filter over 2 loops, keep second
mix2=ss.lfilter(bb,aa,np.concatenate([mix,mix],1),axis=1)[:,L:]; mix=mix2
mix/=np.abs(mix).max()/0.89
wf.write("bgm_loop.wav",SR,(mix.T*32767).astype(np.int16))
print("len s",L/SR)
