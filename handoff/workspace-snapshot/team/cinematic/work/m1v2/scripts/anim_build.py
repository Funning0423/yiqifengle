"""Author cine_open_stand + cine_open_turn as baked per-frame bone animation with world root motion on 'root'.
Start pose = pass2b POSES['sit'] (+ sit_corrective=1) placed at CharacterReference.seatedRoot on the REAL chair; legs re-solved by IK
so the soles rest on the real floor (seat top is 0.38 m, pass2b tuned against a 0.40 m box)."""
import bpy, sys, json, math, numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2/scripts')
import poselib as P
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
W='/workspace/wechat-game/team/cinematic/work/m1v2/'
bpy.ops.wm.open_mainfile(filepath=W+'scene/cine_m1_base.blend')
sc=bpy.context.scene; sc.render.fps=30
CS=float(sc.get('char_scale',1.061164379119873))   # pass2b pose translations are in source units -> scale with the character
a=P.arm()
for pb in a.pose.bones: pb.rotation_mode='QUATERNION'
import os
ARMFIX=float(os.environ.get('ARMFIX','0'))   # v2: legacy forearm lift (replaced by hands-on-thighs IK)
HAND_LIFT=float(os.environ.get('HAND_LIFT','0.008')); HAND_OFF=float(os.environ.get('HAND_OFF','0.05')); STEP_WIDTH=float(os.environ.get('STEP_WIDTH','0.05'))
# anchors from CharacterReference.ts (runtime source of truth); game(x,y,z)->blender(x,-z,y)
CFG=dict(seated_root_xy=(0.4327299768730942,4.207611558444886), standing_root_xy=(-0.016249,4.413086), yaw_walk=-0.04937561571266458, armfix_deg=ARMFIX, yaw_seat=-2.0, hand_lift_m=HAND_LIFT, step_width_m=STEP_WIDTH, seat_drop=None, stand_frames=90, turn_frames=45, timing_source='Oi R24 root_reference_curve.json: rise 0-3s, turn 3-4.5s')
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
R24=json.load(open('/workspace/wechat-game/team/cinematic/refs/oi-handoff/evidence/CAMERA-MOTION-EVIDENCE-20261009-v1/character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/root_reference_curve.json'))
def r24(t):
    xs=[x['time'] for x in R24]; i=max(0,min(len(xs)-2,int(np.searchsorted(xs,t))-1)); a0,a1=R24[i],R24[i+1]; u=0 if a1['time']==a0['time'] else min(1,max(0,(t-a0['time'])/(a1['time']-a0['time'])))
    pa=np.array(a0['position_game_m']); pb=np.array(a1['position_game_m']); pg=pa+(pb-pa)*u
    return Vector((pg[0],-pg[2],0.0)), a0['yaw']+(a1['yaw']-a0['yaw'])*u
R24_P0=r24(0.0)[0]; R24_P3=r24(3.0)[0]; R24_TOT=(R24_P3-R24_P0).length
def r24_prog(t): return min(1.0,(r24(t)[0]-R24_P0).length/R24_TOT)
seat_root=Vector((*CFG['seated_root_xy'],0.0))
ANK_W={}
for s in 'LR':
    p=seat_root+RS@Vector((SIT_ANK[s].x,SIT_ANK[s].y,0)); p.z=ground(p.x,p.y)+REST_ANK[s].z; ANK_W[s]=p
