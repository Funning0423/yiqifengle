import sys,json,copy;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
J,B=load(sys.argv[1]);J=copy.deepcopy(J)
UA=set()
def walk(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in('indices','inverseBindMatrices','input','output') and isinstance(v,int):UA.add(v)
            elif k in('attributes',) or (k=='targets'): pass
            walk(v)
    elif isinstance(o,list):[walk(x) for x in o]
for m in J.get('meshes',[]):
    for p in m['primitives']:
        UA.update(p['attributes'].values());UA.update(v for t in p.get('targets',[]) for v in t.values())
        if 'indices' in p:UA.add(p['indices'])
for s in J.get('skins',[]):
    if 'inverseBindMatrices' in s:UA.add(s['inverseBindMatrices'])
for a in J['animations']:
    for s in a['samplers']:UA.update([s['input'],s['output']])
UA=sorted(UA);am={o:i for i,o in enumerate(UA)}
UB=set(J['accessors'][i]['bufferView'] for i in UA if 'bufferView' in J['accessors'][i])
for i in UA:
    sp=J['accessors'][i].get('sparse')
    if sp:UB.update([sp['indices']['bufferView'],sp['values']['bufferView']])
for im in J.get('images',[]):
    if 'bufferView' in im:UB.add(im['bufferView'])
for m in J.get('meshes',[]):
    for p in m['primitives']:
        d=p.get('extensions',{}).get('KHR_draco_mesh_compression')
        if d:UB.add(d['bufferView'])
UB=sorted(UB);bm={o:i for i,o in enumerate(UB)}
nb=bytearray();nbv=[]
for o in UB:
    bv=dict(J['bufferViews'][o]);s=bv.get('byteOffset',0)
    while len(nb)%4:nb.append(0)
    bv['byteOffset']=len(nb);nb+=B[s:s+bv['byteLength']];nbv.append(bv)
J['bufferViews']=nbv
acs=[]
for o in UA:
    a=dict(J['accessors'][o])
    if 'bufferView' in a:a['bufferView']=bm[a['bufferView']]
    if 'sparse' in a:
        a['sparse']=json.loads(json.dumps(a['sparse']));a['sparse']['indices']['bufferView']=bm[a['sparse']['indices']['bufferView']];a['sparse']['values']['bufferView']=bm[a['sparse']['values']['bufferView']]
    acs.append(a)
J['accessors']=acs
for im in J.get('images',[]):
    if 'bufferView' in im:im['bufferView']=bm[im['bufferView']]
for m in J.get('meshes',[]):
    for p in m['primitives']:
        p['attributes']={k:am[v] for k,v in p['attributes'].items()}
        if 'targets' in p:p['targets']=[{k:am[v] for k,v in t.items()} for t in p['targets']]
        if 'indices' in p:p['indices']=am[p['indices']]
        d=p.get('extensions',{}).get('KHR_draco_mesh_compression')
        if d:d['bufferView']=bm[d['bufferView']]
for s in J.get('skins',[]):
    if 'inverseBindMatrices' in s:s['inverseBindMatrices']=am[s['inverseBindMatrices']]
for a in J['animations']:
    for s in a['samplers']:s['input']=am[s['input']];s['output']=am[s['output']]
print('accessors',len(acs),'bufferViews',len(nbv),'bin',len(nb),'was',len(B));save(sys.argv[2],J,bytes(nb))
