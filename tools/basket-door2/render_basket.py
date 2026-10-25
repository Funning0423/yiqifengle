#!/usr/bin/env python3
"""Offline visual check of transport_balloon.glb basket (+ door leaves): textured flat-shaded orthographic views.
usage: render_basket.py <glb> <out_prefix> [doorDeg]"""
import json,struct,sys,io,numpy as np,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from PIL import Image
f,pre=sys.argv[1],sys.argv[2];deg=float(sys.argv[3]) if len(sys.argv)>3 else 0
b=open(f,'rb').read();jl=struct.unpack('<I',b[12:16])[0];g=json.loads(b[20:20+jl]);BIN=b[28+jl:]
def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];dt={5126:np.float32,5123:np.uint16,5125:np.uint32}[a['componentType']]
  x=np.frombuffer(BIN,dtype=dt,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0));return x.reshape(-1,n) if n>1 else x
v=g['bufferViews'][g['images'][1]['bufferView']];tex=np.asarray(Image.open(io.BytesIO(BIN[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB'))/255.
def M(mi):
  p=g['meshes'][mi]['primitives'][0];P=acc(p['attributes']['POSITION']).astype(float);UV=acc(p['attributes']['TEXCOORD_0']).astype(float);I=acc(p['indices']).astype(int).reshape(-1,3);return P[I],UV[I].mean(1)
def rotY(d,X):c,s=np.cos(np.radians(d)),np.sin(np.radians(d));return np.stack([c*X[...,0]+s*X[...,2],X[...,1],-s*X[...,0]+c*X[...,2]],-1)
T,U=M(0);parts=[(T,U)]
names={n.get('name'):n for n in g['nodes']}
for piv in ['basket_door','basket_door_b']:
  if piv not in names:continue
  n=names[piv];LT,LU=M(names[n and g['nodes'][n['children'][0]]['name']]['mesh'] if False else g['nodes'][n['children'][0]]['mesh'])
  q=n.get('rotation',[0,0,0,1]);yaw=np.degrees(2*np.arctan2(q[1],q[3]))
  X=rotY(yaw+deg,LT)+np.array(n['translation']);parts.append((X,LU))
T=np.concatenate([p[0] for p in parts]);U=np.concatenate([p[1] for p in parts])
col=tex[np.clip((U[:,1]%1)*tex.shape[0],0,tex.shape[0]-1).astype(int),np.clip((U[:,0]%1)*tex.shape[1],0,tex.shape[1]-1).astype(int)]
N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);N/=np.maximum(np.linalg.norm(N,axis=1,keepdims=True),1e-9)
views={'front_+z':(0,0),'back_-z':(180,0),'side_+x':(90,0),'oblique_back':(200,25),'top':(0,89)}
fig,ax=plt.subplots(1,5,figsize=(25,5.5))
for a,(name,(yaw,el)) in zip(ax,views.items()):
  R=rotY(-yaw,T);ce=np.cos(np.radians(el));se=np.sin(np.radians(el))
  y2=R[...,1]*ce-R[...,2]*se;z2=R[...,1]*se+R[...,2]*ce   # pitch down by el; camera looks along -z2 from +z2
  Nr=rotY(-yaw,N);nz=Nr[:,1]*se+Nr[:,2]*ce
  keep=T[:,:,1].max(1)<1.3   # basket only (no envelope/burner)
  o=np.argsort(z2.mean(1))
  o=[i for i in o if keep[i]]
  shade=0.45+0.55*np.abs(nz[o])[:,None]
  a.add_collection(PolyCollection(np.stack([R[o][...,0],y2[o]],-1),facecolors=np.clip(col[o]*shade,0,1),edgecolors=(0,0,0,0.15),linewidths=0.2))
  a.set_xlim(-1.3,1.3);a.set_ylim(-1.4 if el>60 else -0.3,1.4);a.set_aspect('equal');a.set_title(f'{name} door {deg:.0f}°');a.axis('off')
fig.savefig(pre+f'_door{int(deg)}.png',dpi=110,bbox_inches='tight');print(pre+f'_door{int(deg)}.png')
