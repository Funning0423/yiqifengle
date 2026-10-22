# 雪地行走 blocking：以 walk_loop 为底，按相位重采样 + IK 脚 + 上身叠加。用法 blender -b --python snow_walk_block.py -- head|tail|ref
import bpy, math, json, sys, os
from mathutils import Vector, Quaternion, Matrix
MODE=sys.argv[sys.argv.index('--')+1]
OUT=os.path.dirname(os.path.abspath(__file__))
CFG={
 # N: 循环帧数@30fps；k: 步幅；lift: 抬脚倍数；drop: 重心下沉(m)；fy: 脚相对髋后移(m)
 # lean: (hips,spine,chest,neck,head) 度，+ 为前倾；arm: 摆臂保留比例；fore: 前臂额外屈曲°；foot: 脚掌蹬伸保留
 'head':dict(N=46,k=0.85,lift=1.35,drop=0.035,fy=0.03,lean=(5,8,5,-1,3),arm=0.75,fore=12,foot=0.8),
 'tail':dict(N=38,k=0.92,lift=1.30,drop=0.012,fy=0.0,lean=(0,-1.5,-1,0.5,0),arm=1.0,fore=2,foot=0.85),
 'ref':None}
c=CFG[MODE]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspace/yiqifengle/previews/角色动画bot/planB-verify/cand3/planB_cand3b_ribbonwind4b_stepdown.glb")
sc=bpy.context.scene
for o in bpy.data.objects:
    if o.name=="Icosphere": o.hide_render=True; o.hide_viewport=True
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for o in bpy.data.objects:
    if o.type=='MESH' and o.animation_data: o.animation_data.action=None
P=arm.pose.bones
for pb in P: pb.rotation_mode='QUATERNION'
src=bpy.data.actions['walk_loop']; arm.animation_data.action=src
N0=43  # walk_loop 帧数@30
def eval_src(t):  # t 秒
    x=t*24.0; sc.frame_set(int(math.floor(x)),subframe=x-math.floor(x))
N=N0 if c is None else c['N']
rec=[]
for i in range(N+1):
    eval_src((i/N)*N0/30.0)
    r={}
    for pb in P:
        r[pb.name]=(pb.location.copy(),pb.rotation_quaternion.copy(),(arm.matrix_world@pb.matrix).copy())
    rec.append(r)
sc.render.fps=30; sc.frame_start=0; sc.frame_end=N-1
def rotw(pb,axis,deg):
    mr=pb.bone.matrix_local.to_quaternion()
    return mr.inverted()@Quaternion(axis,math.radians(deg))@mr
