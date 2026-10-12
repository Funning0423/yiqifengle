# python3 glb_size.py <glb>  -> byte breakdown: mesh primitives / images / animation (binary) / JSON chunk; tris per primitive
import sys, json, struct
f=open(sys.argv[1],'rb').read(); L=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+L])
acc=j['accessors']; bv=j['bufferViews']
def nb(i):
    a=acc[i]; n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]; s={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]
    return a['count']*n*s
mesh={}; tris={}
for m in j['meshes']:
    for p in m['primitives']:
        k=m['name']+'@'+j['materials'][p['material']]['name']
        mesh[k]=mesh.get(k,0)+sum(nb(v) for v in p['attributes'].values())+nb(p['indices'])+sum(nb(v) for t in p.get('targets',[]) for v in t.values())
        tris[k]=tris.get(k,0)+acc[p['indices']]['count']//3
img={im['name']:bv[im['bufferView']]['byteLength'] for im in j.get('images',[])}
seen=set(); anim=0
for a in j.get('animations',[]):
    for s in a['samplers']:
        for i in (s['input'],s['output']):
            if i not in seen: seen.add(i); anim+=nb(i)
skin=sum(nb(s['inverseBindMatrices']) for s in j.get('skins',[]) if 'inverseBindMatrices' in s)
tot=len(f); rest=tot-sum(mesh.values())-sum(img.values())-anim-skin-L
print(f'total {tot}  ({tot/1048576:.3f} MiB)')
print(f'  meshes   {sum(mesh.values()):>9}'); [print(f'    {v:>9}  {k}  tris {tris[k]}') for k,v in sorted(mesh.items(),key=lambda x:-x[1])]
print(f'  images   {sum(img.values()):>9}'); [print(f'    {v:>9}  {k}') for k,v in sorted(img.items(),key=lambda x:-x[1])]
print(f'  anim bin {anim:>9}  ({len(j.get("animations",[]))} clips)')
print(f'  JSON     {L:>9}  (mostly animation channel/sampler/accessor entries)')
print(f'  skin IBM {skin:>9}   padding/other {rest}')
print(f'  tris total {sum(tris.values())}')
