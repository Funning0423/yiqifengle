import json,struct,numpy as np
DT={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class G:
  def __init__(s,f):
    b=open(f,'rb').read();n=struct.unpack_from('<I',b,12)[0];s.j=json.loads(b[20:20+n]);bn=struct.unpack_from('<I',b,20+n)[0];s.blob=bytearray(b[28+n:28+n+bn])
  def acc(s,i):
    a=s.j['accessors'][i];v=s.j['bufferViews'][a['bufferView']];nc=NC[a['type']];dt=np.dtype(DT[a['componentType']])
    st=v.get('byteStride');off=v.get('byteOffset',0)+a.get('byteOffset',0)
    if st and st!=nc*dt.itemsize:
      raw=np.frombuffer(s.blob,dtype='u1',count=st*a['count'],offset=off).reshape(a['count'],st)[:,:nc*dt.itemsize].copy();return raw.view(dt).reshape(-1,nc)
    r=np.frombuffer(s.blob,dtype=dt,count=a['count']*nc,offset=off).reshape(-1,nc).copy()
    if a.get('normalized') and dt.kind=='u': r=r/ (255. if dt.itemsize==1 else 65535.)
    return r
  def add(s,a,typ='VEC3'):
    a=np.asarray(a,dtype='<f4');s.blob.extend(b'\0'*((-len(s.blob))%4));off=len(s.blob);s.blob.extend(a.tobytes())
    vi=len(s.j['bufferViews']);s.j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes,'target':34962})
    ai=len(s.j['accessors']);s.j['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(a),'type':typ,'min':a.min(0).tolist(),'max':a.max(0).tolist()});return ai
  def save(s,f):
    s.j['buffers']=[{'byteLength':len(s.blob)}];raw=json.dumps(s.j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);s.blob.extend(b'\0'*((-len(s.blob))%4))
    open(f,'wb').write(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(s.blob))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(s.blob),0x004e4942)+bytes(s.blob))
def compact(g):
  j=g.j;used=set()
  for a in j['accessors']:
    if 'bufferView' in a: used.add(a['bufferView'])
    if 'sparse' in a: used|={a['sparse']['indices']['bufferView'],a['sparse']['values']['bufferView']}
  for im in j.get('images',[]):
    if 'bufferView' in im: used.add(im['bufferView'])
  # drop unreferenced accessors first
  ref=set()
  def walk(o):
    pass
  for m in j['meshes']:
    for p in m['primitives']:
      ref|=set(p['attributes'].values());ref.add(p.get('indices')) if 'indices' in p else None
      for t in p.get('targets',[]): ref|=set(t.values())
  for s in j.get('skins',[]):
    if 'inverseBindMatrices' in s: ref.add(s['inverseBindMatrices'])
  for an in j.get('animations',[]):
    for sm in an['samplers']: ref|={sm['input'],sm['output']}
  amap={};na=[]
  for i,a in enumerate(j['accessors']):
    if i in ref: amap[i]=len(na);na.append(a)
  j['accessors']=na
  for m in j['meshes']:
    for p in m['primitives']:
      p['attributes']={k:amap[v] for k,v in p['attributes'].items()}
      if 'indices' in p: p['indices']=amap[p['indices']]
      p['targets']=[{k:amap[v] for k,v in t.items()} for t in p.get('targets',[])] if 'targets' in p else None
      if p['targets'] is None: del p['targets']
  for s in j.get('skins',[]):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
  for an in j.get('animations',[]):
    for sm in an['samplers']: sm['input']=amap[sm['input']];sm['output']=amap[sm['output']]
  used=set(a['bufferView'] for a in na if 'bufferView' in a)|set(im['bufferView'] for im in j.get('images',[]) if 'bufferView' in im)
  for a in na:
    if 'sparse' in a: used|={a['sparse']['indices']['bufferView'],a['sparse']['values']['bufferView']}
  nb=bytearray();vmap={};nv=[]
  for i,v in enumerate(j['bufferViews']):
    if i not in used: continue
    nb.extend(b'\0'*((-len(nb))%4));d=g.blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];v=dict(v);v['byteOffset']=len(nb);nb.extend(d);vmap[i]=len(nv);nv.append(v)
  j['bufferViews']=nv
  for a in na:
    if 'bufferView' in a: a['bufferView']=vmap[a['bufferView']]
    if 'sparse' in a:
      a['sparse']['indices']['bufferView']=vmap[a['sparse']['indices']['bufferView']];a['sparse']['values']['bufferView']=vmap[a['sparse']['values']['bufferView']]
  for im in j.get('images',[]):
    if 'bufferView' in im: im['bufferView']=vmap[im['bufferView']]
  g.blob=nb
