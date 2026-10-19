import numpy as np,json,os,sys
from lib import *
R='/workspace/vbr5/wt-v2scene/creator-build-project/assets/'
A=dict(
 bgm_island=(R+'bundles/audio_bgm_island/audio/bgm_main.mp3','bgm'),
 bgm_meadow=(R+'bundles/region_meadow/audio/bgm_meadow.mp3','bgm'),
 bgm_sky=(R+'bundles/region_skycity/audio/bgm_skycity.mp3','bgm'),
 lake=(R+'bundles/region_lakeside/audio/amb_lake_loop.mp3',19.0),
 wind_soft=(R+'resources/audio_amb/amb_wind_soft_loop.mp3','bgm'),
 shore=('out/amb_island_shore_loop.mp3',24.0), sea=('out/amb_sea_open_loop.mp3',24.0),
 mbirds=('out/amb_meadow_birds_loop.mp3',30.0), insects=('out/amb_meadow_insects_loop.mp3',19.25),
 sky=('out/amb_sky_air_loop.mp3',32.0))
G={k:R+f'resources/audio_sfx/sfx_amb_gull_{k}.mp3' for k in (1,2,3)}
_c={}
def get(f):
    if f not in _c:_c[f]=load(f)
    return _c[f]
def loopify(key,T,offset=0.0):
    f,mode=A[key];x=get(f);xf=int(0.15*SR)
    if mode=='bgm': per=int((len(x)/SR-0.045-0.15-0.03)*SR)   # GameAudio.loopStartAt
    else: per=int(mode*SR)
    n=int((T+offset)*SR);out=np.zeros((n+per+xf,2));t=np.linspace(0,np.pi/2,xf)[:,None]
    pos=0;k=0;seams=[]
    while pos<n:
        seg=x[:per+xf].copy()
        if k: seg[:xf]*=np.sin(t)
        seg[per:per+xf]*=np.cos(t)
        out[pos:pos+len(seg)]+=seg[:len(out)-pos]
        pos+=per;k+=1
        if offset*SR<pos<n: seams.append(round(pos/SR-offset,2))
    o=int(offset*SR);return out[o:o+int(T*SR)],seams
def env(T,pts):  # pts [(t,gain_db or lin)], linear in amplitude between points
    tt=np.arange(int(T*SR))/SR;ts=[p[0] for p in pts];gs=[p[1] for p in pts]
    return np.interp(tt,ts,gs)[:,None]
def ep(T,t0,t1,up=True): # equal-power ramp envelope
    tt=np.arange(int(T*SR))/SR;u=np.clip((tt-t0)/(t1-t0),0,1)
    return (np.sin(u*np.pi/2) if up else np.cos(u*np.pi/2))[:,None]
def shot(mix,f,at,vol,pan=0.0):
    x=get(f);th=(pan+1)*np.pi/4;c,s=np.cos(th),np.sin(th);m=max(c,s);g=np.array([c/m,s/m])
    a=int(at*SR);b=min(len(mix),a+len(x));mix[a:b]+=x[:b-a].mean(1,keepdims=True)*g*vol
def finish(name,mix,notes):
    os.makedirs(OUT,exist_ok=True);mix=mix*10**(4/20);pk=np.abs(mix).max()
    if pk>0.89: mix=mix*0.89/pk
    mix=fade(mix,0.8,2.0)
    save('/tmp/_mix.wav',mix);p=f'{OUT}/{name}.mp3'
    import subprocess;subprocess.run(['ffmpeg','-v','error','-y','-i','/tmp/_mix.wav','-c:a','libmp3lame','-b:a','160k',p],check=True)
    I,tp,lra=lufs(p);notes.update(file=os.path.basename(p),lufs=I,truePeak=tp,bytes=os.path.getsize(p));print(json.dumps(notes,ensure_ascii=False));return notes
OUT='/workspace/yiqifengle/previews/Voice-bot/v2-scene-audio'
BGM=0.4   # default music slider -> GameAudio musicVolume 0.4; ambience bed gain = 1 at this slider
