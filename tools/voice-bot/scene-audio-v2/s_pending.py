# Pending-layer candidates (not wired): lakeside water birds (US gov public-domain recordings) + sky gardener / star ring (own synthesis)
import sys,json,numpy as np
from mk_shot import make_shot
from lib import *
W='src/wb/'
def far_bird(x):  # distant over open water: no low rumble, no hiss, soft 2-6 kHz, long-ish light tail
    x=hp(x,260,4);x=deharsh(x,-4);x=lp(x,4200,4);return reverb(x,wet_db=-6,rt=1.9,lpf=2800,pre=0.04)
SHOTS={
 'sfx_lake_waterbird_1':(W+'Tundra_swans.ogg',1.0,5.0),
 'sfx_lake_waterbird_2':(W+'Tundra_swans.ogg',10.0,4.5),
 'sfx_lake_waterbird_3':(W+'Yellowstone_sound_library_-_American_Coots_-_001.mp3',224.0,7.0),
 'sfx_lake_waterbird_4':(W+'Yellowstone_sound_library_-_American_Coots_-_001.mp3',348.0,7.0),
}
def birds(names):
    for n in names:
        s,ss,t=SHOTS[n];make_shot(n,s,ss,t,far_bird,-28.0,tail=1.4,fi=0.35,fo=1.2)
# ---- own synthesis
def gardener_water(name,seed,dur=3.2):
    rng=np.random.default_rng(seed);n=int((dur+1.5)*SR);x=np.zeros(n)
    t0=0.25;env=lambda t:np.clip(t/0.6,0,1)*np.clip((dur-t)/0.9,0,1)
    for _ in range(int(dur*55)):           # ~55 drops / s, gentle sprinkle on leaves
        t=t0+rng.random()*(dur-t0);a=int(t*SR);f=rng.uniform(900,2600);L=int(0.05*SR)
        tt=np.arange(L)/SR;d=np.sin(2*np.pi*f*tt*(1+tt*3))*np.exp(-tt/0.008)*rng.uniform(.3,1)*env(t)
        x[a:a+L]+=d[:max(0,min(L,n-a))]
    no=rng.standard_normal(n);no=lp(hp(no,700,2),2400,2)*0.25;tt=np.arange(n)/SR
    x+=no*np.array([env(v) for v in tt])
    x=lp(x,3000,4);x=deharsh(x[:,None].repeat(2,1),-3);x=reverb(x,wet_db=-10,rt=1.1,lpf=2500)
    x=fade(x,0.05,0.9);fin(name,x,-31.0,'watering-can sprinkle: ~55 soft droplets/s (1-2.6 kHz chirped pings, 8 ms decay) + low-passed spray noise, 0.6 s in / 0.9 s out')
def gardener_boop(name,notes,seed):
    dur=sum(d for _,d in notes)+2.0;n=int(dur*SR);x=np.zeros(n);t=0.15
    rng=np.random.default_rng(seed)
    for f,d in notes:
        L=int((d+0.6)*SR);tt=np.arange(L)/SR;e=np.clip(tt/0.03,0,1)*np.exp(-np.maximum(tt-d*0.6,0)/0.18)
        v=np.sin(2*np.pi*f*tt+0.6*np.sin(2*np.pi*5.5*tt))+0.18*np.sin(4*np.pi*f*tt);a=int(t*SR);x[a:a+L]+=(v*e)[:n-a];t+=d
    mot=rng.standard_normal(n);mot=lp(hp(mot,180,2),600,2)*0.05*np.clip(np.arange(n)/SR/0.4,0,1)*np.clip((dur-1.2-np.arange(n)/SR)/0.6,0,1)
    x=x*0.5+mot;x=lp(x,2600,4);x=reverb(x[:,None].repeat(2,1),wet_db=-11,rt=1.0,lpf=2200);x=fade(x,0.02,0.8)
    fin(name,x,-32.0,'robot gardener: soft sine "hum-boop" (gentle vibrato, LP 2.6 kHz) over a faint low motor purr')
def starring_loop(name,L=16.0,dup=True):
    n=int(L*SR);t=np.arange(n)/SR;s=np.zeros(n)
    for i,f0 in enumerate([587.33,880.0,698.46,1174.66,1318.5]):   # D minor pentatonic-ish (D5 A5 F5 D6 E6)
        f=round(f0*L)/L;am=0.55+0.45*np.sin(2*np.pi*t*(1+(i%2))*2/L+i*1.3)   # swells at 8 s / 4 s (whole cycles in 16 s)
        s+=(0.5/(1+i*0.4))*np.sin(2*np.pi*f*t+i)*am
    hum=np.sin(2*np.pi*round(146.83*L)/L*t)*0.12*(0.7+0.3*np.sin(2*np.pi*t*2/L))
    nz=np.random.default_rng(3).standard_normal(n);Z=np.fft.rfft(nz);fr=np.fft.rfftfreq(n,1/SR);Z*=((fr>1500)&(fr<4000));nz=np.fft.irfft(Z,n)
    nz=nz/np.abs(nz).max()*0.04*(0.5+0.5*np.sin(2*np.pi*t*4/L))   # faint "whirr" of the ring, circular
    x=(s+hum+nz)[:,None].repeat(2,1)
    X=np.vstack([x,x,x]);X=lp(X,3800,4);X=deharsh(X,-3);X=reverb(X,wet_db=-7,rt=3.0,lpf=3000);x=X[n:2*n]
    if dup: x=np.vstack([x,x[:int(0.15*SR)]])
    fin(name,x,-31.0,'star ring: five D-minor-pentatonic sines with whole-cycle 8 s / 4 s swells, 146.8 Hz hum, faint 1.5-4 kHz whirr; built circular (3x tile, keep the middle), '+('16.0 s + 0.15 s dup' if dup else f'plain circular {L} s (= 667 MPEG-2 L3 frames at 24 kHz) for AudioSource.loop'),loopS=L,kb=24,sr=24000)
def fin(name,x,target,desc,loopS=None,kb=32,sr=32000):
    m=norm_to(x.mean(1,keepdims=True),target);save(f'wav/{name}.wav',m);size=encode(f'wav/{name}.wav',f'out/{name}.mp3',kb,sr,1)
    I,tp,_=lufs(f'out/{name}.mp3');info=dict(name=name,src='own synthesis (s_pending.py)',desc=desc,bytes=size,lufs=I,truePeak=tp,durS=round(len(m)/SR,2),loopS=loopS,ch=1,kbps=kb,sr=sr)
    json.dump(info,open(f'out/{name}.json','w'),indent=1);print(json.dumps(info,ensure_ascii=False))
if __name__=='__main__':
    which=sys.argv[1]
    if which=='try': birds(['sfx_lake_waterbird_1','sfx_lake_waterbird_3']);gardener_water('sfx_sky_gardener_water_1',11)
    if which=='rest':
        birds(['sfx_lake_waterbird_2','sfx_lake_waterbird_4']);gardener_water('sfx_sky_gardener_water_2',23,dur=2.6)
        gardener_boop('sfx_sky_gardener_boop_1',[(784,0.18),(659.25,0.18),(880,0.34)],5);starring_loop('amb_sky_starring_loop')
