"""Read-only full-route lower-body interpolation, fixed contact and real support screen."""
import bpy,json,gzip,numpy as np,math,hashlib,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
BASE=Path('/workspace/shared/grok-takeover/character');O=Path(bpy.data.filepath).parent;sys.path.insert(0,str(BASE/'detector_recovery'));from independent_crossing_probe import witness
sys.path.insert(0,str(BASE/'actual_motion_branch/full_chain_preparation'));from actual_scene_support import ActualFloor,hull,clip
D=json.load(gzip.open(BASE/'base/runtime-editable-source.json.gz'));MP=json.load(open(BASE/'split_mapping.json'));source=np.array(D['positions']);body=bpy.data.objects['B_BODY_AND_ACCESSORIES'];rig=bpy.data.objects['B_RIG_22_original_bones'];C=np.array([[1,0,0],[0,0,-1],[0,1,0]]);rev={v:i for i,v in enumerate(MP[body.name]['source_vertex_ids'])};sid={s:sorted({v for f,o in zip(D['faces'],D['origins']) if o['semanticPart']=='shoe'+s for v in f}) for s in ['L','R']};sh={s:[rev[v] for v in ix] for s,ix in sid.items()};sole={s:[rev[v] for v in ix if source[v,1]<source[ix,1].min()+.0015] for s,ix in sid.items()};legs={s:np.array([[rev[v] for v in f] for f,o in zip(D['faces'],D['origins']) if o['semanticPart'] in ['shoe'+s,'shin.'+s,'leg-completion.shin.'+s,'leg-completion.thigh.'+s]]) for s in ['L','R']}
plan=json.load(open(O/'foot_support_plan.json'));pivots=json.load(open(O/'heel_pivot_events.json'));rise=json.load(open(BASE/'actual_motion_branch/REALSCENE-COHERENT-LOWER-R1/foot_events.json'))['support_intervals'];intervals={s:[] for s in sh};DURATION=33.;HZ=120
for s in sh:
 intervals[s]+=[(a,min(b,4.5)) for a,b in rise[s] if a<4.5];last=4.5
 for q in plan[s]:intervals[s].append((last,q['start']));last=q['end']
 intervals[s].append((last,29.2))
 intervals[s]+=[(32.2-min(b,3),32.2-a) for a,b in rise[s] if a<3];intervals[s].append((32.2,33.))
 intervals[s]=sorted((max(0,a),min(33,b)) for a,b in intervals[s] if b>a)
 # Split declared flat support before and after the heel-only pivot.
 for ev in pivots:
  if ev['side']!=s:continue
  new=[]
  for a,b in intervals[s]:
   if b<=ev['start'] or a>=ev['end']:new.append((a,b));continue
   if a<ev['start']:new.append((a,ev['start']))
   if b>ev['end']:new.append((ev['end'],b))
  intervals[s]=new
