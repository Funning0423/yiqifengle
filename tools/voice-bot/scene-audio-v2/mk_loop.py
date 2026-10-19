import sys,json,numpy as np
from lib import *
DUP=0.15
def make_loop(name,src,ss,L,X,chain,target,kbps=32,sr_out=32000,ch=2,mono_src=False,lin=False):
    x=load(src,ss=ss,t=L+X+2.0)
    if mono_src or ch==1: x=np.repeat(x.mean(1,keepdims=True),2,1)
    x=chain(x)
    x=x[int(1.0*SR):]          # drop filter/reverb warm-up
    loop=circ_loop(x,L,X,lin=lin)
    if ch==1: loop=loop.mean(1,keepdims=True)
    loop=norm_to(loop,target)
    rep=seam_report(loop)
    full=np.vstack([loop,loop[:int(DUP*SR)]])
    save(f'wav/{name}.wav',full); save(f'wav/{name}_x3.wav',np.vstack([loop]*3))
    size=encode(f'wav/{name}.wav',f'out/{name}.mp3',kbps,sr_out,ch)
    I,tp,lra=lufs(f'out/{name}.mp3')
    info=dict(name=name,src=src,ss=ss,loopS=L,xfadeS=X,dupS=DUP,bytes=size,lufs=I,truePeak=tp,lra=lra,kbps=kbps,sr=sr_out,ch=ch,seam=rep)
    json.dump(info,open(f'out/{name}.json','w'),indent=1);print(json.dumps(info));return info
