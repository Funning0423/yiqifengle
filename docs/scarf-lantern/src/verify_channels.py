# 逐通道核对：OUT 里每个 clip 的每个原有通道，与生产版 stepdown 的 time/value 数组逐元素比对；另核 nodes/skin/meshes
import sys,json,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
P,O=sys.argv[1:3];J0,B0=load(P);J1,B1=load(O);r=dict(clips={},bad=[])
nm0={a['name']:a for a in J0['animations']};nm1={a['name']:a for a in J1['animations']}
assert list(nm0)==list(nm1)
for k,a0 in nm0.items():
    a1=nm1[k];c1={(c['target']['node'],c['target']['path']):c for c in a1['channels']};n=0;mx=0
    for c in a0['channels']:
        key=(c['target']['node'],c['target']['path']);d=c1.pop(key)
        s0=a0['samplers'][c['sampler']];s1=a1['samplers'][d['sampler']]
        for f in ('input','output'):
            x=acc(J0,B0,s0[f]);y=acc(J1,B1,s1[f])
            if x.shape!=y.shape or not np.array_equal(x,y):r['bad'].append([k,key,f])
        if s0.get('interpolation')!=s1.get('interpolation'):r['bad'].append([k,key,'interp'])
        n+=1
    extra=[(J1['nodes'][a][ 'name'],b) for a,b in c1]
    r['clips'][k]=dict(orig_channels_identical=n,extra=extra)
r['nodes_same']=all(J0['nodes'][i].get('name')==J1['nodes'][i].get('name') and {x:y for x,y in J0['nodes'][i].items() if x!='children'}=={x:y for x,y in J1['nodes'][i].items() if x!='children'} for i in range(len(J0['nodes'])))
r['joints']=[len(J0['skins'][0]['joints']),len(J1['skins'][0]['joints'])]
r['meshes']=[[m['name'] for m in J0['meshes']],[m['name'] for m in J1['meshes']]]
r['interp_explicit_new']=sum(1 for a in J1['animations'] for s in a['samplers'] if 'interpolation' in s)
print(json.dumps(r,ensure_ascii=False,indent=0)[:3000])
