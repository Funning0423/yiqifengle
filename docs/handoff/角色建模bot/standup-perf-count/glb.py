import json,struct,numpy as np
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};DT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8}
class G:
  def __init__(s,p):
    raw=open(p,'rb').read();JL=struct.unpack('<I',raw[12:16])[0];s.j=json.loads(raw[20:20+JL]);o=20+JL;BL=struct.unpack('<I',raw[o:o+4])[0];s.b=bytearray(raw[o+8:o+8+BL])
  def full(s,i):
    j,b=s.j,s.b;a=j['accessors'][i];n=NC[a['type']];dt=DT[a['componentType']]
    if 'bufferView' in a:
      bv=j['bufferViews'][a['bufferView']];st=bv.get('byteStride');off=bv.get('byteOffset',0)+a.get('byteOffset',0);es=n*np.dtype(dt).itemsize
      if st and st!=es:
        out=np.stack([np.frombuffer(b,dt,count=n,offset=off+k*st) for k in range(a['count'])])
      else: out=np.frombuffer(b,dt,count=a['count']*n,offset=off).reshape(a['count'],n).copy()
    else: out=np.zeros((a['count'],n),dt)
    sp=a.get('sparse')
    if sp:
      ib=j['bufferViews'][sp['indices']['bufferView']];vb=j['bufferViews'][sp['values']['bufferView']]
      idx=np.frombuffer(b,DT[sp['indices']['componentType']],count=sp['count'],offset=ib.get('byteOffset',0)+sp['indices'].get('byteOffset',0))
      out[idx]=np.frombuffer(b,dt,count=sp['count']*n,offset=vb.get('byteOffset',0)+sp['values'].get('byteOffset',0)).reshape(-1,n)
    if a.get('normalized') and dt!=np.float32: out=out.astype(np.float32)/np.iinfo(dt).max
    return out
  def add(s,arr,typ,ct,target=None,minmax=False):
    arr=np.ascontiguousarray(arr,DT[ct]);
    while len(s.b)%4: s.b.append(0)
    bv={'buffer':0,'byteOffset':len(s.b),'byteLength':arr.nbytes}
    if target: bv['target']=target
    s.b+=arr.tobytes();s.j['bufferViews'].append(bv)
    a={'bufferView':len(s.j['bufferViews'])-1,'componentType':ct,'count':len(arr),'type':typ}
    if minmax:
      d=arr.reshape(len(arr),-1);a['min']=[float(x) for x in d.min(0)];a['max']=[float(x) for x in d.max(0)]
    s.j['accessors'].append(a);return len(s.j['accessors'])-1
  def save(s,p):
    j=s.j;j['buffers'][0]['byteLength']=len(s.b)
    js=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode()
    while len(js)%4: js+=b' '
    b=bytearray(s.b)
    while len(b)%4: b.append(0)
    j['buffers'][0]['byteLength']=len(b);js=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode()
    while len(js)%4: js+=b' '
    out=struct.pack('<III',0x46546C67,2,28+len(js)+len(b))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(b),0x004E4942)+bytes(b)
    open(p,'wb').write(out);return out
def compact(g):
    """丢掉没被引用的 bufferView，重排 buffer。"""
    j=g.j;used=set()
    for a in j['accessors']:
        if 'bufferView' in a: used.add(a['bufferView'])
        sp=a.get('sparse')
        if sp: used.add(sp['indices']['bufferView']);used.add(sp['values']['bufferView'])
    for im in j.get('images',[]):
        if 'bufferView' in im: used.add(im['bufferView'])
    for m in j['meshes']:
        for p in m['primitives']:
            for e in p.get('extensions',{}).values():
                if 'bufferView' in e: used.add(e['bufferView'])
    # 未被引用的 accessor 也删
    ref=set()
    def walk(o):
        pass
    old=j['bufferViews'];nb=bytearray();remap={}
    for i,bv in enumerate(old):
        if i not in used: continue
        while len(nb)%4: nb.append(0)
        o=bv.get('byteOffset',0);d=g.b[o:o+bv['byteLength']];nbv=dict(bv);nbv['byteOffset']=len(nb);nb+=d;remap[i]=len(remap);old[i]=nbv
    j['bufferViews']=[old[i] for i in sorted(remap)]
    for a in j['accessors']:
        if 'bufferView' in a: a['bufferView']=remap[a['bufferView']]
        sp=a.get('sparse')
        if sp: sp['indices']['bufferView']=remap[sp['indices']['bufferView']];sp['values']['bufferView']=remap[sp['values']['bufferView']]
    for im in j.get('images',[]):
        if 'bufferView' in im: im['bufferView']=remap[im['bufferView']]
    g.b=nb
def prune_accessors(g):
    j=g.j;used=set()
    for m in j['meshes']:
        for p in m['primitives']:
            used|=set(p['attributes'].values());
            if 'indices' in p: used.add(p['indices'])
            for t in p.get('targets',[]): used|=set(t.values())
    for s in j['skins']:
        if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
    for an in j['animations']:
        for s in an['samplers']: used.add(s['input']);used.add(s['output'])
    keep=sorted(used);remap={o:n for n,o in enumerate(keep)};j['accessors']=[j['accessors'][i] for i in keep]
    for m in j['meshes']:
        for p in m['primitives']:
            p['attributes']={k:remap[v] for k,v in p['attributes'].items()}
            if 'indices' in p: p['indices']=remap[p['indices']]
            p['targets']=[{k:remap[v] for k,v in t.items()} for t in p.get('targets',[])] if 'targets' in p else None
            if p['targets'] is None: del p['targets']
    for s in j['skins']:
        if 'inverseBindMatrices' in s: s['inverseBindMatrices']=remap[s['inverseBindMatrices']]
    for an in j['animations']:
        for s in an['samplers']: s['input']=remap[s['input']];s['output']=remap[s['output']]
