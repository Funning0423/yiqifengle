# python3 splice_glb.py <base.glb> <head_prims.npz> <tex_dir> <out.glb>
# Replace BODY primitives for M_G2_FACE/HEAD/HAIR and the FACE/HEAD images; everything else (skin, IBM, joints,
# animations, other meshes, torso primitive) is copied byte-for-byte. BIN is repacked (unused views dropped).
import sys, json, struct, numpy as np
base,npz,texd,out=sys.argv[1:5]
f=open(base,'rb').read(); L=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+L]); B=f[28+L:]
D=np.load(npz); prims={}
for k in D.files:
    m,a=k.split('__'); prims.setdefault(m,{})[a]=D[k]
acc=j['accessors']; bvs=j['bufferViews']
matidx={m['name']:i for i,m in enumerate(j['materials'])}
newblobs=[]   # (bytes, target) appended bufferViews
def add_view(data,target=None):
    bvs.append({'buffer':0,'byteLength':len(data),'_data':data, **({'target':target} if target else {})}); return len(bvs)-1
def add_acc(arr,ctype,typ,target,minmax=False,normalized=False):
    v=add_view(arr.tobytes(),target); a={'bufferView':v,'componentType':ctype,'count':int(arr.shape[0]),'type':typ}
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    acc.append(a); return len(acc)-1
# keys: '<material>' for LOD0_G2_BODY primitives, '<mesh>@<material>' for other meshes (body-r3: APRON, BOW)
targets=[]
for m in j['meshes']:
    for p in m['primitives']:
        mname=j['materials'][p['material']]['name']
        key=mname if m['name']=='LOD0_G2_BODY' else m['name']+'@'+mname
        if key in prims: targets.append((p,key))
for p,key in targets:
    p.pop('targets',None)
    d=prims[key]; n=d['P'].shape[0]
    col=np.ones((n,3),np.float32)
    p['attributes']={'POSITION':add_acc(d['P'],5126,'VEC3',34962,True),'NORMAL':add_acc(d['N'],5126,'VEC3',34962),
        'TEXCOORD_0':add_acc(d['U'],5126,'VEC2',34962),'COLOR_0':add_acc(col,5126,'VEC3',34962),
        'JOINTS_0':add_acc(d['J'],5121,'VEC4',34962),'WEIGHTS_0':add_acc(d['W'],5126,'VEC4',34962)}
    p['indices']=add_acc(d['I'],5123,'SCALAR',34963)
for im in j['images']:
    fn={'T_G2_FACE_1024':'T_G2_FACE.jpg','T_G2_HEAD_1024':'T_G2_HEAD.jpg'}.get(im['name'])
    if fn: im['bufferView']=add_view(open(f'{texd}/{fn}','rb').read())
# body-r4: T_G2_BODY only feeds the bow's white texel and the hips/thighs hidden under the dress -> 256^2 (name unchanged)
import io, os
from PIL import Image
BODY_TEX=int(os.environ.get('BODY_TEX','256'))
for im in j['images']:
    if im['name']=='T_G2_BODY_1024' and BODY_TEX:
        v=bvs[im['bufferView']]; off=v.get('byteOffset',0); src=Image.open(io.BytesIO(B[off:off+v['byteLength']])).convert('RGB')
        if src.size[0]>BODY_TEX:
            buf=io.BytesIO(); src.resize((BODY_TEX,BODY_TEX),Image.LANCZOS).save(buf,'JPEG',quality=88)
            im['bufferView']=add_view(buf.getvalue()); im['mimeType']='image/jpeg'
# hair now samples the shared HEAD texture (no new image)
for m in j['materials']:
    if m['name']=='M_G2_HAIR':
        pb=m['pbrMetallicRoughness']; pb.pop('baseColorFactor',None); pb['baseColorTexture']={'index':[i for i,mm in enumerate(j['materials']) if mm['name']=='M_G2_HEAD'] and j['materials'][[i for i,mm in enumerate(j['materials']) if mm['name']=='M_G2_HEAD'][0]]['pbrMetallicRoughness']['baseColorTexture']['index']}
# ---- repack: keep only referenced views
used=set()
for a in acc: 
    if 'bufferView' in a: used.add(a['bufferView'])
for im in j['images']: used.add(im['bufferView'])
# drop unreferenced accessors too
refacc=set()
for m in j['meshes']:
    for p in m['primitives']: refacc|=set(p['attributes'].values()); refacc.add(p['indices'])
for s in j['skins']: refacc.add(s['inverseBindMatrices'])
for an in j['animations']:
    for s in an['samplers']: refacc|={s['input'],s['output']}
amap={}; nacc=[]
for i,a in enumerate(acc):
    if i in refacc: amap[i]=len(nacc); nacc.append(a)
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes']={k:amap[v] for k,v in p['attributes'].items()}; p['indices']=amap[p['indices']]
for s in j['skins']: s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
for an in j['animations']:
    for s in an['samplers']: s['input']=amap[s['input']]; s['output']=amap[s['output']]
used={a['bufferView'] for a in nacc}|{im['bufferView'] for im in j['images']}
vmap={}; nbv=[]; blob=bytearray()
for i,v in enumerate(bvs):
    if i not in used: continue
    data=v.pop('_data',None)
    if data is None: off=v.get('byteOffset',0); data=B[off:off+v['byteLength']]
    while len(blob)%4: blob.append(0)
    nv={k:x for k,x in v.items() if k!='byteOffset'}; nv['byteOffset']=len(blob); nv['byteLength']=len(data)
    blob+=data; vmap[i]=len(nbv); nbv.append(nv)
for a in nacc: a['bufferView']=vmap[a['bufferView']]
for im in j['images']: im['bufferView']=vmap[im['bufferView']]
while len(blob)%4: blob.append(0)
j['accessors']=nacc; j['bufferViews']=nbv; j['buffers']=[{'byteLength':len(blob)}]
js=json.dumps(j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
o=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob)
open(out,'wb').write(o); print('wrote',out,len(o))
