"""Drop named mesh nodes from a glTF binary and compact accessors/bufferViews/buffer (no Draco, single buffer). 场景设计部 2026-10-30.
usage: python3 glb_drop_nodes.py in.glb out.glb name [name ...]"""
import sys,json,struct
def rd(p):
  b=open(p,'rb').read();jl=struct.unpack('<I',b[12:16])[0];return json.loads(b[20:20+jl]),b[20+jl+8:]
def wr(p,j,bn):
  js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);bn=bytes(bn)+b'\0'*((-len(bn))%4)
  open(p,'wb').write(struct.pack('<III',0x46546C67,2,28+len(js)+len(bn))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bn),0x004E4942)+bn)
def drop(j,bn,names):
  keep=[i for i,n in enumerate(j['nodes']) if n.get('name') not in names];nm={o:k for k,o in enumerate(keep)}
  for n in j['nodes']:
    if 'children' in n:n['children']=[nm[c] for c in n['children'] if c in nm]
  for s in j['scenes']:s['nodes']=[nm[c] for c in s['nodes'] if c in nm]
  j['nodes']=[j['nodes'][i] for i in keep]
  um=sorted({n['mesh'] for n in j['nodes'] if 'mesh' in n});mm={o:k for k,o in enumerate(um)};j['meshes']=[j['meshes'][i] for i in um]
  for n in j['nodes']:
    if 'mesh' in n:n['mesh']=mm[n['mesh']]
  ua=sorted({a for m in j['meshes'] for p in m['primitives'] for a in list(p['attributes'].values())+([p['indices']] if 'indices' in p else [])})
  am={o:k for k,o in enumerate(ua)};j['accessors']=[j['accessors'][i] for i in ua]
  for m in j['meshes']:
    for p in m['primitives']:
      p['attributes']={k:am[v] for k,v in p['attributes'].items()}
      if 'indices' in p:p['indices']=am[p['indices']]
  ub=sorted({a['bufferView'] for a in j['accessors']}|{im['bufferView'] for im in j.get('images',[]) if 'bufferView' in im});out=bytearray();bv=[]
  for i in ub:
    v=dict(j['bufferViews'][i]);o=v.get('byteOffset',0);data=bn[o:o+v['byteLength']];out.extend(b'\0'*((-len(out))%4));v['byteOffset']=len(out);out.extend(data);bv.append(v)
  bm={o:k for k,o in enumerate(ub)};j['bufferViews']=bv
  for a in j['accessors']:a['bufferView']=bm[a['bufferView']]
  for im in j.get('images',[]):
    if 'bufferView' in im:im['bufferView']=bm[im['bufferView']]
  j['buffers']=[dict(byteLength=len(out))];return j,out
if __name__=='__main__':
  j,bn=rd(sys.argv[1]);j,bn=drop(j,bn,set(sys.argv[3:]));wr(sys.argv[2],j,bn)
