import bpy,json,numpy as np,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path('/workspace/shared/grok-takeover/character/actual_motion_branch/camera_review_gate');S=bpy.context.scene;C=np.array([[1,0,0],[0,0,-1],[0,1,0]])
TIMES=[0,3,4.5,7,9.8,12.7,14,18.9,20.2333333333,21.5,26,29.2,32.2]
ctrl=bpy.data.objects['B_METRE_CONTROLLER_REFERENCE_candidate'];rig=bpy.data.objects['B_RIG_22_original_bones'];R=json.load(open(Path(bpy.data.filepath).parent/'root_reference_curve.json'))
# Environment meshes are unchanged; exact evaluated visible art, no proxy-only collision gate.
envs=[o for o in S.objects if o.type=='MESH' and o.name.startswith('env_') and not o.hide_render]
static=[];dyn=[]
for o in envs:
 if o.name=='env_lighthouse_door':dyn.append(o)
 else:static.append(o)
def make_bvh(obs,dg):
 vs=[];fs=[];owners=[]
 for o in obs:
  ev=o.evaluated_get(dg);m=ev.to_mesh();n=len(vs);vs.extend([ev.matrix_world@v.co for v in m.vertices]);fs.extend([tuple(i+n for i in p.vertices) for p in m.polygons]);owners.extend([o.name]*len(m.polygons));ev.to_mesh_clear()
 return BVHTree.FromPolygons(vs,fs),owners
S.frame_set(1);dg=bpy.context.evaluated_depsgraph_get();sb,so=make_bvh(static,dg)
def ray(p,q):
 p=Vector(C@p);q=Vector(C@q);v=q-p;d=v.length
 if d<1e-8:return None
 best=None
 for b,owner in [(sb,so),(db,do)]:
  loc,n,idx,dist=b.ray_cast(p,v.normalized(),d-.008)
  if idx is not None and (best is None or dist<best['distance']):best={'object':owner[idx],'distance':dist,'point':(C.T@np.array(loc)).tolist()}
 return best
def nearest(p):
 p=Vector(C@p);records=[]
 for b,owners in [(sb,so),(db,do)]:
  loc,n,idx,d=b.find_nearest(p)
  if idx is not None:records.append((d,owners[idx]))
 return min(records)
def basis(p,t):
 f=(t-p);f/=np.linalg.norm(f);right=np.cross(f,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,f);return f,right,up
def analyze(p,target,pts,samples,fov=None,full=False):
 f,r,u=basis(p,target);rel=pts-p;z=rel@f
 if min(z)<.08:return None
 xs=rel@r/z;ys=rel@u/z
 aspect=480/620
 k=max(max(abs(xs))/aspect,max(abs(ys)))/.83
 vfov=math.degrees(2*math.atan(k)) if fov is None else fov
 if vfov>105:return None
 # FOV must preserve complete body with padding.
 half=math.tan(math.radians(vfov/2));ndc=np.stack([.5+.5*xs/(half*aspect),.5+.5*ys/half],axis=1)
 if ndc.min()<.03 or ndc.max()>.97:return None
 oc=[]
 for name,q in samples:
  hit=ray(p,q)
  if hit:oc.append({'sample':name,**hit})
 if len(oc)>3 and not full:return None
 # Frustum rays evaluate every central image subdivision through a plane at target depth.
 fr=[]
 depth=float(np.linalg.norm(target-p));nearcount=0;foreground=0
 for xx in np.linspace(-1,1,9):
  for yy in np.linspace(-1,1,11):
   q=p+f*depth+r*xx*half*aspect*depth+u*yy*half*depth;hit=ray(p,q)
   if hit:
    hit.update(x=float(xx),y=float(yy));fr.append(hit)
    if hit['distance']<.15:nearcount+=1
    if hit['distance']<.55 and yy>-.75:foreground+=1
 clear,nearob=nearest(p)
 if (clear<.08 or nearcount or foreground>6) and not full:return None
 return {'position_game_m':p.tolist(),'target_game_m':target.tolist(),'vfov_deg':vfov,'hfov_deg':math.degrees(2*math.atan(half*aspect)),'body_ndc_bounds':[ndc.min(0).tolist(),ndc.max(0).tolist()],'eye_clearance_m':clear,'nearest_object':nearob,'body_occlusions':oc,'frustum_rays':99,'frustum_hits':fr,'near_15cm_hits':nearcount,'foreground_55cm_hits':foreground,'body_depth_min_m':float(min(z))}
