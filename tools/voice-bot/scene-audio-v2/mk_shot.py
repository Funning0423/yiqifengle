import json,numpy as np
from lib import *
def make_shot(name,src,ss,t,chain,target,tail=1.0,fi=0.04,fo=0.6,kbps=32,sr_out=32000,rate=1.0):
    x=load(src,ss=ss,t=t)
    if rate!=1.0:
        from scipy.signal import resample
        x=resample(x,int(len(x)/rate),axis=0)   # slower+lower (tape-style), rate<1 = deeper
    x=fade(x,fi,0.08)
    x=np.vstack([x,np.zeros((int(tail*SR),2))])
    x=chain(x)[:len(x)]
    x=fade(x,0,fo)
    m=norm_to(x.mean(1,keepdims=True),target)
    save(f'wav/{name}.wav',m)
    size=encode(f'wav/{name}.wav',f'out/{name}.mp3',kbps,sr_out,1)
    I,tp,lra=lufs(f'out/{name}.mp3');dur=len(m)/SR
    info=dict(name=name,src=src,ss=ss,t=t,rate=rate,durS=round(dur,2),bytes=size,lufs=I,truePeak=tp,kbps=kbps,sr=sr_out,ch=1)
    json.dump(info,open(f'out/{name}.json','w'),indent=1);print(json.dumps(info));return info