X=Vector((1,0,0));Y=Vector((0,1,0));Z=Vector((0,0,1))
name='walk_loop' if c is None else ('walk_snow_head' if MODE=='head' else 'walk_snow_tail')
if c is not None:
    act=bpy.data.actions.new(name); arm.animation_data.action=act
    tgt={}
    for s in 'LR':
        e=bpy.data.objects.new("ikT"+s,None); sc.collection.objects.link(e); tgt[s]=e
        pl=bpy.data.objects.new("pole"+s,None); sc.collection.objects.link(pl); tgt['p'+s]=pl
        cn=P['shin.'+s].constraints.new('IK'); cn.target=e; cn.pole_target=pl; cn.chain_count=2; cn.pole_angle=-math.pi/2
    LEAN=dict(zip(('hips','spine','chest','neck','head'),c['lean']))
    for i in range(N+1):
        r=rec[i]
        for pb in P:
            loc,q,_=r[pb.name]; pb.location=loc; pb.rotation_quaternion=q
        hb=P['hips']; hb.location=r['hips'][0]+hb.bone.matrix_local.to_3x3().inverted()@Vector((0,0,-c['drop']))
        for b,d in LEAN.items(): P[b].rotation_quaternion=rotw(P[b],X,d)@r[b][1]
        for s in 'LR':
            ua=P['upper_arm.'+s]; ua.rotation_quaternion=Quaternion().slerp(r[ua.name][1],c['arm'])
            fa=P['forearm.'+s]; fa.rotation_quaternion=rotw(fa,X,-c['fore'])@r[fa.name][1]
            fo=P['foot.'+s]; fo.rotation_quaternion=Quaternion().slerp(r[fo.name][1],c['foot'])
            h=r['foot.'+s][2].translation
            p=Vector((h.x,h.y*c['k']+c['fy'],0.081+max(0,h.z-0.081)*c['lift']))
            tgt[s].location=p; tgt['p'+s].location=(h.x*1.5,-1.0,0.55)
            tgt[s].keyframe_insert('location',frame=i); tgt['p'+s].keyframe_insert('location',frame=i)
        for pb in P:
            pb.keyframe_insert('rotation_quaternion',frame=i); pb.keyframe_insert('location',frame=i)
    # 脚掌：IK 解完后按原 walk_loop 世界朝向（缩放蹬伸）回写，保证着地期全掌贴地
    for i in range(N+1):
        sc.frame_set(i)
        for s in 'LR':
            fo=P['foot.'+s]
            qw=rec[i]['foot.'+s][2].to_quaternion()
            sh=(arm.matrix_world@P['shin.'+s].matrix).to_quaternion()
            # 目标：着地(脚高≤0.0815)时完全用原世界朝向；摆动期保留 IK 后父子关系中的局部旋转
            if rec[i]['foot.'+s][2].translation.z<=0.0815:
                m=Matrix.LocRotScale(fo.matrix.translation,qw,None); fo.matrix=arm.matrix_world.inverted()@m
                bpy.context.view_layer.update()
            fo.keyframe_insert('rotation_quaternion',frame=i)
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=0,frame_end=N,only_selected=False,visual_keying=True,clear_constraints=True,use_current_action=True,bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    act=arm.animation_data.action; act.name=name
else:
    # ref：把 walk_loop 也烘到 30fps 整帧，方便同口径测量/渲染
    act=bpy.data.actions.new('walk_loop_30'); 
    for i in range(N+1):
        for pb in P:
            loc,q,_=rec[i][pb.name]; pb.location=loc; pb.rotation_quaternion=q
        arm.animation_data.action=act
        for pb in P: pb.keyframe_insert('rotation_quaternion',frame=i); pb.keyframe_insert('location',frame=i)
# ---- 测量 t=n/30 ----
v_exp=None; res=[]
for i in range(N+1):
    sc.frame_set(i); row={'f':i}
    for s in 'LR':
        th=P['thigh.'+s]; sh=P['shin.'+s]; fo=P['foot.'+s]; ua=P['upper_arm.'+s]
        v1=(th.tail-th.head).normalized(); v2=(sh.tail-sh.head).normalized()
        row['knee'+s]=math.degrees(v1.angle(v2))
        a=arm.matrix_world@fo.head; t=arm.matrix_world@fo.tail
        row['ank'+s]=list(a); row['toe'+s]=list(t)
        d=(ua.tail-ua.head).normalized(); row['abd'+s]=math.degrees(math.atan2(abs(d.x),-d.z))
        # 手腕扭转：hand 相对 forearm 绕骨轴（局部 Y）的转角
        q=fo.id_data.pose.bones['hand.'+s].rotation_quaternion
        row['twist'+s]=abs(math.degrees(2*math.atan2(q.y,q.w)))
    hb=P['hips']; row['hipZ']=(arm.matrix_world@hb.head).z
    sp=arm.matrix_world@P['spine'].head; hd=arm.matrix_world@P['head'].tail
    row['trunk']=math.degrees(math.atan2(-(hd.y-sp.y),hd.z-sp.z))
    res.append(row)
