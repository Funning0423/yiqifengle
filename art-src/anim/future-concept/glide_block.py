import bpy, math, json
from mathutils import Vector, Quaternion, Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspace/yiqifengle/previews/角色动画bot/planB-verify/cand3/planB_cand3b_ribbonwind4b_stepdown.glb")
sc=bpy.context.scene; sc.render.fps=30; sc.frame_start=0; sc.frame_end=125
for o in bpy.data.objects:
    if o.name=="Icosphere": o.hide_render=True; o.hide_viewport=True
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
if arm.animation_data: arm.animation_data.action=None
for o in bpy.data.objects:
    if o.type=='MESH' and o.animation_data: o.animation_data.action=None
P=arm.pose.bones
def ss(t): t=max(0,min(1,t)); return t*t*(3-2*t)
def track(keys,f):
    # keys: list (frame,value) smoothstep between
    if f<=keys[0][0]: return keys[0][1]
    for (f0,v0),(f1,v1) in zip(keys,keys[1:]):
        if f<=f1:
            s=ss((f-f0)/(f1-f0))
            if isinstance(v0,(tuple,list)): return tuple(a+(b-a)*s for a,b in zip(v0,v1))
            return v0+(v1-v0)*s
    return keys[-1][1]
# --- 轨迹设计 (前进方向 -Y, 30fps) ---
# 0-10 站立; 10-20 预备下蹲+前倾; 20-26 蹬伸; 右脚 f24 离地, 左脚 f27 离地
# 27-82 滑翔(先升后缓降); 82 左脚着地(脚跟), 86 右脚着地; 86-96 缓冲; 96-125 恢复站立
hipY=[(0,0),(10,0),(20,-0.06),(27,-0.20),(40,-0.70),(78,-3.10),(84,-3.36),(90,-3.48),(100,-3.53),(118,-3.55)]
hipZ=[(0,1.03),(10,1.03),(20,0.92),(25,0.97),(32,1.20),(55,1.40),(76,1.10),(84,0.97),(90,0.89),(97,0.87),(118,1.02),(125,1.03)]
lean=[(0,0),(10,0),(20,14),(26,22),(35,30),(75,28),(84,10),(94,14),(115,2),(125,0)]
# 脚: 支撑期固定世界坐标; 空中相对髋
FL0=Vector((-0.065,0.02,0.081)); FR0=Vector((0.065,0.02,0.081))
LAND_L=Vector((-0.07,-3.42,0.081)); LAND_R=Vector((0.07,-3.58,0.081))
def foot(side,f,hy,hz):
    x=-0.065 if side=='L' else 0.065
    # 空中相对髋: 腿微屈,一前一后(左前右后)
    air=Vector((x*1.05, hy+(-0.10 if side=='L' else 0.22), hz-0.80 if side=='L' else hz-0.74))
    off,on=(25,84) if side=='L' else (23,87)
    start=FL0 if side=='L' else FR0; end=LAND_L if side=='L' else LAND_R
    if f<=off: return start.copy(), True
    if f>=on: return end.copy(), True
    a=ss((f-off)/10.0); b=ss((on-f)/10.0)
    p=start.lerp(air,a) if f<off+10 else air
    if f>on-10: p=end.lerp(air,b)
    return p, False
tgt={}
for s in 'LR':
    e=bpy.data.objects.new("ikT"+s,None); sc.collection.objects.link(e); tgt[s]=e
    pl=bpy.data.objects.new("pole"+s,None); sc.collection.objects.link(pl); tgt['p'+s]=pl
    c=P['shin.'+s].constraints.new('IK'); c.target=e; c.pole_target=pl; c.chain_count=2; c.pole_angle=-math.pi/2
def rotw(pb,axis,deg):
    mr=pb.bone.matrix_local.to_quaternion()
    qw=Quaternion(axis,math.radians(deg))
    return mr.inverted()@qw@mr
