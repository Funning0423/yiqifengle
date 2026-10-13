from pathlib import Path
import sys,json,hashlib,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'art-src/animation/mocap/scripts'));import rig as R
a,b,out=map(Path,sys.argv[1:]);x,y=R.Rig(str(a)),R.Rig(str(b));assert x.J['nodes']==y.J['nodes'] and x.J['skins']==y.J['skins'];assert np.array_equal(x.ibm,y.ibm)
changes=[]
for mx,my in zip(x.J['meshes'],y.J['meshes']):
 for pi,(px,py) in enumerate(zip(mx['primitives'],my['primitives'])):
  assert px['indices']==py['indices'];assert np.array_equal(R.acc(x.J,x.BIN,px['indices']),R.acc(y.J,y.BIN,py['indices']))
  for key,idx in px['attributes'].items():
   old=R.acc(x.J,x.BIN,idx);new=R.acc(y.J,y.BIN,py['attributes'][key]);diff=np.where(np.any(old!=new,axis=1))[0]
   if len(diff):assert mx['name']=='LOD0_G2_BODY' and pi in [0,1,2] and key in ['POSITION','NORMAL'];changes.append({'mesh':mx['name'],'primitive':pi,'attribute':key,'count':len(diff),'range':[int(diff.min()),int(diff.max())]});assert np.all((diff>=1503)&(diff<2543))
# Accessors from original BIN remain identical except local body POSITION/NORMAL.
allowed={x.J['meshes'][next(i for i,m in enumerate(x.J['meshes']) if m['name']=='LOD0_G2_BODY')]['primitives'][0]['attributes'][k] for k in ['POSITION','NORMAL']}
for i,ac in enumerate(x.J['accessors']):
 if i not in allowed and 'bufferView' in ac:assert np.array_equal(R.acc(x.J,x.BIN,i),R.acc(y.J,y.BIN,i)),i
changedChannels=[]
for cx,cy in zip(x.J['animations'],y.J['animations']):
 for ax,ay in zip(cx['channels'],cy['channels']):
  sx,sy=cx['samplers'][ax['sampler']],cy['samplers'][ay['sampler']]
  if sx!=sy:
   name=x.J['nodes'][ax['target']['node']]['name'];assert cx['name']=='door_reach' and name in ['upper_arm.L','forearm.L','hand.L'] and ax['target']['path']=='rotation';changedChannels.append(name)
for t in np.linspace(0,.6833333333333333,100):
 tx,qx,sx=x.sample_clip('door_reach',[t]);ty,qy,sy=y.sample_clip('door_reach',[t]);assert np.max(np.abs(qx-qy))<2e-7;assert np.array_equal(tx,ty) and np.array_equal(sx,sy)
res={'inputSHA':hashlib.sha256(a.read_bytes()).hexdigest(),'finalSHA':hashlib.sha256(b.read_bytes()).hexdigest(),'skeletonInverseBindTopologyUVColorsWeightsMorphAndOtherClipDataUnchanged':True,'changedAttributes':changes,'changedChannels':changedChannels,'contactThroughReleasePoseEqualTolerance':2e-7,'lowerBodyGeometryUnchanged':True};out.write_text(json.dumps(res,indent=2));print(json.dumps(res,indent=2))
