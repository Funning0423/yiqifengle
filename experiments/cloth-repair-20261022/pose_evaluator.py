"""Read-only CPU glTF+anim_meta evaluator. Oct18 rebuild, not Oct21 restoration.

API: a=Asset(); scene,wm=a.pose(t,clip='walk_loop',mesh_names=None)
scene[(mesh_name,primitive_index)] = pos,tri,local,M,normal,prim,node,weights.
Positions in metres; M is the per-vertex affine source-to-world LBS matrix.
Meta named morph curves are sampled LINEAR at actual time, before skinning.
"""
import sys,json,hashlib
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation,Slerp

from glb_io import GLB
DEFAULT_DIR=Path(__file__).resolve().parents[2]/'candidates/skirt-v2-normal-h1-20261018/cocos-attrs-r1'
AP='LOD0_G2_APRON';DR='LOD0_G2_DRESS';BODY='LOD0_G2_BODY'
class Asset:
 def __init__(self,glb_path=DEFAULT_DIR/'character-skirt-v2-normal-h1-cocos-attrs-r1.glb',meta_path=DEFAULT_DIR/'anim_meta.json'):
  self.glb_path=Path(glb_path);self.meta_path=Path(meta_path);self.reader=GLB(self.glb_path);self.g=self.reader.j;self.b=self.reader.b;self.sha=self.reader.sha;self.meta=json.loads(self.meta_path.read_text());self.cache={}
  self.parent={c:i for i,n in enumerate(self.g['nodes']) for c in n.get('children',[])};self.anims={a['name']:a for a in self.g.get('animations',[])};self.anim=self.anims['walk_loop']
  self.active_nodes=set()
  def visit(i):
   self.active_nodes.add(i)
   for c in self.g['nodes'][i].get('children',[]):visit(c)
  for i in self.g['scenes'][self.g.get('scene',0)]['nodes']:visit(i)
 def acc(self,i):
  if i not in self.cache:self.cache[i]=self.reader.acc(i)
  return self.cache[i]
 def set_rotation_factors(self,factors,clip='walk_loop'):
  """Optional reversible MEMORY-ONLY scaling of node relative rotation keys.
  Source GLB and self.g never change. factors maps node index to factor.
  Each call uses original accessor bytes, not previously scaled values.
  Pass factor=1 to reset a node. Not applied by default or baseline renders.
  """
  for node,factor in factors.items():
   channels=[c for c in self.anims[clip]['channels'] if c['target']=={'node':node,'path':'rotation'}]
   assert len(channels)==1,(node,len(channels))
   ai=self.anims[clip]['samplers'][channels[0]['sampler']]['output'];rest=Rotation.from_quat(self.g['nodes'][node].get('rotation',[0,0,0,1]));original=Rotation.from_quat(self.reader.acc(ai));self.cache[ai]=(rest*Rotation.from_rotvec((rest.inv()*original).as_rotvec()*float(factor))).as_quat()
 def weights(self,mesh_name,t,clip='walk_loop',node_index=None):
  mesh=next(m for m in self.g['meshes'] if m['name']==mesh_name);count=max((len(p.get('targets',[])) for p in mesh['primitives']),default=0)
  defaults=mesh.get('weights',[0.]*count)
  if node_index is not None:defaults=self.g['nodes'][node_index].get('weights',defaults)
  weights=np.array(defaults,float).copy();assert len(weights)==count
  curves=self.meta['clips'][clip].get('morph',{}).get('curves',{})
  targets=self.meta.get('morph',{}).get('meshes',{}).get(mesh_name,{}).get('targets',{})
  for name,index in targets.items():
   if name in curves:
    curve=np.asarray(curves[name],float);weights[index]=np.interp(float(t),curve[:,0],curve[:,1])
  return weights
 def matrices(self,t,clip='walk_loop'):
  trs=[{k:np.asarray(n.get(k,d),float).copy() for k,d in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]} for n in self.g['nodes']]
  for c in self.anims[clip]['channels']:
   target=c['target'];path=target['path'];sam=self.anims[clip]['samplers'][c['sampler']];ts=self.acc(sam['input']).reshape(-1);values=self.acc(sam['output']);mode=sam.get('interpolation','LINEAR');assert mode=='LINEAR',mode
   if path=='weights':raise NotImplementedError('This source has no native weights channels; do not silently override metadata.')
   assert 'matrix' not in self.g['nodes'][target['node']]
   tt=float(np.clip(t,ts[0],ts[-1]))
   value=(Rotation.from_quat(values[0]).as_quat() if len(ts)==1 else Slerp(ts,Rotation.from_quat(values))([tt]).as_quat()[0]) if path=='rotation' else np.array([np.interp(tt,ts,values[:,k]) for k in range(values.shape[1])])
   trs[target['node']][path]=value
  world={}
  def calc(i):
   if i not in world:
    node=self.g['nodes'][i]
    if 'matrix'in node:m=np.asarray(node['matrix'],float).reshape(4,4).T.copy()
    else:
     r=trs[i];m=np.eye(4);m[:3,:3]=Rotation.from_quat(r['rotation']).as_matrix()@np.diag(r['scale']);m[:3,3]=r['translation']
    world[i]=calc(self.parent[i])@m if i in self.parent else m
   return world[i]
  for i in range(len(trs)):calc(i)
  return world
 def pose(self,t,clip='walk_loop',mesh_names=None):
  wm=self.matrices(float(t),clip);surfaces={}
  for ni,node in enumerate(self.g['nodes']):
   if ni not in self.active_nodes or 'mesh' not in node:continue
   mesh=self.g['meshes'][node['mesh']];name=mesh.get('name',str(node['mesh']))
   if mesh_names is not None and name not in mesh_names:continue
   ws=self.weights(name,t,clip,ni)
   for pi,prim in enumerate(mesh['primitives']):
    assert prim.get('mode',4)==4
    at=prim['attributes'];pos=self.acc(at['POSITION']).astype(float).copy();norm=self.acc(at['NORMAL']).astype(float).copy() if 'NORMAL'in at else np.zeros_like(pos)
    for weight,target in zip(ws,prim.get('targets',[])):
     if weight!=0:
      if 'POSITION'in target:pos+=weight*self.acc(target['POSITION'])
      if 'NORMAL'in target:norm+=weight*self.acc(target['NORMAL'])
    if 'skin'in node:
     sk=self.g['skins'][node['skin']];ib=self.acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1) if 'inverseBindMatrices'in sk else np.repeat(np.eye(4)[None],len(sk['joints']),0)
     joints=np.array([wm[j]@ib[k] for k,j in enumerate(sk['joints'])]);M=np.zeros((len(pos),4,4))
     sets=sorted(k for k in at if k.startswith('JOINTS_'))
     for jkey in sets:
      wkey=jkey.replace('JOINTS_','WEIGHTS_');js=self.acc(at[jkey]).astype(int);weights=self.acc(at[wkey]).astype(float)
      for k in range(js.shape[1]):M+=joints[js[:,k]]*weights[:,k,None,None]
    else:M=np.repeat(wm[ni][None],len(pos),axis=0)
    posed=np.einsum('nij,nj->ni',M[:,:3,:3],pos)+M[:,:3,3]
    # Inverse-transpose normal for the combined affine skin matrix. Rendering may use geometry normals instead.
    normal=np.linalg.solve(M[:,:3,:3].transpose(0,2,1),norm[:,:,None])[:,:,0];normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-30)
    tri=self.acc(prim['indices']).reshape(-1,3).astype(np.int64) if 'indices'in prim else np.arange(len(pos)).reshape(-1,3)
    surfaces[(name,pi)]={'pos':posed,'tri':tri,'local':pos,'M':M,'normal':normal,'prim':prim,'node':ni,'weights':ws.copy()}
  return surfaces,wm
if __name__=='__main__':
 a=Asset()
 for t in [0.,.05345,.1166666667]:
  scene,wm=a.pose(t);print(t,[(k,len(p['pos']),len(p['tri']),int(np.count_nonzero(p['weights']))) for k,p in scene.items()])
