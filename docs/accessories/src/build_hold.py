# lantern_hold_R：角色动画bot 手型草案（BODY 3 个 primitive 绑定空间位移）做成正式 BODY 形态键；6 个 primitive 统一加第 17 个目标（无位移的 primitive 用 1 个零值稀疏项占位）
import sys,os,json,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from glb import G
src,npz,out=sys.argv[1:4];g=G(src);j=g.j;z=np.load(npz)
m=[x for x in j['meshes'] if x['name']=='LOD0_G2_BODY'][0]
def vn(P,F):
    N=np.zeros_like(P);n=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
    for k in range(3): np.add.at(N,F[:,k],n)
    return N/(np.linalg.norm(N,axis=1,keepdims=True)+1e-12)
def sp(idx,vals,count,mm=False):
    ia=g.add(idx.astype(np.uint32),'SCALAR',5125);va=g.add(vals.astype(np.float32),'VEC3',5126)
    acc={'componentType':5126,'count':count,'type':'VEC3','sparse':{'count':len(idx),'indices':{'bufferView':j['accessors'][ia]['bufferView'],'componentType':5125},'values':{'bufferView':j['accessors'][va]['bufferView']}}}
    if mm: acc['min']=[float(min(0,x)) for x in vals.min(0)];acc['max']=[float(max(0,x)) for x in vals.max(0)]
    j['accessors'].append(acc);return len(j['accessors'])-1
info={}
for pi,p in enumerate(m['primitives']):
    P=g.full(p['attributes']['POSITION']).astype(np.float64);n=len(P)
    k=f'prim{pi}'
    if k in z:
        d=z[k].astype(np.float64);assert d.shape==P.shape;F=g.full(p['indices']).reshape(-1,3)
        idx=np.where(np.linalg.norm(d,axis=1)>0)[0];dN=vn(P+d,F)-vn(P,F)
        p['targets'].append({'POSITION':sp(idx,d[idx],n,True),'NORMAL':sp(idx,dN[idx],n)});info[k]=dict(moved=int(len(idx)),max_mm=round(float(np.linalg.norm(d,axis=1).max()*1000),2))
    else:
        idx=np.array([0]);zv=np.zeros((1,3))
        p['targets'].append({'POSITION':sp(idx,zv,n,True),'NORMAL':sp(idx,zv,n)})
m['extras']['targetNames'].append('lantern_hold_R');m['weights'].append(0.0)
ti=len(m['extras']['targetNames'])-1;g.save(out);info['target_index']=ti
json.dump(info,open(out+'.hold.json','w'),indent=1);print('HOLD',json.dumps(info))
