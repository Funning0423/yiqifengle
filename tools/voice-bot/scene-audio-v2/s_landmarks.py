from mk_loop import *
import numpy as np,json
def river(x):
    x=hp(x,200,2);x=deharsh(x,-3);x=lp(x,6000,2);return reverb(x,wet_db=-16,rt=1.0,lpf=3000)
make_loop('amb_meadow_river_loop','src/park_ambience_river.wav',62.5,16.0,2.0,river,-27.0,kbps=24,sr_out=24000,ch=1)
def fall(x):
    x=hp(x,350,2);x=deharsh(x,-3);x=lp(x,4500,4);return reverb(x,wet_db=-8,rt=2.5,lpf=2500,pre=0.05)
make_loop('amb_sky_waterfall_loop','src/park_ambience_river.wav',274.0,16.0,2.0,fall,-27.0,kbps=24,sr_out=24000,ch=1)
def dock(x):
    x=hp(x,80,2);x=lp(x,1600,4);return reverb(x,wet_db=-14,rt=0.9,lpf=1500)
make_loop('amb_island_dock_lap_loop','src/VistulaShort_0.mp3',80.5,12.0,2.0,dock,-27.0,kbps=24,sr_out=24000,ch=1)
# own-synth bells / chimes
def bell(f,dur,parts,decs,seed):
    t=np.arange(int(dur*SR))/SR;rng=np.random.default_rng(seed);s=np.zeros_like(t)
    for (r,a),d in zip(parts,decs): s+=a*np.sin(2*np.pi*f*r*t+rng.random()*6)*np.exp(-t/d)
    att=np.minimum(1,t/0.008);return s*att
def cluster(name,notes,times,parts,decs,lpf,target,seed):
    dur=max(times)+4.5;x=np.zeros((int(dur*SR),2))
    for i,(f,t0) in enumerate(zip(notes,times)):
        b=bell(f,4.0,parts,decs,seed+i)*(0.8+0.2*np.cos(i));p=0.5+0.25*np.sin(i*1.7+seed)
        a=int(t0*SR);x[a:a+len(b)]+=np.stack([b*np.cos(p*np.pi/2),b*np.sin(p*np.pi/2)],1)
    x=lp(x,lpf,4);x=deharsh(x,-3);x=reverb(x,wet_db=-8,rt=2.2,lpf=3000)[:len(x)+int(1.0*SR)]
    x=fade(x,0,0.8);m=norm_to(x.mean(1,keepdims=True),target)
    save(f'wav/{name}.wav',m);size=encode(f'wav/{name}.wav',f'out/{name}.mp3',32,32000,1);I,tp,_=lufs(f'out/{name}.mp3')
    info=dict(name=name,src='own synthesis (s_landmarks.py)',bytes=size,lufs=I,truePeak=tp,durS=round(len(m)/SR,2),ch=1,kbps=32);json.dump(info,open(f'out/{name}.json','w'));print(info)
BRONZE=([(1,1.0),(2.0,0.35),(2.76,0.2),(5.4,0.06)],[2.2,1.2,0.8,0.35])
GLASS=([(1,1.0),(2.32,0.25),(4.25,0.08)],[2.6,1.1,0.4])
cluster('sfx_meadow_windbell_1',[783.99,987.77,1174.66],[0,0.42,1.05],*BRONZE,3800,-29.0,1)
cluster('sfx_meadow_windbell_2',[1174.66,880.0],[0,0.7],*BRONZE,3800,-29.0,5)
cluster('sfx_sky_chime_1',[1174.66,1396.91,1760.0],[0,0.33,0.9],*GLASS,4500,-30.0,9)
cluster('sfx_sky_chime_2',[1567.98,1174.66,880.0],[0,0.5,1.2],*GLASS,4500,-30.0,13)
