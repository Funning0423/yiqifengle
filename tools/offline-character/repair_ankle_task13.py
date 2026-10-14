"""Repair the inner calf/boot envelope from the exact task12 asset, no pose masking."""
from common import *
import subprocess
source=subprocess.check_output(['git','-C',str(ROOT),'show','27f92770c9edb6113c9763bff6867b740c4fb0f3:'+str(ASSET.relative_to(ROOT))]);assert sha(source)=='885cabb17a7ff8cae5629a9cc950545edde8c4cec5541bfdc4e0c7d9b98af332'
p=ROOT/'evidence/offline-character/task12.glb';p.write_bytes(source);g,r,data=load(p)
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
rows=[]
# The covered calf used a different foot/shin blend from the boot at identical
# heights: at .12m calf shin=.8246, shaft shin=.4320. When the ankle flexes,
# the inner calf therefore exits the leather. Use one continuous deformation
# field for both layers and grade only the covered calf radius into the lining.
for md in data:
 if md['name']!='LOD0_G2_BODY' or md['pi']>2:continue
 P=md['P'].copy();J=md['J'].copy();W=md['W'].copy()
 if md['pi']!=0:continue # leather/sole already share the authored shaft field
 for side,lo,hi in [('L',3231,3426),('R',3426,3622)]:
  ids=np.arange(lo,hi);ids=ids[P[ids,1]<.176];y=P[ids,1];u=smooth((y-.074)/(.176-.074))
  before=(W[ids]*(J[ids]==r.idx['shin.'+side])).sum(1);J[ids]=[r.idx['foot.'+side],r.idx['shin.'+side],0,0];W[ids]=np.c_[1-u,u,np.zeros((len(ids),2))]
  # Boot wall at .094m radius x=.031,z=.0365; hidden skin radius z=.023.
  # Fit inner surface without altering exposed silhouette above the cuff.
  c=np.array([(-1 if side=='L' else 1)*.06492877,-.02029017]);factor=1-.08*smooth((.176-y)/.081)
  P[ids,0]=c[0]+(P[ids,0]-c[0])*factor;P[ids,2]=c[1]+(P[ids,2]-c[1])*factor
  rows.append({'side':side,'vertices':len(ids),'maxShinWeightChange':float(abs(before-u).max()),'maxCoveredRadialReduction':float((1-factor).max())})
 for k,a in [('POSITION',P),('JOINTS_0',J),('WEIGHTS_0',W)]:
  ai=md['pr']['attributes'][k];g.write_accessor(ai,a);ac=g.j['accessors'][ai]
  if 'min' in ac:ac['min']=a.min(0).tolist();ac['max']=a.max(0).tolist()
 # Recompute only changed calf normals, weld UV duplicate normals.
 F=md['F'];N=md['N'].copy();changed=np.linalg.norm(P-md['P'],axis=1)>1e-9;affected=np.unique(F[np.any(changed[F],axis=1)]);nn=np.zeros_like(P);fn=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
 for k in range(3):np.add.at(nn,F[:,k],fn)
 nn/=np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-12);N[affected]=nn[affected];g.write_accessor(md['pr']['attributes']['NORMAL'],N)
R.glb_save(str(ASSET),g.j,bytes(g.b));(ROOT/'evidence/offline-character/ankle-task13-repair.json').write_text(json.dumps({'inputSHA256':sha(source),'outputSHA256':sha(ASSET.read_bytes()),'changes':rows,'scope':'covered calf geometry and blend only; no global foot pitch or contact changes'},indent=2));print(rows,sha(ASSET.read_bytes()))
