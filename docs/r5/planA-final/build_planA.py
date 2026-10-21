#!/usr/bin/env python3
"""方案A合成：wip3(=a96226da + cand3_dense 三段坐姿动画 + wip3 布料/BOW morph + 袖子贴图，已逐项验证等价)
-> 补零法线(BODY 0/1/2，仅长度为0的顶点用面积加权几何法线填) -> 所有 accessor 重算 min/max（动画时间必有）。"""
import json,struct,sys,numpy as np,hashlib
IN,OUT=sys.argv[1],sys.argv[2]
raw=open(IN,'rb').read();JL=struct.unpack('<I',raw[12:16])[0];j=json.loads(raw[20:20+JL]);o=20+JL;BL=struct.unpack('<I',raw[o:o+4])[0]
b=bytearray(raw[o+8:o+8+BL])
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};DT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8}
def view(i):
    a=j['accessors'][i];n=NC[a['type']];dt=DT[a['componentType']];bv=j['bufferViews'][a['bufferView']]
    assert not bv.get('byteStride') or bv['byteStride']==n*np.dtype(dt).itemsize
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    return np.frombuffer(b,dt,count=a['count']*n,offset=off).reshape(a['count'],n),off
def full(i):
    a=j['accessors'][i];n=NC[a['type']];dt=DT[a['componentType']]
    out=view(i)[0].copy() if 'bufferView' in a else np.zeros((a['count'],n),dt)
    s=a.get('sparse')
    if s:
        ib=j['bufferViews'][s['indices']['bufferView']];vb=j['bufferViews'][s['values']['bufferView']]
        idx=np.frombuffer(b,DT[s['indices']['componentType']],count=s['count'],offset=ib.get('byteOffset',0)+s['indices'].get('byteOffset',0))
        out[idx]=np.frombuffer(b,dt,count=s['count']*n,offset=vb.get('byteOffset',0)+s['values'].get('byteOffset',0)).reshape(-1,n)
    return out
log={}
for m in j['meshes']:
    for pi,p in enumerate(m['primitives']):
        ni=p['attributes'].get('NORMAL')
        if ni is None: continue
        N,off=view(ni);l=np.linalg.norm(N,axis=1);z=l<1e-6
        if not z.any(): continue
        P=full(p['attributes']['POSITION']).astype(np.float64);I=full(p['indices']).reshape(-1,3)
        fn=np.cross(P[I[:,1]]-P[I[:,0]],P[I[:,2]]-P[I[:,0]]);acc=np.zeros_like(P)
        for k in range(3): np.add.at(acc,I[:,k],fn)
        al=np.linalg.norm(acc,axis=1);ok=z&(al>0);Nn=N.copy();Nn[ok]=(acc[ok]/al[ok,None]).astype(np.float32)
        rest=z&~ok; Nn[rest]=[0,1,0]
        b[off:off+Nn.nbytes]=Nn.tobytes();log[f"{m['name']}/{pi}"]=[int(z.sum()),int(rest.sum())]
# min/max
need=set(s['input'] for an in j['animations'] for s in an['samplers'])
for m in j['meshes']:
    for p in m['primitives']:
        need.add(p['attributes']['POSITION']); need|={t['POSITION'] for t in p.get('targets',[]) if 'POSITION' in t}
for i,a in enumerate(j['accessors']):
    if i not in need and 'min' not in a: continue
    if a['type']=='MAT4': continue
    d=full(i).astype(np.float64)
    if a['componentType']==5126: a['min']=[float(np.float32(x)) for x in d.min(0)];a['max']=[float(np.float32(x)) for x in d.max(0)]
    else: a['min']=[int(x) for x in d.min(0)];a['max']=[int(x) for x in d.max(0)]
for an in j['animations']:
    for s in an['samplers']:
        a=j['accessors'][s['input']];assert 'min' in a
        t=full(s['input'])[:,0];assert (np.diff(t)>0).all(),(an['name'],'non-increasing')
js=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode()
while len(js)%4: js+=b' '
while len(b)%4: b.append(0)
out=struct.pack('<III',0x46546C67,2,28+len(js)+len(b))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(b),0x004E4942)+bytes(b)
open(OUT,'wb').write(out);print(json.dumps(log),len(out),hashlib.sha256(out).hexdigest())
