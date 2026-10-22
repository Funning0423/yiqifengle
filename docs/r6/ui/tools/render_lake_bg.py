# 湖畔棋盘背景：基线 55368056 的 region_lakeside 资源（scene_r5h_slim_transforms.json 的 431 个运行时实例，跳过方式同 lakeside-scene.cjs），
# 游戏棋盘相机 = LakesideCameraLayout.lakesideAlignedLookAt(390x844 刘海+胶囊)：pos (2.94478,3.58,31.16376) target (0.01685,-0.55607,12.10968) 竖直 FOV 57.3526°
# 光照 = r5h3 交接 §5（4 盏太阳，方向 = 光线前进方向，Y-up）+ AgX Punchy 曝光 +0.32；天空 = 运行时 clearColor。MODE=night 用 LAKESIDE_NIGHT_LIGHT_PARAMS。
# blender -b -P render_lake_bg.py -- REPO OUT.png [W H]
import bpy, json, sys, math, os
from mathutils import Matrix, Vector, Quaternion
a=sys.argv[sys.argv.index('--')+1:]; REPO=a[0]; OUT=a[1]; W=int(a[2]) if len(a)>2 else 780; H=int(a[3]) if len(a)>3 else 1688
MODE=os.environ.get('MODE','day'); B=REPO+'/creator-build-project/assets/bundles/region_lakeside/'
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));Ci=C.inverted()
def g2b(p):return Vector((p[0],-p[2],p[1]))
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def imp(p):
    b=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=p);return [o for o in bpy.data.objects if o not in b]
T=json.load(open(B+'scene_r5h_slim_transforms.json')); SKIP=('LK_board_frame.glb','LK_contact_shadow.glb','LK_ripple_ring.glb')
lib={}; hold=bpy.data.collections.new('lib'); sc.collection.children.link(hold); n=0
for ins in T['instances']:
    g=ins.get('glb')
    if not isinstance(g,str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name')==g.replace('.glb',''): continue
    if g not in lib:
        objs=imp(B+'models/'+g)
        for o in objs:
            for c in list(o.users_collection): c.objects.unlink(o)
            hold.objects.link(o)
        lib[g]=[(o.data,o.matrix_world.copy()) for o in objs if o.type=='MESH']
    x,y,z,w=ins['rot_quat_xyzw']; q=Quaternion((w,x,y,z)).to_matrix().to_4x4(); M=Matrix.Translation(ins['pos'])@q@Matrix.Diagonal((*ins['scale'],1))
    for data,mw in lib[g]:
        o=bpy.data.objects.new(ins['name'],data); sc.collection.objects.link(o); o.matrix_world=C@M@Ci@mw
    n+=1
hold.hide_render=True; print('INSTANCES',n)
# LK_shore_foam 在运行时走 ShoreFoamCore 自己的半透明泡沫着色器；Blender 导入后是不透明噪点贴图，会在近景水面盖一条像素带，这里不渲（参考图里同样看不到）
for o in sc.collection.objects:
    if o.name.startswith('LK_shore_foam'): o.hide_render=True
# 草簇/芦苇卡片的 alpha 贴图：Blender 导入后默认不透明会变成像素块，按运行时（alpha test）改成 clip
for m in bpy.data.materials:
    if m.use_nodes:
        try: m.blend_method='CLIP'
        except Exception: pass
def sun(name,fwd,col,e,ang):
    L=bpy.data.lights.new(name,'SUN'); L.energy=e; L.color=col; L.angle=math.radians(ang)
    o=bpy.data.objects.new(name,L); sc.collection.objects.link(o); o.rotation_mode='QUATERNION'; o.rotation_quaternion=g2b(fwd).normalized().to_track_quat('-Z','Y')
if MODE=='day':
    sun('Sun',[-0.4182,-0.3983,0.8164],(1.0,0.6,0.32),7.2,1.2)
    sun('Sun.001',[0.5014,-0.6217,-0.6017],(0.212,0.631,0.745),0.55,0.53)
    sun('SUN_dusk_side',[-0.9629,-0.223,0.152],(1.0,0.55,0.28),2.2,1.72)
    sky=(0.0116,0.2747,0.4793); amb=float(os.environ.get('AMB','1.0'))
else:
    sun('Moon',[-0.4182,-0.3983,0.8164],(0.36,0.46,0.78),float(os.environ.get('MOON','2.2')),1.2)
    sky=(0.0114,0.0203,0.0513); amb=float(os.environ.get('AMB','0.6'))
# 世界：照明 = 运行时半球环境光（上 = sky、下 = ground，r5h3 线性色）；镜头直接看到的天空 = 地平线暖、天顶冷的渐变（r5h3 world ramp 的近似）
GROUND=(1.0,0.5457,0.1441) if MODE=='day' else (0.02,0.022,0.04)
HOR=(1.0,0.62,0.42) if MODE=='day' else (0.03,0.05,0.10); ZEN=(0.30,0.36,0.52) if MODE=='day' else (0.011,0.02,0.051)
wd=bpy.data.worlds.new('w'); sc.world=wd; wd.use_nodes=True; nt=wd.node_tree; N=nt.nodes; Lk=nt.links
bg=N['Background']; out=N['World Output']
tc=N.new('ShaderNodeTexCoord'); sep=N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Generated'],sep.inputs[0])
def ramp(c0,c1,lo,hi):
    m=N.new('ShaderNodeMapRange'); m.inputs['From Min'].default_value=lo; m.inputs['From Max'].default_value=hi; Lk.new(sep.outputs['Z'],m.inputs['Value'])
    mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.inputs[6].default_value=(*c0,1); mx.inputs[7].default_value=(*c1,1); Lk.new(m.outputs[0],mx.inputs[0]); return mx
lit=ramp(GROUND,sky,-0.3,0.3); see=ramp(HOR,ZEN,0.0,0.45)
b2=N.new('ShaderNodeBackground'); b2.inputs[1].default_value=float(os.environ.get('SKYSEE','1.0')); Lk.new(see.outputs[2],b2.inputs[0])
Lk.new(lit.outputs[2],bg.inputs[0]); bg.inputs[1].default_value=amb
lp=N.new('ShaderNodeLightPath'); ms=N.new('ShaderNodeMixShader'); Lk.new(lp.outputs['Is Camera Ray'],ms.inputs[0]); Lk.new(bg.outputs[0],ms.inputs[1]); Lk.new(b2.outputs[0],ms.inputs[2]); Lk.new(ms.outputs[0],out.inputs[0])
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.eevee.taa_render_samples=int(os.environ.get('SAMPLES','24'))
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Punchy'; sc.view_settings.exposure=float(os.environ.get('EXPO','0.32'))
cd=bpy.data.cameras.new('cam'); cd.sensor_fit='VERTICAL'; cd.angle=math.radians(57.35256446956713); cd.clip_start=0.1; cd.clip_end=1000
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
p=g2b([2.9447784998228568,3.58,31.16376380032755]); t=g2b([0.016853639386563035,-0.5560677406073884,12.109678593619002])
cam.location=p; cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=(t-p).normalized().to_track_quat('-Z','Y')
sc.render.resolution_x=W; sc.render.resolution_y=H; sc.render.resolution_percentage=100
sc.render.filepath=OUT; bpy.ops.render.render(write_still=True); print('RENDERED',OUT)
