# python3 inspect_glb.py <glb> <outdir> : header stats + extract textures + mesh connectivity stats
import json,struct,sys,os,io
import numpy as np
from PIL import Image
G,O=sys.argv[1],sys.argv[2]; os.makedirs(O,exist_ok=True)
f=open(G,'rb'); f.read(12); l,_=struct.unpack('<II',f.read(8)); j=json.loads(f.read(l)); bl,_=struct.unpack('<II',f.read(8)); B=f.read(bl)
def bv(i): v=j['bufferViews'][i]; o=v.get('byteOffset',0); return B[o:o+v['byteLength']]
st={'file_MB':os.path.getsize(G)/1e6}
for im in j['images']:
    raw=bv(im['bufferView']); I=Image.open(io.BytesIO(raw)); I.save(f"{O}/{im['name']}.png") if False else open(f"{O}/{im['name']}.png",'wb').write(raw)
    a=np.asarray(I.convert('RGBA')).astype(float)
    st[im['name']]={'size':I.size,'mode':I.mode,'png_MB':len(raw)/1e6,'mean_rgb':a[...,:3].mean((0,1)).round(1).tolist(),'alpha_min':a[...,3].min()}
acc=j['accessors']
P=np.frombuffer(bv(acc[0]['bufferView']),np.float32).reshape(-1,3)
UV=np.frombuffer(bv(acc[2]['bufferView']),np.float32).reshape(-1,2)
I=np.frombuffer(bv(acc[3]['bufferView']),np.uint32).reshape(-1,3)
st.update(verts=len(P),tris=len(I),bbox_min=P.min(0).tolist(),bbox_max=P.max(0).tolist(),uv_min=UV.min(0).tolist(),uv_max=UV.max(0).tolist())
# weld by position, then connected components
q=np.round(P/1e-6).astype(np.int64); _,inv=np.unique(q,axis=0,return_inverse=True); inv=inv.ravel()
T=inv[I]; n=inv.max()+1
par=np.arange(n)
def find(x):
    while par[x]!=x: par[x]=par[par[x]]; x=par[x]
    return x
# vectorized union-find via scipy
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
e=np.concatenate([T[:,[0,1]],T[:,[1,2]]]); M=coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n))
nc,lab=connected_components(M,directed=False)
fl=lab[T[:,0]]; cnt=np.bincount(fl,minlength=nc); order=np.argsort(-cnt)
st['welded_verts']=int(n); st['uv_seam_split_ratio']=len(P)/n; st['components']=int(nc)
st['component_tris_top10']=cnt[order[:10]].tolist()
st['components_lt100tris']=int((cnt<100).sum())
comp_bb=[]
for c in order[:8]:
    v=np.unique(T[fl==c]); pp=np.zeros((0,3))
    # positions of welded verts: take first original
    first=np.zeros(n,int); first[inv[::-1]]=np.arange(len(P))[::-1]
    pp=P[first[v]]; comp_bb.append({'tris':int(cnt[c]),'min':pp.min(0).round(3).tolist(),'max':pp.max(0).round(3).tolist()})
st['component_bbox']=comp_bb
# non-manifold edges / boundary
E=np.sort(e if False else np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),axis=1)
k=E[:,0]*n+E[:,1]; _,c=np.unique(k,return_counts=True)
st['edges']=int(len(c)); st['boundary_edges']=int((c==1).sum()); st['nonmanifold_edges']=int((c>2).sum())
A=np.linalg.norm(np.cross(P[I[:,1]]-P[I[:,0]],P[I[:,2]]-P[I[:,0]]),axis=1)/2
st['degenerate_tris']=int((A<1e-12).sum()); st['tri_area_median']=float(np.median(A))
np.save(f'{O}/../data/face_comp.npy',fl.astype(np.int32)); np.save(f'{O}/../data/comp_order.npy',order[:50])
json.dump(st,open(f'{O}/../data/sample_stats.json','w'),indent=1,ensure_ascii=False,default=lambda x: x.item() if hasattr(x,'item') else str(x))
print(json.dumps(st,indent=1,ensure_ascii=False,default=str))
