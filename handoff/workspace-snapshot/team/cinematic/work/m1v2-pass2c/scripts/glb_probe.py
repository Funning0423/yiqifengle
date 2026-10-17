import json,struct,sys,numpy as np
b=open(sys.argv[1],'rb').read()
l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l]); off=20+l; bl=struct.unpack('<I',b[off:off+4])[0]; BIN=b[off+8:off+8+bl]
def acc(i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    return np.frombuffer(BIN,dtype=np.float32,count=a['count']*n,offset=bv.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],n)
out={}
for an in j['animations']:
    r={}
    for c in an['channels']:
        s=an['samplers'][c['sampler']]; t=acc(s['input']); v=acc(s['output']); nd=j['nodes'][c['target']['node']].get('name')
        if c['target']['path']=='weights': r['weights_'+nd]={'t0':float(t[0,0]),'t1':float(t[-1,0]),'n':len(t),'first':float(v[0,0]),'last':float(v[-1,0])}
        if c['target']['path']=='scale': r.setdefault('scale_minmax',[9,0]); r['scale_minmax']=[min(r['scale_minmax'][0],float(v.min())),max(r['scale_minmax'][1],float(v.max()))]
        if nd=='root' and c['target']['path']=='translation': r['root_t_first']=v[0].round(5).tolist(); r['root_t_last']=v[-1].round(5).tolist(); r['root_keys']=len(t); r['duration']=float(t[-1,0])
    out[an['name']]=r
print(json.dumps(out,indent=1))
