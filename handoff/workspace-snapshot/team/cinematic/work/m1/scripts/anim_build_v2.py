"""Author cine_open_stand + cine_open_turn as baked per-frame bone animation with world root motion on 'root'.
Start pose = pass2b POSES['sit'] (+ sit_corrective=1) placed at CharacterReference.seatedRoot on the REAL chair; legs re-solved by IK
so the soles rest on the real floor (seat top is 0.38 m, pass2b tuned against a 0.40 m box)."""
import bpy, sys, json, math, numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1/scripts')
import poselib as P
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
W='/workspace/wechat-game/team/cinematic/work/m1/'
bpy.ops.wm.open_mainfile(filepath=W+'scene/cine_m1_base.blend')
sc=bpy.context.scene; sc.render.fps=30
a=P.arm()
for pb in a.pose.bones: pb.rotation_mode='QUATERNION'
import os
ARMFIX=float(os.environ.get('ARMFIX','30'))
# anchors from CharacterReference.ts (runtime source of truth); game(x,y,z)->blender(x,-z,y)
CFG=dict(seated_root_xy=(0.4327299768730942,4.207611558444886), standing_root_xy=(-0.016249,4.413086), yaw_walk=-0.04937561571266458, armfix_deg=ARMFIX, yaw_seat=-2.0, seat_drop=-0.0255, stand_frames=60, turn_frames=45)
def ease(x): x=min(1,max(0,x)); return x*x*x*(x*(6*x-15)+10)
def seg(f,a0,a1): return ease((f-a0)/(a1-a0))
# --- ground (real floor + rug) ---
gco=[];gt=[];off=0
for n in ['env_interior_shell','ENV_props_merged_minus_chair']:
    o=bpy.data.objects[n]; me=o.data; me.calc_loop_triangles()
    c=[o.matrix_world@v.co for v in me.vertices]; gco+=c; gt+=[[i+off for i in t.vertices] for t in me.loop_triangles]; off+=len(c)
G=BVHTree.FromPolygons(gco,gt,all_triangles=True)
def ground(x,y):
    h=G.ray_cast(Vector((x,y,0.3)),Vector((0,0,-1)),0.6); return h[0].z if h[0] else 0.0
# --- capture char-frame poses ---
P.reset(); REST=P.capture()
REST_ANK={s:P.head('foot.'+s).copy() for s in 'LR'}; REST_FOOTROT={s:a.pose.bones['foot.'+s].matrix.to_3x3().copy() for s in 'LR'}
P.apply_list(P.SIT); SIT=P.capture()
SIT_ANK={s:P.head('foot.'+s).copy() for s in 'LR'}  # root-relative (root only translated)
ROOT_REST=a.data.bones['root'].matrix_local.copy()
SITZ=-0.609+CFG['seat_drop']
SKIRT=[b for b in REST if b.startswith('skirt')]; ARMS=['upper_arm.L','forearm.L','hand.L','upper_arm.R','forearm.R','hand.R']
def qlerp(M0,M1,t):
    q=M0.to_quaternion().slerp(M1.to_quaternion(),t); l=M0.to_translation().lerp(M1.to_translation(),t)
    return Matrix.Translation(l)@q.to_matrix().to_4x4()
def set_root(pos,yaw):
    pb=a.pose.bones['root']; pb.matrix=Matrix.Translation(pos)@Matrix.Rotation(yaw,4,'Z')@ROOT_REST; P.upd()
def rot_axis(bn,axis_world,deg):
    pb=a.pose.bones[bn]; P.upd(); M=pb.matrix.copy(); h=M.to_translation()
    pb.matrix=Matrix.Translation(h)@Matrix.Rotation(math.radians(deg),4,Vector(axis_world))@Matrix.Translation(-h)@M; P.upd()
def foot_place(side,ankle_w,yaw):
    fwd=Matrix.Rotation(yaw,3,'Z')@Vector((0,-1,0)); kd=fwd+Vector((0,0,0.35))
    err=P.leg_ik(side,ankle_w,kd)
    pb=a.pose.bones['foot.'+side]; h=pb.matrix.to_translation(); pb.matrix=Matrix.Translation(h)@(Matrix.Rotation(yaw,3,'Z')@REST_FOOTROT[side]).to_4x4(); P.upd()
    return err