# --- sit height fit on the REAL chair (contact, 1 mm clearance; bow tails excluded = model-level issue) ---
def seat_fit():
    """v2g: exact fit by TRUE triangle intersection. For each mesh (body = bow tails excluded, dress, apron; solidify off = game midsurface)
    find by bisection the smallest vertical shift dz of the sit pose (root at the pass2b scaled z) at which it has NO tri-tri overlap with the
    REAL chair seat/front-edge triangles (backrest and legs excluded). Returns gap = -dz (m) so the existing 1 mm clearance logic is unchanged.
    (v2e ray footprint stopped at ly 0.12 and missed the rear of the hips; v2f normal-filtered ray picked up the seat/back junction, +50 mm.)"""
    P.reset(); P.apply_list(P.SIT); P.set_sk(1.0); set_root(seat_root+Vector((0,0,-0.609*CS)),CFG['yaw_seat'])
    ch=bpy.data.objects['CHAIR_REAL_reading_chair']; me=ch.data; me.calc_loop_triangles(); Mi=ch.matrix_world.inverted()
    def lab(t):
        c=sum((me.vertices[i].co for i in t.vertices),Vector())/3
        return not ((c.y>0.17 and c.z>0.40) or c.z<0.33)
    CT=BVHTree.FromPolygons([ch.matrix_world@v.co for v in me.vertices],[list(t.vertices) for t in me.loop_triangles if lab(t)],all_triangles=True)
    bow=set(np.load(W+'probe/bow_tail_vidx.npy').tolist())
    dg=bpy.context.evaluated_depsgraph_get(); dg.update(); best={}
    for n in (P.BODY,P.DRESS,P.APRON):
        o=bpy.data.objects[n]
        for m in o.modifiers:
            if m.type=='SOLIDIFY': m.show_viewport=False
        dg.update(); oe=o.evaluated_get(dg); mm=oe.to_mesh(); mm.calc_loop_triangles()
        co=[o.matrix_world@v.co for v in mm.vertices]
        tris=[list(t.vertices) for t in mm.loop_triangles if not (n==P.BODY and any(i in bow for i in t.vertices))]
        def hit(dz):
            B=BVHTree.FromPolygons([c+Vector((0,0,dz)) for c in co],tris,all_triangles=True); return len(B.overlap(CT))>0
        lo,hi=-0.10,0.15
        if not hit(lo): best[n]=-lo
        elif hit(hi): best[n]=-hi
        else:
            for _ in range(18):
                mid=(lo+hi)/2
                if hit(mid): lo=mid
                else: hi=mid
            best[n]=-hi
        oe.to_mesh_clear()
        for m in o.modifiers:
            if m.type=='SOLIDIFY': m.show_viewport=True
    return best
def back_clear(zroot):
    """signed clearance (m) of body (incl. hat/hair-boundary, bow tails excluded) + hair to the REAL backrest mesh"""
    P.reset(); P.apply_list(P.SIT); P.set_sk(1.0); set_root(seat_root+Vector((0,0,zroot)),CFG['yaw_seat'])
    ch=bpy.data.objects['CHAIR_REAL_reading_chair']; me=ch.data; me.calc_loop_triangles(); Mi=ch.matrix_world.inverted()
    tris=[t for t in me.loop_triangles if (lambda c:(c.y>0.17 and c.z>0.40))(sum((me.vertices[i].co for i in t.vertices),Vector())/3)]
    BT=BVHTree.FromPolygons([ch.matrix_world@v.co for v in me.vertices],[list(t.vertices) for t in tris],all_triangles=True)
    bow=set(np.load(W+'probe/bow_tail_vidx.npy').tolist()); dg=bpy.context.evaluated_depsgraph_get(); dg.update(); best=1e9
    for n in (P.BODY,P.HAIR):
        o=bpy.data.objects[n]; oe=o.evaluated_get(dg); mm=oe.to_mesh(); used=set(i for p in mm.polygons for i in p.vertices)
        for v in mm.vertices:
            if v.index not in used or (n==P.BODY and v.index in bow): continue
            c=o.matrix_world@v.co; l=Mi@c
            if l.y>0.0 and c.z>0.42:
                cp,nr,fi,d=BT.find_nearest(c,0.3)
                if cp is not None: best=min(best,d*(1 if (c-cp).dot(nr)>=0 else -1))
        oe.to_mesh_clear()
    return best
# v2: sitting root derived from REAL seat (z), backrest (horizontal, 5 mm clearance) and floor (feet by IK) contacts; delta vs R24 reported
R24_SEAT=seat_root.copy(); FITLOG=[]
for it in range(3):
    GAPS=seat_fit(); zr=-0.609*CS-(GAPS[P.BODY]-0.001)
    bc_=back_clear(zr); FITLOG.append({'iter':it,'seat_root':list(seat_root),'body_seat_gap_mm':GAPS[P.BODY]*1000,'back_clear_mm':bc_*1000})
    if abs(bc_-0.005)<0.0005: break
    seat_root=seat_root+RS@Vector((0,bc_-0.005,0))
GAPS=seat_fit(); CFG['seat_fit_log']=FITLOG; CFG['seat_back_clearance_target_mm']=5.0
CFG['seated_root_derived_xy']=[seat_root.x,seat_root.y]; CFG['seated_root_delta_vs_R24_mm']=(seat_root-R24_SEAT).length*1000
CFG['seated_root_delta_vs_R24_along_chair_forward_mm']=-(RS.inverted()@(seat_root-R24_SEAT)).y*1000
for s_ in 'LR':
    p=seat_root+RS@Vector((SIT_ANK[s_].x,SIT_ANK[s_].y,0)); p.z=ground(p.x,p.y)+REST_ANK[s_].z; ANK_W[s_]=p
