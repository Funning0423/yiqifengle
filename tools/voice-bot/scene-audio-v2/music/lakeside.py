from synth import *
from motif import *
import json
TON=174.61  # F3
BPM=72;B=60/BPM;BARS=20;N=int(round(BARS*4*B*SR))
S=Score(N)
prog=[1,3]+[1,6,4,5,1,3,4,5]+[6,4,1,5,6,4,2,5]+[4,5]   # chord roots (degrees)
for bar,r in enumerate(prog):
    t0=bar*4*B
    # harp arpeggio: 8 eighths over chord tones
    tones=[r,r+2,r+4,r+7,r+9,r+7,r+4,r+2]
    for i,d in enumerate(tones):
        S.add(t0+i*B/2,harp(deg(TON,d),B/2),0.16,pan=-0.35+0.1*np.sin(i))
    S.add(t0,bass(deg(TON/2,r),4*B),0.14,0)
    if 10<=bar<18:
        for d in (r,r+2,r+4): S.add(t0,strings(deg(TON,d),4*B),0.09,pan=0.3)
def melody(start_bar,phr,octv,vol,inst=piano,pan=0.1):
    t=start_bar*4*B
    for d,du in phr:
        S.add(t,inst(deg(TON,d,octv),du*B*0.95),vol,pan);t+=du*B
melody(2,M1+M2+M3+M4,1,0.30)              # A: motif, piano, upper register
melody(6,M1+M2+M3+M4END,1,0.30)
melody(10,[(d-2,du) for d,du in M1+M2],1,0.26)   # B: motif sequenced a third lower over Dm/Bb
melody(12,M3+M4END,1,0.28)
melody(14,[(d-2,du) for d,du in M1+M2],0,0.24)   # one octave down, softer
melody(16,M3+M4,0,0.24)
x=circ_reverb(S.buf,-9,2.4,lpf=3200)
x=master(x)
save('/workspace/v2amb/wav/bgm_lakeside.wav',x)
print(len(x)/SR)
