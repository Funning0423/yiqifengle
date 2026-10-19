import json,numpy as np
from lib import *
from mk_loop import DUP
L=32.0;N=int(L*SR);rng=np.random.default_rng(20261018);t=np.arange(N)/SR
def circ_noise(lo,hi,tilt=-1.0):
    out=[]
    for c in range(2):
        F=np.fft.rfftfreq(N,1/SR);mag=np.where((F>lo)&(F<hi),1.0,0.0)*np.maximum(F,1)**(tilt/2)
        # soft band edges
        mag*=1/(1+(lo/np.maximum(F,1))**4)*1/(1+(F/hi)**4)
        ph=np.exp(2j*np.pi*rng.random(len(F)));out.append(np.fft.irfft(mag*ph,N))
    x=np.stack(out,1);x=0.75*x+0.25*x[:,::-1];return x/np.sqrt((x**2).mean())
def env(cycles_amps,base):
    e=np.full(N,base)
    for k,a,p in cycles_amps:e+=a*np.sin(2*np.pi*k*t/L+p)
    return np.clip(e,0.05,None)
low=circ_noise(180,900,-1.2)*env([(1,.35,0),(3,.18,1.3),(5,.08,2.2)],1.0)[:,None]
mid=circ_noise(700,2400,-1.5)*env([(2,.4,.7),(3,.2,2.9),(7,.07,.4)],0.7)[:,None]*0.35
air=circ_noise(2500,7000,-2)*env([(1,.3,2.0),(4,.15,.1)],0.5)[:,None]*0.05
wind=low+mid+air
# shimmer glints (D minor pentatonic, soft sines), placed circularly
notes=[587.33,1174.66,1396.91,1567.98,1760.0,880.0]
gl=np.zeros((N,2))
times=[1.2,5.9,9.4,13.8,17.1,21.6,24.9,28.7]
for i,t0 in enumerate(times):
    f=notes[(i*3)%len(notes)];dur=7.0;n=int(dur*SR);tt=np.arange(n)/SR
    a=(1-np.exp(-tt/0.9))*np.exp(-tt/2.2)
    s=(np.sin(2*np.pi*f*tt)+0.12*np.sin(2*np.pi*2*f*tt+0.5)+0.5*np.sin(2*np.pi*f*1.003*tt))*a
    pan=0.5+0.35*np.sin(i*2.1);st=np.stack([s*np.cos(pan*np.pi/2),s*np.sin(pan*np.pi/2)],1)
    idx=(int(t0*SR)+np.arange(n))%N;np.add.at(gl,idx,st)
gl=gl/np.abs(gl).max()
x=wind/np.abs(wind).max()+gl*0.22
# circular reverb + filters via 3x tiling
x3=np.vstack([x,x,x]);x3=reverb(x3,wet_db=-8,rt=3.5,lpf=3000,pre=0.06)[:3*N];x3=hp(x3,90,2);x3=deharsh(x3,-3)
loop=x3[N:2*N]
loop=norm_to(loop,-24.0)
rep=seam_report(loop);name='amb_sky_air_loop'
save(f'wav/{name}.wav',np.vstack([loop,loop[:int(DUP*SR)]]));save(f'wav/{name}_x3.wav',np.vstack([loop]*3))
size=encode(f'wav/{name}.wav',f'out/{name}.mp3',32,32000,2);I,tp,lra=lufs(f'out/{name}.mp3')
info=dict(name=name,src='own synthesis (s_sky.py, seed 20261018)',loopS=L,xfadeS=0,dupS=DUP,bytes=size,lufs=I,truePeak=tp,lra=lra,kbps=32,sr=32000,ch=2,seam=rep)
json.dump(info,open(f'out/{name}.json','w'),indent=1);print(json.dumps(info))