CFG['seat_gaps_at_pass2b_root_mm']={k:round(v*1000,2) for k,v in GAPS.items()}
CFG['seat_drop']=-(GAPS[P.BODY]-0.001)   # v4b: fit the BODY (bow tails excluded) to the real seat with 1 mm clearance; garment gaps reported (fitting to the dress made the body hover ~30 mm)
SITZ=-0.609*CS+CFG['seat_drop']; CFG['pass2b_sit_root_z_scaled']=-0.609*CS
stand_root=Vector((*CFG['standing_root_xy'],0.0))
ANK_SIT=ANK_W; ANK_ST={}
for s in 'LR':
    p=stand_root+RS@Vector((REST_ANK[s].x,REST_ANK[s].y,0)); p.z=ground(p.x,p.y)+REST_ANK[s].z; ANK_ST[s]=p
TUCK={'L':(5,20),'R':(12,27)}   # feet tucked back under the knees before rising (lands stand end exactly on standingRoot)
log={'cfg':CFG,'ankles_world':{s:list(ANK_W[s]) for s in 'LR'},'stand_root':list(stand_root),'tuck_mm':{s:(ANK_ST[s]-ANK_SIT[s]).length*1000 for s in 'LR'},'ground_under_feet':{s:ground(ANK_W[s].x,ANK_W[s].y) for s in 'LR'}}
def two_bone(b1,b2,target,pole):
    p1=a.pose.bones[b1]; p2=a.pose.bones[b2]; P.upd(); H=p1.matrix.to_translation(); L1=(p1.tail-H).length; L2=(p2.tail-p2.matrix.to_translation()).length
    d=Vector(target)-H; D=min(d.length,L1+L2-1e-5); u=d.normalized(); x=(L1*L1-L2*L2+D*D)/(2*D); hg=math.sqrt(max(0,L1*L1-x*x))
    kd=Vector(pole); kd=(kd-u*kd.dot(u)).normalized(); mid=H+u*x+kd*hg
    P.aim_bone(b1,mid,a); P.aim_bone(b2,H+u*D,a); return (Vector(target)-(H+u*D)).length
HANDS={'L':('upper_arm.L','forearm.L','hand.L','thigh.L','chest'),'R':('upper_arm.R','forearm.R','hand.R','thigh.R','chest')}
HAND_REF={}
def capture_hand_ref():
    """at stand f0: hand position/orientation in its thigh's frame, elbow pole in the chest frame (keeps the sit-pose elbow line: no outward push)"""
    P.upd()
    for s,(ua,fa,hd,th,ch) in HANDS.items():
        Mt=a.pose.bones[th].matrix.copy(); Mh=a.pose.bones[hd].matrix.copy(); Mc=a.pose.bones[ch].matrix.copy()
        sh=a.pose.bones[ua].matrix.to_translation(); el=a.pose.bones[fa].matrix.to_translation(); wr=Mh.to_translation()
        ax=(wr-sh).normalized(); pole=(el-sh)-ax*(el-sh).dot(ax)
        HAND_REF[s]=dict(h=Mt.inverted()@wr, R=(Mt.to_3x3().inverted()@Mh.to_3x3()), pole=Mc.to_3x3().inverted()@pole)
HAND_ERR=[0.0]
def hand_on_thigh(f,hold):
    if hold<=0 or not HAND_REF: return
    for s,(ua,fa,hd,th,ch) in HANDS.items():
        A={b:a.pose.bones[b].matrix_basis.copy() for b in (ua,fa,hd)}
        P.upd(); Mt=a.pose.bones[th].matrix.copy(); Mc=a.pose.bones[ch].matrix.copy(); r=HAND_REF[s]
        hl=r['h'].copy(); kn=a.pose.bones[th].length*0.82; hl.y=hl.y+(max(hl.y,kn)-hl.y)*seg(f,15,40)   # v2: hands slide from mid-thigh toward the knees to push off (R24 timing f10-40)
        ax=Vector((0,1,0)); radial=(hl-ax*hl.dot(ax)); nrm=Mt.to_3x3()@radial.normalized()   # thigh surface normal under the hand (bone Y = thigh axis)
        tgt=Mt@hl+Vector((0,0,HAND_LIFT*seg(f,10,24)))+nrm*(HAND_OFF*seg(f,44,58))
        e=two_bone(ua,fa,tgt,Mc.to_3x3()@r['pole'])
        pb=a.pose.bones[hd]; P.upd(); hh=pb.matrix.to_translation(); pb.matrix=Matrix.Translation(hh)@(Mt.to_3x3()@r['R']).to_4x4(); P.upd()
        if hold>=0.999: HAND_ERR[0]=max(HAND_ERR[0],e)
        B={b:a.pose.bones[b].matrix_basis.copy() for b in (ua,fa,hd)}
        for b in (ua,fa,hd): a.pose.bones[b].matrix_basis=qlerp(A[b],B[b],hold)
    P.upd()
