import bpy,sys,math,json
from mathutils import Vector
glb,out,mode=sys.argv[-3:]
g2b=lambda v:Vector((v[0],-v[2],v[1]))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
for n in ['state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_bridge_after','state_ring_after_stars','Icosphere']:
    o=bpy.data.objects.get(n)
    if o: o.hide_render=True
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=390; sc.render.resolution_y=844; sc.view_settings.view_transform='Standard'; sc.eevee.taa_render_samples=8
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; day=mode=='day'
bg.inputs[0].default_value=(0.2,0.5,0.8,1) if day else (0.03,0.05,0.12,1); bg.inputs[1].default_value=1.0 if day else 0.35
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sc.collection.objects.link(sun); sun.data.energy=3.5 if day else 0.5; sun.data.color=(1,.96,.88) if day else (.6,.7,1); sun.rotation_euler=(math.radians(50),0,math.radians(-35))
c=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(c); sc.camera=c; c.data.sensor_fit='VERTICAL'; c.data.clip_start=.05; c.data.angle=math.radians(40)
pts=json.load(open('/tmp/ws/add_late.json'))['points']['stones'][:3]+json.load(open('/tmp/ws/add_mid.json'))['points']['stones'][:3]
for k,p in enumerate(pts):
    t=g2b(p); pos=t+Vector((1.1,-1.1,0.9)); c.location=pos; c.rotation_euler=(t-pos).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=f'{out}/stone{k}_{mode}.png'; bpy.ops.render.render(write_still=True)
