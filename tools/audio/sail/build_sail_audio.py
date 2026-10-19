"""Voice Bot r5 sail audio: CC0 field recordings (Freesound originals via Creazilla public-domain mirror) -> 4 mono files.
Calm/healing: low-passed, rounded onsets, natural decays + raised-cosine fade-outs, no hard cuts."""
import numpy as np,subprocess,json,re
from scipy.io import wavfile
from scipy.signal import butter,sosfilt,sosfiltfilt
SR=44100
def load(n):
  sr,x=wavfile.read(f'src/{n}.wav');x=x.astype(np.float64)
  from scipy.signal import resample_poly
  return resample_poly(x,SR,sr) if sr!=SR else x
def cut(x,a,b): i=int(a*SR);return x[i:i+int(round((b-a)*SR))].copy()
def lp(x,f,o=4): return sosfiltfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfiltfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def fin(x,s): n=int(s*SR);x[:n]*=0.5-0.5*np.cos(np.linspace(0,np.pi,n));return x
def fout(x,s): n=int(s*SR);x[-n:]*=0.5+0.5*np.cos(np.linspace(0,np.pi,n));return x
def soft(x,over=9.0,ratio=3.0,att=0.001,rel=0.15):
  # gentle peak smoother: feed-forward compressor above (short-term RMS + over dB); no hard limiting, no added distortion
  a=np.exp(-1/(att*SR));r=np.exp(-1/(rel*SR));lvl=np.sqrt(np.mean(x**2));th=lvl*10**(over/20);env=0.0;g=np.ones_like(x)
  ax=np.abs(x)
  for i in range(len(x)):
    v=ax[i];env=a*env+(1-a)*v if v>env else r*env+(1-r)*v
    if env>th:g[i]=(th*(env/th)**(1/ratio))/env
  return x*g
def rms(x): return np.sqrt(np.mean(x**2))
def norm(x,db): return x*10**(db/20)/max(rms(x),1e-12)
def pad(x,n): return np.concatenate([x,np.zeros(max(0,n-len(x)))])[:n] if n>=len(x) else x[:n]
def room(x,rt=0.6,wet=0.12,seed=7):
  r=np.random.default_rng(seed);n=int(rt*1.5*SR);t=np.arange(n)/SR
  ir=r.standard_normal(n)*np.exp(-6.9*t/rt);ir=lp(ir,2500,2);ir/=np.sqrt(np.sum(ir**2))
  from scipy.signal import fftconvolve; y=pad(fftconvolve(x,ir),len(x)+n);return np.concatenate([x,np.zeros(n)])*(1-wet)+y*wet
bow=load('bow_distant');flap=load('sail_flap_554439');dock=load('dock_creak_91912');under=load('underway');lovis=load('lovis_kyles')
out={}
# 1 board: soft wooden creak as she steps aboard + gentle water lap under it (3.2 s)
c=fin(lp(hp(cut(dock,136.5,139.1),120),3000),0.04);w=fin(lp(hp(cut(bow,4.0,7.4),90),2500),0.25)
x=pad(norm(soft(c,6,4),-27),int(3.4*SR))+norm(w,-33);x=room(x,0.5,0.1)[:int(3.4*SR)];out['sfx_sail_board']=fout(x,0.9)
# 2 unfurl / departure: sail cloth luffs and fills (a few flaps settling into a steady fill) + the bow wave rising (4.6 s)
f=fin(lp(hp(cut(flap,69.6,74.2),150),3200),0.12);f=fout(f,1.2)
w=lp(hp(cut(bow,10.0,14.6),90),2500);w*=np.linspace(0.2,1,len(w))**1.5
x=norm(soft(f,8,3),-25)+norm(w,-31);x=fin(x,0.08);out['sfx_sail_unfurl']=fout(x,1.0)
# 3 cruise bed: calm bow wave + distant sail/wind and lines, 16 s, seamless loop (1.5 s tail cross-faded into the head)
L=16.0;X=1.5;import os;BO=float(os.environ.get('BO','20'));UO=float(os.environ.get('UO','128'))
w=lp(hp(cut(bow,BO,BO+L+X),80),3000);s=lp(hp(cut(under,UO,UO+L+X),120),2200)
m=norm(w,-27)+norm(s,-34);n=int(L*SR);k=int(X*SR);g=0.5-0.5*np.cos(np.linspace(0,np.pi,k))
loop=m[:n].copy();loop[:k]=m[:k]*np.sqrt(g)+m[n:n+k]*np.sqrt(1-g);out['amb_sail_cruise']=loop
# 4 dock: the hull nudges the landing (a muffled wooden knock + rope creak) and water sloshes down (3.8 s)
d=fin(lp(hp(cut(dock,88.0,90.8),110),2400),0.03);sl=fin(lp(hp(cut(lovis,40.0,44.4),90),1800),0.4)
D=int(4.4*SR);x=pad(np.concatenate([np.zeros(int(0.45*SR)),norm(soft(d,7,4),-26)]),D)+pad(norm(sl,-31),D);x=room(x,0.55,0.1)[:D];out['sfx_sail_dock']=fout(x,1.2)
info={}
for k,x in out.items():
  pk=np.abs(x).max();lim=10**(-4/20)
  if pk>lim:x=x*lim/pk
  wavfile.write(f'out/{k}.wav',SR,(x*32767).astype(np.int16))
  info[k]=dict(dur=round(len(x)/SR,3),peak_db=round(20*np.log10(np.abs(x).max()),1))
json.dump(info,open('out/info.json','w'),indent=1);print(info)
