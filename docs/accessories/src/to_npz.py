# fix_hold 结果（Blender 坐标、Blender 顶点序）→ 角色动画bot 同格式的 glTF 逐 primitive 位移 npz（按静止位置匹配）
import sys,os,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));from glb import G
from scipy.spatial import cKDTree
fx=np.load(sys.argv[1]);g=G(sys.argv[2]);z0=np.load(sys.argv[3]);out=sys.argv[4]
cv=lambda P:np.stack([P[:,0],P[:,2],-P[:,1]],1)
bas=cv(fx['bas']);D=cv(fx['K']-fx['bas']);D0=cv(fx['K0']-fx['bas']);T=cKDTree(bas)
m=[x for x in g.j['meshes'] if x['name']=='LOD0_G2_BODY'][0];res={};st=[]
for pi,p in enumerate(m['primitives']):
    k=f'prim{pi}'
    if k not in z0: continue
    P=g.full(p['attributes']['POSITION']).astype(np.float64);dd,ii=T.query(P)
    old=z0[k].astype(np.float64);chk=np.abs(D0[ii]-old).max(axis=1)
    new=old.copy();sel=dd<1e-5;new[sel]=old[sel]+(D[ii[sel]]-D0[ii[sel]])
    res[k]=new.astype(np.float32);st.append((k,int(sel.sum()),len(P),float(dd.max()),float(chk[sel].max()),int((np.linalg.norm(new-old,axis=1)>1e-6).sum())))
np.savez(out,**res);print('NPZ',st)
