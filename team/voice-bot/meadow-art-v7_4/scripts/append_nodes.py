# append all nodes (+meshes, +one animation renamed) of a parts glb under base node 'scene_root'. usage: base parts out anim_name|- 
import json,struct,sys
def load(f):
    b=open(f,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); o=20+n
    bl=struct.unpack('<I',b[o:o+4])[0]; return j,bytearray(b[o+8:o+8+bl])
base,parts,out,aname=sys.argv[1:5]
g,bin_=load(base); p,pb=load(parts)
mat=[i for i,m in enumerate(g['materials']) if m['name']=='M_meadow_palette'][0]
def append(data):
    while len(bin_)%4: bin_.append(0)
    o=len(bin_); bin_.extend(data); return o
amap={}
def acc(i):
    if i in amap: return amap[i]
    a=dict(p['accessors'][i]); bv=dict(p['bufferViews'][a['bufferView']]); s=bv.get('byteOffset',0)
    bv['byteOffset']=append(pb[s:s+bv['byteLength']]); bv['buffer']=0; g['bufferViews'].append(bv); a['bufferView']=len(g['bufferViews'])-1
    g['accessors'].append(a); amap[i]=len(g['accessors'])-1; return amap[i]
mmap={}
for i,m in enumerate(p.get('meshes',[])):
    prims=[]
    for pr in m['primitives']:
        q={'attributes':{k:acc(v) for k,v in pr['attributes'].items()},'material':mat}
        if 'indices' in pr: q['indices']=acc(pr['indices'])
        prims.append(q)
    g['meshes'].append({'name':m.get('name'),'primitives':prims}); mmap[i]=len(g['meshes'])-1
base_n=len(g['nodes']); names={n['name'] for n in g['nodes']}
for n in p['nodes']:
    assert n['name'] not in names,n['name']
    q={k:v for k,v in n.items() if k in('name','translation','rotation','scale')}
    if 'mesh' in n: q['mesh']=mmap[n['mesh']]
    if 'children' in n: q['children']=[c+base_n for c in n['children']]
    g['nodes'].append(q)
child=set(c for n in p['nodes'] for c in n.get('children',[]))
roots=[i for i in p['scenes'][p.get('scene',0)]['nodes']]
sr=[n for n in g['nodes'] if n['name']=='scene_root'][0]; sr['children']+= [r+base_n for r in roots]
if aname!='-':
    smp=[];ch=[]
    for a in p['animations']:   # merge all per-object animations into one clip
        off=len(smp)
        smp+=[{'input':acc(s['input']),'output':acc(s['output']),'interpolation':s.get('interpolation','LINEAR')} for s in a['samplers']]
        ch+=[{'sampler':c['sampler']+off,'target':{'node':c['target']['node']+base_n,'path':c['target']['path']}} for c in a['channels']]
    g['animations'].append({'name':aname,'samplers':smp,'channels':ch})
while len(bin_)%4: bin_.append(0)
g['buffers'][0]['byteLength']=len(bin_)
js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
with open(out,'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,28+len(js)+len(bin_))); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js); f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)
print(out,"nodes+",len(p['nodes']),"anims",[x['name'] for x in g['animations']])
