"""Pinned, bounded elbow-ring taper and three door arm rotation channels after release."""
from pathlib import Path
import sys,json,hashlib,argparse,copy
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'art-src/animation/mocap/scripts'))
import rig as R
p=argparse.ArgumentParser();p.add_argument('glb',type=Path);p.add_argument('--report',type=Path,required=True);a=p.parse_args()
assert hashlib.sha256(a.glb.read_bytes()).hexdigest()=='245e923f668a4e570d1021ef58aacd871305129b152c30a08e6ea9ffc4969e72'
r=R.Rig(str(a.glb));j=copy.deepcopy(r.J);b=bytearray(r.BIN);clip=next(x for x in j['animations'] if x['name']=='door_reach');start=.6833333333333333;end=2.;rows=[]
def add(v,typ):
 v=np.asarray(v,dtype='<f4');b.extend(b'\0'*((-len(b))%4));off=len(b);b.extend(v.tobytes());bv=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':v.nbytes});idx=len(j['accessors']);ac={'bufferView':bv,'componentType':5126,'count':len(v),'type':typ}
 if typ=='SCALAR':ac.update(min=[float(v.min())],max=[float(v.max())])
 j['accessors'].append(ac);return idx
for ch in clip['channels']:
 name=j['nodes'][ch['target']['node']].get('name');path=ch['target']['path']
 if name not in ['upper_arm.L','forearm.L','hand.L'] or path!='rotation':continue
 s=clip['samplers'][ch['sampler']];assert s.get('interpolation','LINEAR')=='LINEAR';times=R.acc(j,b,s['input']).ravel();old=R.acc(j,b,s['output']);newtimes=np.unique(np.r_[times[times<start],start,np.linspace(start,end,81)]);q=r.sample_clip('door_reach',newtimes)[1][:,r.idx[name]].copy();q0=r.sample_clip('door_reach',[start])[1][0,r.idx[name]];qe=r.sample_clip('door_reach',[end])[1][0,r.idx[name]]
 if np.dot(q0,qe)<0:qe=-qe
 dot=np.clip(np.dot(q0,qe),-1,1);ang=np.arccos(dot)
 for k,t in enumerate(newtimes):
  if t<start:continue
  u=(t-start)/(end-start);u=u*u*(3-2*u)
  q[k]=R.qnorm((1-u)*q0+u*qe) if abs(ang)<1e-5 else (np.sin((1-u)*ang)*q0+np.sin(u*ang)*qe)/np.sin(ang)
 s['input']=add(newtimes,'SCALAR');s['output']=add(q,'VEC4');rows.append({'node':name,'keysBefore':len(times),'keysAfter':len(newtimes),'unchangedThroughSec':start,'endSec':end})
R.glb_save(str(a.glb),j,bytes(b));a.report.write_text(json.dumps({'input':'245e923f668a4e570d1021ef58aacd871305129b152c30a08e6ea9ffc4969e72','output':hashlib.sha256(a.glb.read_bytes()).hexdigest(),'channels':rows,'geometryUnchanged':True,'contactAtSec':.6333},indent=2))
# Local sleeve volume correction: bounded radial taper of elbow rings only.
r2=R.Rig(str(a.glb));j=r2.J;b=bytearray(r2.BIN);pr=next(m for m in j['meshes'] if m['name']=='LOD0_G2_BODY')['primitives'][0];attrs=pr['attributes'];P=R.acc(j,b,attrs['POSITION']);F=R.acc(j,b,pr['indices']).astype(int).reshape(-1,3);N=R.acc(j,b,attrs['NORMAL']);changed=set();shape=[]
import collections
for side,lo in [('L',1503),('R',2023)]:
 ids=np.arange(lo,lo+520);adj={int(i):set() for i in ids};ec=collections.Counter()
 for tri in F[np.all(np.isin(F,ids),1)]:
  for x,y in zip(tri,np.roll(tri,-1)):adj[x].add(y);adj[y].add(x);ec[tuple(sorted((x,y)))]+=1
 boundary=set(v for e,c in ec.items() if c==1 for v in e);hw=np.linalg.inv(r2.ibm[r2.idx['hand.'+side]])[:3,3];start=min(boundary,key=lambda i:np.linalg.norm(P[i]-hw));ring={start};q=[start]
 while q:
  x=q.pop()
  for y in adj[x]&boundary-ring:ring.add(y);q.append(y)
 layers=[sorted(ring)];seen=set(ring)
 while len(seen)<len(ids):
  nxt=set(y for x in layers[-1] for y in adj[x])-seen;assert nxt;layers.append(sorted(nxt));seen.update(nxt)
 assert len(layers)==26
 for k in range(9,18):
  ix=layers[k];center=P[ix].mean(0);factor=.30*max(0,1-abs(k-13)/5);delta=-(P[ix]-center)*factor;mag=np.linalg.norm(delta,axis=1);delta*=np.minimum(1,.012/np.maximum(mag,1e-10))[:,None];P[ix]+=delta;changed.update(ix);shape.append({'side':side,'ring':k,'maxDisplacementMm':float(np.max(np.linalg.norm(delta,axis=1))*1000)})
# Recompute normals only over the adjusted sleeve and its incident neighbor rings.
normalIds=set(F[np.any(np.isin(F,list(changed)),1)].ravel());vn=np.zeros_like(P)
for tri in F:
 n=np.cross(P[tri[1]]-P[tri[0]],P[tri[2]]-P[tri[0]])
 for x in tri:vn[x]+=n
for x in normalIds:N[x]=vn[x]/max(np.linalg.norm(vn[x]),1e-10)
def overwrite(index,vals):
 ac=j['accessors'][index];bv=j['bufferViews'][ac['bufferView']];off=bv.get('byteOffset',0)+ac.get('byteOffset',0);step=bv.get('byteStride',vals.shape[1]*4)
 for k,v in enumerate(vals):b[off+k*step:off+k*step+len(v)*4]=np.asarray(v,dtype='<f4').tobytes()
 if 'min' in ac:ac['min']=vals.min(0).tolist();ac['max']=vals.max(0).tolist()
overwrite(attrs['POSITION'],P);overwrite(attrs['NORMAL'],N);R.glb_save(str(a.glb),j,bytes(b));report=json.loads(a.report.read_text());report.update(output=hashlib.sha256(a.glb.read_bytes()).hexdigest(),geometryUnchanged=False,sleeveShape=shape,changedSleeveVertices=len(changed),normalVertices=len(normalIds),maxShapeDisplacementMm=max(x['maxDisplacementMm'] for x in shape));a.report.write_text(json.dumps(report,indent=2))
