import numpy as np, subprocess, scipy.io.wavfile as wf
exec(open("make_v4.py").read().split("cheers=None")[0])  # reuse helpers (tts, shift, glide, stretch_tail)
tiers=[("Great",1,3,0),("Excellent",2,4,0),("Amazing",3,5,0.2),("Unbelievable",4,6,0.32)]
for idx,(w,base,g,tf) in enumerate(tiers):
    v=tts(w+"!",f"t5_{w}.wav")
    lead=glide(v,base,g)
    if tf: lead=stretch_tail(lead,tf,1.9 if w=="Unbelievable" else 1.35)
    L=len(lead); total=L+int(SR*0.45); mix=np.zeros(total,np.float32); mix[:L]+=lead
    # two light natural doubles for a fuller "group" feel (no formant tricks)
    for ps,dl,gn in [(-2.5,0.014,0.22),(2.5,0.024,0.18)]:
        d=shift(lead,ps); s=int(SR*dl); n=min(len(d),total-s); mix[s:s+n]+=gn*d[:n]
    t=np.arange(int(SR*0.45))/SR; c=np.zeros(len(t),np.float32)
    for i,sm in enumerate([0,4,7,12][:2+idx//2+1]):
        f=880*2**((idx*2+sm)/12); st=int(i*SR*0.045); env=np.exp(-t*9)*np.minimum(1,t/0.003)
        c[st:]+= (np.sin(2*np.pi*f*t)*env*0.5)[:len(c)-st]
    cs=max(0,L-int(SR*0.12)); n=min(len(c),total-cs); mix[cs:cs+n]+=0.12*c[:n]
    mix/=np.abs(mix).max()/0.9; wr(f"d5_{w}.wav",mix)
    ff(["-i",f"d5_{w}.wav","-af","highpass=f=140,equalizer=f=2600:t=q:w=1.2:g=3,aecho=0.9:0.8:35:0.10,acompressor=threshold=-22dB:ratio=5:attack=3:release=60:makeup=5,afade=t=out:st=%.2f:d=0.2"%(total/SR-0.22),f"w5_{w}.wav"])
