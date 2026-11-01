# Voice Bot: soft footstep one-shots, synthesised from code only (numpy noise + sines; no external samples => no licence).
# usage: python3 synth_footsteps.py <outdir>   -> step_<surface>_<n>.wav (22.05 kHz mono) + steps_manifest.json
# Each surface has 4 variants with baked pitch offsets (0.94 / 0.98 / 1.02 / 1.06: Cocos AudioSource has no pitch control) and
# different noise seeds. All are low-passed at 4.5 kHz (8th-order Butterworth), 3 ms raised-cosine attack (no click),
# exponential tails, and peak-normalised to -6 dBFS so mp3 quantisation stays clean; the in-game level is set by
# FOOTSTEP_GAIN in GameAudio (far below 1).
import sys,os,json,numpy as np
from scipy.signal import butter,sosfilt,resample_poly
SR=22050; OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)
def bp(x,lo,hi,o=2): return sosfilt(butter(o,[lo,hi],'band',fs=SR,output='sos'),x)
def lp(x,f,o=8): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def env(n,a,d,hold=0.0):
    t=np.arange(n)/SR; e=np.exp(-np.maximum(0,t-a-hold)/d); na=max(1,int(a*SR)); e[:na]*=0.5-0.5*np.cos(np.pi*np.arange(na)/na); return e
def grains(rng,n,dens,dur):
    x=np.zeros(n); k=int(dur*SR)
    for i in np.flatnonzero(rng.random(k)<dens/SR): x[i:i+int(0.002*SR)]+=rng.standard_normal(min(int(0.002*SR),n-i))*rng.uniform(.3,1)
    return x
def wood(rng,n):
    t=np.arange(n)/SR
    knock=np.sin(2*np.pi*(170+rng.uniform(-10,10))*t)*env(n,0.003,0.028)*0.7          # board thump
    plank=np.sin(2*np.pi*(430+rng.uniform(-25,25))*t)*env(n,0.003,0.035)*0.35          # hollow plank resonance
    body=bp(rng.standard_normal(n),300,1400)*env(n,0.003,0.022)*1.0                      # plank body (audible on phone speakers)
    heel=bp(rng.standard_normal(n),1400,3200)*env(n,0.002,0.007)*0.15                    # soft heel contact
    toe=np.roll(bp(rng.standard_normal(n),300,1200)*env(n,0.003,0.015)*0.45,int(0.075*SR)) # toe lands ~75 ms later
    return knock+plank+body+heel+toe
def rug(rng,n):
    t=np.arange(n)/SR
    thud=np.sin(2*np.pi*(120+rng.uniform(-8,8))*t)*env(n,0.006,0.03)*0.6
    felt=bp(rng.standard_normal(n),250,1100)*env(n,0.007,0.035)*1.0                       # muffled fabric
    toe=np.roll(bp(rng.standard_normal(n),250,900)*env(n,0.006,0.02)*0.4,int(0.07*SR))
    return thud+felt+toe
def stone(rng,n):
    t=np.arange(n)/SR
    tap=bp(rng.standard_normal(n),350,3000)*env(n,0.002,0.012)
    low=np.sin(2*np.pi*(120+rng.uniform(-10,10))*t)*env(n,0.003,0.02)*0.5
    scuff=bp(rng.standard_normal(n),600,3500)*env(n,0.02,0.04,0.0)*0.12
    toe=np.roll(bp(rng.standard_normal(n),400,2800)*env(n,0.002,0.008)*0.4,int(0.07*SR))
    return tap+low+scuff+toe
def path(rng,n):
    t=np.arange(n)/SR
    crunch=bp(grains(rng,n,1800,0.12),500,3800)*env(n,0.004,0.05)
    sand=bp(rng.standard_normal(n),300,2500)*env(n,0.006,0.045)*0.35
    low=np.sin(2*np.pi*110*t)*env(n,0.004,0.025)*0.45
    return crunch+sand+low
def grass(rng,n):
    t=np.arange(n)/SR
    swish=bp(rng.standard_normal(n),350,3200)*env(n,0.012,0.07)*0.7
    rustle=bp(grains(rng,n,900,0.16),700,4000)*env(n,0.01,0.08)*0.8
    low=np.sin(2*np.pi*100*t)*env(n,0.006,0.03)*0.35
    return swish+rustle+low
SURF={'wood':(wood,0.26),'rug':(rug,0.22),'stone':(stone,0.22),'path':(path,0.26),'grass':(grass,0.30)}
PITCH=[0.94,0.98,1.02,1.06]
man={'sampleRate':SR,'lowpassHz':4500,'files':[]}
for si,(name,(fn,dur)) in enumerate(SURF.items()):
    for vi,p in enumerate(PITCH):
        rng=np.random.default_rng(1000+si*10+vi); n=int(dur*SR*1.1)
        x=fn(rng,n)
        # pitch: resample by p (higher p = shorter, higher)
        up,down=100,int(round(100*p)); x=lp(resample_poly(x,up,down),4500)   # LPF after the pitch shift
        n2=int(dur*SR); x=x[:n2] if len(x)>=n2 else np.pad(x,(0,n2-len(x)))
        f=int(0.015*SR); x[-f:]*=np.linspace(1,0,f)                                       # no tail click
        x*=10**(-6/20)/max(1e-9,np.abs(x).max())
        fn_=f'step_{name}_{vi+1}'; from scipy.io import wavfile; wavfile.write(os.path.join(OUT,fn_+'.wav'),SR,(x*32767).astype(np.int16))
        man['files'].append({'name':fn_,'surface':name,'pitch':p,'seconds':round(len(x)/SR,3)})
json.dump(man,open(os.path.join(OUT,'steps_manifest.json'),'w'),indent=1); print(len(man['files']),'files')
