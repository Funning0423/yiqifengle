"""Clip-boundary continuity: cine_open_stand f89,f90 vs cine_open_turn f0,f1. Pose delta (deg) and angular-velocity delta (deg/frame) per bone, root pos/vel delta (mm)."""
import bpy,sys,json,math
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts'); import clips
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1]); out=sys.argv[sys.argv.index('--')+2]
a=bpy.data.objects['R5G2_RIG_22P4']; sc=bpy.context.scene
def snap(clip,f):
    clips.activate(clip); sc.frame_set(f)
    return {b.name:(a.matrix_world@b.matrix).copy() for b in a.pose.bones}
S89,S90=snap('cine_open_stand',89),snap('cine_open_stand',90); T0,T1=snap('cine_open_turn',0),snap('cine_open_turn',1)
def ang(m1,m2): return math.degrees(m1.to_quaternion().rotation_difference(m2.to_quaternion()).angle)
res={}
for b in S90:
    pose=ang(S90[b],T0[b]); posmm=(S90[b].to_translation()-T0[b].to_translation()).length*1000
    v1=S89[b].to_quaternion().rotation_difference(S90[b].to_quaternion()); v2=T0[b].to_quaternion().rotation_difference(T1[b].to_quaternion())
    vel_deg=math.degrees(v1.angle); vel2=math.degrees(v2.angle)
    lv=(S90[b].to_translation()-S89[b].to_translation())-(T1[b].to_translation()-T0[b].to_translation())
    res[b]=dict(pose_jump_deg=round(pose,4),pos_jump_mm=round(posmm,3),angvel_in=round(vel_deg,4),angvel_out=round(vel2,4),linvel_delta_mm_per_frame=round(lv.length*1000,3))
w=max(res,key=lambda b:res[b]['pose_jump_deg']); wv=max(res,key=lambda b:abs(res[b]['angvel_in']-res[b]['angvel_out'])); wl=max(res,key=lambda b:res[b]['linvel_delta_mm_per_frame'])
summ=dict(max_pose_jump=(w,res[w]['pose_jump_deg']),max_angvel_mismatch=(wv,res[wv]['angvel_in'],res[wv]['angvel_out']),max_linvel_delta=(wl,res[wl]['linvel_delta_mm_per_frame']),max_pos_jump_mm=max(r['pos_jump_mm'] for r in res.values()))
json.dump(dict(summary=summ,bones=res),open(out,'w'),indent=1); print('CONT',json.dumps(summ))
