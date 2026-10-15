# splice named meshes from parts glb into base glb + optionally replace an embedded image's bytes. usage: base parts out mesh1,mesh2 [imgname=file]
import json,struct,sys
def load(f):
    b=open(f,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); o=20+n
    bl=struct.unpack('<I',b[o:o+4])[0]; return j,bytearray(b[o+8:o+8+bl])
base,parts,out,names=sys.argv[1:5]; extra=sys.argv[5:]
g,bin_=load(base); p,pb=load(parts); names=names.split(',')
pm={}
for nd in p['nodes']:
    if 'mesh' in nd: pm[nd['name']]=p['meshes'][nd['mesh']]
def append(data):
    while len(bin_)%4: bin_.append(0)
    off=len(bin_); bin_.extend(data); return off
import struct as _st
def copy_acc(i,to_float3=False):
    a=dict(p['accessors'][i]); bv=dict(p['bufferViews'][a['bufferView']])
    if to_float3 and a['type']=='VEC4' and a['componentType'] in (5121,5123):
        s=bv.get('byteOffset',0)+a.get('byteOffset',0); n=a['count']; fmt,mx=('<4H',65535.0) if a['componentType']==5123 else ('<4B',255.0)
        sz=_st.calcsize(fmt); stride=bv.get('byteStride',sz); out=bytearray()
        for k in range(n):
            c=_st.unpack_from(fmt,pb,s+k*stride); out+=_st.pack('<3f',*(x/mx for x in c[:3]))
        nbv={'buffer':0,'byteOffset':append(out),'byteLength':len(out),'target':34962}
        g['bufferViews'].append(nbv); na={'bufferView':len(g['bufferViews'])-1,'componentType':5126,'count':n,'type':'VEC3'}
        g['accessors'].append(na); return len(g['accessors'])-1
    return copy_acc_raw(i)
def copy_acc_raw(i):
    a=dict(p['accessors'][i]); bv=dict(p['bufferViews'][a['bufferView']])
    s=bv.get('byteOffset',0); bv['byteOffset']=append(pb[s:s+bv['byteLength']]); bv['buffer']=0
    g['bufferViews'].append(bv); a['bufferView']=len(g['bufferViews'])-1; g['accessors'].append(a); return len(g['accessors'])-1
for m in g['meshes']:
    if m['name'] in names:
        srcp=pm[m['name']]['primitives'][0]; prim=m['primitives'][0]
        assert set(srcp['attributes'])>=set(prim['attributes']),(m['name'],srcp['attributes'].keys(),prim['attributes'].keys())
        prim['attributes']={k:copy_acc(srcp['attributes'][k],k=='COLOR_0') for k in prim['attributes']}
        if 'indices' in srcp: prim['indices']=copy_acc(srcp['indices'])
        else: prim.pop('indices',None)
for e in extra:
    nm,f=e.split('=',1)
    for im in g['images']:
        if im['name']==nm:
            data=open(f,'rb').read(); bv={'buffer':0,'byteOffset':append(data),'byteLength':len(data)}
            g['bufferViews'].append(bv); im['bufferView']=len(g['bufferViews'])-1
while len(bin_)%4: bin_.append(0)
g['buffers'][0]['byteLength']=len(bin_)
js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
with open(out,'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,28+len(js)+len(bin_))); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js); f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)
