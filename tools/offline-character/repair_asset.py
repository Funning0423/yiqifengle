"""Pinned, reproducible offline asset repair. No engine/import/build invocation."""
from common import *
import argparse
parser=argparse.ArgumentParser();args=parser.parse_args()
base=baseline()
assert sha(base.read_bytes())=='2f98cf0e1ee1a1213008397e2fd369868576317cd53e718333f7158d2c4de19f'
g,r,data=load(base);report={'inputSHA256':sha(base.read_bytes()),'animation':[],'skin':[],'cloth':[]}
def write(i,a):
 ac=g.j['accessors'][i]
 if 'min' in ac:ac['min']=np.asarray(a).min(0).tolist();ac['max']=np.asarray(a).max(0).tolist()
 if 'sparse' not in ac:g.write_accessor(i,np.asarray(a));return
 arr=np.asarray(a,dtype='<f4');g.b.extend(b'\0'*((-len(g.b))%4));off=len(g.b);g.b.extend(arr.tobytes());g.j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes});ac.pop('sparse');ac['bufferView']=len(g.j['bufferViews'])-1;ac.pop('byteOffset',None)
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
# Reauthor the upper chain in model space. Original root/hip/leg motion is retained.
# The existing CMU retarget sums hip+spine pitch while neck/head add strong roll/yaw.
a=r.clips['stand_up'];duration=max(float(g.accessor(s['input'])[-1,0]) for s in a['samplers'])
for ch in a['channels']:
 name=g.j['nodes'][ch['target']['node']]['name'];s=a['samplers'][ch['sampler']]
 if ch['target']['path']!='rotation' or name not in ['spine','chest','neck','head','upper_arm.L','upper_arm.R']:continue
 ts=g.accessor(s['input'])[:,0];T,Q,S=r.sample_clip('stand_up',ts);world=r.fk(T,Q,S);i=r.idx[name];parent=r.parent[i]
 pitch={'spine':29,'chest':26,'neck':14,'head':10}.get(name,0)
 # Smoothly rise into the authored lean, then unroll while hips rise.
 lean=np.maximum(0,np.sin(np.pi*np.clip(ts/duration,0,1)))**1.5
 endpoint=R.slerp(R.m2q(world[0,i,:3,:3])[None],R.m2q(world[-1,i,:3,:3])[None],smooth(ts/duration));target=R.rotvec2m(np.c_[np.radians(pitch)*lean,np.zeros((len(ts),2))])@R.q2m(endpoint);
 if name.startswith('upper_arm.'):target=world[:,i,:3,:3]
 # Parent matrices include preceding repaired channels by reloading from current BIN.
 rr=R.Rig(str(base));rr.BIN=bytes(g.b);T,Q,S=rr.sample_clip('stand_up',ts);ww=rr.fk(T,Q,S)
 local=R.m2q(np.transpose(ww[:,parent,:3,:3],(0,2,1))@target)
 out=local;out[0]=g.accessor(s['output'])[0];out[-1]=g.accessor(s['output'])[-1]
 write(s['output'],out);report['animation'].append({'clip':'stand_up','bone':name,'keys':len(ts),'endpointsPreserved':True})
# Relax locomotion wrists; retain seated hand placement and door interaction.
for a in g.j['animations']:
 name=a['name']
 if name in ['sit_hold','sit_down','door_reach','apron_lift','wind_flutter_loop']:continue
 dur=max(float(g.accessor(s['input'])[-1,0]) for s in a['samplers'])
 for ch in a['channels']:
  bone=g.j['nodes'][ch['target']['node']]['name']
  if ch['target']['path']!='rotation' or bone not in ['hand.L','hand.R']:continue
  s=a['samplers'][ch['sampler']];ts=g.accessor(s['input'])[:,0];q=g.accessor(s['output']);rest=r.rest_r[r.idx[bone]]
  ang=2*np.arccos(np.clip(abs(q@rest),0,1));bound=np.minimum(1,np.radians(28)/np.maximum(ang,1e-12));relaxed=R.slerp(rest[None],q,bound)
  if name=='stand_up':out=R.slerp(q,relaxed,smooth((ts-.95)/.30));out[0]=q[0]
  elif name=='sit_down':out=R.slerp(relaxed,q,smooth((ts-(dur-.48))/.35));out[-1]=q[-1]
  else:out=relaxed
  write(s['output'],out);report['animation'].append({'clip':name,'bone':bone,'maxSourceRestDeltaDeg':float(np.degrees(ang).max()),'relaxedLimitDeg':28})
