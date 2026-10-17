import numpy as np, wave
def rd(p):
    w=wave.open(p);return np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(float)/32768
SR=16000;N=1024;H=160
def spec(x):
    n=(len(x)-N)//H; win=np.hanning(N)
    F=np.array([np.abs(np.fft.rfft(x[i*H:i*H+N]*win)) for i in range(n)])
    return F
s=spec(rd('h_sting.wav'))
M={'12_sail_day_p750':(27.50,0.163),'12_sail_night_p750':(27.64,0.131),'13_sail_day_p750':(27.55,0.133),'13_sail_night_p750':(27.56,0.143)}
L=int(2.5*100)
for k,(ss,off) in M.items():
    x=rd('h_'+k+'.wav'); a=int((ss-off-5)*SR); x=x[a:]
    r=spec(x)
    # whitened: per-band subtract recording's median (bgm) power
    bg=np.median(r**2,axis=0)
    rr=np.log(r**2+1e-10)-np.log(bg+1e-10)
    st=s[:L]**2; sl=np.log(st+1e-10)-np.log(np.median(s**2,axis=0)+1e-10)
    sl=(sl-sl.mean()); 
    sc=[]
    for d in range(0,len(rr)-L):
        y=rr[d:d+L]; y=y-y.mean(); sc.append((y*sl).sum()/np.sqrt((y*y).sum()*(sl*sl).sum()))
    sc=np.array(sc); o=np.argsort(sc)[::-1][:3]
    print(k,['onset %.2f (sailStart%+.2f) r=%.3f'%(a/SR+d/100+off,a/SR+d/100+off-ss,sc[d]) for d in o])
