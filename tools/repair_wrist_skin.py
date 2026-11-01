"""Local wrist skin repair. No animation, rig, material, topology, leg or root changes."""
import sys,json,pathlib,numpy as np,hashlib,argparse
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'art-src/animation/mocap/scripts'))
import rig as R
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'
parser=argparse.ArgumentParser();parser.add_argument('--glb',type=pathlib.Path,default=p);p=parser.parse_args().glb
assert hashlib.sha256(p.read_bytes()).hexdigest()=='ca040cc6e20ce8fa58f24cbbe9f38c82654da2fba31817384647bd9e01e3a2e4','input must be the verified baseline GLB'
r=R.Rig(str(p));j,b=r.J,r.BIN;data=bytearray(b);changed=[]
# The palm root ring is separate from the cuff. Its old world-height weights
# pull the root away from the forearm during flexion. Keep that ring with the
# forearm and distribute bending along the existing wrist rings.
seen=set()
for m in j['meshes']:
 if m['name']!='LOD0_G2_BODY':continue
 for pr in m['primitives']:
  a=pr['attributes']
  if a['POSITION'] in seen:continue
  seen.add(a['POSITION']);P=R.acc(j,b,a['POSITION']).astype(np.float64);J=R.acc(j,b,a['JOINTS_0']).astype(int);W=R.acc(j,b,a['WEIGHTS_0']).copy()
  for side in 'LR':
   h=r.idx['hand.'+side];f=r.idx['forearm.'+side];hw=((J==h)*W).sum(1);local=np.c_[P,np.ones(len(P))]@r.ibm[h].astype(np.float64).T
   idx=np.where((hw>.1)&(hw<.999)&(local[:,1]<.04))[0]
   for i in idx:
    y=local[i,1];u=np.clip((y-.004)/.028,0,1);weight=u*u*(3-2*u)
    J[i]=[h,f,0,0];W[i]=[weight,1-weight,0,0]
    # Extend the existing root ring 8 mm toward the cuff, making a real
    # articulated wrist connection rather than enlarging/covering the sleeve.
    if y<.0045:
     v=r.ibm[h].astype(np.float64);axis=np.linalg.inv(v)[:3,1];P[i]-=axis*.008
    changed.append({'vertex':int(i),'side':side,'handWeightBefore':float(hw[i]),'handWeightAfter':float(weight),'extended':bool(y<.0045)})
  for key,arr in [('POSITION',P),('JOINTS_0',J),('WEIGHTS_0',W)]:
   ai=a[key];ac=j['accessors'][ai];bv=j['bufferViews'][ac['bufferView']];dt=R.CT[ac['componentType']];v=np.asarray(arr,dtype=dt);o=bv.get('byteOffset',0)+ac.get('byteOffset',0);assert not bv.get('byteStride');data[o:o+v.nbytes]=v.tobytes()
   if key=='POSITION':ac['min']=v.min(0).tolist();ac['max']=v.max(0).tolist()
R.glb_save(str(p),j,bytes(data))
print(json.dumps({'changedVertices':len(changed),'changes':changed},indent=2))
