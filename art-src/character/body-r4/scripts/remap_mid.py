# python3 remap_mid.py in.glb out.glb : yellow dress drops skirt.front.mid / skirt.front.low.mid (merged into the non-mid bones)
import json,struct,sys
import numpy as np
src,dst=sys.argv[1:3]
b=bytearray(open(src,'rb').read()); L=struct.unpack('<I',b[12:16])[0]; J=json.loads(b[20:20+L]); bin0=20+L+8
names=[J['nodes'][i]['name'] for i in J['skins'][0]['joints']]
M={names.index('skirt.front.mid'):names.index('skirt.front'),names.index('skirt.front.low.mid'):names.index('skirt.front.low')}
CT={5121:np.uint8,5123:np.uint16,5126:np.float32}
def view(ai):
    a=J['accessors'][ai]; bv=J['bufferViews'][a['bufferView']]; dt=CT[a['componentType']]
    off=bin0+bv.get('byteOffset',0)+a.get('byteOffset',0); n=a['count']*4
    assert bv.get('byteStride',4*np.dtype(dt).itemsize)==4*np.dtype(dt).itemsize
    return off,np.frombuffer(bytes(b[off:off+n*np.dtype(dt).itemsize]),dt).reshape(-1,4).copy()
m=[m for m in J['meshes'] if m['name']=='LOD0_G2_DRESS'][0]; done=set(); moved=0
for pr in m['primitives']:
    ja,wa=pr['attributes']['JOINTS_0'],pr['attributes']['WEIGHTS_0']
    if ja in done: continue
    done.add(ja); oj,Jt=view(ja); ow,Wt=view(wa)
    assert J['accessors'][wa]['componentType']==5126
    for a_,b_ in M.items():
        hit=(Jt==a_)&(Wt>0); moved+=int(hit.sum()); Jt[Jt==a_]=b_
    # merge duplicate joints per vertex
    for i in range(len(Jt)):
        seen={}
        for k in range(4):
            if Wt[i,k]<=0: continue
            if Jt[i,k] in seen: Wt[i,seen[Jt[i,k]]]+=Wt[i,k]; Wt[i,k]=0; Jt[i,k]=0
            else: seen[Jt[i,k]]=k
    b[oj:oj+Jt.nbytes]=Jt.tobytes(); b[ow:ow+Wt.nbytes]=Wt.astype(np.float32).tobytes()
open(dst,'wb').write(bytes(b)); print('dress .mid influences remapped:',moved)
