# scale wind_flutter_loop per-bone delta (vs its frame 0) in place: rot q0*slerp(I,q0^-1 q,s), trans t0+(t-t0)s. Other clips/channels untouched.
import sys,json,fnmatch,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
SRC,OUT,WS=sys.argv[1],sys.argv[2],json.loads(sys.argv[3])
J,B=load(SRC);B=bytearray(B)
def qinv(q):return q*np.array([-1,-1,-1,1])
def qmul(a,b):
    x1,y1,z1,w1=a.T;x2,y2,z2,w2=b.T
    return np.stack([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2],-1)
def qpow(q,s):
    q=np.where(q[:,3:4]<0,-q,q);th=np.arccos(np.clip(q[:,3],-1,1));sn=np.sin(th);ax=np.where(sn[:,None]>1e-9,q[:,:3]/np.maximum(sn,1e-12)[:,None],0)
    return np.concatenate([ax*np.sin(th*s)[:,None],np.cos(th*s)[:,None]],1)
a=[a for a in J['animations'] if a['name']=='wind_flutter_loop'][0];done=[]
for c in a['channels']:
    n=J['nodes'][c['target']['node']]['name'];p=c['target']['path']
    s=next((v for k,v in WS.items() if fnmatch.fnmatchcase(n,k)),None)
    if s is None or p not in('rotation','translation') or s==1.0:continue
    sm=a['samplers'][c['sampler']];ac=J['accessors'][sm['output']];v=acc(J,B,sm['output']).astype(np.float64)
    if p=='rotation':q0=v[:1];nv=qmul(np.repeat(q0,len(v),0),qpow(qmul(np.repeat(qinv(q0),len(v),0),v),s))
    else:nv=v[:1]+(v-v[:1])*s
    nv=nv.astype(np.float32).tobytes()   # append new accessor + own sampler (accessors may be shared/deduped)
    while len(B)%4:B.append(0)
    o=len(B);B+=nv;J['bufferViews'].append(dict(buffer=0,byteOffset=o,byteLength=len(nv)))
    J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=ac['count'],type=ac['type']))
    ns=dict(sm);ns['output']=len(J['accessors'])-1;a['samplers'].append(ns);c['sampler']=len(a['samplers'])-1;done.append((n,p,s))
used=sorted(set(c['sampler'] for c in a['channels']));mp={o:i for i,o in enumerate(used)};a['samplers']=[a['samplers'][i] for i in used]
for c in a['channels']:c['sampler']=mp[c['sampler']]
save(OUT,J,bytes(B));print(done)
