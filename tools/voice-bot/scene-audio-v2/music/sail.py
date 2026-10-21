from synth import *
from motif import *
TON=130.81  # C3
E=60/(54*3);BAR=6*E;BARS=16;N=int(round(BARS*BAR*SR))
S=Score(N)
prog=[1,6,4,5,1,3,4,5,6,4,1,5,4,1,2,5]
for bar,r in enumerate(prog):
    t0=bar*BAR
    for i,d in enumerate([r,r+4,r+7,r+9,r+7,r+4]):      # 6/8 nylon-guitar rocking arpeggio
        S.add(t0+i*E,guitar(deg(TON,d),E),0.2,pan=-0.3)
    S.add(t0,bass(deg(TON/2,r),BAR),0.13,0)
    S.add(t0+3*E,bass(deg(TON/2,r+4),BAR/2),0.07,0)
    for d in (r,r+2,r+4): S.add(t0,strings(deg(TON,d,1),BAR*1.05),0.05,pan=0.35)   # swell every bar (waves)
# motif in 6/8: beats->eighths x2 (one 4/4 beat = 2 eighths)
def mel(start_bar,phr,octv,vol,inst=flute,pan=0.12):
    t=start_bar*BAR
    for d,du in phr:
        S.add(t,inst(deg(TON,d,octv),du*(BAR/4)*0.95),vol,pan);t+=du*BAR/4*1.0
    return t
# 4/4 motif bar (4 beats) fits one 6/8 bar when 1 beat = BAR/4 (gentle hemiola feel)
mel(2,M1+M2+M3+M4,1,0.32)
mel(6,M1+M2+M3+M4END,1,0.32)
mel(10,[(d-2,du) for d,du in M1+M2]+M3+M4END,1,0.18,inst=strings,pan=0.0)   # strings sing the motif a third lower, then home
x=circ_reverb(S.buf,-8,2.6,lpf=3000)
x=master(x)
save('/workspace/v2amb/wav/bgm_sail.wav',x);print(len(x)/SR)
