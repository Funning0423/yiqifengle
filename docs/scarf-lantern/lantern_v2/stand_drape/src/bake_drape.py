# 把膝角驱动的布料顶起烘进 lantern_pick_up_stand / lantern_put_down_stand 的 skirt.front / skirt.front.mid 旋转通道（30 fps 采样，LINEAR）
# python3 bake_drape.py in.glb out_full.glb out_delta.glb params.json
import sys,json,math,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import load,acc,save
from scipy.spatial.transform import Rotation as R
src,outf,outd,pj=sys.argv[1:5];PRM=json.load(open(pj));J,B=load(src);B=bytearray(B)
K0,K1=30.0,104.0;g=PRM.get('gamma',1.0)
def w(k):
    x=np.clip((k-K0)/(K1-K0),0,1);x=1-(1-x)**g;return x*x*x*(x*(6*x-15)+10)
nid={n['name']:i for i,n in enumerate(J['nodes'])}
def samp(a,node,path):
    for c in a['channels']:
        if c['target']['node']==nid[node] and c['target']['path']==path:return c,a['samplers'][c['sampler']]
def ev(a,node,t):
    c,s=samp(a,node,'rotation');T=acc(J,B,s["input"]).ravel();Q=acc(J,B,s['output'])
    i=np.clip(np.searchsorted(T,t,side='right')-1,0,len(T)-1);j=np.minimum(i+1,len(T)-1);u=np.where(j>i,(t-T[i])/np.maximum(T[j]-T[i],1e-9),0)[:,None]
    q0,q1=Q[i],Q[j];q1=np.where((q0*q1).sum(1,keepdims=True)<0,-q1,q1);q=q0*(1-u)+q1*u   # 与引擎 LINEAR(nlerp 近似) 一致
    return q/np.linalg.norm(q,axis=1,keepdims=True)
def add(arr,typ):
    arr=np.ascontiguousarray(arr,np.float32);
    while len(B)%4:B.append(0)
    off=len(B);B.extend(arr.tobytes());J['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=arr.nbytes));a=dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=len(arr),type=typ)
    if typ=='SCALAR':a['min']=[float(arr.min())];a['max']=[float(arr.max())]
    J['accessors'].append(a);return len(J['accessors'])-1
INFO={}
for a in J['animations']:
    if a['name'] not in ('lantern_pick_up_stand','lantern_put_down_stand'):continue
    c,s=samp(a,'shin.L','rotation');T0=acc(J,B,s["input"]).ravel();n=int(round(T0.max()*30));t=np.arange(n+1)/30.0
    kn=np.max([np.degrees(np.arccos(np.clip(R.from_quat(ev(a,'shin.'+sd,t)).apply([0,1,0])[:,1],-1,1))) for sd in 'LR'],axis=0)
    ww=w(kn);INFO[a['name']]=dict(knee=kn.round(2).tolist(),w=ww.round(4).tolist())
    ti=add(t,'SCALAR')
    for b in ('skirt.front','skirt.front.mid','skirt.front.low','skirt.front.low.mid'):
        A=PRM.get(b,0)
        if not A:continue
        q=R.from_quat(ev(a,b,t))*R.from_rotvec(np.outer(np.radians(A*ww),[1,0,0]))   # 局部右乘绕 X（glTF/Blender 骨局部 X 一致）
        Q=q.as_quat();Q[1:]*=np.sign((Q[1:]*Q[:-1]).sum(1))[:,None]+((Q[1:]*Q[:-1]).sum(1)==0)[:,None]
        c,s=samp(a,b,'rotation');s['input']=ti;s['output']=add(Q,'VEC4');s['interpolation']='LINEAR'
J['buffers'][0]['byteLength']=len(B);save(outf,J,bytes(B))
json.dump(INFO,open(outf+'.drive.json','w'))
# 增量包：只含被改的布料骨通道 + 节点祖先链（路径与主包一致），无网格
bones=[b for b in ('skirt.front','skirt.front.mid','skirt.front.low','skirt.front.low.mid') if PRM.get(b)]
par={c:i for i,n in enumerate(J['nodes']) for c in n.get('children',[])};keep=set()
for b in bones:
    k=nid[b]
    while True:
        keep.add(k)
        if k not in par or J['nodes'][par[k]].get('mesh') is not None or 'skin' in J['nodes'][par[k]]:break
        k=par[k]
order=sorted(keep);nm={o:i for i,o in enumerate(order)};nodes=[]
for o in order:
    nd={k:v for k,v in J['nodes'][o].items() if k in('name','translation','rotation','scale')};ch=[nm[c] for c in J['nodes'][o].get('children',[]) if c in nm]
    if ch:nd['children']=ch
    nodes.append(nd)
blob=bytearray();accs=[];am={};A=[]
def cp(i):
    if i in am:return am[i]
    arr=acc(J,B,i).astype(np.float32);off=len(blob);blob.extend(arr.tobytes());a=J['accessors'][i];na=dict(bufferView=0,byteOffset=off,componentType=5126,count=a['count'],type=a['type'])
    if 'min' in a:na['min']=a['min'];na['max']=a['max']
    am[i]=len(accs);accs.append(na);return am[i]
for a in J['animations']:
    if a['name'] not in INFO:continue
    S=[];C=[]
    for b in bones:
        c,s=samp(a,b,'rotation');S.append(dict(input=cp(s['input']),output=cp(s['output']),interpolation='LINEAR'));C.append(dict(sampler=len(S)-1,target=dict(node=nm[nid[b]],path='rotation')))
    A.append(dict(name=a['name']+'_drape',samplers=S,channels=C))
roots=[nm[o] for o in order if not any(o in J['nodes'][p].get('children',[]) for p in order)]
P=dict(asset=dict(version='2.0',generator='角色动画bot stand_drape',extras=dict(note='高台取/放灯 布料顶起覆盖层：只含 '+','.join(bones)+' 旋转（完整值，非加法）；mask=这些骨，权重 1，与 base clip 同步播放',params=PRM)),
       scene=0,scenes=[dict(nodes=roots)],nodes=nodes,animations=A,accessors=accs,bufferViews=[dict(buffer=0,byteOffset=0,byteLength=len(blob))],buffers=[dict(byteLength=len(blob))])
print(json.dumps(dict(full=outf,delta_bytes=save(outd,P,bytes(blob)),bones=bones,knee_max={k:max(v['knee']) for k,v in INFO.items()})))
