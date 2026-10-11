import numpy as np, subprocess, scipy.io.wavfile as wf, os
SR=44100
tiers=[("Great","Great!",1,3,[0,4,7]),("Excellent","Excellent!",2,4,[0,4,7,12]),("Amazing","Amazing!",3,5,[2,7,11,14]),("Unbelievable","Unbelievable!",4,6,[0,4,7,12,16,19])]
def ff(a): subprocess.run(["ffmpeg","-y","-loglevel","error"]+a,check=True)
def rd(p):
    sr,x=wf.read(p); x=x.astype(np.float32)
    if x.dtype!=np.float32 or np.abs(x).max()>2: x/=32768
    return x if x.ndim==1 else x.mean(1)
def chime(notes,base):
    t=np.arange(int(SR*0.5))/SR; out=np.zeros(int(SR*0.9),np.float32)
    for i,s in enumerate(notes):
        f=base*2**(s/12); env=np.exp(-t*8)*np.minimum(1,t/0.003)
        tone=(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*2*f*t))*env
        st=int(i*SR*0.045); out[st:st+len(t)]+=tone*0.5
    return out
for idx,(w,text,base,glide,notes) in enumerate(tiers):
    raw=f"x_{w}.wav"
    subprocess.run(["./venv/bin/piper","-m","en_US-ljspeech-high.onnx","--length-scale","1.3","--noise-scale","0.85","--noise-w","0.9","-f",raw],input=text.encode(),check=True,capture_output=True)
    ff(["-i",raw,"-af","silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse","-ar",str(SR),"-ac","1",f"t_{w}.wav"])
    x=rd(f"t_{w}.wav"); N=8; seg=len(x)//N; xf=int(SR*0.02); out=np.zeros(len(x)+xf,np.float32)
    for k in range(N):
        a=max(0,k*seg-xf); b=min(len(x),(k+1)*seg+xf)
        wf.write("seg.wav",SR,(x[a:b]*32767).astype(np.int16))
        semis=base+glide*(k/(N-1))**1.6
        ff(["-i","seg.wav","-af",f"rubberband=pitch={2**(semis/12):.5f}:formant=preserved","seg2.wav"])
        y=rd("seg2.wav")[:b-a]; win=np.ones(len(y),np.float32); r=min(xf,len(y)//2)
        if a>0: win[:r]=np.linspace(0,1,r)
        if b<len(x): win[-r:]=np.linspace(1,0,r)
        out[a:a+len(y)]+=y*win
    v=out[:len(x)]
    wf.write(f"g_{w}.wav",SR,(v/np.abs(v).max()*0.9*32767).astype(np.int16))
    ff(["-i",f"g_{w}.wav","-af","highpass=f=160,equalizer=f=3000:t=q:w=1:g=6,aexciter=amount=2:drive=6,chorus=0.7:0.9:40|60:0.3|0.2:0.25|0.4:2|1.5,acompressor=threshold=-24dB:ratio=6:attack=2:release=50:makeup=6",f"vp_{w}.wav"])
    v=rd(f"vp_{w}.wav"); c=chime(notes,880*2**(idx*2/12))
    cst=max(0,len(v)-int(SR*0.18)); total=cst+len(c)
    mix=np.zeros(total,np.float32); mix[:len(v)]+=v; mix[cst:cst+len(c)]+=0.18*c
    mix/=np.abs(mix).max()/0.9
    wf.write(f"d3_{w}.wav",SR,(mix*32767).astype(np.int16))
    ff(["-i",f"d3_{w}.wav","-af","aecho=0.9:0.7:40|85:0.15|0.07,afade=t=out:st=%.2f:d=0.15"%(total/SR-0.1),f"w3_{w}.wav"])
