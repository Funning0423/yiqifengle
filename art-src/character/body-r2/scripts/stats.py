import json,struct,sys,os
def st(p):
    b=open(p,'rb').read(); L=struct.unpack('<I',b[12:16])[0]; J=json.loads(b[20:20+L]); out={}
    for m in J['meshes']:
        t=v=0
        for pr in m['primitives']:
            t+=J['accessors'][pr['indices']]['count']//3; v+=J['accessors'][pr['attributes']['POSITION']]['count']
        out[m['name']]=(v,t)
    return dict(size_kb=os.path.getsize(p)//1024,joints=len(J['skins'][0]['joints']),anims=len(J.get('animations',[])),
        meshes=out,tris=sum(t for _,t in out.values()),verts=sum(v for v,_ in out.values()),images=[i.get('name') for i in J.get('images',[])])
for p in sys.argv[1:]: print(os.path.basename(p),json.dumps(st(p),ensure_ascii=False))
