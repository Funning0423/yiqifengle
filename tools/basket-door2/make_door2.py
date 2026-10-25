#!/usr/bin/env python3
"""b19 basket door 2 (产品总监 2026-10-25): second door on the opposite (-z) wall of transport_balloon.glb, no new texture/material.
The +z front band (every balloon_basket triangle with all vertices z > 0.5: door cut-out, jambs, sill, rim splits, corner
chamfers; the floor octagon fan is already symmetric and left alone) is copied rotated 180° about Y onto the back, replacing the back band (all z < -0.5). The back-wall lantern (the
only back-only part, 20 tris at x≈0) would hang in the new opening; both side walls already carry the identical ornament and the front (door) wall has none, so it is dropped -> back now reads exactly like the front.
New nodes: basket_door_b (hinge (-0.4,0,-0.84), yaw 180) > basket_door_leaf_b, reusing mesh basket_door_leaf (0 bytes).
usage: python3 make_door2.py <in.glb> <out.glb>"""
import json,struct,sys,numpy as np
src,dst=sys.argv[1],sys.argv[2]
b=open(src,'rb').read();jl=struct.unpack('<I',b[12:16])[0];g=json.loads(b[20:20+jl]);bl=struct.unpack('<I',b[20+jl:24+jl])[0];BIN=b[28+jl:28+jl+bl]
def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  dt={5126:np.float32,5123:np.uint16,5125:np.uint32}[a['componentType']];o=v.get('byteOffset',0)+a.get('byteOffset',0)
  x=np.frombuffer(BIN,dtype=dt,count=a['count']*n,offset=o);return x.reshape(a['count'],n) if n>1 else x
pr=g['meshes'][0]['primitives'][0];A=pr['attributes']
P=acc(A['POSITION']).astype(np.float64);N=acc(A['NORMAL']).astype(np.float64);UV=acc(A['TEXCOORD_0']).astype(np.float64);I=acc(pr['indices']).astype(np.int64).reshape(-1,3)
T=P[I];zmin=T[:,:,2].min(1);zmax=T[:,:,2].max(1);c=T.mean(1)
lantern=(np.abs(c[:,0])<0.12)&(c[:,2]<-0.7)&(c[:,1]>0.5)&(c[:,1]<1.05)
octa=(np.ptp(T[:,:,1],1)<1e-3)&(np.abs(T[:,0,1])<0.04)&(np.abs(T[:,:,[0,2]]).max((1,2))<0.69)  # symmetric floor octagon fan: untouched
front=(zmin>0.5)&~octa;back=(zmax<-0.5)&~lantern
R=lambda deg,X:np.stack([np.cos(np.radians(deg))*X[:,0]+np.sin(np.radians(deg))*X[:,2],X[:,1],-np.sin(np.radians(deg))*X[:,0]+np.cos(np.radians(deg))*X[:,2]],1)
keep=I[~front&~back&~lantern];fr=I[front];ln=I[lantern]
newP=[P];newN=[N];newUV=[UV];newI=[keep,fr];base=len(P)
def add(tris,deg):
  global base
  v=np.unique(tris);m={o:k for k,o in enumerate(v)}
  newP.append(R(deg,P[v]));newN.append(R(deg,N[v]));newUV.append(UV[v]);newI.append(np.vectorize(lambda o:m[o]+base)(tris));base+=len(v)
add(fr,180.0)          # front band -> back band (door B)
# back ornament dropped: identical ones already hang on both side walls (tris 216-235 / 236-255), the front door wall has none
P2=np.vstack(newP).astype(np.float32);N2=np.vstack(newN).astype(np.float32);UV2=np.vstack(newUV).astype(np.float32);I2=np.vstack(newI).astype(np.uint16 if len(P2)<65536 else np.uint32)
# drop unused vertices
u=np.unique(I2);remap=np.full(len(P2),-1,np.int64);remap[u]=np.arange(len(u));P2,N2,UV2=P2[u],N2[u],UV2[u];I2=remap[I2].astype(np.uint16)
print('basket tris',len(I),'->',len(I2),'verts',len(P),'->',len(P2),'| front band',front.sum(),'back band removed',back.sum(),'lantern',lantern.sum())
# ---- rebuild buffer: every referenced bufferView copied, mesh0 views replaced ----
views=[];data=bytearray()
def put(raw,target=None):
  while len(data)%4:data.append(0)
  views.append({'buffer':0,'byteOffset':len(data),'byteLength':len(raw),**({'target':target} if target else {})});data.extend(raw);return len(views)-1
oldmap={}
def keepview(i):
  if i not in oldmap:
    v=g['bufferViews'][i];o=v.get('byteOffset',0);raw=BIN[o:o+v['byteLength']];nv={k:v[k] for k in v if k not in('byteOffset','byteLength','buffer')}
    k=put(raw,v.get('target'));views[k].update(nv);oldmap[i]=k
  return oldmap[i]
mine={A['POSITION']:P2,A['NORMAL']:N2,A['TEXCOORD_0']:UV2,pr['indices']:I2}
for ai,a in enumerate(g['accessors']):
  if ai in mine:
    arr=mine[ai];a['bufferView']=put(arr.tobytes(),34963 if ai==pr['indices'] else 34962);a['byteOffset']=0;a['count']=int(arr.shape[0]*(1 if arr.ndim==2 else 1)) if arr.ndim==2 else int(arr.size)
    if ai==pr['indices']:a['count']=int(I2.size);a['componentType']=5123;a['max']=[int(I2.max())];a['min']=[int(I2.min())]
    if ai==A['POSITION']:a['min']=P2.min(0).tolist();a['max']=P2.max(0).tolist()
  elif 'bufferView' in a:a['bufferView']=keepview(a['bufferView'])
for im in g.get('images',[]):
  if 'bufferView' in im:im['bufferView']=keepview(im['bufferView'])
g['bufferViews']=views;g['buffers']=[{'byteLength':len(data)}]
# ---- door B nodes ----
leafMesh=[i for i,n in enumerate(g['nodes']) if n.get('name')=='basket_door_leaf'][0];leaf=g['nodes'][leafMesh]
g['nodes'].append({'name':'basket_door_leaf_b','mesh':leaf['mesh'],**({k:leaf[k] for k in ('translation','rotation','scale') if k in leaf})})
g['nodes'].append({'name':'basket_door_b','translation':[-0.4,0.0,-0.84],'rotation':[0.0,1.0,0.0,0.0],'children':[len(g['nodes'])-1],'extras':{**g['nodes'][[i for i,n in enumerate(g['nodes']) if n.get('name')=='basket_door'][0]].get('extras',{}),'mirrorOf':'basket_door (yaw 180 about basket origin)','b19':'door 2, tools/basket-door2/make_door2.py'}})
root=[n for n in g['nodes'] if n.get('name')=='transport_balloon'][0];root['children'].append(len(g['nodes'])-1)
js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4);bb=bytes(data)+b'\0'*((4-len(data)%4)%4)
out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bb))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bb),0x004E4942)+bb
open(dst,'wb').write(out);print('wrote',dst,len(b),'->',len(out))
