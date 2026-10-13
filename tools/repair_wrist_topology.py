"""Rebuild cuff-to-palm skin transition; remove buried proximal cap and grade elbow rings.
Input SHA pinned. Does not change skeleton, clips, sleeves' outline, fingers, or runtime.
"""
import sys,json,hashlib,collections,argparse
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'art-src/animation/mocap/scripts'));import rig as R
pa=argparse.ArgumentParser();pa.add_argument('--glb',type=Path,required=True);pa.add_argument('--report',type=Path,required=True);args=pa.parse_args();p=args.glb
assert hashlib.sha256(p.read_bytes()).hexdigest()=='8294a71c2fb1ec441f2a0a187620da293c7a0a5d1435273c073304f018797e53'
r=R.Rig(str(p));j,b=r.J,bytearray(r.BIN);m=next(m for m in j['meshes'] if m['name']=='LOD0_G2_BODY');pr=m['primitives'][0];attrs=pr['attributes'];A={k:R.acc(j,b,v).copy() for k,v in attrs.items()};P=A['POSITION'];J=A['JOINTS_0'].astype(int);W=A['WEIGHTS_0'];F=R.acc(j,b,pr['indices']).astype(int).reshape(-1,3);rows=[];newfaces=[];newattrs={k:[] for k in A};remove=[];changednorm=set()
def boundary_layers(ids):
 adj={int(i):set() for i in ids};ec=collections.Counter()
 for tri in F[np.all(np.isin(F,ids),1)]:
  for x,y in zip(tri,np.roll(tri,-1)):adj[x].add(y);adj[y].add(x);ec[tuple(sorted((x,y)))]+=1
 boundary=set(v for e,c in ec.items() if c==1 for v in e);start=min(boundary,key=lambda i:np.linalg.norm(P[i]-hw));ring={start};q=[start]
 while q:
  x=q.pop()
  for y in adj[x]&boundary-ring:ring.add(y);q.append(y)
 layers=[sorted(ring)];seen=set(ring)
 while len(seen)<len(ids):
  nxt=set(y for x in layers[-1] for y in adj[x])-seen
  assert nxt;layers.append(sorted(nxt));seen.update(nxt)
 assert len(layers)==26 and all(len(x)==20 for x in layers)
 return layers
for side,lo,hi,palo,pahi,cap in [('L',1503,2023,2758,2844,2842),('R',2023,2543,2994,3080,3078)]:
 h,f,u=[r.idx[n+'.'+side] for n in ['hand','forearm','upper_arm']];hw=np.linalg.inv(r.ibm[h])[:3,3];layers=boundary_layers(np.arange(lo,hi));spreads=[]
 for k in range(11,16):
  ix=layers[k];fw=((J[ix]==f)*W[ix]).sum(1);spreads.append(float(np.ptp(fw)));v=float(np.mean(fw));J[ix]=[u,f,0,0];W[ix]=[1-v,v,0,0]
 # Proximal palm fan is not an articulated wrist. Replace it with a manifold
 # annulus to the cuff's inner lip. Existing palm and finger outlines remain.
 tris=F[np.any(F==cap,1)];assert len(tris)==14
 root=sorted(set(tris.ravel())-{cap});assert len(root)==14
 remove.extend(np.where(np.any(F==cap,1))[0]);changednorm.update(root)
 cuff=layers[0];axis=np.linalg.inv(r.ibm[h])[:3,1];axis/=np.linalg.norm(axis);x=np.linalg.inv(r.ibm[h])[:3,0];x-=axis*np.dot(axis,x);x/=np.linalg.norm(x);z=np.cross(axis,x)
 center=P[cuff].mean(0)
 def order(ids):
  angles=np.array([np.arctan2(np.dot(P[i]-center,z),np.dot(P[i]-center,x)) for i in ids]);ix=np.argsort(angles);return [ids[k] for k in ix],angles[ix]
 cuff,ca=order(cuff);root,ra=order(root);offset=len(P)+len(newattrs['POSITION']);C=[]
 # Duplicate only the UV/material seam; exact bind position and forearm
 # weights on both sides make it a positional weld in every animation.
 for i in cuff:
  C.append(len(P)+len(newattrs['POSITION']))
  for key in A:
   value=A[key][i].copy()
   if key=='TEXCOORD_0':value=A[key][root[0]].copy()
   if key=='COLOR_0':value=A[key][root[0]].copy()
   newattrs[key].append(value)
 ci=ri=0
 # angular zipper between unequal 20/14 ring counts
 for _ in range(len(cuff)+len(root)):
  cnext=ca[(ci+1)%len(cuff)]+(2*np.pi if ci+1>=len(cuff) else 0)
  rnext=ra[(ri+1)%len(root)]+(2*np.pi if ri+1>=len(root) else 0)
  if ci>=len(cuff):cnext=float('inf')
  if ri>=len(root):rnext=float('inf')
  c0=C[ci%len(cuff)];r0=root[ri%len(root)]
  if cnext<rnext:newfaces.append([c0,C[(ci+1)%len(cuff)],r0]);ci+=1
  else:newfaces.append([c0,root[(ri+1)%len(root)],r0]);ri+=1
 rows.append({'side':side,'removedProximalFanTriangles':14,'proximalCap':cap,'cuffVertices':cuff,'palmRootVertices':root,'bridgeTriangles':34,'elbowRingWeightSpreadsBefore':spreads,'elbowRingWeightSpreadsAfter':[0]*5})
A['JOINTS_0']=J;A['WEIGHTS_0']=W
for key in A:A[key]=np.concatenate([A[key],np.asarray(newattrs[key])])
P=A['POSITION'];NF=np.asarray(newfaces)
# Keep zipper winding consistent with both existing boundary loops.
F=np.concatenate([np.delete(F,remove,axis=0),NF]);affected=set(range(len(A['POSITION'])-40,len(A['POSITION'])))|changednorm
# Recompute area-weighted normals on the new connection and adjacent palm ring.
N=np.zeros_like(P)
for tri in F:
 n=np.cross(P[tri[1]]-P[tri[0]],P[tri[2]]-P[tri[0]])
 for v in tri:N[v]+=n
for i in affected:
 if np.linalg.norm(N[i])>1e-12:A['NORMAL'][i]=N[i]/np.linalg.norm(N[i])
def add(arr,old):
 ac=dict(j['accessors'][old]);arr=np.asarray(arr,dtype=R.CT[ac['componentType']]);off=len(b);b.extend(arr.tobytes());b.extend(b'\0'*((-len(b))%4));j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes});ac.update(bufferView=len(j['bufferViews'])-1,count=len(arr));ac.pop('byteOffset',None)
 if ac['type']=='VEC3' and 'min' in ac:ac.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
 j['accessors'].append(ac);return len(j['accessors'])-1
newidx={key:add(arr,attrs[key]) for key,arr in A.items()}
for pp in m['primitives'][:3]:pp['attributes']=dict(newidx)
pr['indices']=add(F.reshape(-1,1),pr['indices']);R.glb_save(str(p),j,bytes(b))
args.report.write_text(json.dumps({'inputSHA256':'8294a71c2fb1ec441f2a0a187620da293c7a0a5d1435273c073304f018797e53','outputSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'repairs':rows,'animationNodesSkinMaterialsUnchanged':True,'appearanceAcceptance':'requires rendered verification'},indent=2,default=lambda v:int(v)));print(args.report.read_text())
