"""Preserve every authored hand world transform while reducing forearm roll at the wrist."""
import sys,pathlib,numpy as np,json,argparse
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'art-src/animation/mocap/scripts'))
import rig as R
p=pathlib.Path(__file__).resolve().parents[1]/'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb';parser=argparse.ArgumentParser();parser.add_argument('--glb',type=pathlib.Path,default=p);p=parser.parse_args().glb;r=R.Rig(str(p));t=np.linspace(0,r.clip_duration('door_reach'),121);T,Q,S=r.sample_clip('door_reach',t);W=r.fk(T,Q,S);u,f,h=[r.idx[n] for n in ['upper_arm.L','forearm.L','hand.L']];parent=r.parent[u];Q2=Q.copy();restHand=R.q2m(r.rest_r[h]);old=[];new=[]
for k,tm in enumerate(t):
 if tm<.15 or tm>1.85:continue
 # Preserve the elbow centre and hand centre. Only rotate forearm about its
 # long axis toward the rest-relative wrist orientation. Counterrotate hand
 # within numerical precision, so the existing handle contact and finger orientation are kept.
 axis=W[k,h,:3,3]-W[k,f,:3,3];axis/=np.linalg.norm(axis)
 desired=W[k,h,:3,:3]@restHand.T
 current=W[k,f,:3,:3]
 # closest roll, using perpendicular components of a frame axis
 v=current[:,0]-axis*np.dot(current[:,0],axis);z=desired[:,0]-axis*np.dot(desired[:,0],axis);v/=np.linalg.norm(v);z/=np.linalg.norm(z)
 angle=np.arctan2(np.dot(axis,np.cross(v,z)),np.dot(v,z));fade=min(1,(tm-.15)/.2,(1.85-tm)/.2);fade=max(0,fade);fade=fade*fade*(3-2*fade)
 rf=R.rotvec2m(axis*angle*fade)@current
 Q2[k,f]=R.m2q(W[k,u,:3,:3].T@rf);Q2[k,h]=R.m2q(rf.T@W[k,h,:3,:3])
 old.append(float(np.rad2deg(2*np.arccos(np.clip(abs(Q[k,h,3]),0,1)))));new.append(float(np.rad2deg(2*np.arccos(np.clip(abs(Q2[k,h,3]),0,1)))))
W2=r.fk(T,Q2,S);error=np.max(np.linalg.norm(W2[:,h,:3,3]-W[:,h,:3,3],axis=1))*1000;rot=np.max(abs(W2[:,h,:3,:3]-W[:,h,:3,:3]));assert error<.002 and rot<1e-5
j=r.J;b=bytearray(r.BIN)
def add(arr,typ):
 arr=np.asarray(arr,np.float32);off=len(b);b.extend(arr.tobytes());j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes});ac={'bufferView':len(j['bufferViews'])-1,'componentType':5126,'count':len(arr),'type':typ}
 if typ=='SCALAR':ac.update(min=[float(arr.min())],max=[float(arr.max())])
 j['accessors'].append(ac);return len(j['accessors'])-1
anim=next(a for a in j['animations'] if a['name']=='door_reach');ti=add(t,'SCALAR')
for ch in anim['channels']:
 if ch['target']['path']=='rotation' and ch['target']['node'] in [r.joint_nodes[f],r.joint_nodes[h]]:
  idx=r.joint_nodes.index(ch['target']['node']);sm=anim['samplers'][ch['sampler']];sm.update(input=ti,output=add(Q2[:,idx],'VEC4'),interpolation='LINEAR')
R.glb_save(str(p),j,bytes(b));print(json.dumps({'handWorldMaxErrorMm':error,'handWorldRotationMaxMatrixError':rot,'wristAngleBeforeMax':max(old),'wristAngleAfterMax':max(new),'onlyChannels':['door_reach/forearm.L/rotation','door_reach/hand.L/rotation'],'keys':len(t)},indent=2))
