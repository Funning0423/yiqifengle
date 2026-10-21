import json,struct,sys,hashlib,numpy as np
def load(p):
    b=open(p,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); o=20+n; bl=struct.unpack('<I',b[o:o+4])[0]; return j,b[o+8:o+8+bl]
CT={5126:'f4',5123:'u2',5125:'u4',5121:'u1',5120:'i1',5122:'i2'};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(g,i):
    j,b=g;a=j['accessors'][i]
    if 'bufferView' not in a: return np.zeros((a['count'],NC[a['type']]))
    v=j['bufferViews'][a['bufferView']];dt=np.dtype(CT[a['componentType']]);nc=NC[a['type']];st=v.get('byteStride',dt.itemsize*nc)
    off=v.get('byteOffset',0)+a.get('byteOffset',0);raw=np.frombuffer(b,np.uint8,a['count']*st,off).reshape(a['count'],st)[:,:dt.itemsize*nc].copy()
    x=raw.view(dt).reshape(a['count'],nc).astype(float)
    if 'sparse' in a: pass
    return x
def anims(g):
    j=g[0];R={}
    for an in j['animations']:
        d={}
        for ch in an['channels']:
            s=an['samplers'][ch['sampler']];k=(j['nodes'][ch['target']['node']].get('name'),ch['target']['path'])
            d[k]=(acc(g,s['input']),acc(g,s['output']),s.get('interpolation'))
        R[an['name']]=d
    return R
def h(x):return hashlib.sha1(np.ascontiguousarray(x).tobytes()).hexdigest()[:10]
A=load(sys.argv[1]);B=load(sys.argv[2]);clips=sys.argv[3].split(',') if len(sys.argv)>3 else None
aa,ab=anims(A),anims(B);out={}
for c in sorted(set(aa)|set(ab)):
    if clips and c not in clips: continue
    if c not in aa or c not in ab: out[c]='missing in '+('A' if c not in aa else 'B');continue
    ka,kb=aa[c],ab[c];ident=set(ka)==set(kb);mx=0;nd=0
    for k in set(ka)&set(kb):
        (ia,oa,_),(ib,ob,_)=ka[k],kb[k]
        if ia.shape!=ib.shape or oa.shape!=ob.shape: nd+=1;mx=float('inf');continue
        d=max(np.abs(ia-ib).max(initial=0),np.abs(oa-ob).max(initial=0))
        if d>0:nd+=1;mx=max(mx,d)
    out[c]=dict(same_channels=ident,nch=len(ka),nch_b=len(kb),ndiff=nd,maxdiff=mx)
for c,v in out.items():print(c,v)
# skins/bones
for g,nm in ((A,'A'),(B,'B')):
    j=g[0];
    for si,s in enumerate(j.get('skins',[])):print(nm,'skin',si,'joints',len(s['joints']),'ibm',h(acc(g,s['inverseBindMatrices'])),'names',h(np.array([hash(j['nodes'][x].get('name')) for x in s['joints']])))
    print(nm,'rest',h(np.array([j['nodes'][i].get('translation',[0,0,0])+j['nodes'][i].get('rotation',[0,0,0,1]) for s in j['skins'] for i in s['joints']])))
