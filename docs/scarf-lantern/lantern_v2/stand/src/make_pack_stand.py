# 灯塔子包：只含骨骼节点层级（无网格/蒙皮，供 Cocos 按节点路径绑定）+ 9 段 *_lantern 右臂覆盖 clip（3 旋转通道，已压缩）
import sys,json,copy,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
src,out=sys.argv[1:3];J,B=load(src)
anims=[a for a in J['animations'] if a['name'] in ('lantern_pick_up_stand','lantern_put_down_stand')]
used=sorted({s[k] for a in anims for s in a['samplers'] for k in ('input','output')})
blob=bytearray();acc_new=[];amap={}
for i in used:
    a=J['accessors'][i];arr=acc(J,B,i).astype(np.float32);off=len(blob);blob.extend(arr.tobytes())
    na=dict(bufferView=0,byteOffset=off,componentType=5126,count=a['count'],type=a['type'])
    if 'min' in a:na['min']=a['min'];na['max']=a['max']
    amap[i]=len(acc_new);acc_new.append(na)
# 节点：只保留被驱动骨骼到场景根的祖先链（节点路径与主包一致），无网格/蒙皮
par={c:i for i,n in enumerate(J['nodes']) for c in n.get('children',[])};keep=set()
for a in anims:
    for c in a['channels']:
        k=c['target']['node']
        while True:
            keep.add(k)
            if k not in par or J['nodes'][par[k]].get('mesh') is not None or 'skin' in J['nodes'][par[k]]:break
            k=par[k]
keep={k for k in keep if J['nodes'][k]['name']!='R5G2_RIG_22P4' or True}
order=sorted(keep);nmap={o:i for i,o in enumerate(order)};nodes=[]
for o in order:
    n={k:v for k,v in J['nodes'][o].items() if k in('name','translation','rotation','scale')}
    ch=[nmap[c] for c in J['nodes'][o].get('children',[]) if c in nmap]
    if ch:n['children']=ch
    nodes.append(n)
roots=[nmap[o] for o in order if not any(o in J['nodes'][p].get('children',[]) for p in order)]
A=[]
for a in anims:
    A.append(dict(name=a['name'],samplers=[dict(input=amap[s['input']],output=amap[s['output']]) for s in a['samplers']],
                  channels=[dict(sampler=c['sampler'],target=dict(node=nmap[c['target']['node']],path=c['target']['path'])) for c in a['channels']]))
P=dict(asset=dict(version='2.0',generator='角色动画bot lantern_stand make_pack',extras=dict(note='灯塔子包：lantern_pick_up_stand / lantern_put_down_stand 全身 base 层 clip（高台 0.40 m 半蹲取放灯）；骨骼节点路径与主包一致，无网格')),
       scene=0,scenes=[dict(nodes=roots)],nodes=nodes,animations=A,accessors=acc_new,bufferViews=[dict(buffer=0,byteOffset=0,byteLength=len(blob))],buffers=[dict(byteLength=len(blob))])
n=save(out,P,bytes(blob));print(json.dumps(dict(bytes=n,anim_bin=len(blob),clips=[a['name'] for a in A],nodes=len(nodes))))
