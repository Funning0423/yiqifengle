# reduce walk hip lateral sway: hips X deviation from a 1-stride moving average scaled by K; legs re-solved by analytic 2-bone IK
# so ankle world position+foot world rotation are identical to the original every frame (no new slide); knee stays in the original knee plane.
import bpy,json,sys,os,math,numpy as np
from mathutils import Vector,Matrix
SRC,OUTG,LOG=sys.argv[-3:];TARGET=float(os.environ.get('TARGET_MM',65))
CLIPS=['walk_loop','walk_start','walk_stop_bodyL','walk_stop_bodyR']
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=SRC)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute=True
PB=arm.pose.bones;AW=arm.matrix_world;AWi=AW.inverted()
def setact(a):
  arm.animation_data.action=a
  try: arm.animation_data.action_slot=a.slots[0]
  except: pass
def ma(x,w,cyc):
  n=len(x);
  if cyc: return np.array([np.mean([x[(i+k)%n] for k in range(-w//2,w//2+1)]) for i in range(n)])
  return np.array([np.mean(x[max(0,i-w//2):min(n,i+w//2+1)]) for i in range(n)])
log={}
for cn in CLIPS:
  a=bpy.data.actions[cn];setact(a);N=int(round(a.frame_range[1]))
  G=[];
  for f in range(N+1):
    sc.frame_set(f);bpy.context.view_layer.update()
    G.append(dict(loc={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in PB},
      M={b.name:b.matrix.copy() for b in PB}))
  hx=np.array([g['M']['hips'].translation.x for g in G])  # armature space
  cyc=cn=='walk_loop';W=43 if cyc else 22   # one gait cycle (walk_loop = 1 cycle of 44 frames)
  base=ma(hx,W,cyc) if not cyc else np.full_like(hx,hx[:-1].mean())
  dev=hx-base;
  # K so that the lateral range of the gait part (dev) reaches TARGET
  r0=(hx.max()-hx.min())*1000;rd=(dev.max()-dev.min())*1000
  K=min(1.0,max(0.3,(TARGET-(r0-rd))/rd)) if cyc else min(1.0,TARGET/max(1e-6,r0)) if r0>TARGET else 1.0
  if not cyc: K=min(1.0,max(0.3,1-(r0-TARGET)/max(rd,1e-6)))
  K=float(os.environ.get('KFIX',K))
  if cyc: C=float(hx[:-1].mean())
  def sst(u): u=min(1,max(0,u)); return u*u*(3-2*u)
  RA=[int(x) for x in os.environ.get('RAMP','0,20').split(',')]
  if cn=='walk_loop': w=np.ones(len(hx))
  elif cn=='walk_start': w=np.array([sst((f-RA[0])/(RA[1]-RA[0])) for f in range(len(hx))])
  else: w=np.array([1-sst((f-(N-RA[1]))/(RA[1]-RA[0])) for f in range(len(hx))])
  newx=hx-(1-K)*w*(hx-C)
  out=[];maxerr=0;kn=[]
  for f,g in enumerate(G):
    for b in PB: b.location,b.rotation_quaternion,b.scale=g['loc'][b.name]
    bpy.context.view_layer.update()
    Mh=g['M']['hips'].copy();Mh.translation.x=newx[f];PB['hips'].matrix=Mh;bpy.context.view_layer.update()
    for s in 'LR':
      th,sh,ft=PB['thigh.'+s],PB['shin.'+s],PB['foot.'+s]
      H=th.head.copy();T=g['M']['foot.'+s].translation.copy();K0=g['M']['shin.'+s].translation.copy();H0=g['M']['thigh.'+s].translation.copy()
      l1=(K0-H0).length;l2=(T-K0).length;d=min((T-H).length,l1+l2-1e-5)
      # knee plane normal from original
      n0=(K0-H0).cross(T-H0).normalized();u=(T-H).normalized()
      cosA=(l1*l1+d*d-l2*l2)/(2*l1*d);A=math.acos(max(-1,min(1,cosA)))
      side=n0.cross(u).normalized()
      if side.dot(K0-(H0+(T-H0).normalized()*((K0-H0).dot((T-H0).normalized()))))<0: side=-side
      Kn=H+u*(l1*math.cos(A))+side*(l1*math.sin(A))
      # thigh: rotate current pose matrix so its Y axis points H->Kn
      Mt=th.matrix.copy();y=Mt.to_3x3().col[1].normalized();R=y.rotation_difference((Kn-H).normalized()).to_matrix()
      M3=R@Mt.to_3x3();Mt2=M3.to_4x4();Mt2.translation=H;th.matrix=Mt2;bpy.context.view_layer.update()
      Ms=sh.matrix.copy();y=Ms.to_3x3().col[1].normalized();R=y.rotation_difference((T-sh.head).normalized()).to_matrix()
      Ms2=(R@Ms.to_3x3()).to_4x4();Ms2.translation=sh.head.copy();sh.matrix=Ms2;bpy.context.view_layer.update()
      Mf=g['M']['foot.'+s].copy();Mf.translation=sh.tail.copy();ft.matrix=Mf;bpy.context.view_layer.update()
      maxerr=max(maxerr,(ft.head-T).length,(ft.tail-g['M']['foot.'+s].to_3x3().col[1]*0+ (PB['foot.'+s].tail)).length*0)
      kang0=math.degrees((K0-H0).angle(T-K0));kang1=math.degrees((sh.head-th.head).angle(T-sh.head));kn.append(round(kang1-kang0,2))
    out.append({b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in PB})
  # verify feet world identical
  ferr=0
  for f,P in enumerate(out):
    for b in PB: b.location,b.rotation_quaternion,b.scale=P[b.name]
    bpy.context.view_layer.update()
    for s in 'LR': ferr=max(ferr,(PB['foot.'+s].head-G[f]['M']['foot.'+s].translation).length,(PB['foot.'+s].tail-(G[f]['M']['foot.'+s]@Vector((0,PB['foot.'+s].length,0)))).length)
  log[cn]=dict(K=round(float(K),3),hipsX_range_mm_before=round(r0,1),hipsX_range_mm_after=round(float((newx.max()-newx.min())*1000),1),
     gait_dev_range_before=round(rd,1),gait_dev_range_after=round(rd*K,1),seam_x=[round(float(hx[0]*1000),2),round(float(newx[0]*1000),2),round(float(hx[-1]*1000),2),round(float(newx[-1]*1000),2)],foot_world_err_mm=round(ferr*1000,4),knee_flex_change_deg=[min(kn),max(kn)])
  print('SWAY',cn,json.dumps(log[cn]),flush=True)
  for fc in list(a.fcurves): a.fcurves.remove(fc)
  for bn in out[0]:
    for path,j,n_ in (('location',0,3),('rotation_quaternion',1,4),('scale',2,3)):
      for i in range(n_):
        fc=a.fcurves.new(f'pose.bones["{bn}"].{path}',index=i,action_group=bn);fc.keyframe_points.add(len(out))
        for f,P in enumerate(out): fc.keyframe_points[f].co=(f,P[bn][j][i]);fc.keyframe_points[f].interpolation='LINEAR'
        fc.update()
json.dump(log,open(LOG,'w'),indent=1)
for x in list(bpy.data.actions):
  if x.name not in CLIPS: bpy.data.actions.remove(x)
setact(bpy.data.actions['walk_loop'])
bpy.ops.export_scene.gltf(filepath=OUTG,export_format='GLB',export_tangents=False,export_animations=True,export_animation_mode='ACTIONS',
  export_force_sampling=True,export_frame_step=1,export_optimize_animation_size=False,export_def_bones=False,export_skins=True,export_morph=False,export_extras=False)
