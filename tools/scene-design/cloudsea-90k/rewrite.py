import json,struct,sys,numpy as np,DracoPy
def load(f):
  b=open(f,'rb').read();jl=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+jl]);s=20+jl
  bl=struct.unpack('<I',b[s:s+4])[0];return j,bytearray(b[s+8:s+8+bl])
def rewrite(src,dst,removals,drop_nodes=()):
  """removals: {node_name: bool mask over faces (True=remove)}"""
  j,bin_=load(src);stats={}
  views=[bytes(bin_[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]) for v in j['bufferViews']]
  for n in j['nodes']:
    if n['name'] not in removals:continue
    prims=j['meshes'][n['mesh']]['primitives'];assert len(prims)==1,n['name']
    p=prims[0];ext=p['extensions']['KHR_draco_mesh_compression']
    d=DracoPy.decode(views[ext['bufferView']]);A={a['attribute_type']:a for a in d.attributes}
    rm=np.asarray(removals[n['name']],bool);assert len(rm)==len(d.faces),(n['name'],len(rm),len(d.faces))
    faces=d.faces[~rm];used=np.unique(faces);remap=-np.ones(len(d.points),np.int64);remap[used]=np.arange(len(used))
    pts=d.points[used].astype('f8');nf=remap[faces].astype('u4')
    nrm=d.normals[used].astype('f8');uv=d.tex_coord[used].astype('f8');col=d.colors[used].astype('u1')
    enc=DracoPy.encode(pts,nf,quantization_bits=16,compression_level=7,colors=col,tex_coord=uv,normals=nrm,tex_coord_quantization_bits=14,normal_quantization_bits=12)
    views[ext['bufferView']]=enc
    ext['attributes']={'POSITION':3,'NORMAL':2,'TEXCOORD_0':1,'COLOR_0':0}
    for k,a in p['attributes'].items():j['accessors'][a]['count']=int(len(used))
    j['accessors'][p['indices']]['count']=int(len(nf)*3)
    pa=j['accessors'][p['attributes']['POSITION']];pa['min']=[float(x) for x in pts.min(0)];pa['max']=[float(x) for x in pts.max(0)]
    stats[n['name']]=(len(d.faces),len(nf))
  out=bytearray()
  for i,v in enumerate(views):
    while len(out)%4:out.append(0)
    j['bufferViews'][i]['byteOffset']=len(out);j['bufferViews'][i]['byteLength']=len(v);out+=v
  while len(out)%4:out.append(0)
  j['buffers'][0]['byteLength']=len(out)
  js=json.dumps(j,separators=(',',':')).encode()
  while len(js)%4:js+=b' '
  glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+out
  open(dst,'wb').write(glb);return stats,len(glb)
def replace_geom(src,dst,node,g):
  """g: dict P,N,UV,C,F; swaps the single primitive of node for new geometry"""
  import DracoPy
  j,bin_=load(src)
  n=[x for x in j['nodes'] if x['name']==node][0];p=j['meshes'][n['mesh']]['primitives'][0];ext=p['extensions']['KHR_draco_mesh_compression']
  enc=DracoPy.encode(g['P'].astype('f8'),g['F'].astype('u4'),quantization_bits=16,compression_level=7,colors=g['C'].astype('u1'),tex_coord=g['UV'].astype('f8'),normals=g['N'].astype('f8'),tex_coord_quantization_bits=14,normal_quantization_bits=12)
  views=[bytes(bin_[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]) for v in j['bufferViews']]
  views[ext['bufferView']]=enc;ext['attributes']={'POSITION':3,'NORMAL':2,'TEXCOORD_0':1,'COLOR_0':0}
  for k,a in p['attributes'].items():j['accessors'][a]['count']=int(len(g['P']))
  j['accessors'][p['indices']]['count']=int(len(g['F'])*3)
  pa=j['accessors'][p['attributes']['POSITION']];pa['min']=[float(x) for x in g['P'].min(0)];pa['max']=[float(x) for x in g['P'].max(0)]
  out=bytearray()
  for i,v in enumerate(views):
    while len(out)%4:out.append(0)
    j['bufferViews'][i]['byteOffset']=len(out);j['bufferViews'][i]['byteLength']=len(v);out+=v
  while len(out)%4:out.append(0)
  j['buffers'][0]['byteLength']=len(out)
  js=json.dumps(j,separators=(',',':')).encode()
  while len(js)%4:js+=b' '
  open(dst,'wb').write(struct.pack('<III',0x46546C67,2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+out)
