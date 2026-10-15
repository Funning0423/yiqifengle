"""Delay task18 palm-root/axial-roll additions until hands clear the early seated blend.
Keep baseline correctives, topology and all hand world-space animation key poses.
"""
from common import *
import subprocess,copy
BASE='fbff602c8559231492bff4eccb0db97549301ea5'
p=ROOT/'evidence/offline-character/task20-baseline.glb';p.write_bytes(subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+str(ASSET.relative_to(ROOT))]))
og,orr,ods=load(p)
candidate=ROOT/'evidence/offline-character/task20-rejected-input.glb';candidate.write_bytes(subprocess.check_output(['git','-C',str(ROOT),'show','495e9ef25bb0f6d7d92df0be11b68da2b23d7106:'+str(ASSET.relative_to(ROOT))]));g,r,ds=load(candidate);meta=json.loads(subprocess.check_output(['git','-C',str(ROOT),'show','495e9ef25bb0f6d7d92df0be11b68da2b23d7106:'+str(META.relative_to(ROOT))]))
src=(ROOT/'tools/offline-character/repair_lower_task16.py').read_text();exec(src[src.index('def sparse('):src.index('for md in [ds[0],ds[-1]]:')])
mesh=next(m for m in g.j['meshes'] if m['name']=='LOD0_G2_BODY');mi=g.j['meshes'].index(mesh)
for k in range(3):
 name='wrist_clearance_stand_up_'+str(k)
 for md,old in zip(ds,ods):
  if md['name']!='LOD0_G2_BODY':continue
  pr=md['pr'];delta=md['D'][k]-old['D'][k];dn=g.accessor(pr['targets'][k]['NORMAL'])-og.accessor(old['pr']['targets'][k]['NORMAL'])
  sparse(pr['targets'][k]['POSITION'],old['D'][k]);sparse(pr['targets'][k]['NORMAL'],og.accessor(old['pr']['targets'][k]['NORMAL']))
  pr['targets'].append(dict(POSITION=sparse(None,delta),NORMAL=sparse(None,dn)))
 mesh['extras']['targetNames'].append(name);mesh['weights'].append(0.)
 for node in g.j['nodes']:
  if node.get('mesh')==mi and 'weights' in node:node['weights'].append(0.)
 meta['morph']['meshes']['LOD0_G2_BODY']['targets'][name]=len(mesh['weights'])-1
 curve=meta['clips']['stand_up']['morph']['curves']['corrective_stand_up_'+str(k)]
 ts=sorted(set([x[0] for x in curve]+np.linspace(.12,.14,41).tolist()+[0]))
 def value(t):
  s=float(np.clip((t-.12)/.02,0,1));return float(np.interp(t,np.array(curve)[:,0],np.array(curve)[:,1])*s*s*(3-2*s))
 meta['clips']['stand_up']['morph']['curves'][name]=[[t,value(t)] for t in ts]
# Recompute axial roll with delayed onset; compensation keeps each keyed palm transform.
a=r.clips['stand_up'];report=[]
for side in 'LR':
 u,f,h=[r.idx[n+'.'+side] for n in ['upper_arm','forearm','hand']];channels={g.j['nodes'][ch['target']['node']]['name']:ch for ch in a['channels'] if ch['target']['path']=='rotation'};sf=a['samplers'][channels['forearm.'+side]['sampler']];sh=a['samplers'][channels['hand.'+side]['sampler']];ts=g.accessor(sf['input'])[:,0];T,Q,S=orr.sample_clip('stand_up',ts);W=orr.fk(T,Q,S);Q2=Q.copy()
 for i,t in enumerate(ts):
  fade=min(np.clip((t-.12)/.02,0,1),np.clip((.70-t)/.24,0,1));fade=fade*fade*(3-2*fade)*.65
  if fade==0:continue
  axis=W[i,h,:3,3]-W[i,f,:3,3];axis/=np.linalg.norm(axis);current=W[i,f,:3,:3];desired=W[i,h,:3,:3]@R.q2m(orr.rest_r[h]).T;v=current[:,0]-axis*np.dot(current[:,0],axis);z=desired[:,0]-axis*np.dot(desired[:,0],axis);v/=np.linalg.norm(v);z/=np.linalg.norm(z);angle=np.arctan2(np.dot(axis,np.cross(v,z)),np.dot(v,z));rf=R.rotvec2m(axis*angle*fade)@current;Q2[i,f]=R.m2q(W[i,u,:3,:3].T@rf);Q2[i,h]=R.m2q(rf.T@W[i,h,:3,:3])
 W2=orr.fk(T,Q2,S);pe=float(np.linalg.norm(W2[:,h,:3,3]-W[:,h,:3,3],axis=1).max());re=float(abs(W2[:,h,:3,:3]-W[:,h,:3,:3]).max());assert pe<2e-6 and re<1e-5
 for idx,sm in [(f,sf),(h,sh)]:g.write_accessor(sm['output'],Q2[:,idx])
 report.append(dict(side=side,handPositionErrorM=pe,handRotationMatrixError=re))
exec(src[src.index('# Repack only referenced bufferViews;'):src.index('META.write_text(')])
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
(ROOT/'evidence/offline-character/task20-repair.json').write_text(json.dumps(dict(report=report,glbSHA256=sha(ASSET.read_bytes()),metaSHA256=sha(META.read_bytes()),onset=[.12,.14]),indent=2))
print(report)
