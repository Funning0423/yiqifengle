"""Reconstructed exact-TRS diagnostic. No clip resampling, no invented root motion."""
import json,gzip,hashlib
from pathlib import Path
import numpy as np
from glb_local import Glb

def rotation(q):
 q=np.asarray(q,float);q=q/np.linalg.norm(q);x,y,z,w=q
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def trs(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 a=np.eye(4);a[:3,:3]=rotation(n.get('rotation',[0,0,0,1]))*np.array(n.get('scale',[1,1,1]))[None,:];a[:3,3]=n.get('translation',[0,0,0]);return a

def read_frames(path):
 with (gzip.open(path,'rt') if str(path).endswith('.gz') else open(path)) as f:x=json.load(f)
 return x if isinstance(x,list) else x['frames']

class ReplaySkin:
 def __init__(self,path):
  self.g=Glb(path);g=self.g;self.parts=[];self.joint_names=[]
  for si,s in enumerate(g.j['skins']):
   self.joint_names.append([g.j['nodes'][i]['name'] for i in s['joints']])
  self.ibm=[g.accessor(s['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1).astype(float) for s in g.j['skins']]
  for n in g.j['nodes']:
   if 'mesh' not in n:continue
   mesh=g.j['meshes'][n['mesh']]
   for pi,p in enumerate(mesh['primitives']):
    if p.get('mode',4)!=4:raise ValueError('Only triangles supported')
    a=p['attributes'];weights=g.accessor(a['WEIGHTS_0']).astype(float)
    weights/=weights.sum(1,keepdims=True)
    self.parts.append(dict(name=mesh['name'],primitive=pi,skin=n['skin'],position=g.accessor(a['POSITION']).astype(float),joints=g.accessor(a['JOINTS_0']).astype(int),weights=weights,faces=g.accessor(p['indices']).reshape(-1,3).astype(int),uv=g.accessor(a['TEXCOORD_0']).astype(float),material=p['material'],targets=[g.accessor(t['POSITION']).astype(float) if 'POSITION' in t else None for t in p.get('targets',[])]))
 def matrices(self,frame):
  nodes={n['name']:n for n in frame['nodes']};world={};visiting=set()
  def w(name):
   if name not in nodes:return np.eye(4)
   if name in visiting:raise ValueError('cyclic frame nodes')
   if name not in world:
    visiting.add(name);n=nodes[name];world[name]=w(n.get('parent'))@trs(n);visiting.remove(name)
   return world[name]
  q=frame['yaw'];ext=np.eye(4);ext[:3,:3]=rotation([0,np.sin(q/2),0,np.cos(q/2)]);ext[:3,3]=frame['root']
  for name in nodes:w(name)
  mats=[]
  for names,ibm in zip(self.joint_names,self.ibm):
   if any(n not in nodes for n in names):raise ValueError('missing joint in runtime frame')
   mats.append(np.array([ext@world[n] for n in names])@ibm)
  return mats,ext,world
 def deform(self,frame):
  mats,ext,world=self.matrices(frame);mw={m['mesh']:m['weights'] for m in frame.get('morph',[])};out=[]
  for p in self.parts:
   v=p['position'].copy();weights=mw.get(p['name'],{})
   for i,d in enumerate(p['targets']):
    if d is not None:v+=d*float(weights.get(str(p['primitive'])+':'+str(i),0))
   h=np.c_[v,np.ones(len(v))];m=mats[p['skin']];j=p['joints'];w=p['weights']
   out.append(sum(np.einsum('nij,nj->ni',m[j[:,i]],h)[:,:3]*w[:,i,None] for i in range(4)))
  hips=(ext@world['hips'])[:3,3]
  return out,hips
 def verify(self,frame):
  out,hips=self.deform(frame);d=float(np.max(np.abs(hips-np.array(frame['hips']))))*1000 if 'hips' in frame else None
  # Independent exported sole samples must coincide with actual skinned BODY vertices.
  body=np.concatenate([v for p,v in zip(self.parts,out) if p['name']=='LOD0_G2_BODY']);maxsole=0
  for foot,pts in frame.get('soles',{}).items():
   pts=np.asarray(pts);dist=np.min(np.sum((pts[:,None,:]-body[None,:,:])**2,axis=2),axis=1)**.5
   maxsole=max(maxsole,float(dist.max())*1000)
  if d is not None and d>0.05:raise AssertionError(('hips',d))
  if maxsole>0.05:raise AssertionError(('sole vertex',maxsole))
  return dict(frame=frame['frame'],hip_max_component_mm=d,sole_nearest_vertex_max_mm=maxsole,vertices=sum(map(len,out)))