def pose_stand(f):
    """f: 0..90 (3.0 s @30fps, R24 rise timing; all motion ends by f84, f84-90 static rest on standingRoot)"""
    for b,M in REST.items(): a.pose.bones[b].matrix_basis=M.copy()
    # phases
    lean=seg(f,15,42)*(1-seg(f,58,86))          # torso pitch envelope
    armw=seg(f,52,100)   # v2: crosses the clip boundary (continues 10 frames into cine_open_turn) - no rest at the stand end                            # v2: arms go to rest only after the hands have lifted off the thighs
    hold=1-seg(f,58,74)                          # v2: hands planted on the thighs (push off from the knees), lift off along the thigh normal f44-58, then release
    yprog=ease(r24_prog(min(3.0,f/30.0)))        # v2: R24 controller progress over the full 3.0 s (no rest hold; continuous into the turn)
    zprog=seg(f,30,86)                           # hips up
    rise=zprog
    w=zprog                                      # skirt/shape-key release follows hip height (v1 released early -> hem hit floor f34-37)
    fwd=RS@Vector((0,-1,0))
    pos=seat_root+(stand_root-seat_root)*yprog+Vector((0,0,SITZ*(1-zprog)))
    # bones
    for b in SKIRT: a.pose.bones[b].matrix_basis=qlerp(SIT[b],REST[b],w)
    for b in ARMS: a.pose.bones[b].matrix_basis=qlerp(SIT[b],REST[b],armw)
    a.pose.bones['spine'].matrix_basis=qlerp(SIT['spine'],REST['spine'],seg(f,30,80))
    set_root(pos,CFG['yaw_seat'])
    side_ax=RS@Vector((1,0,0))
    rot_axis('forearm.L',side_ax,-ARMFIX*lean); rot_axis('forearm.R',side_ax,-ARMFIX*lean)
    rot_axis('hips',side_ax,26*lean); rot_axis('spine',side_ax,10*lean); rot_axis('chest',side_ax,5*lean); rot_axis('neck',side_ax,-14*lean); rot_axis('head',side_ax,-12*lean)
    errs=[]; tk={}
    for s in 'LR':
        t0,t1=TUCK[s]; u=seg(f,t0,t1); lift=0.02*math.sin(math.pi*min(1,max(0,(f-t0)/(t1-t0))))
        tgt=ANK_SIT[s].lerp(ANK_ST[s],u)+Vector((0,0,lift)); errs.append(foot_place(s,tgt,CFG['yaw_seat'])); tk[s]=not (t0<f<t1)
    # v2e: no FK blend of the legs to REST at the stand end (v2d: that blend dipped the soles up to 1.19 mm under the floor f79-84).
    # Legs stay on foot IK to f90; targets at f90 == turn f0 targets (foot_target(s,yaw_seat,0)), so the clip boundary is continuous.
    P.upd()
    hand_on_thigh(f,hold)
    P.set_sk(1-w)
    return pos,errs,dict(hold=hold,lean=lean,rise=rise,skirt=w,arms=armw,yprog=yprog,zprog=zprog,contact=tk)
# turn: yaw seat -> toward walkEndRoot (game -0.0917,-2.8849 -> blender (-0.0917, 2.8849))
walk_end=Vector((-0.09167675807680428,2.884915363629018,0))
yaw_end=CFG['yaw_walk']  # CharacterReference.walkYawRad (game yaw == blender Z rot)
d=walk_end-stand_root; log['yaw_to_walkEnd_from_standingRoot']=math.atan2(d.x,-d.y)
log['yaw_end']=yaw_end; log['turn_deg']=math.degrees(yaw_end-CFG['yaw_seat'])
FOOT_LOCAL={s:Vector((REST_ANK[s].x,REST_ANK[s].y,0)) for s in 'LR'}
def foot_target(s,yaw,fr=1.0):
    out=Vector((math.copysign(STEP_WIDTH*math.sin(math.pi*min(1,max(0,fr))),FOOT_LOCAL[s].x),0,0))   # v2: feet open slightly mid-turn (0 at start/end)
    p=stand_root+Matrix.Rotation(yaw,3,'Z')@(FOOT_LOCAL[s]+out); p.z=ground(p.x,p.y)+REST_ANK[s].z; return p