results=[]
for ti,t in enumerate(TIMES):
 fr=1+t*30;S.frame_set(int(fr),subframe=fr-int(fr));dg=bpy.context.evaluated_depsgraph_get();db,do=make_bvh(dyn,dg)
 root=C.T@np.array(ctrl.location);yaw=float(np.interp(t,[r['time'] for r in R],[r['yaw'] for r in R]));forward=np.array([math.sin(yaw),0,math.cos(yaw)]);right=np.cross(forward,[0,1,0]);pts=[]
 for name in ['B_BODY_AND_ACCESSORIES','B_YELLOW_DRESS','B_WHITE_APRON']:
  o=bpy.data.objects[name];ev=o.evaluated_get(dg);m=ev.to_mesh();pts.extend([C.T@np.array(ev.matrix_world@v.co) for v in m.vertices]);ev.to_mesh_clear()
 pts=np.array(pts);mn,mx=pts.min(0),pts.max(0);target=(mn+mx)/2;target[1]=(mn[1]+mx[1])/2
 samples=[]
 for name in ['hips','chest','head','hand.L','hand.R','foot.L','foot.R']:
  b=rig.pose.bones[name];samples.append((name,C.T@np.array(rig.matrix_world@b.head)))
 samples.extend([('hat_top',pts[np.argmax(pts[:,1])]),('shoe_bottom',pts[np.argmin(pts[:,1])])])
 cands=[]
 if t<=11.5 or t>=21.5:
  # Interior eyes. Include many actor-right candidates without assuming global +X is right.
  grid=[np.array([x,y,z]) for x in np.arange(-1.1,1.76,.3) for z in np.arange(-4.85,-.5,.3) for y in [1.0,1.25,1.5]]
 else:
  # Exterior right-side sweep; no doorway crossing before fully open.
  grid=[np.array([x,y,z]) for x in np.arange(-2.6,.21,.4) for z in np.arange(.45,4.1,.4) for y in [1.05,1.35,1.65]]
 for p in grid:
  dist=np.linalg.norm(p-target)
  if dist<1.15 or dist>3.8:continue
  rs=float((p-root)@right);fs=float((p-root)@forward)
  # During close, physical right rotates into -Z. Prefer doorway-safe left-side exterior when positive-right impossible.
  a=analyze(p,target,pts,samples)
  if a is None:continue
  score=len(a['body_occlusions'])*30+max(0,a['vfov_deg']-75)*.1+a['foreground_55cm_hits']*2
  score+=max(0,-rs)*2.0+.2*abs(dist-2.4)+max(0,-fs)*.25
  score+=max(0,.18-a['eye_clearance_m'])*10
  a.update(score=score,physical_right_offset_m=rs,forward_offset_m=fs)
  cands.append(a)
 cands.sort(key=lambda a:a['score']);record={'time':t,'root_game_m':root.tolist(),'forward_game':forward.tolist(),'physical_right_game':right.tolist(),'character_bounds_game':[mn.tolist(),mx.tolist()],'candidate_count':len(cands),'candidates':cands[:12]};results.append(record)
 print('FIT',t,len(cands),json.dumps([{k:a[k] for k in ['position_game_m','vfov_deg','physical_right_offset_m','eye_clearance_m','body_occlusions','foreground_55cm_hits','score']} for a in cands[:2]]),flush=True)
 (O/'camera_candidates.json').write_text(json.dumps(results,indent=2))
