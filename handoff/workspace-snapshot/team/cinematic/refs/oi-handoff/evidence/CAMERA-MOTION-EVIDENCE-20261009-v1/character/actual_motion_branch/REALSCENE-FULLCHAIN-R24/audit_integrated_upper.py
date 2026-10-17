import bpy,json,gzip,sys,hashlib,itertools,numpy as np
from pathlib import Path
from collections import Counter
from mathutils.bvhtree import BVHTree
R=Path('/workspace/shared/grok-takeover/contact-review');O=Path(bpy.data.filepath).parent;BASE=Path('/workspace/shared/grok-takeover/character');SRC=json.load(gzip.open(BASE/'base/runtime-editable-source.json.gz'));MP=json.load(open(BASE/'split_mapping.json'));scene=bpy.context.scene;EPS=1e-5;SEAM=.001
src=(R/'audit_actual_scene_dense_cached.py').read_text();exec(src[src.index('def mesh('):src.index('fixture_cache={}')])
src2=(R/'audit_authored_panel_rest.py').read_text();exec(src2[src2.index('def points('):src2.index('rows=[]')])
assert hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()=='1ff76c18e3ce759f44fae7cac208326fe5600f4993b822fbaeaf9dd0126e07c4'
assert not any(m.type=='CLOTH' and m.show_viewport for o in bpy.data.objects for m in o.modifiers)
rig=bpy.data.objects['B_RIG_22_original_bones'];body=bpy.data.objects['B_BODY_AND_ACCESSORIES'];fixtures=[o.name for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('env_') and not o.hide_render];cache={};rows=[];C=np.array([[1,0,0],[0,0,-1],[0,1,0.]])
baseline_error=None;restlen={n.name:n.length for n in rig.data.bones}
for si in range(3961):
 fr=1+si/4;scene.frame_set(int(fr),subframe=fr-int(fr));dg=bpy.context.evaluated_depsgraph_get();p,f,ids=mesh(body,dg);sem=np.array([SRC['origins'][int(v)]['semanticPart'] for v in ids]);mask=np.array([s.startswith(('hand','wrist','head','neck','hat')) for s in sem]);sel=np.where(mask)[0];fg=f[sel];g=(p,fg,ids[sel]);bh=bvh(g);full=(p,f,ids);bf=bvh(full);sourcevid=np.array(MP[body.name]['source_vertex_ids']);fixture_hits=[]
 for n in fixtures:
  q=mesh(bpy.data.objects[n],dg);old=cache.get(n)
  if old is None or not np.array_equal(q[0],old[0][0]) or not np.array_equal(q[1],old[0][1]):cache[n]=(q,bvh(q))
  q,bq=cache[n];hh=hit(g,bh,q,bq)
  if hh:fixture_hits.append({'fixture':n,'count':len(hh),'regions':dict(Counter(sem[sel[i]] for i,j in hh)),'pairs':[[int(ids[sel[i]]),j] for i,j in hh]})
 selfhits=[];sewn=0;seen=set()
 for aidx,j in bh.overlap(bf):
  i=int(sel[aidx]);key=tuple(sorted([i,j]))
  if i==j or key in seen:continue
  seen.add(key);a=p[f[i]];b=p[f[j]];an=np.cross(a[1]-a[0],a[2]-a[0]);bnorm=np.cross(b[1]-b[0],b[2]-b[0]);an/=max(np.linalg.norm(an),1e-20);bnorm/=max(np.linalg.norm(bnorm),1e-20);da=(a-b[0])@bnorm;db=(b-a[0])@an
  if not(da.min()<-EPS and da.max()>EPS and db.min()<-EPS and db.max()>EPS):continue
  ps=points(a,b)+points(b,a)
  if not ps:continue
  shared=np.intersect1d(f[i],f[j]);local=False
  if len(shared):
   va=p[shared];dist=[]
   for v in ps:
    if len(shared)>1:
     d=va[1]-va[0];near=va[0]+np.clip((v-va[0])@d/max(d@d,1e-20),0,1)*d;dist.append(np.linalg.norm(v-near))
    else:dist.append(np.linalg.norm(v-va[0]))
   local=max(dist)<=SEAM
  if local:sewn+=1;continue
  selfhits.append({'source_faces':[int(ids[i]),int(ids[j])],'regions':[sem[i],sem[j]],'bilateral_straddle_m':float(min(-da.min(),da.max(),-db.min(),db.max())),'segment_m':float(max(np.linalg.norm(u-v) for u in ps for v in ps))})
 arms={};MW=np.array(rig.matrix_world);ch=rig.pose.bones['chest'].matrix@rig.data.bones['chest'].matrix_local.inverted();ci=np.linalg.inv(np.array(ch)[:3,:3])
 for s in 'LR':
  pb=[rig.pose.bones[n+'.'+s] for n in ['upper_arm','forearm','hand']];h,e,w=[np.array(v.head) for v in pb];u=e-h;v=w-e;ul=C.T@ci@u;norm=lambda x:x/max(np.linalg.norm(x),1e-20)
  world=lambda x:(MW@np.r_[x,1])[:3]
  arms[s]={'shoulder_world':world(h).tolist(),'elbow_world':world(e).tolist(),'wrist_world':world(w).tolist(),'hand_tip_world':world(np.array(pb[2].tail)).tolist(),'torso_relative_abduction_deg':float(np.degrees(np.arctan2(abs(ul[0]),-ul[1]))),'torso_relative_flexion_deg':float(np.degrees(np.arctan2(ul[2],-ul[1]))),'elbow_bend_deg':float(np.degrees(np.arccos(np.clip(norm(u)@norm(v),-1,1)))),'max_connected_joint_gap_m':float(max(np.linalg.norm(world(np.array(pb[k].tail))-world(np.array(pb[k+1].head))) for k in [0,1])),'length_relative_error':max(abs((v.tail-v.head).length/restlen[v.name]-1) for v in pb)}
 rows.append({'frame':fr,'rise_time_s':si/120,'fixture_hits':fixture_hits,'hand_wrist_body_hits':selfhits,'sewn_local_pairs':sewn,'arms':arms})
 if si%60==0:print('FRAME',fr,'FIX',len(fixture_hits),'SELF',len(selfhits),flush=True)
