# GLB 瘦身（不改几何）：① COLOR_0 由 float 转为 normalized UNSIGNED_BYTE VEC4 ② 内嵌调色板图改为外部 URI 共享（T_LK_palette_256.png）
# Cocos 3.8 glTF 导入支持相对 URI 外部图片与 normalized 整型顶点色。用法: python3 slim_glb.py models/*.glb
import json, struct, sys, numpy as np
CT={5126:('f4',4),5121:('u1',1),5123:('u2',2),5125:('u4',4)}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    b=open(p,'rb').read(); jl=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+jl]); bo=20+jl
    bl=struct.unpack_from('<I',b,bo)[0]; return j,bytearray(b[bo+8:bo+8+bl])
def save(p,j,bins):
    js=json.dumps(j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4); bins+=b'\0'*((4-len(bins)%4)%4)
    out=struct.pack('<III',0x46546C67,2,28+len(js)+len(bins))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bins),0x004E4942)+bins
    open(p,'wb').write(out)
for p in sys.argv[1:]:
    j,b=load(p); views=[bytes(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]) for v in j['bufferViews']]
    drop=set()
    for img in j.get('images',[]):
        if 'bufferView' in img: drop.add(img.pop('bufferView')); img.pop('mimeType',None); img['uri']='T_LK_palette_256.png'
    for m in j['meshes']:
        for pr in m['primitives']:
            ai=pr['attributes'].get('COLOR_0')
            if ai is None: continue
            a=j['accessors'][ai]
            if a['componentType']==5121: continue
            dt,sz=CT[a['componentType']]; n=NC[a['type']]; v=j['bufferViews'][a['bufferView']]
            raw=np.frombuffer(views[a['bufferView']],dtype='<'+dt,count=a['count']*n,offset=a.get('byteOffset',0)).reshape(-1,n).astype(np.float64)
            if a['componentType']!=5126: raw/= (255 if dt=='u1' else 65535)
            if n==3: raw=np.hstack([raw,np.ones((len(raw),1))])
            q=np.clip(np.round(raw*255),0,255).astype(np.uint8)
            views.append(q.tobytes()); j['bufferViews'].append({'buffer':0,'byteLength':len(views[-1])})
            if a['bufferView'] not in [x.get('bufferView') for k,x in enumerate(j['accessors']) if k!=ai]: drop.add(a['bufferView'])
            a.update(bufferView=len(views)-1,componentType=5121,normalized=True,type='VEC4'); a.pop('byteOffset',None); a.pop('min',None); a.pop('max',None)
    # repack
    remap={}; nb=bytearray(); nv=[]
    for i,(v,d) in enumerate(zip(j['bufferViews'],views)):
        if i in drop: continue
        while len(nb)%4: nb+=b'\0'
        v=dict(v); v['byteOffset']=len(nb); v['byteLength']=len(d); nb+=d; remap[i]=len(nv); nv.append(v)
    j['bufferViews']=nv
    for a in j['accessors']:
        if 'bufferView' in a: a['bufferView']=remap[a['bufferView']]
    j['buffers']=[{'byteLength':len(nb)}]; save(p,j,nb)
