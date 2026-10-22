# 把压缩后 clip（线性插值）按 30 fps 重采样回 QA 用 dense GLB（同名替换），用于压缩后复检
import sys,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
from scipy.spatial.transform import Rotation as R,Slerp
dense,comp,out=sys.argv[1:4];CL=sys.argv[4:]
J,B=load(dense);C,CB=load(comp);blob=bytearray()
def add(arr,typ):
    arr=np.ascontiguousarray(arr,np.float32);off=len(blob);blob.extend(arr.tobytes());J['accessors'].append(dict(bufferView=len(J['bufferViews']),byteOffset=off,componentType=5126,count=int(arr.shape[0]),type=typ,**({'min':arr.min(0).tolist(),'max':arr.max(0).tolist()} if typ=='SCALAR' else {})));return len(J['accessors'])-1
NM={n['name']:i for i,n in enumerate(J['nodes'])}
for ai,a in enumerate(J['animations']):
    if a['name'] not in CL:continue
    ca=[x for x in C['animations'] if x['name']==a['name']][0];T=acc(J,B,a['samplers'][0]['input'])[:,0];ti=add(T.reshape(-1,1),'SCALAR');sm=[];ch=[]
    for c in ca['channels']:
        s=ca['samplers'][c['sampler']];t=acc(C,CB,s['input'])[:,0];v=acc(C,CB,s['output']);p=c['target']['path']
        if p=='rotation':val=R.from_quat(np.repeat(v[:1],len(T),0)).as_quat() if len(t)<2 else Slerp(t,R.from_quat(v))(np.clip(T,t[0],t[-1])).as_quat()
        else:val=np.stack([np.interp(T,t,v[:,k]) for k in range(v.shape[1])],1)
        o=add(val,'VEC4' if p=='rotation' else 'VEC3');sm.append(dict(input=ti,output=o));ch.append(dict(sampler=len(sm)-1,target=dict(node=NM[C['nodes'][c['target']['node']]['name']],path=p)))
    J['animations'][ai]=dict(name=a['name'],channels=ch,samplers=sm)
pad=(4-len(B)%4)%4;J['bufferViews'].append(dict(buffer=0,byteOffset=len(B)+pad,byteLength=len(blob)));save(out,J,B+b'\0'*pad+bytes(blob));print('ok')
