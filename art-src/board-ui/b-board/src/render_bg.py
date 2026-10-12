# Board backgrounds, rendered from the game's own region models.
#   island  "岛边": region_island/combined_visual_m.glb from the south beach.
#   skycity "天空城": region_skycity/env_skycity.glb from just off the south rim (great tree, ruins, star court, robot).
# blender -b -P render_bg.py -- <out.png> [samples] [island|skycity]
import bpy,math,sys,os
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; OUTP=a[0]; S=int(a[1]) if len(a)>1 else 64; REGION=a[2] if len(a)>2 else 'island'
BUNDLES=os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../../..')),'creator-build-project/assets/bundles')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=S; sc.cycles.use_denoising=True
sc.render.resolution_x=750; sc.render.resolution_y=1624
sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('sky'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.62,0.80,0.95,1); bg.inputs['Strength'].default_value=0.55
sd=bpy.data.lights.new('sun','SUN'); sd.energy=2.35; sd.angle=math.radians(8); sd.color=(1.0,0.97,0.92)
sun=bpy.data.objects.new('sun',sd); sc.collection.objects.link(sun)
sun.rotation_euler=Vector((0.55,0.6,-0.75)).normalized().to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
cd.sensor_fit='VERTICAL'; cd.clip_end=3000
if REGION=='island':
  bpy.ops.import_scene.gltf(filepath=os.path.join(BUNDLES,'region_island/combined_visual_m.glb'))
  HIDE=('col_','collision','exit_','return_','fx_','env_lighthouse_beam','env_sky_moon','env_int','env_interior','interaction','interior_spawn','ref_girl','door_stand','entrance','Icosphere','env_window_blind','env_rear','env_chimney_smoke')
  for o in sc.objects:
    if o.name.startswith(HIDE): o.hide_render=True
  loc,tgt=(3,-28,6.5),(2,0,2.6); cd.angle=math.radians(46); cd.shift_y=-0.10; cd.shift_x=0.13
elif REGION=='skycity':
  bpy.ops.import_scene.gltf(filepath=os.path.join(BUNDLES,'region_skycity/env_skycity.glb'))
  for o in sc.objects:
    if o.type=='MESH' and (o.name in ('Icosphere','env_sky_starring') or o.name.startswith('state_') and '_after' in o.name): o.hide_render=True
  # The island has no sky dome: camera rays see a soft vertical gradient, lighting stays the T9 sky above.
  nt=w.node_tree; out=nt.nodes['World Output']; grad=nt.nodes.new('ShaderNodeBackground'); grad.inputs['Strength'].default_value=1.0
  tc=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ'); ramp=nt.nodes.new('ShaderNodeValToRGB')
  nt.links.new(tc.outputs['Generated'],sep.inputs[0]); nt.links.new(sep.outputs['Z'],ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'],grad.inputs['Color'])
  lin=lambda h:tuple(((int(h[i:i+2],16)/255+0.055)/1.055)**2.4 for i in (1,3,5))+(1,)
  stops=((0.0,'#9fc2e6'),(0.40,'#c9dcee'),(0.50,'#f4ecdf'),(0.60,'#b6cdee'),(1.0,'#9dbbe8'))
  els=ramp.color_ramp.elements; els[0].position=0.0; els[1].position=1.0
  for p,_ in stops[1:-1]: els.new(p)
  for e in els: e.color=lin(min(stops,key=lambda s:abs(s[0]-e.position))[1])
  lp=nt.nodes.new('ShaderNodeLightPath'); mix=nt.nodes.new('ShaderNodeMixShader')
  nt.links.new(lp.outputs['Is Camera Ray'],mix.inputs['Fac']); nt.links.new(bg.outputs[0],mix.inputs[1]); nt.links.new(grad.outputs[0],mix.inputs[2]); nt.links.new(mix.outputs[0],out.inputs['Surface'])
  loc,tgt=(18,-95,34),(0,-5,10); cd.angle=math.radians(46)
else:
  raise SystemExit('unknown region '+REGION)
cam.location=loc; cam.rotation_euler=(Vector(tgt)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=OUTP; bpy.ops.render.render(write_still=True)
