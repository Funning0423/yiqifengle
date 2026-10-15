# Replace mesh primitives of named meshes in original glb with those from parts glb; everything else byte-identical in JSON semantics.
import json,struct,sys
def load(f):
    b=open(f,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); o=20+n
    bl=struct.unpack('<I',b[o:o+4])[0]; return j,bytearray(b[o+8:o+8+bl])
orig,parts,out=sys.argv[1:4]
g,bin_=load(orig); p,pb=load(parts)
pm={m['name']:m for m in p['meshes']}
for nd in p['nodes']:
    if 'mesh' in nd: pm[nd['name']]=p['meshes'][nd['mesh']]
def copy_acc(i):
    a=dict(p['accessors'][i]); bv=dict(p['bufferViews'][a['bufferView']])
    while len(bin_)%4: bin_.append(0)
    data=pb[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    bv['byteOffset']=len(bin_); bv['buffer']=0; bin_.extend(data)
    g['bufferViews'].append(bv); a['bufferView']=len(g['bufferViews'])-1; a.pop('byteOffset',None) if False else None
    g['accessors'].append(a); return len(g['accessors'])-1
for m in g['meshes']:
    if m['name'] in ('meadow_path','windmill_static_merged','windmill_sails'):
        src=pm[m['name']]['primitives'][0]; prim=m['primitives'][0]
        prim['attributes']={k:copy_acc(v) for k,v in src['attributes'].items() if k in prim['attributes']}
        prim['indices']=copy_acc(src['indices'])
g.setdefault('asset',{}).setdefault('extras',{})['voicebotCandidate']='meadow windmill+path art v1 2026-10-15 (unused old accessors remain until gltf-transform prune)'
while len(bin_)%4: bin_.append(0)
g['buffers'][0]['byteLength']=len(bin_)
js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
with open(out,'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_)))
    f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)