RS=Matrix.Rotation(CFG['yaw_seat'],3,'Z')
seat_root=Vector((*CFG['seated_root_xy'],0.0))
ANK_W={}
for s in 'LR':
    p=seat_root+RS@Vector((SIT_ANK[s].x,SIT_ANK[s].y,0)); p.z=ground(p.x,p.y)+REST_ANK[s].z; ANK_W[s]=p
stand_root=Vector((*CFG['standing_root_xy'],0.0))
ANK_SIT=ANK_W; ANK_ST={}
for s in 'LR':
    p=stand_root+RS@Vector((REST_ANK[s].x,REST_ANK[s].y,0)); p.z=ground(p.x,p.y)+REST_ANK[s].z; ANK_ST[s]=p
TUCK={'L':(4,13),'R':(8,17)}   # feet tucked back under the knees before rising (lands stand end exactly on standingRoot)
log={'cfg':CFG,'ankles_world':{s:list(ANK_W[s]) for s in 'LR'},'stand_root':list(stand_root),'tuck_mm':{s:(ANK_ST[s]-ANK_SIT[s]).length*1000 for s in 'LR'},'ground_under_feet':{s:ground(ANK_W[s].x,ANK_W[s].y) for s in 'LR'}}
def pose_stand(f):
    """f: 0..60"""
    for b,M in REST.items(): a.pose.bones[b].matrix_basis=M.copy()
    # phases
    lean=seg(f,10,27)*(1-seg(f,36,54))          # torso pitch envelope
    rise=seg(f,24,52)                            # root progress
    armw=seg(f,28,54)
    yprog=ease(min(1,max(0,(f-22)/24.0)))        # forward first...
    zprog=ease(min(1,max(0,(f-28)/24.0)))        # ...then up
    w=zprog                                      # skirt/shape-key release follows hip height (v1 released early -> hem hit floor f34-37)
    fwd=RS@Vector((0,-1,0))
    pos=seat_root+(stand_root-seat_root)*yprog+Vector((0,0,SITZ*(1-zprog)))
    # bones
    for b in SKIRT: a.pose.bones[b].matrix_basis=qlerp(SIT[b],REST[b],w)
    for b in ARMS: a.pose.bones[b].matrix_basis=qlerp(SIT[b],REST[b],armw)
    a.pose.bones['spine'].matrix_basis=qlerp(SIT['spine'],REST['spine'],seg(f,20,50))
    set_root(pos,CFG['yaw_seat'])
    side_ax=RS@Vector((1,0,0))
    rot_axis('forearm.L',side_ax,-ARMFIX*lean); rot_axis('forearm.R',side_ax,-ARMFIX*lean)
    rot_axis('hips',side_ax,26*lean); rot_axis('spine',side_ax,10*lean); rot_axis('chest',side_ax,5*lean); rot_axis('neck',side_ax,-14*lean); rot_axis('head',side_ax,-12*lean)
    errs=[]; tk={}
    for s in 'LR':
        t0,t1=TUCK[s]; u=seg(f,t0,t1); lift=0.02*math.sin(math.pi*min(1,max(0,(f-t0)/(t1-t0))))
        tgt=ANK_SIT[s].lerp(ANK_ST[s],u)+Vector((0,0,lift)); errs.append(foot_place(s,tgt,CFG['yaw_seat'])); tk[s]=not (t0<f<t1)
    pos=pos  # root unchanged
    P.set_sk(1-w)
    return pos,errs,dict(lean=lean,rise=rise,skirt=w,arms=armw,yprog=yprog,zprog=zprog,contact=tk)
# turn: yaw seat -> toward walkEndRoot (game -0.0917,-2.8849 -> blender (-0.0917, 2.8849))
walk_end=Vector((-0.09167675807680428,2.884915363629018,0))
yaw_end=CFG['yaw_walk']  # CharacterReference.walkYawRad (game yaw == blender Z rot)
d=walk_end-stand_root; log['yaw_to_walkEnd_from_standingRoot']=math.atan2(d.x,-d.y)
log['yaw_end']=yaw_end; log['turn_deg']=math.degrees(yaw_end-CFG['yaw_seat'])
FOOT_LOCAL={s:Vector((REST_ANK[s].x,REST_ANK[s].y,0)) for s in 'LR'}
def foot_target(s,yaw):
    p=stand_root+Matrix.Rotation(yaw,3,'Z')@FOOT_LOCAL[s]; p.z=ground(p.x,p.y)+REST_ANK[s].z; return p
