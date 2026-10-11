import numpy as np, subprocess, scipy.io.wavfile as wf
SR=44100
tiers=[("Good",3,[0,4,7]),("Great",4,[0,4,7,12]),("Excellent",5,[2,7,11,14]),("Amazing",6,[0,4,7,12,16,19])]
def ff(args): subprocess.run(["ffmpeg","-y","-loglevel","error"]+args,check=True)
def load(p):
    sr,x=wf.read(p); x=x.astype(np.float32); x/=32768 if x.dtype!=np.float32 else 1
    if x.ndim>1: x=x.mean(1)
    return x
def shifted(word,semis,out):
    r=2**(semis/12)
    ff(["-i",f"raw_{word}.wav","-af",f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,asetrate=22050*{r:.5f},aresample={SR},atempo={max(0.5,min(2,1/r*1.08)):.4f},highpass=f=180,acompressor=threshold=-18dB:ratio=4:attack=5:release=60","-ac","1",out])
    sr,x=wf.read(out); return x.astype(np.float32)/32768
def chime(notes,base=880):
    n=int(SR*0.55); out=np.zeros(n+int(SR*0.4),np.float32)
    for i,s in enumerate(notes):
        f=base*2**(s/12); t=np.arange(int(SR*0.45))/SR
        env=np.exp(-t*7)*np.minimum(1,t/0.004)
        tone=(np.sin(2*np.pi*f*t)+0.35*np.sin(2*np.pi*2*f*t)+0.15*np.sin(2*np.pi*3.01*f*t))*env
        st=int(i*SR*0.055); out[st:st+len(tone)]+=tone*0.5
    return out
for idx,(w,semi,notes) in enumerate(tiers):
    v=shifted(w,semi,f"v_{w}.wav"); h=shifted(w,semi+7,f"h_{w}.wav")
    L=max(len(v),len(h)); vv=np.zeros(L,np.float32); vv[:len(v)]+=v; vv[:len(h)]+=0.35*h
    c=chime(notes,base=784*2**(idx*2/12))
    lead=int(SR*0.04); total=max(len(c),lead+L)+int(SR*0.15)
    mix=np.zeros(total,np.float32); mix[:len(c)]+=0.55*c; mix[lead:lead+L]+=vv
    mix/=np.max(np.abs(mix))/0.9
    wf.write(f"dry_{w}.wav",SR,(mix*32767).astype(np.int16))
    ff(["-i",f"dry_{w}.wav","-af","aecho=0.8:0.6:45|90|140:0.35|0.22|0.12,alimiter=limit=0.89:level=false,afade=t=out:st=%.2f:d=0.12"%(total/SR+0.05),"-t","%.2f"%(total/SR+0.17),f"wet_{w}.wav"])
    ff(["-i",f"wet_{w}.wav","-ac","1","-ar","44100","-b:a","48k","-map_metadata","-1",f"sfx_cheer_{idx+1}_{w.lower()}.mp3"])
