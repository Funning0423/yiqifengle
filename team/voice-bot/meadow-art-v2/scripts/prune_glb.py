import json,struct,sys
b=open(sys.argv[1],'rb').read(); n=struct.unpack('<I',b[12:16])[0]; g=json.loads(b[20:20+n]); o=20+n; bin_=b[o+8:o+8+struct.unpack('<I',b[o:o+4])[0]]
used_acc=set()
def walk(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if k in('POSITION','NORMAL','TEXCOORD_0','TEXCOORD_1','COLOR_0','TANGENT','JOINTS_0','WEIGHTS_0','indices','input','output','inverseBindMatrices') and isinstance(v,int): used_acc.add(v)
            else: walk(v)
    elif isinstance(x,list): [walk(i) for i in x]
for k in('meshes','animations','skins'): walk(g.get(k,[]))
acc_map={}; newacc=[]
for i,a in enumerate(g['accessors']):
    if i in used_acc: acc_map[i]=len(newacc); newacc.append(a)
used_bv={a['bufferView'] for a in newacc if 'bufferView' in a}|{im['bufferView'] for im in g.get('images',[]) if 'bufferView' in im}
bv_map={}; newbv=[]; out=bytearray()
for i,bv in enumerate(g['bufferViews']):
    if i in used_bv:
        while len(out)%4: out.append(0)
        s=bv.get('byteOffset',0); d=bin_[s:s+bv['byteLength']]; bv=dict(bv); bv['byteOffset']=len(out); out.extend(d); bv_map[i]=len(newbv); newbv.append(bv)
for a in newacc:
    if 'bufferView' in a: a['bufferView']=bv_map[a['bufferView']]
for im in g.get('images',[]):
    if 'bufferView' in im: im['bufferView']=bv_map[im['bufferView']]
def remap(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if k in('POSITION','NORMAL','TEXCOORD_0','TEXCOORD_1','COLOR_0','TANGENT','JOINTS_0','WEIGHTS_0','indices','input','output','inverseBindMatrices') and isinstance(v,int): x[k]=acc_map[v]
            else: remap(v)
    elif isinstance(x,list): [remap(i) for i in x]
for k in('meshes','animations','skins'): remap(g.get(k,[]))
g['accessors']=newacc; g['bufferViews']=newbv
while len(out)%4: out.append(0)
g['buffers'][0]['byteLength']=len(out); g['asset']['extras']['voicebotCandidate']='meadow windmill+path art v1 2026-10-15'
js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
with open(sys.argv[2],'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,28+len(js)+len(out))); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js); f.write(struct.pack('<II',len(out),0x004E4942)); f.write(out)
print("acc",len(newacc),"bv",len(newbv))