X=Vector((1,0,0));Y=Vector((0,1,0));Z=Vector((0,0,1))
for pb in P: pb.rotation_mode='QUATERNION'
log=[]
for f in range(0,126):
    sc.frame_set(f)
    hy=track(hipY,f); hz=track(hipZ,f); ln=track(lean,f)
    P['root'].location=(0,0,0)
    # hips 平移: 骨骼局部 -> 直接用 world 偏移转换
    hb=P['hips']; mr=hb.bone.matrix_local.to_3x3()
    hb.location=mr.inverted()@Vector((0,hy,hz-1.058))
    hb.rotation_quaternion=rotw(hb,X,ln*0.35)
    P['spine'].rotation_quaternion=rotw(P['spine'],X,ln*0.4)
    P['chest'].rotation_quaternion=rotw(P['chest'],X,ln*0.25)
    P['neck'].rotation_quaternion=rotw(P['neck'],X,-ln*0.45)
    P['head'].rotation_quaternion=rotw(P['head'],X,-ln*0.35)
    air=ss((f-24)/10)*ss((86-f)/8)
    crouch=ss((f-10)/10)*ss((26-f)/6)+ss((f-84)/6)*ss((112-f)/16)
    # 手臂: 预备后摆→蹬伸前摆→空中略后下、小外展(<=14°)保持体侧,不外张; 落地前送平衡
    sw=track([(0,0),(10,0),(20,22),(26,-28),(34,10),(78,10),(84,-12),(92,6),(118,0)],f)
    ab=6+8*air
    for s,sg in (('L',1),('R',-1)):
        ua=P['upper_arm.'+s]
        ua.rotation_quaternion=rotw(ua,Y,sg*ab)@rotw(ua,X,sw)
        P['forearm.'+s].rotation_quaternion=rotw(P['forearm.'+s],X,-(12+10*air+8*crouch))
        P['hand.'+s].rotation_quaternion=Quaternion()  # 不扭腕
    # 风: 前进相对风从前方来 → 裙摆后飘, 飘带后拖
    w=air*(1+0.15*math.sin(f*0.9))
    P['skirt.back'].rotation_quaternion=rotw(P['skirt.back'],X,-14*w)
    P['skirt.back.low'].rotation_quaternion=rotw(P['skirt.back.low'],X,-18*w)
    P['ribbon'].rotation_quaternion=rotw(P['ribbon'],X,-(10+35*air)+6*math.sin(f*1.3)*air)
    for s in 'LR':
        p,planted=foot(s,f,hy,hz)
        tgt[s].location=p; tgt[s].keyframe_insert('location',frame=f)
        tgt['p'+s].location=(p.x,hy-1.0,hz-0.45); tgt['p'+s].keyframe_insert('location',frame=f)
        # 脚掌: 起跳脚尖蹬地, 空中脚尖自然下垂, 着地脚跟先
        fp=0
        if s=='R': fp=track([(0,0),(18,0),(24,35),(30,25),(78,25),(85,-10),(89,0)],f)
        else: fp=track([(0,0),(21,0),(27,35),(33,25),(76,20),(81,-12),(85,0)],f)
        P['foot.'+s].rotation_quaternion=rotw(P['foot.'+s],X,fp)
    for pb in P:
        pb.keyframe_insert('rotation_quaternion',frame=f); pb.keyframe_insert('location',frame=f)
# 测量
dg=bpy.context.evaluated_depsgraph_get()
res=[];prev={}
for f in range(0,126):
    sc.frame_set(f)
    row={'f':f}
    for s in 'LR':
        pb=arm.pose.bones['shin.'+s]; th=arm.pose.bones['thigh.'+s]
        a=(arm.matrix_world@pb.tail); 
        v1=(th.tail-th.head).normalized(); v2=(pb.tail-pb.head).normalized()
        row['knee'+s]=round(math.degrees(v1.angle(v2)),1)
        ft=arm.pose.bones['foot.'+s]
        toe=arm.matrix_world@ft.tail
        row['ank'+s]=[round(c,4) for c in a]; row['toe'+s+'z']=round(toe.z,3)
    res.append(row)
json.dump(res,open('glide_metrics.json','w'),indent=0)
# 场景
bpy.ops.mesh.primitive_plane_add(size=12,location=(0,-2,-0.03))
g=bpy.context.object; m=bpy.data.materials.new("g"); m.diffuse_color=(0.55,0.68,0.5,1); g.data.materials.append(m)
cam=bpy.data.objects.new("cam",bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera=cam
cam.data.lens=35
for f in range(0,126):
    hy=track(hipY,f); cam.location=(5.2,hy-0.6,1.5); 
    d=Vector((0,hy,1.0))-cam.location; cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    cam.keyframe_insert('location',frame=f); cam.keyframe_insert('rotation_euler',frame=f)
sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='MATERIAL'
sc.display.shading.show_shadows=True
sc.render.resolution_x=960; sc.render.resolution_y=540
sc.render.filepath='//frames/f_'
sc.render.image_settings.file_format='PNG'
sc.render.use_stamp=True; sc.render.use_stamp_frame=True; sc.render.use_stamp_date=False;sc.render.use_stamp_time=False;sc.render.use_stamp_render_time=False;sc.render.use_stamp_camera=False;sc.render.use_stamp_filename=False;sc.render.use_stamp_scene=False
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('/workspace/yiqifengle/previews/角色动画bot/future-scenes/glide_concept.blend'))
bpy.ops.render.render(animation=True)
