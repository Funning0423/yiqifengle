# python3 splice_glb.py <base.glb> <head_prims.npz> <tex_dir> <out.glb>
# Replace BODY FACE/HEAD/HAIR prims; keep morph TARGET COUNT with zero deltas so mesh weights stay valid.
import sys, json, struct, numpy as np
base,npz,texd,out=sys.argv[1:5]
f=open(base,'rb').read(); L=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+L]); B=f[28+L:]
D=np.load(npz); prims={}
for k in D.files:
    m,a=k.split('__'); prims.setdefault(m,{})[a]=D[k]
acc=j['accessors']; bvs=j['bufferViews']
def add_view(data,target=None):
    bvs.append({'buffer':0,'byteLength':len(data),'_data':data, **({'target':target} if target else {})}); return len(bvs)-1
def add_acc(arr,ctype,typ,target,minmax=False):
    v=add_view(arr.tobytes(),target); a={'bufferView':v,'componentType':ctype,'count':int(arr.shape[0]),'type':typ}
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    acc.append(a); return len(acc)-1
body=[m for m in j['meshes'] if m['name']=='LOD0_G2_BODY'][0]
n_morph=len(body.get('weights') or [])
for p in body['primitives']:
    mname=j['materials'][p['material']]['name']
    if mname not in prims: continue
    d=prims[mname]; n=d['P'].shape[0]
    col=np.ones((n,3),np.float32)
    p['attributes']={'POSITION':add_acc(d['P'],5126,'VEC3',34962,True),'NORMAL':add_acc(d['N'],5126,'VEC3',34962),
        'TEXCOORD_0':add_acc(d['U'],5126,'VEC2',34962),'COLOR_0':add_acc(col,5126,'VEC3',34962),
        'JOINTS_0':add_acc(d['J'],5121,'VEC4',34962),'WEIGHTS_0':add_acc(d['W'],5126,'VEC4',34962)}
    p['indices']=add_acc(d['I'],5123,'SCALAR',34963)
    # zero-delta morph targets matching mesh weight count (preserve targetNames / Cocos indexing)
    if n_morph:
        z3=np.zeros((n,3),np.float32); z2=np.zeros((n,2),np.float32)
        p['targets']=[{'POSITION':add_acc(z3,5126,'VEC3',34962,True),'NORMAL':add_acc(z3,5126,'VEC3',34962),'TEXCOORD_0':add_acc(z2,5126,'VEC2',34962)} for _ in range(n_morph)]
for im in j['images']:
    fn={'T_G2_FACE_1024':'T_G2_FACE.jpg','T_G2_HEAD_1024':'T_G2_HEAD.jpg','T_G2_HAIR_1024':'T_G2_HEAD.jpg'}.get(im['name'])
    if fn:
        path=f'{texd}/{fn}'
        im['bufferView']=add_view(open(path,'rb').read())
# Also replace HAIR image if separate and we have hair in HEAD atlas — already mapped above for T_G2_HAIR_1024
# ---- repack
used=set()
for a in acc:
    if 'bufferView' in a: used.add(a['bufferView'])
for im in j['images']:
    if 'bufferView' in im: used.add(im['bufferView'])
refacc=set()
for m in j['meshes']:
    for p in m['primitives']:
        refacc|=set(p['attributes'].values()); refacc.add(p['indices'])
        for t in p.get('targets',[]): refacc|=set(t.values())
for s in j['skins']: refacc.add(s['inverseBindMatrices'])
for an in j['animations']:
    for s in an['samplers']: refacc|={s['input'],s['output']}
amap={}; nacc=[]
for i,a in enumerate(acc):
    if i in refacc: amap[i]=len(nacc); nacc.append(a)
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes']={k:amap[v] for k,v in p['attributes'].items()}; p['indices']=amap[p['indices']]
        for t in p.get('targets',[]):
            for k in list(t): t[k]=amap[t[k]]
for s in j['skins']: s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
for an in j['animations']:
    for s in an['samplers']: s['input']=amap[s['input']]; s['output']=amap[s['output']]
used={a['bufferView'] for a in nacc if 'bufferView' in a}|{im['bufferView'] for im in j['images'] if 'bufferView' in im}
for a in nacc:
    sp=a.get('sparse')
    if not sp: continue
    used.add(sp['indices']['bufferView']); used.add(sp['values']['bufferView'])
vmap={}; nbv=[]; blob=bytearray()
for i,v in enumerate(bvs):
    if i not in used: continue
    data=v.pop('_data',None)
    if data is None: off=v.get('byteOffset',0); data=B[off:off+v['byteLength']]
    while len(blob)%4: blob.append(0)
    nv={k:x for k,x in v.items() if k!='byteOffset'}; nv['byteOffset']=len(blob); nv['byteLength']=len(data)
    blob+=data; vmap[i]=len(nbv); nbv.append(nv)
for a in nacc:
    if 'bufferView' in a: a['bufferView']=vmap[a['bufferView']]
    sp=a.get('sparse')
    if sp:
        sp['indices']['bufferView']=vmap[sp['indices']['bufferView']]
        sp['values']['bufferView']=vmap[sp['values']['bufferView']]
for im in j['images']:
    if 'bufferView' in im: im['bufferView']=vmap[im['bufferView']]
while len(blob)%4: blob.append(0)
j['accessors']=nacc; j['bufferViews']=nbv; j['buffers']=[{'byteLength':len(blob)}]
js=json.dumps(j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
o=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob)
open(out,'wb').write(o); print('wrote',out,len(o),'morphs_on_head',n_morph)
