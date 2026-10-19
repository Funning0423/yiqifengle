# Motif demo: same 4-bar motif, island arrangement (F major, 92 BPM, ukulele + soft harmonica-like reed)
# then meadow arrangement (G major, 76 BPM, nylon guitar + recorder-like flute + strings). ~30 s, not a loop.
from synth import *
from motif import *
def section(TON,BPM,mel_inst,acc,acc_vol,mel_vol,strings_on,bars_prog):
    B=60/BPM;N=int((len(bars_prog)*4*B+3.0)*SR);S=Score(N+int(SR*3))
    for bar,r in enumerate(bars_prog):
        t0=bar*4*B
        pat=[r,r+4,r+7,r+4,r+2,r+4,r+7,r+4] if acc is guitar else [r,r+2,r+4,r+7]*2
        for i,d in enumerate(pat): S.add(t0+i*B/2,acc(deg(TON,d),B/2),acc_vol,-0.3)
        S.add(t0,bass(deg(TON/2,r),4*B),0.12,0)
        if strings_on:
            for d in (r,r+2,r+4): S.add(t0,strings(deg(TON,d),4*B),0.05,0.35)
    t=1*4*B
    for d,du in MOTIF[:-len(M4)]+M4END: S.add(t,mel_inst(deg(TON,d,1),du*B*0.95),mel_vol,0.12);t+=du*B
    return S.buf[:N]
isl=section(174.61,92,reed,uke,0.17,0.24,False,[1,1,6,4,5,1])
mea=section(196.0,76,flute,guitar,0.18,0.30,True,[1,1,6,4,5,1])
xf=int(2.5*SR);a=reverb(isl,-10,1.8,lpf=3200);b=reverb(mea,-9,2.2,lpf=3200)
t=np.linspace(0,np.pi/2,xf)[:,None];L=len(a)-xf+len(b)
out=np.zeros((L,2));out[:len(a)]+=a*np.vstack([np.ones((len(a)-xf,1)),np.cos(t)]);out[len(a)-xf:len(a)-xf+len(b)]+=b*np.vstack([np.sin(t),np.ones((len(b)-xf,1))])
out=fade(out,0.05,2.5);out=norm_to(out,-17.0,tp_max=-1.5)
save('/workspace/v2amb/wav/motif_demo.wav',out);print(len(out)/SR,'switch at',(len(a)-xf)/SR)
