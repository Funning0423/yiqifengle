import bpy,json,numpy as np,math,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path('/workspace/shared/grok-takeover/character/actual_motion_branch/camera_review_gate');S=bpy.context.scene;C=np.array([[1,0,0],[0,0,-1],[0,1,0]])
exec((O/'fit_cameras.py').read_text().split('results=[]')[0])
# All truly animated art is re-evaluated; static mesh ray tree uses unchanged frame-one art.
dyn=[o for o in envs if o.animation_data and o.animation_data.action];static=[o for o in envs if o not in dyn];S.frame_set(1);dg=bpy.context.evaluated_depsgraph_get();sb,so=make_bvh(static,dg)
print('DYNAMIC', [o.name for o in dyn],flush=True)
def camera_plan(t,root):
 if t<4.5:return 'A_chair_physical_right',np.array([-.80,1.65,-4.80]),90.
 if t<7.1:return 'B_approach_front_right',root+np.array([-.68,1.25,1.53]),72.
 if t<11.5:return 'C_door_inside_right',root+np.array([-.68,1.50,-1.60]),73.
 if t<19.9:
  u=float(np.clip((t-17.5)/2.0,0,1));u=u*u*(3-2*u)
  return 'D_exterior_right',np.array([-.55,1.65,3.65])*(1-u)+np.array([-2.2,1.3,1.65])*u,64.
 if t<23.2:return 'E_close_inside_right',np.array([-1.1,1.5,-1.75]),76.
 if t<26.6:return 'F_return_room_right',np.array([1.45,1.5,-4.10]),82.
 if t<29.2:return 'G_return_turn_from_travel_right',np.array([.10,1.25,-2.35]),85.
 return 'H_seated_physical_right',np.array([-.80,1.65,-4.80]),90.
def pose_info(t):
 fr=1+t*30;S.frame_set(int(fr),subframe=fr-int(fr));dg=bpy.context.evaluated_depsgraph_get();root=C.T@np.array(ctrl.location);pts=[];body=None;feet=[]
 for name in ['B_BODY_AND_ACCESSORIES','B_YELLOW_DRESS','B_WHITE_APRON']:
  o=bpy.data.objects[name];ev=o.evaluated_get(dg);m=ev.to_mesh();v=np.array([C.T@np.array(ev.matrix_world@q.co) for q in m.vertices]);pts.extend(v)
  if name=='B_BODY_AND_ACCESSORIES':
   body=v
   for side in ['L','R']:
    gi=o.vertex_groups['foot.'+side].index
    vi=[q.index for q in o.data.vertices if any(g.group==gi and g.weight>.99 for g in q.groups)]
    a=v[vi]
    # Actual shoe extremal points: heel, toe, sole, medial, lateral.
    if len(a):
     for j in range(3):
      feet.extend([('shoe_'+side+'_axis'+str(j)+'_min',a[np.argmin(a[:,j])]),('shoe_'+side+'_axis'+str(j)+'_max',a[np.argmax(a[:,j])])])
  ev.to_mesh_clear()
 pts=np.array(pts);mn,mx=pts.min(0),pts.max(0);target=(body.min(0)+body.max(0))/2;target[1]=(max(0,body[:,1].min())+body[:,1].max())/2
 samples=[]
 for name in ['hips','chest','head','hand.L','hand.R','foot.L','foot.R']:
  b=rig.pose.bones[name];samples.append((name,C.T@np.array(rig.matrix_world@b.head)))
 samples.extend([('hat_top',body[np.argmax(body[:,1])])]);samples+=feet
 # Clothing vertices below the preserved real floor are already-rejected LBS defects, not framing target.
 framing_pts=pts[pts[:,1]>=-.015]
 return dg,root,target,framing_pts,samples
records=[];bad=[]
TS=sorted(set([i/30 for i in range(991)]+TIMES+[4.499,7.099,11.499,19.899,23.199,26.599]))
for i,t in enumerate(TS):
 dg,root,target,pts,samples=pose_info(t);db,do=make_bvh(dyn,dg);shot,p,fov=camera_plan(t,root)
 if shot in ['A_chair_physical_right','H_seated_physical_right']:
  planar=target[[0,2]]-p[[0,2]];dist=np.linalg.norm(planar);forward=planar/dist;depth=(pts[:,[0,2]]-p[[0,2]])@forward;elev=np.arctan2(pts[:,1]-p[1],depth);angle=(elev.min()+elev.max())*.5;target[1]=p[1]+dist*math.tan(angle);fov=90.
 a=analyze(p,target,pts,samples,fov,full=True)
 if a is None:
  # Return framing values even when current plan does not fit.
  a=analyze(p,target,pts,samples,None,full=True)
  fail='frame-fit'
 else:fail=None
 if a is None:a={'position_game_m':p.tolist(),'target_game_m':target.tolist(),'vfov_deg':fov,'body_occlusions':[]};fail='eye-or-extreme-fit'
 a.update(time=t,shot=shot,plan_vfov_deg=fov,root_game_m=root.tolist(),failure=fail)
 if a.get('eye_clearance_m') is not None:
  near_radius=.03*math.sqrt(1+(1+(480/620)**2)*math.tan(math.radians(fov/2))**2)
  a.update(near_plane_corner_radius_m=near_radius,near_plane_conservative_clearance_m=a['eye_clearance_m']-near_radius)
 for hit in a['body_occlusions']:
  q=next(v for n,v in samples if n==hit['sample']);hit['sample_game_m']=q.tolist();hit['occluded_segment_m']=float(np.linalg.norm(q-p)-hit['distance'])
 a['body_occlusion_exceptions']=[q for q in a['body_occlusions'] if q['sample'].startswith('shoe_') and q['object'] in ['env_interior_shell','env_lighthouse_ext'] and q['occluded_segment_m']<.03 and q['sample_game_m'][1]<.025]
 a['unaccepted_body_occlusions']=[q for q in a['body_occlusions'] if q not in a['body_occlusion_exceptions']]

 if a.get('near_15cm_hits',0) or a.get('foreground_55cm_hits',0)>6 or a.get('eye_clearance_m',1)<.08:fail='near-geometry';a['failure']=fail
 if len(a['unaccepted_body_occlusions']):fail='body-occlusion';a['failure']=fail
 records.append(a)
 if fail:bad.append(a)
 if i%30==0:print('AUDIT',round(t,3),'bad',len(bad),flush=True)
(O/'shot_plan_audit_v10.json').write_text(json.dumps({'frames':records,'failures':bad,'animated_environment_objects':[o.name for o in dyn]},indent=2))
for a in bad[:50]:print('FAIL',round(a['time'],3),a['shot'],a['failure'],'occ',[(q['sample'],q['object'],round(q['distance'],2)) for q in a['body_occlusions']],'vfov',a['vfov_deg'],flush=True)
print('DONE',len(records),len(bad),flush=True)