STEPS=[('R',2,12,0.0,0.4),('L',12,22,0.0,0.7),('R',22,33,0.4,1.0),('L',33,43,0.7,1.0)]  # v2: anatomical LEFT foot (= bone foot.R, +X side) opens first for a left turn; v1 stepped foot.L (anatomical right) first = crossover, toes clashed  # v3b: 4 sequential steps, feet stay within ~25deg of body yaw (v3a 3-step pattern crossed thighs f8-31)  # (side, f0,f1, from frac, to frac of turn)
def pose_turn(f):
    for b,M in REST.items(): a.pose.bones[b].matrix_basis=M.copy()
    for b in ARMS: a.pose.bones[b].matrix_basis=qlerp(SIT[b],REST[b],seg(90+f,52,100))   # continuous with cine_open_stand
    y0=CFG['yaw_seat']; Y=yaw_end-y0
    u=(r24(3.0+f/30.0)[1]-y0)/Y; yaw=y0+Y*ease(u)   # R24 yaw curve 3-4.5 s, eased end
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
        fy=y0+Y*fr; t=foot_target(s,fy,fr)+Vector((0,0,lift))
        errs.append(foot_place(s,t,fy)); contact[s]=planted
    bl=seg(f,42,45)
    for b in ['thigh.L','shin.L','foot.L','thigh.R','shin.R','foot.R']: a.pose.bones[b].matrix_basis=qlerp(a.pose.bones[b].matrix_basis.copy(),REST[b],bl)
    P.upd()
    # skirt inertia: small lag twist about vertical, bounded 4 deg
    vel=(ease((r24(3+(f+1)/30)[1]-y0)/Y)-ease((r24(3+(f-1)/30)[1]-y0)/Y))/2*Y*30 if 0<f<45 else 0.0   # rad/s
    for b in ['skirt.front','skirt.back','skirt.left','skirt.right']:
        rot_axis(b,(0,0,1),-math.degrees(0.06*vel))
    P.set_sk(0)
    return yaw,errs,contact
def bake(name,n,fn):
    # v3 fix: mute every existing NLA track while baking. Assigning a new action re-tags animation and the first
    # P.upd() re-evaluated the previous clip's track at frame 0 -> turn f0 was keyed with the SIT pose (v1/v2 bug).
    prev=[]
    for h in [a]+[bpy.data.objects[on].data.shape_keys for on in (P.DRESS,P.APRON)]:
        if h.animation_data:
            for t in h.animation_data.nla_tracks: prev.append((t,t.mute)); t.mute=True
    P.upd()
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
    for t,m in prev: t.mute=m
    return info
# mute old pass2 loops so they don't export under these names
for t in a.animation_data.nla_tracks: t.mute=True
HAND_REF.clear(); pose_stand(0); capture_hand_ref()
si=bake('cine_open_stand',CFG['stand_frames'],pose_stand)
ti=bake('cine_open_turn',CFG['turn_frames'],pose_turn)
# v2 safe stop poses for skip (single-frame clips; clean, on anchor). M1 provisional: opening ends at the turn end until M3 adds the walk/out clips.
def pose_open_safe(f):
    for b,M in REST.items(): a.pose.bones[b].matrix_basis=M.copy()
    set_root(stand_root,yaw_end); P.set_sk(0); return (stand_root,[0,0],{})
def pose_home_safe(f):
    r=pose_stand(0); return r
oi=bake('cine_open_safe_end',0,pose_open_safe)
hi=bake('cine_home_safe_end',0,pose_home_safe)
log['hand_ik_err_mm_max_while_planted']=HAND_ERR[0]*1000
log['stand_foot_ik_err_mm_max']=max(max(e) for _,e,_ in si)*1000
log['turn_foot_ik_err_mm_max']=max(max(e) for _,e,_ in ti)*1000
log['stand_root_frames']=[[round(x,5) for x in p] for p,_,_ in si]
log['stand_phase']=[ph for _,_,ph in si]
log['turn']=[{'yaw':y,'contact':c} for y,_,c in ti]
json.dump(log,open(W+'probe/anim_build_log.json','w'),indent=1)
sc.frame_start=0; sc.frame_end=CFG['stand_frames']
bpy.ops.wm.save_as_mainfile(filepath=W+'scene/cine_m1_anim.blend')
print('DONE',json.dumps({k:log[k] for k in ['stand_root','yaw_end','turn_deg','stand_foot_ik_err_mm_max','turn_foot_ik_err_mm_max','ground_under_feet']}))