floor=ActualFloor();flat_bounds=np.array([[q[:,[0,2]].min(0),q[:,[0,2]].max(0)] for q in floor.tris]);anchors={};sole_anchors={};heel_anchors={};out=[]
connected=[('hips','spine'),('spine','chest'),('chest','neck'),('neck','head')]+[(a+'.'+s,b+'.'+s) for s in sh for a,b in [('thigh','shin'),('shin','foot'),('upper_arm','forearm'),('forearm','hand')]]
W={'head':.081,'torso':.497,'upper_arm.L':.028,'upper_arm.R':.028,'forearm.L':.016,'forearm.R':.016,'hand.L':.006,'hand.R':.006,'thigh.L':.1,'thigh.R':.1,'shin.L':.0465,'shin.R':.0465,'foot.L':.0145,'foot.R':.0145}
def area(p):return abs(sum(np.cross(p[(i+1)%len(p)],p[i]) for i in range(len(p)))/2) if len(p)>2 else 0.
def support_patch(q):
 poly=hull(q[:,[0,2]]);lo=poly.min(0);hi=poly.max(0);center3=q.mean(0);_,_,vh=np.linalg.svd(q-center3);normal=vh[-1];normal=normal if normal[1]>0 else -normal;plane_d=float(normal@center3);plane_y=lambda p:(plane_d-normal[0]*p[0]-normal[2]*p[2])/normal[1];valid=np.where(np.all(flat_bounds[:,1]>=lo,axis=1)&np.all(flat_bounds[:,0]<=hi,axis=1))[0];pts=[];used=[]
 for i in valid:
  tri=floor.tris[i];n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);p=clip(tri[:,[0,2]],poly)
  if not p:continue
  # Clip the real floor patch to a 2 mm shoe-bottom contact tolerance, never a broad threshold AABB.
  pp=[np.array([v[0],tri[0,1]-(n[0]*(v[0]-tri[0,0])+n[2]*(v[1]-tri[0,2]))/n[1],v[1]]) for v in p]
  for boundary,sgn in [(-.002,1),(.001,-1)]:
   old=pp;pp=[]
   if not old:break
   prev=old[-1];dp=sgn*(prev[1]-plane_y(prev)-boundary)
   for cur in old:
    dc=sgn*(cur[1]-plane_y(cur)-boundary)
    if (dc>=0)!=(dp>=0):pp.append(prev+(cur-prev)*dp/(dp-dc))
    if dc>=0:pp.append(cur)
    prev=cur;dp=dc
  if pp:pts.extend([p[[0,2]] for p in pp]);used.append(i)
 patch=hull(pts) if pts else np.empty((0,2));return patch,float(area(patch)/max(area(poly),1e-12)),used
for i in range(round(DURATION*HZ)+1):
 t=i/HZ;fr=1+t*30;bpy.context.scene.frame_set(int(fr),subframe=fr-int(fr));dg=bpy.context.evaluated_depsgraph_get();ob=body.evaluated_get(dg);rg=rig.evaluated_get(dg);me=ob.to_mesh();v=np.array([C.T@(ob.matrix_world@q.co) for q in me.vertices]);ob.to_mesh_clear();feet={};support=[]
 for s,ix in sh.items():
  q=v[ix];ev=next((e for e in pivots if e['side']==s and e['start']-1e-8<=t<=e['end']+1e-8),None);iv=next((j for j,(a,b) in enumerate(intervals[s]) if a-1e-8<=t<=b+1e-8),None);kind='heel' if ev else 'flat' if iv is not None else 'swing';ys=[floor.point_height(p) for p in q];gaps=[p[1]-y for p,y in zip(q,ys) if y is not None];head=C.T@np.array(rg.matrix_world@rg.pose.bones['foot.'+s].head);anchor_drift=sole_drift=heel_drift=0.;ratio=None;patch=[]
  if kind=='flat':
   key=(s,iv)
   if key not in anchors:anchors[key]=head.copy();sole_anchors[key]=v[sole[s]].copy()
   anchor_drift=float(np.linalg.norm(head-anchors[key]));sole_drift=float(np.max(np.linalg.norm(v[sole[s]]-sole_anchors[key],axis=1)));patch,ratio,used=support_patch(v[sole[s]]);support.extend(patch)
  elif kind=='heel':
   heel=v[rev[ev['source_heel_vertex_id']]];heel_drift=float(np.linalg.norm(heel-ev['world_heel_game_m']));patch=[heel[[0,2]]];support.extend(patch)
  feet[s]={'support_kind':kind,'min_actual_vertex_ground_clearance_m':min(gaps) if gaps else None,'ground_query_missing_vertices':sum(y is None for y in ys),'flat_ankle_drift_m':anchor_drift,'flat_lowsole_drift_m':sole_drift,'heel_fixed_source_vertex_drift_m':heel_drift,'support_convex_patch_ratio':ratio,'support_patch_xz_m':[list(p) for p in patch]}
 trees={s:BVHTree.FromPolygons(v.tolist(),legs[s].tolist(),all_triangles=True,epsilon=0) for s in sh};pairs=trees['L'].overlap(trees['R']);crossings=0
 if pairs:
  pp=np.array(pairs);a=v[legs['L'][pp[:,0]]];b=v[legs['R'][pp[:,1]]];l,_,_=witness(a,b);r,_,_=witness(b,a);crossings=int(np.count_nonzero(l|r))
 centers={n:C.T@np.array(rg.matrix_world@((rg.pose.bones[n].head+rg.pose.bones[n].tail)/2)) for n in W if n!='torso'};centers['torso']=C.T@np.array(rg.matrix_world@((rg.pose.bones['hips'].head+rg.pose.bones['neck'].tail)/2));com=sum(centers[n]*w for n,w in W.items());poly=hull(support) if support else [];margins=[]
 for j,a in enumerate(poly):
  e=poly[(j+1)%len(poly)]-a
  if np.linalg.norm(e)>1e-8:margins.append(float(np.cross(e,com[[0,2]]-a)/np.linalg.norm(e)))
 out.append({'time':t,'frame':fr,'feet':feet,'strict_cross_leg_pairs':crossings,'approx_segment_mass_COM_game_m':com.tolist(),'approx_COM_static_support_margin_m':min(margins) if len(poly)>2 else None,'joint_gap_max_m':max((rg.matrix_world@rg.pose.bones[a].tail-rg.matrix_world@rg.pose.bones[b].head).length for a,b in connected),'bone_length_max_error_source':max(abs((b.tail-b.head).length-b.bone.length) for b in rg.pose.bones),'rig_root_identity_error':float(np.abs(np.array(rg.pose.bones['root'].matrix_basis)-np.eye(4)).max())})
 if i%240==0:print('DENSE',t,'cross',crossings,'clearance',[f['min_actual_vertex_ground_clearance_m'] for f in feet.values()],flush=True)
