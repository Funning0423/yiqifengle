# Voice Bot: exit_outbound audio, synthesized from code only (no external samples).
# usage: PYTHONHASHSEED=0 python3 synth_exit.py timing.json B55.csv out.wav
import sys,json,csv,math,numpy as np
from scipy.signal import butter,sosfilt
from scipy.io import wavfile
SR=44100; rng=np.random.default_rng(55)
T=json.load(open(sys.argv[1])); fps=T['fps']; dur=T['durationSec']; ev=T['events']
N=int(round(dur*SR)); t=np.arange(N)/SR
rows=list(csv.DictReader(open(sys.argv[2])))
ct=np.array([float(r['t']) for r in rows]); rx=np.array([float(r['rx']) for r in rows]); rz=np.array([float(r['rz']) for r in rows])
hd=np.array([float(r['horizDist']) for r in rows])
cam=np.array([[float(r[k]) for k in('cx','cy','cz')] for r in rows])
def bp(x,lo,hi,o=2): return sosfilt(butter(o,[lo,hi],'band',fs=SR,output='sos'),x)
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
out=np.zeros((N,2))
# --- wind: envelope from timing json 'wind' (per frame), brighter as it grows
wf=np.array(T['wind'],float); wenv=np.interp(t,np.arange(len(wf))/fps,wf)
n=rng.standard_normal((N,2))
wl=bp(n,150,700); wh=bp(n,600,3000)
gust=1+0.25*np.sin(2*np.pi*0.23*t)+0.15*np.sin(2*np.pi*0.61*t+1)
wind=(wl*(0.35+0.25*wenv)[:,None]+wh*(wenv**1.5)[:,None]*0.5)*(0.08+0.9*wenv)[:,None]*gust[:,None]
out+=wind
# --- sea: slow surf swells, constant bed (so file never starts silent)
sea=lp(rng.standard_normal((N,2)),500)*(0.05+0.035*(0.5+0.5*np.sin(2*np.pi*t/5.5)))[:,None]
out+=sea
# --- camera whoosh: follows camera speed (crane), subtle
cs=np.r_[0,np.linalg.norm(np.diff(cam,axis=0),axis=1)/np.diff(ct)]; csp=np.interp(t,ct,cs)/4.52
out+=bp(rng.standard_normal((N,2)),300,1500)*(0.05*csp**2)[:,None]
# --- footsteps on dirt path: character walks 0.7 m/s until walkEndFrame
spd=np.r_[0,np.hypot(np.diff(rx),np.diff(rz))/np.diff(ct)]
walkEnd=ev['walkEndFrame']/fps
period=0.56  # ~1.8 steps/s at 0.7 m/s
steps=[]; s=0.08
while s<=walkEnd-0.05: steps.append(s); s+=period
steps.append(min(walkEnd+0.18,steps[-1]+0.42))  # settle/stop step (feet together)
def step(i,ts):
    L=int(0.16*SR); k=np.arange(L)/SR
    crunch=bp(rng.standard_normal(L),400,3500)*np.exp(-k/0.035)*(1+0.6*(rng.random(L)<0.02))
    thump=np.sin(2*np.pi*95*k)*np.exp(-k/0.025)
    heel=np.r_[np.zeros(int(0.012*SR)),bp(rng.standard_normal(L),800,4000)[:L-int(0.012*SR)]*np.exp(-k[:L-int(0.012*SR)]/0.02)*0.35]
    x=0.55*crunch+0.5*thump+heel
    d=np.interp(ts,ct,hd); g=0.5*min(1,2.3/max(d,0.5))*(0.6 if i==len(steps)-1 else 1)*(0.9+0.2*rng.random())
    pan=0.12 if i%2 else -0.12
    a=int(ts*SR); b=min(N,a+L)
    out[a:b,0]+=x[:b-a]*g*(1-pan); out[a:b,1]+=x[:b-a]*g*(1+pan)
for i,s in enumerate(steps): step(i,s)
out/=max(1e-9,np.abs(out).max()); out*=0.89
wavfile.write(sys.argv[3],SR,(out*32767).astype(np.int16))
json.dump({'steps_sec':[round(x,3) for x in steps],'walkEndSec':walkEnd,'period':period},open(sys.argv[3]+'.steps.json','w'),indent=1)
