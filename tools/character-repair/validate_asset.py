"""CPU LBS and glTF LINEAR quaternion audit, including in-between frames.
Reports deformation and contracts, not Cocos GPU/phone acceptance.
"""
from pathlib import Path
import sys,json,numpy as np,math
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'static-seat'));from glb_local import Glb,sha
sys.path.insert(0,str(Path(__file__).resolve().parent));from repair_asset import ASSET,SOURCE,components
np.seterr(all='raise')
def qmat(q):
 x,y,z,w=q/np.linalg.norm(q);return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def sample(q,times,t,rotation=False):
 k=max(0,min(len(times)-2,int(np.searchsorted(times,t,side='right')-1)))
 if len(times)==1:return q[0]
 u=np.clip((t-times[k])/(times[k+1]-times[k]),0,1);a=q[k].astype(float);b=q[k+1].astype(float)
 if rotation:
  if a@b<0:b=-b
  d=np.clip(a@b,-1,1)
  if d<.9995:
   h=math.acos(d);return (math.sin((1-u)*h)*a+math.sin(u*h)*b)/math.sin(h)
  v=a*(1-u)+b*u;return v/np.linalg.norm(v)
 return a*(1-u)+b*u
def matrices(g,anim,t):
 nodes=g.j['nodes'];trs=[[np.array(n.get('translation',[0,0,0]),float),np.array(n.get('rotation',[0,0,0,1]),float),np.array(n.get('scale',[1,1,1]),float)] for n in nodes]
 for c in anim['channels']:
  s=anim['samplers'][c['sampler']];path=c['target']['path'];assert s.get('interpolation','LINEAR')=='LINEAR';v=sample(g.accessor(s['output']),g.accessor(s['input'])[:,0],t,path=='rotation');trs[c['target']['node']][{'translation':0,'rotation':1,'scale':2}[path]]=v
 parent={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};out={}
 def world(i):
  if i not in out:
   p,q,s=trs[i];M=np.eye(4);M[:3,:3]=qmat(q)*s[None,:];M[:3,3]=p
   out[i]=np.einsum('ij,jk->ik',world(parent[i]),M) if i in parent else M
  return out[i]
 return np.array([world(i) for i in g.j['skins'][0]['joints']])
def inspect(g):
 p=g.j['meshes'][1]['primitives'][0];a=p['attributes'];P=g.accessor(a['POSITION']).astype(float);J=g.accessor(a['JOINTS_0']);W=g.accessor(a['WEIGHTS_0']).astype(float);H=np.column_stack([P,np.ones(len(P))]);ib=g.accessor(g.j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1).astype(float)
 names=[g.j['nodes'][i]['name'] for i in g.j['skins'][0]['joints']];wrist={}
 for side in ['L','R']:
  f=names.index('forearm.'+side);h=names.index('hand.'+side);loc=np.einsum('ij,kj->ki',ib[h],H)
  wrist[side]=np.where((np.sum(W*((J==f)|(J==h)),axis=1)>.999)&(abs(loc[:,1])<.025)&(np.sum(W*(J==h),axis=1)>.01)&(np.sum(W*(J==f),axis=1)>.01))[0]
 shoes={}
 for ids in components(P,g.accessor(p['indices']).reshape(-1,3)):
  v=P[ids]
  if len(ids)==257 and v[:,1].max()<.18 and v[:,1].min()<.001:
   side='L' if v[:,0].mean()<0 else 'R';ids=np.array(ids);sole=ids[v[:,1]<=.094];edges=np.array([[sole[0],v] for v in sole[1:]])
   shoes[side]=(sole,edges,np.linalg.norm(P[edges[:,0]]-P[edges[:,1]],axis=1))
 elbows={side:np.where((np.sum(W*((J==names.index('upper_arm.'+side))|(J==names.index('forearm.'+side))),axis=1)>.999)&(np.sum(W*(J==names.index('upper_arm.'+side)),axis=1)>.01)&(np.sum(W*(J==names.index('forearm.'+side)),axis=1)>.01))[0] for side in ['L','R']}
 rows=[]
 for anim in g.j['animations']:
  duration=max(g.accessor(s['input'])[-1,0] for s in anim['samplers']);row={'clip':anim['name'],'duration_s':float(duration),'samples':121,'wrist':{},'shoe_lower_max_distance_error_m':0,'all_finite':True}
  worst={s:(float('inf'),0) for s in wrist};shoe_error=0;elbow_min={s:1. for s in elbows}
  for t in np.linspace(0,duration,121):
   skin=np.einsum('nij,njk->nik',matrices(g,anim,t),ib);blend=np.einsum('vk,vkij->vij',W,skin[J]);deform=np.einsum('vij,vj->vi',blend,H)[:,:3];assert np.isfinite(deform).all()
   for side,ids in wrist.items():
    minimum=float(np.linalg.svd(blend[ids,:3,:3],compute_uv=False)[:,-1].min())
    if minimum<worst[side][0]:worst[side]=(minimum,float(t))
   for side,ids in elbows.items():
    if len(ids):elbow_min[side]=min(elbow_min[side],float(np.linalg.svd(blend[ids,:3,:3],compute_uv=False)[:,-1].min()))
   for side,(sole,edges,dist) in shoes.items():shoe_error=max(shoe_error,float(np.max(abs(np.linalg.norm(deform[edges[:,0]]-deform[edges[:,1]],axis=1)-dist))))
  row['wrist']={side:{'min_lbs_singular_value':v[0],'worst_time_s':v[1],'mixed_vertices':len(wrist[side])} for side,v in worst.items()};row['shoe_lower_max_distance_error_m']=shoe_error;row['elbow_min_lbs_singular_value']=elbow_min;rows.append(row)
 return rows
