import numpy as np, subprocess, scipy.io.wavfile as wf
SR=44100; rng=np.random.default_rng(7)
tiers=[("Great",1,3,0.0),("Excellent",2,4,0.0),("Amazing",3,5,0.25),("Unbelievable",4,6,0.6)]
def ff(a): subprocess.run(["ffmpeg","-y","-loglevel","error"]+a,check=True)
def rd(p):
    sr,x=wf.read(p); x=x.astype(np.float32)
    if np.abs(x).max()>2: x/=32768
    return x if x.ndim==1 else x.mean(1)
def wr(p,x): wf.write(p,SR,(np.clip(x,-1,1)*32767).astype(np.int16))
def tts(text,out,ls=1.3,spk=None):
    subprocess.run(["./venv/bin/piper","-m","en_US-ljspeech-high.onnx","--length-scale",str(ls),"--noise-scale","0.9","--noise-w","1.0","-f","tmp.wav"],input=text.encode(),check=True,capture_output=True)
    ff(["-i","tmp.wav","-af","silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse","-ar",str(SR),"-ac","1",out]); return rd(out)
def shift(x,semis,formant=1.0,tempo=1.0):
    wr("s_in.wav",x); ff(["-i","s_in.wav","-af",f"rubberband=pitch={2**(semis/12):.5f}:tempo={tempo:.4f}:formant=preserved"+ (f",asetrate={int(SR*formant)},aresample={SR},atempo={1/formant:.4f}" if formant!=1.0 else ""),"s_out.wav"]); return rd("s_out.wav")
def glide(x,base,g,N=8):
    seg=len(x)//N; xf=int(SR*0.02); out=np.zeros(len(x)+SR,np.float32); pos=0
    for k in range(N):
        a=max(0,k*seg-xf); b=len(x) if k==N-1 else min(len(x),(k+1)*seg+xf)
        y=shift(x[a:b],base+g*(k/(N-1))**1.6); r=min(xf,len(y)//2); win=np.ones(len(y),np.float32)
        if a>0: win[:r]=np.linspace(0,1,r)
        if k<N-1: win[-r:]=np.linspace(1,0,r)
        out[a:a+len(y)]+=y*win
    return np.trim_zeros(out,'b')
def stretch_tail(x,frac,factor):
    cut=int(len(x)*(1-frac)); xf=int(SR*0.03)
    head=x[:cut+xf].copy(); tail=shift(x[cut:],0,tempo=1/factor)
    head[-xf:]*=np.linspace(1,0,xf); tail[:xf]*=np.linspace(0,1,xf)
    out=np.zeros(cut+len(tail),np.float32); out[:len(head)]+=head; out[cut:cut+len(tail)]+=tail
    # gentle vibrato-ish decay on held tail
    env=np.ones(len(out),np.float32); n=len(tail); env[-n:]=np.linspace(1,0.55,n); return out*env
def crowd_bed(n):
    noise=rng.standard_normal(n).astype(np.float32); wr("n.wav",noise)
    ff(["-i","n.wav","-af","bandpass=f=1100:w=1400,bandpass=f=1000:w=1600,tremolo=f=7:d=0.4","n2.wav"]); y=rd("n2.wav")[:n]
    t=np.arange(n)/SR; env=np.minimum(1,t/0.12)*np.exp(-np.maximum(0,t-0.35)*2.2); return y/np.abs(y).max()*env
cheers=None
for idx,(w,base,g,tailfrac) in enumerate(tiers):
    v=tts(w+"!",f"t4_{w}.wav")
    lead=glide(v,base,g)
    if tailfrac: lead=stretch_tail(lead,0.32 if w=="Unbelievable" else 0.25,2.2 if w=="Unbelievable" else 1.5)
    L=len(lead); total=L+int(SR*0.9); mix=np.zeros(total,np.float32); mix[:L]+=lead
    # crowd of voices: 7 doubles with varied pitch/formant/timing
    for j,(ps,fm,dl,gn) in enumerate([(-5,0.9,0.025,0.35),(-3,0.95,0.012,0.4),(3,1.06,0.018,0.35),(5,1.1,0.03,0.3),(7,1.12,0.04,0.25),(-7,0.88,0.035,0.3),(2,1.0,0.05,0.3)]):
        d=shift(lead,ps+rng.uniform(-0.3,0.3),formant=fm,tempo=rng.uniform(0.97,1.03)); s=int(SR*dl)
        n=min(len(d),total-s); mix[s:s+n]+=gn*d[:n]
    # background "yeah/woo" cheers
    for j,(txt,ps,fm,dl) in enumerate([("Yeah!",4,1.1,0.10),("Woo!",8,1.15,0.18),("Yay!",6,1.08,0.28),("Woo hoo!",2,0.95,0.38),("Yeah!",-2,0.9,0.22)]):
        c=shift(tts(txt,f"c_{j}.wav",ls=1.1),ps+idx,formant=fm); s=int(SR*dl)
        n=min(len(c),total-s); mix[s:s+n]+=(0.12+0.04*idx)*c[:n]
    mix+= (0.10+0.04*idx)*np.concatenate([crowd_bed(total)])
    mix/=np.abs(mix).max()/0.9; wr(f"d4_{w}.wav",mix)
    ff(["-i",f"d4_{w}.wav","-af","highpass=f=120,equalizer=f=3000:t=q:w=1:g=4,aecho=0.85:0.75:50|110|180:0.25|0.15|0.08,acompressor=threshold=-22dB:ratio=5:attack=3:release=80:makeup=5,afade=t=out:st=%.2f:d=0.35"%(total/SR-0.4),f"w4_{w}.wav"])