STEPS=[('L',4,16,0.0,0.5),('R',14,28,0.0,1.0),('L',26,38,0.5,1.0)]  # (side, f0,f1, from frac, to frac of turn)
def pose_turn(f):
    for b,M in REST.items(): a.pose.bones[b].matrix_basis=M.copy()
    y0=CFG['yaw_seat']; Y=yaw_end-y0
    yaw=y0+Y*seg(f,3,40)
    set_root(stand_root,yaw)
    contact={}
    errs=[]
    for s in 'LR':
        fr=0.0; lift=0.0; planted=True
        for (ss,f0,f1,a0,a1) in STEPS:
            if ss!=s: continue
            if f>=f1: fr=a1
            elif f>f0: u=seg(f,f0,f1); fr=a0+(a1-a0)*u; lift=0.045*math.sin(math.pi*(f-f0)/(f1-f0)); planted=False
            else: break
        fy=y0+Y*fr; t=foot_target(s,fy)+Vector((0,0,lift))
        errs.append(foot_place(s,t,fy)); contact[s]=planted
    # skirt inertia: small lag twist about vertical, bounded 4 deg
    vel=(seg(f+1,3,40)-seg(f-1,3,40))/2*Y*30   # rad/s
    for b in ['skirt.front','skirt.back','skirt.left','skirt.right']:
        rot_axis(b,(0,0,1),-math.degrees(0.06*vel))
    P.set_sk(0)
    return yaw,errs,contact
def bake(name,n,fn):
    act=bpy.data.actions.new(name); a.animation_data_create(); a.animation_data.action=act
    ska={}
    for on in (P.DRESS,P.APRON):
        k=bpy.data.objects[on].data.shape_keys; k.animation_data_create(); ska[on]=bpy.data.actions.new(name+'__'+on+'_sk'); k.animation_data.action=ska[on]
    info=[]
    for f in range(n+1):
        r=fn(f); info.append(r)
        for pb in a.pose.bones:
            pb.keyframe_insert('rotation_quaternion',frame=f,group=pb.name)
            if pb.name=='root': pb.keyframe_insert('location',frame=f,group=pb.name)
            else: pb.location=(0,0,0); pb.keyframe_insert('location',frame=f,group=pb.name)
        for on in (P.DRESS,P.APRON):
            bpy.data.objects[on].data.shape_keys.key_blocks['sit_corrective'].keyframe_insert('value',frame=f)
    for fc in act.fcurves:
        for k in fc.keyframe_points: k.interpolation='LINEAR'
    # NLA tracks named by clip (merged into one glTF animation per clip)
    tr=a.animation_data.nla_tracks.new(); tr.name=name; st=tr.strips.new(name,0,act); a.animation_data.action=None
    for on in (P.DRESS,P.APRON):
        k=bpy.data.objects[on].data.shape_keys; t2=k.animation_data.nla_tracks.new(); t2.name=name; t2.strips.new(name,0,ska[on]); k.animation_data.action=None
    return info
# mute old pass2 loops so they don't export under these names
for t in a.animation_data.nla_tracks: t.mute=True
si=bake('cine_open_stand',CFG['stand_frames'],pose_stand)
ti=bake('cine_open_turn',CFG['turn_frames'],pose_turn)
log['stand_foot_ik_err_mm_max']=max(max(e) for _,e,_ in si)*1000
log['turn_foot_ik_err_mm_max']=max(max(e) for _,e,_ in ti)*1000
log['stand_root_frames']=[[round(x,5) for x in p] for p,_,_ in si]
log['stand_phase']=[ph for _,_,ph in si]
log['turn']=[{'yaw':y,'contact':c} for y,_,c in ti]
json.dump(log,open(W+'probe/anim_build_log.json','w'),indent=1)
sc.frame_start=0; sc.frame_end=CFG['stand_frames']
bpy.ops.wm.save_as_mainfile(filepath=W+'scene/cine_m1_anim.blend')
print('DONE',json.dumps({k:log[k] for k in ['stand_root','yaw_end','turn_deg','stand_foot_ik_err_mm_max','turn_foot_ik_err_mm_max','ground_under_feet']}))
