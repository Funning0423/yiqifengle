# Board background "岛边": render the game's own island (region_island/combined_visual_m.glb) from the south beach.
# blender -b -P render_bg.py -- <out.png> [samples]
import bpy,math,sys
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; OUTP=a[0]; S=int(a[1]) if len(a)>1 else 64
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/棋盘UI美术bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
sc=bpy.context.scene
HIDE=('col_','collision','exit_','return_','fx_','env_lighthouse_beam','env_sky_moon','env_int','env_interior','interaction','interior_spawn','ref_girl','door_stand','entrance','Icosphere','env_window_blind','env_rear','env_chimney_smoke')
for o in sc.objects:
  if o.name.startswith(HIDE): o.hide_render=True
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=S; sc.cycles.use_denoising=True
sc.render.resolution_x=750; sc.render.resolution_y=1624
sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('sky'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.62,0.80,0.95,1); bg.inputs['Strength'].default_value=0.55
sd=bpy.data.lights.new('sun','SUN'); sd.energy=2.35; sd.angle=math.radians(8); sd.color=(1.0,0.97,0.92)
sun=bpy.data.objects.new('sun',sd); sc.collection.objects.link(sun)
sun.rotation_euler=Vector((0.55,0.6,-0.75)).normalized().to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
loc,tgt=(3,-28,6.5),(2,0,2.6)
cam.location=loc; cam.rotation_euler=(Vector(tgt)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
cd.sensor_fit='VERTICAL'; cd.angle=math.radians(46); cd.shift_y=-0.10; cd.shift_x=0.13
sc.render.filepath=OUTP; bpy.ops.render.render(write_still=True)
