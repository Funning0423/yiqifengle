import json,struct,copy,sys
SRC='/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/planB_cand3b_ribbonwind4b_stepdown_scarf.glb'
d=open(SRC,'rb').read();n=struct.unpack('<I',d[12:16])[0];J=json.loads(d[20:20+n]);BIN=d[28+n:28+n+struct.unpack('<I',d[20+n:24+n])[0]]
SCARF_MESH=[i for i,m in enumerate(J['meshes']) if m['name']=='LOD0_G2_SCARF'][0]
SCARF_NODE=[i for i,x in enumerate(J['nodes']) if x.get('mesh')==SCARF_MESH][0]
def pack(j,path):
  # collect used accessors/views, rebuild buffer compactly in original order
  used=set()
  for m in j.get('meshes',[]):
    for p in m['primitives']:
      used|=set(p['attributes'].values())
      if 'indices' in p: used.add(p['indices'])
      for t in p.get('targets',[]): used|=set(t.values())
  for s in j.get('skins',[]):
    if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
  for a in j.get('animations',[]):
    for s in a['samplers']: used|={s['input'],s['output']}
  ua=sorted(used);amap={o:i for i,o in enumerate(ua)}
  views=set(j['accessors'][a]['bufferView'] for a in ua if 'bufferView' in j['accessors'][a])|set(v for a in ua for v in ([j['accessors'][a]['sparse']['indices']['bufferView'],j['accessors'][a]['sparse']['values']['bufferView']] if 'sparse' in j['accessors'][a] else []))|set(im['bufferView'] for im in j.get('images',[]) if 'bufferView' in im)
  uv=sorted(views);vmap={o:i for i,o in enumerate(uv)};out=bytearray();nv=[]
  for o in uv:
    v=copy.deepcopy(j['bufferViews'][o]);s=v.get('byteOffset',0)
    while len(out)%4:out+=b'\0'
    chunk=BIN[s:s+v['byteLength']];v['byteOffset']=len(out);out+=chunk;nv.append(v)
  na=[]
  for o in ua:
    a=copy.deepcopy(j['accessors'][o])
    if 'bufferView' in a:a['bufferView']=vmap[a['bufferView']]
    if 'sparse' in a:
      for k in ('indices','values'):a['sparse'][k]['bufferView']=vmap[a['sparse'][k]['bufferView']]
    na.append(a)
  j['accessors']=na;j['bufferViews']=nv;j['buffers']=[{'byteLength':len(out)}]
  for im in j.get('images',[]):
    if 'bufferView' in im: im['bufferView']=vmap[im['bufferView']]
  for m in j.get('meshes',[]):
    for p in m['primitives']:
      p['attributes']={k:amap[v] for k,v in p['attributes'].items()}
      if 'indices' in p:p['indices']=amap[p['indices']]
      if 'targets' in p:p['targets']=[{k:amap[v] for k,v in t.items()} for t in p['targets']]
  for s in j.get('skins',[]): s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
  for a in j.get('animations',[]):
    for s in a['samplers']: s['input']=amap[s['input']];s['output']=amap[s['output']]
  js=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode()
  while len(js)%4: js+=b' '
  while len(out)%4: out+=b'\0'
  g=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+out
  open(path,'wb').write(g)
def drop_node(j,ni):
  for x in j['nodes']:
    if 'children' in x:
      x['children']=[c-(c>ni) for c in x['children'] if c!=ni]
      if not x['children']:del x['children']
  for s in j['skins']: s['joints']=[c-(c>ni) for c in s['joints']];
  for s in j['scenes']: s['nodes']=[c-(c>ni) for c in s['nodes'] if c!=ni]
  for a in j.get('animations',[]):
    a['channels']=[c for c in a['channels'] if c['target']['node']!=ni]
    for c in a['channels']: c['target']['node']-= c['target']['node']>ni
  del j['nodes'][ni]
def drop_mesh(j,mi):
  del j['meshes'][mi]
  for x in j['nodes']:
    if 'mesh' in x and x['mesh']>mi:x['mesh']-=1
def prune_materials(j):
  used=sorted({p['material'] for m in j['meshes'] for p in m['primitives'] if 'material' in p});mm={o:i for i,o in enumerate(used)}
  j['materials']=[j['materials'][o] for o in used]
  for m in j['meshes']:
    for p in m['primitives']:
      if 'material' in p:p['material']=mm[p['material']]
  def texrefs(o,f):
    if isinstance(o,dict):
      for k,v in o.items():
        if k.endswith('Texture') and isinstance(v,dict) and 'index' in v: f(v)
        else: texrefs(v,f)
    elif isinstance(o,list):
      for v in o: texrefs(v,f)
  ut=set();texrefs(j['materials'],lambda v:ut.add(v['index']));ut=sorted(ut);tm={o:i for i,o in enumerate(ut)}
  texrefs(j['materials'],lambda v:v.__setitem__('index',tm[v['index']]))
  j['textures']=[j['textures'][o] for o in ut]
  ui=sorted({t['source'] for t in j['textures']});im={o:i for i,o in enumerate(ui)}
  for t in j['textures']:t['source']=im[t['source']]
  j['images']=[j['images'][o] for o in ui]
  us=sorted({t['sampler'] for t in j['textures'] if 'sampler' in t});sm={o:i for i,o in enumerate(us)}
  for t in j['textures']:
    if 'sampler' in t:t['sampler']=sm[t['sampler']]
  j['samplers']=[j['samplers'][o] for o in us]
# main: drop scarf node+mesh
m=copy.deepcopy(J);drop_node(m,SCARF_NODE);drop_mesh(m,SCARF_MESH);prune_materials(m)
m.setdefault('extras',{})['scarf_split']={'scarf_mesh':'separate subpackage GLB','skin_joints':len(m['skins'][0]['joints'])}
pack(m,sys.argv[1])
# scarf: keep all nodes (same hierarchy/joint names), drop other mesh nodes, no animations
s=copy.deepcopy(J);s.pop('animations',None)
for ni in sorted([i for i,x in enumerate(s['nodes']) if 'mesh' in x and x['mesh']!=SCARF_MESH],reverse=True):drop_node(s,ni)
for mi in sorted([i for i in range(len(s['meshes'])) if i!=SCARF_MESH],reverse=True):drop_mesh(s,mi)
prune_materials(s);s['extras']={'scarf_attach':{'skin_joints':len(s['skins'][0]['joints']),'note':'skin identical to main GLB (joint names, order, inverseBindMatrices)'}}
pack(s,sys.argv[2])