# Cuff/palm annulus has an overly long tapered stretch under ~100 degree wrist
# rotation; wrist relaxation above addresses its pose, leaving manifold topology intact.
# The rigid heel stays on the foot; grade the upper shaft over a larger distance.
for md in data:
 if md['name']!='LOD0_G2_BODY' or md['pi']>2:continue
 P=md['P'];J=md['J'].copy();W=md['W'].copy()
 for side,lo,hi in [('L',3622,3879),('R',3879,4136)]:
  ids=np.arange(lo,hi);y=P[ids,1];u=smooth((y-.074)/(.176-.074));u[y<=.074]=0
  J[ids]=[r.idx['foot.'+side],r.idx['shin.'+side],0,0];W[ids]=np.c_[1-u,u,np.zeros((len(ids),2))]
 write(md['pr']['attributes']['JOINTS_0'],J);write(md['pr']['attributes']['WEIGHTS_0'],W)
 report['skin'].append({'mesh':md['name'],'primitive':md['pi'],'shaftBlendBeginM':.074,'shaftBlendEndM':.176,'rigidHeelThroughM':.074})
# Seated cuffs intersect the supported thigh drape. Compress only their lower
# sleeve surface in the existing seated corrective, keeping palms and fingers.
world,weights=actual(r)
md=next(m for m in data if m['name']=='LOD0_G2_BODY' and m['pi']==0)
v=posed(md,r,world,weights);offset=np.zeros_like(v);ids=np.r_[1503:2543,4136:4176]
# Distal sleeve contact zone; keep the arm profile above the cuff intact.
factor=smooth((v[ids,2]-.23)/.04)*smooth((.43-v[ids,2])/.04)
offset[ids,1]=np.maximum(0,.578-v[ids,1])*factor
matrices=world@r.ibm;A=np.sum(matrices[md['J'],:3,:3]*md['W'][:,:,None,None],axis=1)
delta=np.linalg.solve(A,offset[:,:,None])[:,:,0]
idx=md['names'].index('corrective_stand_up_0');write(md['pr']['targets'][idx]['POSITION'],md['D'][idx]+delta)
# The seated corrective includes NORMAL. Update its affected neighborhood too;
# CPU recomputed shading must not hide stale imported morph normals.
Pnew=md['P']+md['D'][idx]+delta;faces=np.concatenate([m['F'] for m in data if m['name']=='LOD0_G2_BODY' and m['pi']<3]);changed=np.linalg.norm(delta,axis=1)>1e-6;affected=np.unique(faces[np.any(changed[faces],axis=1)]);normals=np.zeros_like(Pnew);fn=np.cross(Pnew[faces[:,1]]-Pnew[faces[:,0]],Pnew[faces[:,2]]-Pnew[faces[:,0]])
for lane in range(3):np.add.at(normals,faces[:,lane],fn)
# Weld UV duplicates in analysis so cuff/skin seams also share corrected normals.
groups={}
for vertex in range(len(Pnew)):groups.setdefault(tuple(Pnew[vertex]),[]).append(vertex)
for group in groups.values():
 if len(group)>1:normals[group]=normals[group].sum(0)
normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12);normalIndex=md['pr']['targets'][idx]['NORMAL'];normalDelta=g.accessor(normalIndex).astype(float);normalDelta[affected]=normals[affected]-md['N'][affected];write(normalIndex,normalDelta)

report['cloth'].append({'mesh':md['name'],'target':'corrective_stand_up_0','changedVertices':int((np.linalg.norm(delta,axis=1)>1e-6).sum()),'maxBindDeltaM':float(np.linalg.norm(delta,axis=1).max())})
R.glb_save(str(ASSET),g.j,bytes(g.b));report['outputSHA256']=sha(ASSET.read_bytes())
(ROOT/'evidence/offline-character/repair.json').write_text(json.dumps(report,indent=2))
print(report['outputSHA256'])

# Stable local sole forward axes preserve the rest toe direction across yaw.
meta=json.load(open(META));axes={bone:(np.linalg.inv(r.rest_world[r.idx[bone],:3,:3])@np.array([0,0,1])).tolist() for bone in ['foot.L','foot.R']}
meta['sole_contact']['relaxed_swing']={'toe_down_deg':16,'forward':axes}
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
