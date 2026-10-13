import math
from pathlib import Path
exec(Path(__file__).with_name('repair_boots.py').read_text().split('asset=P')[0])
from scipy.spatial.transform import Rotation as R
sys.path.insert(0,str(P/'tools/character-repair'));from door_ik import worlds,sample,between
path=(OUT/'dynamic-after.glb');old=Glb(path);g=Glb(path);names={n['name']:i for i,n in enumerate(g.j['nodes'])};report=[]
for a in g.j['animations']:
 if a['name'] not in ['stand_up','sit_down','sit_hold']:continue
 oa=next(x for x in old.j['animations'] if x['name']==a['name']);hip=names['hips'];hs=next(a['samplers'][c['sampler']] for c in a['channels'] if c['target']=={'node':hip,'path':'translation'});ht=g.accessor(hs['input'])[:,0];vals=g.accessor(hs['output']);dur=max(float(g.accessor(s['input'])[-1,0]) for s in a['samplers'])
 def offset(t):
  phase=np.clip(t/dur,0,1);u=phase*phase*(3-2*phase)
  return .055*(1-u if a['name']=='stand_up' else u if a['name']=='sit_down' else 1)
 vals[:,1]+=[offset(t) for t in ht];g.write_accessor(hs['output'],vals)
 unreachable=0;err=0
 for side in ['L','R']:
  thigh,shin,foot=[names[n+'.'+side] for n in ['thigh','shin','foot']]
  chans={c['target']['node']:a['samplers'][c['sampler']] for c in a['channels'] if c['target']['path']=='rotation' and c['target']['node'] in [thigh,shin,foot]}
  times=np.unique(np.concatenate([g.accessor(s['input'])[:,0] for s in chans.values()]));outputs={i:[] for i in chans}
  for t in times:
   wm,parent=worlds(g,a,float(t));ow,_=worlds(old,oa,float(t));target=ow[foot][:3,3];start=wm[thigh][:3,3];knee=wm[shin][:3,3];vec1=sample(g,a,shin,'translation',t);vec2=sample(g,a,foot,'translation',t);l1=np.linalg.norm(vec1);l2=np.linalg.norm(vec2);d=np.linalg.norm(target-start);axis=(target-start)/d
   if d>l1+l2-1e-7 or d<abs(l1-l2)+1e-7:unreachable+=1;d=np.clip(d,abs(l1-l2)+1e-7,l1+l2-1e-7);target=start+axis*d
   x=(d*d+l1*l1-l2*l2)/(2*d);height=math.sqrt(max(0,l1*l1-x*x));perp=knee-start-axis*((knee-start)@axis)
   if np.linalg.norm(perp)<1e-8:perp=np.cross(axis,[0,0,1])
   perp/=np.linalg.norm(perp);newk=start+axis*x+perp*height;upper=between(knee-start,newk-start)@wm[thigh][:3,:3];base=upper@R.from_quat(sample(g,a,shin,'rotation',t)).as_matrix();lower=between(base@vec2,target-newk)@base
   outputs[thigh].append(R.from_matrix(wm[parent[thigh]][:3,:3].T@upper).as_quat());outputs[shin].append(R.from_matrix(upper.T@lower).as_quat());outputs[foot].append(R.from_matrix(lower.T@ow[foot][:3,:3]).as_quat())
  for node,qs in outputs.items():
   qs=np.array(qs)[np.searchsorted(times,g.accessor(chans[node]['input'])[:,0])]
   for i in range(1,len(qs)):
    if qs[i]@qs[i-1]<0:qs[i]*=-1
   g.write_accessor(chans[node]['output'],qs)
 report.append({'clip':a['name'],'hip_lift_m':.055,'unreachable_keys':unreachable,'feet_target':'source foot world position and orientation'})
g.write_lossless(path);json.dump(report,open(OUT/'seat-ik.json','w'),indent=2);print(report)
