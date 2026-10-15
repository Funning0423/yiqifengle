"""Pinned task18 wrist annulus smoothing and compensated forearm axial roll.
Preserves key hand world transforms, endpoints, rig, topology, controller, boots and waist.
"""
import sys,json,numpy as np,subprocess
from pathlib import Path
from common import *
BASE='fbff602c8559231492bff4eccb0db97549301ea5'
old=ROOT/'evidence/offline-character/task18-baseline.glb';old.parent.mkdir(parents=True,exist_ok=True);old.write_bytes(subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+str(ASSET.relative_to(ROOT))]));assert sha(old.read_bytes())=='e1a3415bb58b2de2a517e2ad594af89da11281e2a47295e60663bb8e9ce031b1'
g,r,ds=load(old);src=(ROOT/'tools/offline-character/repair_lower_task16.py').read_text();exec(src[src.index('def sparse('):src.index('for md in [ds[0],ds[-1]]:')]);report=[]
for md,changes in [(ds[1],{'corrective_stand_up_'+str(k):np.load(ROOT/'tools/offline-character/task18-wrist-surface.npy')[k] for k in range(3)})]:
 _,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True);rep=rep.ravel()
 for name,d in changes.items():
  k=md['names'].index(name);V=md['D'][k]+d;t=md['pr']['targets'][k];sparse(t['POSITION'],V)
  N=g.accessor(t['NORMAL']).astype(float);affected=np.unique(md['F'][np.any((np.linalg.norm(d,axis=1)>1e-8)[md['F']],axis=1)])
  NN=normals(md['P']+V,md['F'],rep)-normals(md['P'],md['F'],rep);N[affected]=NN[affected];sparse(t['NORMAL'],N)
  report.append(dict(mesh=md['name'],target=name,vertices=int((np.linalg.norm(d,axis=1)>1e-8).sum()),maxM=float(np.linalg.norm(d,axis=1).max())))
exec(src[src.index('# Repack only referenced bufferViews;'):src.index('META.write_text(')])
(ROOT/'evidence/offline-character/task18-install-report.json').write_text(json.dumps(dict(changes=report,assetSHA256=sha(ASSET.read_bytes())),indent=2))

g,r,ds=load(ASSET);a=r.clips['stand_up'];report=[]
for side in 'LR':
 u,f,h=[r.idx[n+'.'+side] for n in ['upper_arm','forearm','hand']];channels={g.j['nodes'][ch['target']['node']]['name']:ch for ch in a['channels'] if ch['target']['path']=='rotation'};sf=a['samplers'][channels['forearm.'+side]['sampler']];sh=a['samplers'][channels['hand.'+side]['sampler']];ts=g.accessor(sf['input'])[:,0];assert np.array_equal(ts,g.accessor(sh['input'])[:,0]);T,Q,S=r.sample_clip('stand_up',ts);W=r.fk(T,Q,S);Q2=Q.copy();angles=[]
 for k,t in enumerate(ts):
  fade=min(np.clip((t-.02)/.12,0,1),np.clip((.70-t)/.24,0,1));fade=fade*fade*(3-2*fade)*.65
  if fade==0:continue
  axis=W[k,h,:3,3]-W[k,f,:3,3];axis/=np.linalg.norm(axis);current=W[k,f,:3,:3];desired=W[k,h,:3,:3]@R.q2m(r.rest_r[h]).T;v=current[:,0]-axis*np.dot(current[:,0],axis);z=desired[:,0]-axis*np.dot(desired[:,0],axis);v/=np.linalg.norm(v);z/=np.linalg.norm(z);angle=np.arctan2(np.dot(axis,np.cross(v,z)),np.dot(v,z));rf=R.rotvec2m(axis*angle*fade)@current;Q2[k,f]=R.m2q(W[k,u,:3,:3].T@rf);Q2[k,h]=R.m2q(rf.T@W[k,h,:3,:3]);angles.append(float(np.degrees(angle*fade)))
 W2=r.fk(T,Q2,S);err=float(np.linalg.norm(W2[:,h,:3,3]-W[:,h,:3,3],axis=1).max());rot=float(abs(W2[:,h,:3,:3]-W[:,h,:3,:3]).max());assert err<2e-6 and rot<1e-5
 for idx,sm in [(f,sf),(h,sh)]:
  out=Q2[:,idx];original=g.accessor(sm['output']);out[0]=original[0];out[-1]=original[-1];g.write_accessor(sm['output'],out)
 report.append(dict(side=side,maxRollDeg=max(abs(x) for x in angles),handPositionErrorM=err,handRotationMatrixError=rot,keys=len(ts),support=[.02,.70]))
R.glb_save(str(ASSET),g.j,bytes(g.b));(ROOT/'evidence/offline-character/task18-roll-repair.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
