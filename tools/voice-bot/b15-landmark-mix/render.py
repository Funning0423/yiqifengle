import sys,json,numpy as np,subprocess,os
sys.path.insert(0,'/workspace/v2amb')
from lib import load,save,SR,lufs,fade
root,inp,out=sys.argv[1:4]
B=root+'/creator-build-project/assets/bundles/'
J=json.load(open(inp));T=60.0;n=int(T*SR)
def loop(f,vol,per=None,dup=0.0):
    x=load(B+f);L=len(x) if per is None else int(per*SR)
    reps=int(np.ceil(n/L))+1;y=np.vstack([x[:L]]*reps)[:n];return y*vol
if J['scenario']=='lake': mix=loop('region_lakeside/audio/bgm_lakeside.mp3',0.4)+loop('region_lakeside/audio/amb_lake_loop.mp3',0.55,19.0)
else: mix=loop('region_skycity/audio/bgm_skycity.mp3',0.4)+loop('region_skycity/audio/amb_sky_air_loop.mp3',0.75,32.0)
ft=np.array([f['t'] for f in J['frames']]);ts=np.arange(n)/SR
land=np.zeros((n,2));ev=J['events'];cache={}
for i,e in enumerate(ev):
    if e['ev']!='play':continue
    end=next((x['t'] for x in ev[i+1:] if x['id']==e['id'] and x['ev']=='release'),T)
    f=B+('region_lakeside/' if 'lake' in e['clip'] else 'region_skycity/')+e['clip']+'.mp3'
    if f not in cache:cache[f]=load(f)
    x=cache[f];a=int(e['t']*SR);b=min(n,int(end*SR))
    if e['loop']:
        reps=int(np.ceil((b-a)/len(x)))+1;seg=np.vstack([x]*reps)[:b-a]   # native loop: whole file repeats (incl. any dup tail)
    else: seg=x[:b-a];b=a+len(seg)
    vol=np.interp(ts[a:b],ft,[fr['vol'][e['id']] for fr in J['frames']])[:,None]
    land[a:b]+=seg*vol
mix=mix+land;mix=fade(mix*10**(4/20),0.5,1.5)
save('/tmp/_b15.wav',mix);subprocess.run(['ffmpeg','-v','error','-y','-i','/tmp/_b15.wav','-c:a','libmp3lame','-b:a','160k',out],check=True)
save('/tmp/_b15l.wav',land if np.abs(land).max()>0 else land+1e-9)
I=lufs(out)[0];Il=lufs('/tmp/_b15l.wav')[0] if np.abs(land).max()>1e-6 else None
print(os.path.basename(out),'mix',I,'landmark-only(pre-makeup)',Il)
