import json,struct,numpy as np
CT={5126:'f4',5121:'u1',5123:'u2',5125:'u4',5120:'i1',5122:'i2'}; NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class G:
    def __init__(s,path):
        b=open(path,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; s.j=json.loads(b[20:20+n]); o=20+n
        bl=struct.unpack('<I',b[o:o+4])[0]; s.bin=bytearray(b[o+8:o+8+bl])
    def view(s,i):
        a=s.j['accessors'][i]; bv=s.j['bufferViews'][a['bufferView']]; dt=np.dtype(CT[a['componentType']]); k=NC[a['type']]
        st=bv.get('byteStride',0) or dt.itemsize*k; off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        return np.ndarray((a['count'],k),dtype=dt,buffer=s.bin,offset=off,strides=(st,dt.itemsize))
    def get(s,i):
        a=s.j['accessors'][i]; v=s.view(i).astype('f8')
        if a.get('normalized'): v=v/{5121:255,5123:65535}[a['componentType']]
        return v
    def put(s,i,arr):
        a=s.j['accessors'][i]; v=s.view(i)
        if a.get('normalized'): arr=np.rint(arr*{5121:255,5123:65535}[a['componentType']])
        elif a['componentType']!=5126: arr=np.rint(arr)
        v[...]=arr.astype(v.dtype)
        if a['componentType']==5126 and 'min' in a: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    def image_bytes(s,name):
        for im in s.j['images']:
            if im['name']==name: bv=s.j['bufferViews'][im['bufferView']]; o=bv.get('byteOffset',0); return bytes(s.bin[o:o+bv['byteLength']]),im['bufferView']
    def replace_view(s,bvi,data):
        # append new data at end, repoint view (old bytes stay; compacted on save)
        while len(s.bin)%4: s.bin.append(0)
        o=len(s.bin); s.bin+=data; s.j['bufferViews'][bvi]['byteOffset']=o; s.j['bufferViews'][bvi]['byteLength']=len(data)
    def save(s,path):
        # compact: rebuild buffer in view order
        nb=bytearray()
        for bv in s.j['bufferViews']:
            while len(nb)%4: nb.append(0)
            o=bv.get('byteOffset',0); d=s.bin[o:o+bv['byteLength']]; bv['byteOffset']=len(nb); nb+=d
        while len(nb)%4: nb.append(0)
        s.j['buffers'][0]['byteLength']=len(nb)
        js=json.dumps(s.j,separators=(',',':')).encode()
        while len(js)%4: js+=b' '
        out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(nb))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(nb),0x004E4942)+nb
        open(path,'wb').write(out)
def sparse_parts(g,i):
    a=g.j['accessors'][i]; sp=a.get('sparse')
    if not sp: return None
    def arr(d,ct,k):
        bv=g.j['bufferViews'][d['bufferView']]; dt=np.dtype(CT[ct]); off=bv.get('byteOffset',0)+d.get('byteOffset',0)
        return np.ndarray((sp['count'],k),dtype=dt,buffer=g.bin,offset=off)
    return arr(sp['indices'],sp['indices']['componentType'],1)[:,0], arr(sp['values'],a['componentType'],NC[a['type']]), a
def scale_target(g,i,f):
    a=g.j['accessors'][i]
    if 'sparse' in a:
        idx,val,_=sparse_parts(g,i); val[...]=(val*f[idx]).astype(val.dtype)
        if 'bufferView' in a: g.put(i,g.get(i)*f)
        if 'min' in a: a.pop('min',None); a.pop('max',None)
    elif 'bufferView' in a: g.put(i,g.get(i)*f)