s={'blend_sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'sampling_hz':HZ,'samples':len(out),'cross_leg_bad_samples':sum(q['strict_cross_leg_pairs']>0 for q in out),'max_cross_leg_pairs':max(q['strict_cross_leg_pairs'] for q in out),'min_actual_vertex_ground_clearance_m':min(f['min_actual_vertex_ground_clearance_m'] for q in out for f in q['feet'].values() if f['min_actual_vertex_ground_clearance_m'] is not None),'max_flat_ankle_drift_m':max(f['flat_ankle_drift_m'] for q in out for f in q['feet'].values()),'max_flat_lowsole_drift_m':max(f['flat_lowsole_drift_m'] for q in out for f in q['feet'].values()),'max_heel_fixed_source_vertex_drift_m':max(f['heel_fixed_source_vertex_drift_m'] for q in out for f in q['feet'].values()),'max_joint_gap_m':max(q['joint_gap_max_m'] for q in out),'max_bone_length_error_source':max(q['bone_length_max_error_source'] for q in out),'rig_root_identity_max_error':max(q['rig_root_identity_error'] for q in out),'narrow_flat_support_samples':[{'time':q['time'],'side':s,'ratio':f['support_convex_patch_ratio']} for q in out for s,f in q['feet'].items() if f['support_convex_patch_ratio'] is not None and f['support_convex_patch_ratio']<.25],'limitations':['Lower-body only. Full body self, upper-body, cloth, dynamic balance and runtime import remain unaccepted.','Actual support patch clips real lowsole convex footprint to real scene triangles within 2 mm vertical tolerance; its convex hull is a support envelope, not a claim of uniform pressure.','Heel pivot tracks its declared real source heel vertex; whole-sole lock is not asserted during that interval.','Segment-mass COM is approximate. A negative static margin during walking is not alone proof of dynamic imbalance, and a positive margin is not a force-balance validation.']}
(O/'dense_120hz_lower_body_audit.json').write_text(json.dumps({'summary':s,'support_intervals':intervals,'heel_pivot_events':pivots,'samples':out},indent=2));print(json.dumps({k:v for k,v in s.items() if k!='narrow_flat_support_samples'},indent=2),flush=True);print('NARROW_SUPPORT_SAMPLES',len(s['narrow_flat_support_samples']))