old=Glb(SOURCE);new=Glb(ASSET);assert old.j==new.j,'JSON contract changed';changes=[i for i in range(len(old.j['accessors'])) if not np.array_equal(old.accessor(i),new.accessor(i))]
allowed=set()
for a in old.j['animations']:
 for c in a['channels']:
  if c['target']['path']=='rotation' and old.j['nodes'][c['target']['node']]['name'] in (['hand.L','hand.R','upper_arm.L','forearm.L'] if a['name']=='door_reach' else ['hand.L','hand.R']):allowed.add(a['samplers'][c['sampler']]['output'])
for m in old.j['meshes']:
 for p in m['primitives']:allowed.update(p['attributes'][k] for k in ['JOINTS_0','WEIGHTS_0'])
assert set(changes)<=allowed
result={'source_sha256':sha(old.raw),'candidate_sha256':sha(ASSET.read_bytes()),'json_bytes_contract_unchanged':True,'changed_accessors':changes,'source':inspect(old),'candidate':inspect(new),'rotation_audit':[]}
for anim in new.j['animations']:
 for c in anim['channels']:
  bone=new.j['nodes'][c['target']['node']]['name']
  if c['target']['path']!='rotation' or bone not in ['hand.L','hand.R','upper_arm.L','forearm.L']:continue
  sampler=anim['samplers'][c['sampler']];q=new.accessor(sampler['output']).astype(float);q/=np.linalg.norm(q,axis=1)[:,None];times=new.accessor(sampler['input'])[:,0];dot=np.clip(abs(np.sum(q[1:]*q[:-1],axis=1)),0,1);speed=np.degrees(2*np.arccos(dot))/np.diff(times)
  result['rotation_audit'].append({'clip':anim['name'],'bone':bone,'max_key_angular_speed_deg_s':float(speed.max()) if len(speed) else 0})
  if bone.startswith('hand'):assert not len(speed) or speed.max()<240.02
assert all(r['all_finite'] and r['shoe_lower_max_distance_error_m']<1e-6 and all(w['min_lbs_singular_value']>.85 for w in r['wrist'].values()) for r in result['candidate'])
Path('output/character-repair/skin-audit.json').write_text(json.dumps(result,indent=2));print('PASS',len(result['candidate']),'clips x 121 samples; JSON/topology/textures/bind/channels unchanged; wrist Jacobian > .85; rigid lower boot distances < 1um')
