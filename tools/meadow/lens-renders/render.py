import bpy,math,json,sys,os,mathutils
# 运镜bot: Blender Cycles textured renders for tools/meadow/lens-renders/shots.cjs. blender -b -P render.py (env OUT, REPO)
W=os.environ.get('REPO','.')+'/creator-build-project/assets/bundles/';OUT=os.environ['OUT']+'/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=W+'region_meadow/env_meadow.glb')
pre=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=W+'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
her=[o for o in bpy.data.objects if o not in pre and o.parent is None]
for o in bpy.data.objects:
  if o.type in('CAMERA','LIGHT'):o.hide_render=True
G=lambda p:mathutils.Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=12;sc.cycles.use_denoising=True
sc.render.resolution_x=390;sc.render.resolution_y=844;sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;bg=w.node_tree.nodes['Background'];bg.inputs[0].default_value=(0.55,0.75,0.95,1);bg.inputs[1].default_value=0.8
sun=bpy.data.lights.new('sun','SUN');sun.energy=3.4;sun.color=(1,0.94,0.82);so=bpy.data.objects.new('sun',sun);sc.collection.objects.link(so);so.rotation_euler=(-G((-0.55,0.62,0.55)).normalized()).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('c');cam.sensor_fit='VERTICAL';cam.clip_start=0.05;cam.clip_end=900;co=bpy.data.objects.new('cam',cam);sc.collection.objects.link(co);sc.camera=co
for a in bpy.data.actions:
  if 'idle' in a.name.lower():
    for o in her:
      if o.type=='ARMATURE':o.animation_data_create();o.animation_data.action=a
    break
J=json.load(open(OUT+'shots.json'))
for k,v in J.items():
  for o in her:o.location=G(v['her']);o.rotation_euler=(0,0,math.radians(v.get('yaw',0)))
  sc.render.resolution_x=v['w'];sc.render.resolution_y=v['h']
  p=G(v['position']);t=G(v['target']);co.location=p;co.rotation_euler=(t-p).to_track_quat('-Z','Y').to_euler();cam.angle_y=math.radians(v['fov'])
  sc.render.filepath=OUT+'r/'+k+'.png';bpy.ops.render.render(write_still=True);print('SHOT',k)