# 着地脚滑动：着地帧(踝高≤0.0815 连续两帧)的速度与平均履带速度的偏差
sp=[];stats={}
for s in 'LR':
    for a,b in zip(res,res[1:]):
        if a['ank'+s][2]<=0.0815 and b['ank'+s][2]<=0.0815: sp.append((s,b['ank'+s][1]-a['ank'+s][1],b['ank'+s][0]-a['ank'+s][0]))
vy=sum(x[1] for x in sp)/len(sp)
stats['clip']=name; stats['frames']=N; stats['dur_s']=N/30
stats['treadmill_mps']=vy*30
stats['slide_mm_per_frame_max']=max(math.hypot(x[1]-vy,x[2]) for x in sp)*1000
stats['knee_min_deg']=min(min(r['kneeL'],r['kneeR']) for r in res)
stats['knee_max_deg']=max(max(r['kneeL'],r['kneeR']) for r in res)
stats['knee_dmax_deg_per_frame']=max(abs(b['knee'+s]-a['knee'+s]) for s in 'LR' for a,b in zip(res,res[1:]))
# 膝突伸：一帧内伸直 >8° 且伸到 <3°
stats['knee_snap_frames']=[b['f'] for s in 'LR' for a,b in zip(res,res[1:]) if a['knee'+s]-b['knee'+s]>8 and b['knee'+s]<3]
stats['arm_abd_max_deg']=max(max(r['abdL'],r['abdR']) for r in res)
stats['wrist_twist_max_deg']=max(max(r['twistL'],r['twistR']) for r in res)
stats['hipZ_min']=min(r['hipZ'] for r in res); stats['hipZ_max']=max(r['hipZ'] for r in res)
stats['trunk_lean_mean_deg']=sum(r['trunk'] for r in res)/len(res)
stats['ankle_lift_max_m']=max(max(r['ankL'][2],r['ankR'][2]) for r in res)-0.081
stats['toe_min_z']=min(min(r['toeL'][2],r['toeR'][2]) for r in res)
stats['stride_m']=max(r['ankL'][1] for r in res)-min(r['ankL'][1] for r in res)
stats['loop_seam_knee_deg']=max(abs(res[0]['knee'+s]-res[-1]['knee'+s]) for s in 'LR')
json.dump({'stats':stats,'frames':res},open(f'{OUT}/metrics_{MODE}.json','w'),indent=0)
print("STATS",json.dumps(stats,ensure_ascii=False))
# ---- 场景/渲染 ----
bpy.ops.mesh.primitive_plane_add(size=10,location=(0,0,-0.025))
g=bpy.context.object; m=bpy.data.materials.new("snow"); m.diffuse_color=(0.86,0.9,0.96,1); g.data.materials.append(m)
cams={}
for nm,loc in (('side',(3.6,-0.15,1.0)),('front',(0.0,-3.6,1.0))):
    cm=bpy.data.objects.new(nm,bpy.data.cameras.new(nm)); sc.collection.objects.link(cm); cm.data.lens=50
    cm.location=loc; cm.rotation_euler=(Vector((0,0,0.82))-Vector(loc)).to_track_quat('-Z','Y').to_euler(); cams[nm]=cm
sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='MATERIAL'; sc.display.shading.show_shadows=True
sc.render.resolution_x=540; sc.render.resolution_y=720
sc.render.image_settings.file_format='PNG'
sc.render.use_stamp=True; sc.render.use_stamp_frame=True
for k in ('date','time','render_time','camera','filename','scene','lens','memory','hostname'):
    if hasattr(sc.render,'use_stamp_'+k): setattr(sc.render,'use_stamp_'+k,False)
sc.render.use_stamp_note=True; sc.render.stamp_note_text=name
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/snow_{MODE}.blend')
for nm,cm in cams.items():
    sc.camera=cm; sc.render.filepath=f'{OUT}/frames_{MODE}_{nm}/f_'
    bpy.ops.render.render(animation=True)
