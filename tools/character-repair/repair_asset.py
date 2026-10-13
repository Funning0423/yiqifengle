"""Local, lossless candidate for QF-WRIST-20261013 / QF-HEEL-20261013.
Keeps topology, inverse binds, animation channels/times, images and GLB JSON bytes.
Bounds hand deformation relative to bind; reweights rigid shoe shells below ankle.
"""
from pathlib import Path
import sys,json,math,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'static-seat'))
from glb_local import Glb,sha
ASSET=Path('creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
SOURCE=Path('output/character-repair/original.glb')
def components(P,I):
 parent=np.arange(len(P))
 def find(i):
  while parent[i]!=i:
   parent[i]=parent[parent[i]];i=parent[i]
  return i
 for tri in I:
  for v in tri[1:]:parent[find(int(v))]=find(int(tri[0]))
 out={}
 for i in range(len(P)):out.setdefault(find(i),[]).append(i)
 return list(out.values())
def slerp(a,b,u):
 d=float(np.clip(a@b,-1,1))
 if d<0:b=-b;d=-d
 if d>.9995:
  q=(1-u)*a+u*b;return q/np.linalg.norm(q)
 h=math.acos(d);return (math.sin((1-u)*h)*a+math.sin(u*h)*b)/math.sin(h)
def bounded(q,rest,times):
 q=q.astype(float);q/=np.linalg.norm(q,axis=1)[:,None];rest=rest/np.linalg.norm(rest)
 q[(q@rest)<0]*=-1;dot=np.clip(q@rest,-1,1);theta=2*np.arccos(dot)
 # C1 smooth onset at 40 degrees, asymptotic limit 60 degrees.
 start=math.radians(40);span=math.radians(20)
 target=np.where(theta>start,start+span*np.tanh((theta-start)/span),theta)
 half=theta/2;u=np.divide(target,theta,out=np.ones_like(theta),where=theta>1e-9)
 out=np.empty_like(q)
 for i in range(len(q)):
  out[i]=rest if half[i]<1e-8 else (math.sin((1-u[i])*half[i])*rest+math.sin(u[i]*half[i])*q[i])/math.sin(half[i])
 for i in range(1,len(out)):
  if out[i]@out[i-1]<0:out[i]*=-1
 # Canonical log can flip its axis at 180 degrees. Project the bounded
 # trajectory onto a 240 deg/s speed envelope, keeping clip endpoints.
 first=out[0].copy();last=out[-1].copy();limit=math.radians(240)
 for repeat in range(120):
  for i in range(1,len(out)-1):
   angle=2*math.acos(float(np.clip(abs(out[i-1]@out[i]),0,1)));allowed=limit*float(times[i]-times[i-1])
   if angle>allowed+1e-8:out[i]=slerp(out[i-1],out[i],allowed/angle)
  out[-1]=last
  for i in range(len(out)-2,0,-1):
   angle=2*math.acos(float(np.clip(abs(out[i+1]@out[i]),0,1)));allowed=limit*float(times[i+1]-times[i])
   if angle>allowed+1e-8:out[i]=slerp(out[i+1],out[i],allowed/angle)
  out[0]=first
 speed=[math.degrees(2*math.acos(float(np.clip(abs(out[i-1]@out[i]),0,1))))/float(times[i]-times[i-1]) for i in range(1,len(out))]
 assert not speed or max(speed)<240.01, max(speed)
 return out.astype('<f4'),np.degrees(theta),np.degrees(target)
def main():
 SOURCE.parent.mkdir(parents=True,exist_ok=True)
 if not SOURCE.exists():SOURCE.write_bytes(ASSET.read_bytes())
 g=Glb(SOURCE);report={'issues':['QF-WRIST-20261013','QF-HEEL-20261013'],'source_sha256':sha(g.raw),'wrist':[],'shoes':[],'wrist_weights':[]}
 for anim in g.j['animations']:
  for ch in anim['channels']:
   n=g.j['nodes'][ch['target']['node']]
   if ch['target']['path']!='rotation' or n.get('name') not in ['hand.L','hand.R']:continue
   sampler=anim['samplers'][ch['sampler']];assert sampler.get('interpolation','LINEAR')=='LINEAR'
   q=g.accessor(sampler['output']);new,oldangle,newangle=bounded(q,np.array(n['rotation']),g.accessor(sampler['input'])[:,0])
   g.write_accessor(sampler['output'],new)
   report['wrist'].append({'clip':anim['name'],'bone':n['name'],'keys':len(q),'old_max_bind_delta_deg':float(oldangle.max()),'new_max_bind_delta_deg':float(newangle.max()),'adjacent_min_dot':float(np.sum(new[1:]*new[:-1],axis=1).min()) if len(q)>1 else 1})
 names=[g.j['nodes'][i]['name'] for i in g.j['skins'][0]['joints']]
 ib=g.accessor(g.j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 for mesh in g.j['meshes']:
  for p in mesh['primitives']:
   a=p['attributes'];P=g.accessor(a['POSITION']);J=g.accessor(a['JOINTS_0']);W=g.accessor(a['WEIGHTS_0']);I=g.accessor(p['indices']).reshape(-1,3)
   for ids in components(P,I):
    v=P[ids]
    # Palm and independent finger surfaces use one shared wrist transition.
    if len(ids) in (86,30) and v[:,1].min()>.79 and v[:,1].max()<.97 and np.min(abs(v[:,0]))>.19:
     side='L' if v[:,0].mean()<0 else 'R';hand=names.index('hand.'+side);forearm=names.index('forearm.'+side)
     if np.all(np.sum(W[ids]*((J[ids]==hand)|(J[ids]==forearm)),axis=1)>.999):
      local=np.einsum('ij,kj->ki',ib[hand],np.column_stack([v,np.ones(len(ids))]))
      if len(ids)==86:
       u=np.clip((local[:,1]+.018)/.043,0,1);hw=u*u*(3-2*u)
      else:hw=np.ones(len(ids))
      J[ids]=[hand,forearm,0,0];W[ids]=np.column_stack([hw,1-hw,np.zeros((len(ids),2))])
      report['wrist_weights'].append({'side':side,'component_vertices':len(ids),'hand_weight_range':[float(hw.min()),float(hw.max())]})
    # Select complete disconnected boot shells, not calves, using known bind bounds.
    if len(ids)!=257 or v[:,1].max()>.18 or v[:,1].min()>.001:continue
    side='L' if v[:,0].mean()<0 else 'R';foot=names.index('foot.'+side);shin=names.index('shin.'+side)
    before=W[ids].copy();u=np.clip((v[:,1]-.094)/(.176-.094),0,1);shin_weight=u*u*(3-2*u)
    J[ids]=[foot,shin,0,0];W[ids]=np.column_stack([1-shin_weight,shin_weight,np.zeros((len(ids),2))])
    report['shoes'].append({'side':side,'vertices':len(ids),'rigid_lower_vertices':int(sum(v[:,1]<=.094)),'changed_weights':int(sum(np.max(abs(W[ids]-before),axis=1)>1e-6)),'shaft_blend_start_m':.094,'shaft_blend_end_m':.176})
   g.write_accessor(a['JOINTS_0'],J);g.write_accessor(a['WEIGHTS_0'],W)
 from door_ik import apply
 report['door_ik']=apply(g,Glb(SOURCE))
 g.write_lossless(ASSET);report['candidate_sha256']=sha(ASSET.read_bytes());Path('output/character-repair/first-change.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({'sha':report['candidate_sha256'],'wrist_channels':len(report['wrist']),'shoes':report['shoes']},indent=2))
if __name__=='__main__':main()
