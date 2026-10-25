"""结局画面 3D 场景：打开湖畔原始场景 lakeside_r5h3.blend，放入游戏角色 glb，重设机位，渲染。
用法: blender -b lakeside_r5h3.blend -P render_ending_scene.py -- <out_dir> <w> <h> <night 0/1> <frames: 逗号分隔的摇摆相位 0..1 | 'still'> [cam参数 json]
"""
import bpy,sys,math,json,os
from mathutils import Vector,Euler
a=sys.argv[sys.argv.index('--')+1:];out=a[0];W=int(a[1]);H=int(a[2]);night=a[3]=='1';phases=a[4]
P=dict(cam=[-4.6,-5.2,1.15],look=[-7.6,4.0,3.3],lens=30,girl=[-7.05,0.55,None],girl_yaw=200,head_up=24,head_up_sign=-1,chime=[-8.4,2.2,4.4])
if len(a)>5:P.update(json.loads(a[5]))
sc=bpy.context.scene
sc.timeline_markers.clear()  # 原场景有按帧切机位的标记，清掉
CHAR='/workspace/wechat-game/work/post-island-ui/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'
# (d) 去掉画面边缘会被截到的晾衣绳等近景杂物；其他风铃/亭子保持原样
for o in bpy.data.objects:
  if o.type=='MESH' and (o.name.startswith(('LK_clothesline','LK_signpost')) or '_cell' in o.name or 'board' in o.name.lower() and 'boardwalk' not in o.name.lower()):o.hide_render=True
# 摄像机
cd=bpy.data.cameras.new('end');cd.lens=P['lens'];cd.sensor_fit='VERTICAL';cd.sensor_height=24;cd.clip_end=1000
cam=bpy.data.objects.new('CAM_ending',cd);sc.collection.objects.link(cam);sc.camera=cam
cam.location=Vector(P['cam']);cam.rotation_euler=(Vector(P['look'])-cam.location).to_track_quat('-Z','Y').to_euler()
# 角色：地面高度用射线求
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=CHAR);new=[o for o in bpy.data.objects if o not in before]
root=[o for o in new if o.parent is None][0];arm=[o for o in new if o.type=='ARMATURE'][0]
for o in new:
  if o.name.startswith('Icosphere'):o.hide_render=True
gx,gy=P['girl'][0],P['girl'][1];dg=bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
  if o.type=='MESH' and P.get('clear') and not o.hide_render and o.name.endswith(tuple('_i'+s for s in ('','.001','.002','.003','.004','.005','.006','.007','.008','.009'))) is False: pass
TER=bpy.data.objects['LK_terrain_i']
def terrain_z(x,y):
  mi=TER.matrix_world.inverted();o=mi@Vector((x,y,50));d=(mi.to_3x3()@Vector((0,0,-1))).normalized()
  ok,loc,_,_=TER.ray_cast(o,d);return (TER.matrix_world@loc).z if ok else 0.55
gz=terrain_z(gx,gy)
holder=bpy.data.objects.new('girl_holder',None);sc.collection.objects.link(holder)
holder.location=(gx,gy,gz);holder.rotation_euler=(0,0,math.radians(P['girl_yaw']));root.parent=holder
act=bpy.data.actions.get('idle_breathing_loop') or bpy.data.actions.get('wind_flutter_loop')
arm.animation_data_create();arm.animation_data.action=act
if hasattr(arm.animation_data,'action_slot') and act.slots:arm.animation_data.action_slot=act.slots[0]
sc.frame_set(10)
# 把第 10 帧姿势定格（去掉动作，否则渲染时会被动作覆盖），再让头颈抬起仰望
basis={bn.name:bn.matrix_basis.copy() for bn in arm.pose.bones}
arm.animation_data.action=None
from mathutils import Quaternion
for bn in arm.pose.bones:
  bn.matrix_basis=basis[bn.name]
  if bn.name in ('neck','head','chest'):
    k={'chest':0.2,'neck':0.35,'head':0.45}[bn.name]
    bn.rotation_mode='QUATERNION';bn.rotation_quaternion=bn.rotation_quaternion@Quaternion((1,0,0),math.radians(P['head_up_sign']*P['head_up']*k))
for o in new:
  if o.type=='MESH':
    for p in o.data.polygons:p.use_smooth=False
# 把木架+风铃挪到湖岸开阔处（原位在村子里，背后是房子）
post=bpy.data.objects['LK_chime_post_i'];ch=bpy.data.objects['LK_windchime_i']
print('ANIM',ch.animation_data,ch.constraints[:],ch.parent)
ch.animation_data_clear();[ch.constraints.remove(c) for c in list(ch.constraints)]
def ground(x,y):return terrain_z(x,y)
if P.get('post'):
  px,py=P['post'];off=ch.location-post.location;yaw=math.radians(P.get('post_yaw',0))
  off=Vector((off.x*math.cos(yaw)-off.y*math.sin(yaw),off.x*math.sin(yaw)+off.y*math.cos(yaw),off.z))
  post.location=(px,py,ground(px,py));ch.location=post.location+off
  post.rotation_mode='XYZ';ch.rotation_mode='XYZ';post.rotation_euler.z+=yaw;ch.rotation_euler.z+=yaw
