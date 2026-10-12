# python3 verify_glb.py <base.glb> <new.glb> : everything except BODY FACE/HEAD/HAIR prims + 2 images must be byte-identical
import sys,json,struct,hashlib
def load(p):
    f=open(p,'rb').read(); L=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+L]); return j,f[28+L:]
(a,A),(b,Bb)=load(sys.argv[1]),load(sys.argv[2])
def accbytes(j,B,i):
    x=j['accessors'][i]; v=j['bufferViews'][x['bufferView']]; o=v.get('byteOffset',0)+x.get('byteOffset',0)
    return hashlib.sha1(B[o:o+v['byteLength']]).hexdigest(), {k:x[k] for k in ('componentType','count','type')}
ok=True
def chk(name,c):
    global ok; ok&=c; print(('OK  ' if c else 'FAIL'),name)
chk('node names/order', [n.get('name') for n in a['nodes']]==[n.get('name') for n in b['nodes']])
chk('node TRS', all({k:n.get(k) for k in('translation','rotation','scale','children','mesh','skin')}=={k:m.get(k) for k in('translation','rotation','scale','children','mesh','skin')} for n,m in zip(a['nodes'],b['nodes'])))
chk('skin joints', a['skins'][0]['joints']==b['skins'][0]['joints'] and len(a['skins'][0]['joints'])==28)
chk('inverseBindMatrices bytes', accbytes(a,A,a['skins'][0]['inverseBindMatrices'])==accbytes(b,Bb,b['skins'][0]['inverseBindMatrices']))
same=True
for x,y in zip(a['animations'],b['animations']):
    same&= x['name']==y['name'] and x['channels']==y['channels'] and all(accbytes(a,A,s['input'])==accbytes(b,Bb,t['input']) and accbytes(a,A,s['output'])==accbytes(b,Bb,t['output']) and s.get('interpolation')==t.get('interpolation') for s,t in zip(x['samplers'],y['samplers']))
chk('7 animations bytes', same and len(a['animations'])==len(b['animations']))
chk('materials', a['materials']==b['materials'])
chk('mesh names', [m['name'] for m in a['meshes']]==[m['name'] for m in b['meshes']])
chk('image names', [i['name'] for i in a['images']]==[i['name'] for i in b['images']])
for mi,(x,y) in enumerate(zip(a['meshes'],b['meshes'])):
    for pi,(p,q) in enumerate(zip(x['primitives'],y['primitives'])):
        mat=a['materials'][p['material']]['name']; changed= x['name']=='LOD0_G2_BODY' and mat in('M_G2_FACE','M_G2_HEAD','M_G2_HAIR')
        eq= p['material']==q['material'] and set(p['attributes'])==set(q['attributes']) and all(accbytes(a,A,p['attributes'][k])==accbytes(b,Bb,q['attributes'][k]) for k in p['attributes']) and accbytes(a,A,p['indices'])==accbytes(b,Bb,q['indices'])
        if changed: chk(f'{x["name"]}#{pi} {mat} replaced (same attribute set & material)', p['material']==q['material'] and set(p['attributes'])==set(q['attributes']))
        else: chk(f'{x["name"]}#{pi} {mat} byte-identical', eq)
print('ALL_OK' if ok else 'SOME_FAIL')