summary={}
for s in 'LR':
 a=[r['arms'][s] for r in rows];w=np.array([x['wrist_world'] for x in a]);speed=np.linalg.norm(np.diff(w,axis=0),axis=1)*120;acc=np.linalg.norm(np.diff(w,n=2,axis=0),axis=1)*120**2
 summary[s]={'torso_abduction_range_deg':[min(x['torso_relative_abduction_deg'] for x in a),max(x['torso_relative_abduction_deg'] for x in a)],'elbow_bend_range_deg':[min(x['elbow_bend_deg'] for x in a),max(x['elbow_bend_deg'] for x in a)],'max_joint_gap_m':max(x['max_connected_joint_gap_m'] for x in a),'max_relative_length_error':max(x['length_relative_error'] for x in a),'max_wrist_speed_m_s':float(speed.max()),'max_wrist_speed_time_s':float((np.argmax(speed)+.5)/120),'max_second_difference_wrist_acceleration_m_s2':float(acc.max()),'first_to_last_wrist_displacement_m':float(np.linalg.norm(w[-1]-w[0]))}
out=O/'full_route_hand_wrist_head_surface_gate.json';out.write_text(json.dumps({'blend':bpy.data.filepath,'sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'actual_environment_meshes':fixtures,'scope':'3961 evaluated samples at120Hz, actual exposed hand/wrist/head/neck/hat source triangles vs all24 actual room and exterior render meshes and complete source body surface. Does not infer nonexistent anatomical skin beneath sleeves, certify garment deformation or judge motion solely from counts. Joints measured from evaluated saved rig. Explicit shared-topology 1mm locality,10um strict plane threshold.','baseline_comparison':'Separate reference-delta report; no unchanged upper-body claim for this integrated candidate','summary':summary,'rows':rows},indent=2));print('SAVED',out,summary,flush=True)