# 去掉立柱中段那块小木板（模型里的独立零件：z 1.05–1.75，贴在立柱 +y 面，从机位看像悬空）
if P.get('drop_plaque',True):
  import bmesh
  post.data=post.data.copy();bm=bmesh.new();bm.from_mesh(post.data)
  dead=[v for v in bm.verts if 1.0<v.co.z<1.8 and v.co.y>0.13]
  bmesh.ops.delete(bm,geom=dead,context='VERTS');bm.to_mesh(post.data);bm.free()
# 风铃：重新导入 LK_windchime.glb（场景里那只带原动画、渲染不出来），挂在木架横臂末端，绕挂点摇摆
ch.hide_render=True
bpy.context.view_layer.update()
pb=[post.matrix_world@Vector(c) for c in post.bound_box];ptop=max(v.z for v in pb)
yaw=math.radians(P.get('post_yaw',0));dirx=-math.cos(yaw);diry=-math.sin(yaw)   # 横臂原本朝 -x
arm_len=float(P.get('arm',1.15));hx=post.location.x+dirx*arm_len;hy=post.location.y+diry*arm_len
b4=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath='/workspace/wechat-game/work/post-island-ui/creator-build-project/assets/bundles/region_lakeside/models/LK_windchime.glb')
cn=[o for o in bpy.data.objects if o not in b4 and o.type=='MESH']
piv=bpy.data.objects.new('chime_pivot',None);sc.collection.objects.link(piv);piv.location=(hx,hy,ptop-0.12)
k=float(P.get('chime_scale',2.0))
for o in cn:
  for p in o.data.polygons:p.use_smooth=False
bpy.context.view_layer.update()
cb=[o.matrix_world@Vector(c) for o in cn for c in o.bound_box];ctop=max(v.z for v in cb);cx=sum(v.x for v in cb)/len(cb);cy=sum(v.y for v in cb)/len(cb)
for o in cn:
  if o.parent is None or o.parent not in cn:
    o.parent=piv;o.location=((o.location.x-cx)*k,(o.location.y-cy)*k,(o.location.z-ctop)*k);o.scale=tuple(v*k for v in o.scale)
# 夜间：压暗太阳、加暖色点光照风铃
if night:
  # 夜间光照：太阳改成冷色弱月光；天空换成纯渐变夜空（原天空贴图里有太阳盘，会在右上角留光斑）
  for o in bpy.data.objects:
    if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy*=0.10;o.data.color=(0.55,0.65,1.0);o.data.angle=0.05
  w=bpy.data.worlds.new('night');w.use_nodes=True;nt=w.node_tree;bgn=nt.nodes['Background']
  tc=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');ramp=nt.nodes.new('ShaderNodeValToRGB')
  nt.links.new(tc.outputs['Generated'],sep.inputs[0]);nt.links.new(sep.outputs['Z'],ramp.inputs['Fac'])
  ramp.color_ramp.elements[0].position=0.5;ramp.color_ramp.elements[0].color=(0.035,0.05,0.11,1)
  ramp.color_ramp.elements[1].position=0.75;ramp.color_ramp.elements[1].color=(0.008,0.014,0.04,1)
  fog=bpy.data.objects.get('FX_fog_volume')
  if fog:fog.hide_render=True   # 体积雾在逆光太阳方向散射出光斑，夜间关掉
  m=bpy.data.materials.get('M_LK_cloud_preview')
  if m and m.use_nodes:
    for n in m.node_tree.nodes:
      if n.type=='EMISSION':n.inputs['Strength'].default_value*=0.15
      if n.type=='BSDF_PRINCIPLED':
        n.inputs['Emission Strength'].default_value*=0.15 if 'Emission Strength' in n.inputs else 1
  nt.links.new(ramp.outputs['Color'],bgn.inputs['Color']);bgn.inputs['Strength'].default_value=1.0;sc.world=w
  ld=bpy.data.lights.new('chime_lamp','POINT');ld.energy=180;ld.color=(1,.78,.45);ld.shadow_soft_size=.6
  lo=bpy.data.objects.new('chime_lamp',ld);sc.collection.objects.link(lo);lo.location=(piv.location.x+.8,piv.location.y-1.4,piv.location.z-.8)
# 分层渲染：bg=场景（不含女孩和风铃）；girl=只有女孩；chime=只有风铃。分层后女孩可按屏幕尺寸重新摆位，风铃摇摆只需重渲小层
PASS=P.get('pass','all');girl_meshes=[o for o in new if o.type=='MESH']
if PASS=='bg':
  for o in girl_meshes+cn:o.hide_render=True
elif PASS in ('girl','chime'):
  keep=set(girl_meshes if PASS=='girl' else cn)
  for o in bpy.data.objects:
    if o.type=='MESH' and o not in keep:o.hide_render=True
  sc.render.film_transparent=True
sc.render.resolution_x=W;sc.render.resolution_y=H;sc.render.resolution_percentage=100
try:sc.eevee.taa_render_samples=int(P.get('samples',48))
except:pass
os.makedirs(out,exist_ok=True)
AMP=float(P.get('amp',4.0))  # 摇摆幅度（度）
ph=[None] if phases=='still' else [float(x) for x in phases.split(',')]
for i,p in enumerate(ph):
  ang=0 if p is None else AMP*math.sin(2*math.pi*p)
  piv.rotation_euler=(math.radians(ang)*0.35,math.radians(ang),0)   # 主摆沿 X 轴，少量前后
  sc.render.filepath=os.path.join(out,'still.png' if p is None else 'sway_%03d.png'%i)
  bpy.ops.render.render(write_still=True)
