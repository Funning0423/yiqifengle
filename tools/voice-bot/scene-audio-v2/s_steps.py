import numpy as np,json,os
from lib import *
from stepmeas import meas
D='/workspace/yiqifengle/previews/Voice-bot/ui-soft-v3/src/impact/Audio/'
def mk(name,src,chain,tail,fo,target=-21.0):
    x=load(D+src);x=fade(x,0.004,0);x=np.vstack([x,np.zeros((int(tail*SR),2))]);x=chain(x)[:len(x)]
    # trim trailing near-silence after tail then fade
    x=fade(x,0,fo);m=x.mean(1,keepdims=True)
    n=int(.1*SR);r=max(np.sqrt((m[i:i+n]**2).mean()) for i in range(0,len(m)-n,SR//200))
    m=m*10**((target-20*np.log10(r))/20)
    save(f'wav/{name}.wav',m);size=encode(f'wav/{name}.wav',f'out/{name}.mp3',32,44100,1)
    I=meas(f'out/{name}.mp3');info=dict(name=name,src='Kenney Impact Sounds '+src,bytes=size,rms100ms_max=float(I[0]),peak=float(I[1]),durS=I[2])
    json.dump(info,open(f'out/{name}.json','w'));print(info)
def sand(x):
    x=hp(x,140,2);x=lp(x,3000,4);x=deharsh(x,-3);return reverb(x,wet_db=-16,rt=0.35,lpf=2500,pre=0.01)
def cloud(x):
    x=hp(x,120,2);x=lp(x,1600,4);return reverb(x,wet_db=-9,rt=0.7,lpf=2200,pre=0.02)
for i,k in enumerate([0,1,2,4],1): mk(f'step_sand_{i}',f'footstep_snow_00{k}.ogg',sand,0.18,0.14)
for i,k in enumerate([0,1,2,3],1): mk(f'step_cloud_{i}',f'footstep_carpet_00{k}.ogg',cloud,0.35,0.22)
