# 草原棋盘背景（对比用）：基线 region_meadow/env_meadow.glb，相机 = MeadowSceneData PORTRAIT（meadowBoardCamera 'authored' 默认）
# pos (9,19,42) target (0.32747,5.50941,-15.81688) 竖直 FOV 49.4264°；GLB 自带灯光保留，补一盏暖白太阳 + 天空环境光（离线近似）
import bpy,sys,math
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; REPO,OUT=a[0],a[1]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=REPO+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb')
def g2b(p): return Vector((p[0],-p[2],p[1]))
L=bpy.data.lights.new('sun','SUN'); L.energy=3.0; L.color=(1,0.96,0.88); L.angle=math.radians(3)
o=bpy.data.objects.new('sun',L); sc.collection.objects.link(o); o.rotation_euler=(math.radians(50),0,math.radians(30))
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.55,0.72,0.92,1); bg.inputs[1].default_value=0.8
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.eevee.taa_render_samples=24; sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('c'); cd.sensor_fit='VERTICAL'; cd.angle=math.radians(49.42635311494791); cd.clip_end=3000
cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
p=g2b([9,19,42]); t=g2b([0.3274661665889038,5.509406509325702,-15.81687522999821]); cam.location=p; cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=(t-p).normalized().to_track_quat('-Z','Y')
for ob in list(sc.objects):
    if ob.type=='CAMERA' and ob!=cam: ob.hide_render=True
sc.render.resolution_x=780; sc.render.resolution_y=1688; sc.render.filepath=OUT; bpy.ops.render.render(write_still=True); print('RENDERED')
