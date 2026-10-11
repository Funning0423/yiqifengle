import numpy as np, subprocess, scipy.io.wavfile as wf
exec(open("make_v4.py").read().split("cheers=None")[0])
lead0=rd("g_Unbelievable.wav")   # v3 glided voice, before v3 effects
def sparkle(dur,f0,f1,n=14,gain=0.5):
    out=np.zeros(int(SR*(dur+0.6)),np.float32); t=np.arange(int(SR*0.5))/SR
    for i in range(n):
        f=f0*(f1/f0)**(i/(n-1)); st=int(SR*dur*i/n); env=np.exp(-t*10)*np.minimum(1,t/0.002)
        tone=(np.sin(2*np.pi*f*t)+0.25*np.sin(2*np.pi*2*f*t))*env*(0.6+0.4*i/n)
        out[st:st+len(t)]+=tone
    return out/np.abs(out).max()*gain
def boom():
    t=np.arange(int(SR*0.35))/SR; f=90*np.exp(-t*6)+45
    return (np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)).astype(np.float32)
variants={
 "A":dict(tf=0.30,fac=1.6,lift=0,hall="aecho=0.9:0.75:60|130:0.16|0.08",sp=(0.5,1200,3200),boom=False),
 "B":dict(tf=0.32,fac=2.1,lift=1.5,hall="aecho=0.9:0.8:70|150|240:0.18|0.11|0.06",sp=(0.8,1000,4200),boom=False),
 "C":dict(tf=0.32,fac=1.9,lift=1.0,hall="aecho=0.9:0.78:60|140|220:0.16|0.10|0.05",sp=(0.6,1400,4800),boom=True),
}
for k,p in variants.items():
    v=stretch_tail(lead0,p["tf"],p["fac"])
    if p["lift"]:
        cut=int(len(v)*0.7); xf=int(SR*0.03); hd=v[:cut+xf].copy(); tl=shift(v[cut:],p["lift"])
        hd[-xf:]*=np.linspace(1,0,xf); tl[:xf]*=np.linspace(0,1,xf); v2=np.zeros(cut+len(tl),np.float32); v2[:len(hd)]+=hd; v2[cut:]+=tl; v=v2
    wr("u_v.wav",v/np.abs(v).max()*0.9)
    ff(["-i","u_v.wav","-af","highpass=f=160,equalizer=f=3000:t=q:w=1:g=6,aexciter=amount=2:drive=6,chorus=0.7:0.9:40|60:0.3|0.2:0.25|0.4:2|1.5,acompressor=threshold=-24dB:ratio=6:attack=2:release=50:makeup=6","u_vp.wav"])
    v=rd("u_vp.wav"); L=len(v); total=L+int(SR*0.8); mix=np.zeros(total,np.float32)
    off=int(SR*0.03) if p["boom"] else 0
    mix[off:off+L]+=v
    if p["boom"]: b=boom(); mix[:len(b)]+=0.45*b
    d,f0,f1=p["sp"]; s=sparkle(d,f0,f1); st=int(L*0.55); n=min(len(s),total-st); mix[st:st+n]+=0.22*s[:n]
    mix/=np.abs(mix).max()/0.9; wr(f"ud_{k}.wav",mix)
    ff(["-i",f"ud_{k}.wav","-af",p["hall"]+",afade=t=out:st=%.2f:d=0.35"%(total/SR-0.4),f"uw_{k}.wav"])
