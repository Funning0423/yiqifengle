import json,struct,sys
def load(f):
  b=open(f,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; return json.loads(b[20:20+n])
for f in sys.argv[1:]:
  g=load(f); print(f, "nodes",len(g['nodes']),"anims",[(a['name'],len(a['channels'])) for a in g.get('animations',[])],"imgs",[(i.get('name'),i.get('mimeType'),g['bufferViews'][i['bufferView']]['byteLength']) for i in g['images']],"ext",g.get('extensionsUsed'))
a=load(sys.argv[1]); b=load(sys.argv[2])
na={n['name']:n for n in a['nodes']}; nb={n['name']:n for n in b['nodes']}
print("missing",set(na)-set(nb),"added",set(nb)-set(na))
for k in na:
  if k in nb:
    for f in ['translation','rotation','scale','extras']:
      if f in na[k] or f in nb[k]:
        x,y=na[k].get(f),nb[k].get(f)
        if f!='extras' and x and y and max(abs(p-q) for p,q in zip(x,y))<1e-5: continue
        if x!=y: print("diff",k,f,x,y)
