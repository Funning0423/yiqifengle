import sys; exec(open('/tmp/w2/c2.py').read())
glb,csvf,out,mode=sys.argv[-4:]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
for n in ['state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_bridge_after','state_ring_after_stars','Icosphere']:
    o=bpy.data.objects.get(n)
    if o: o.hide_render=True
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=390; sc.render.resolution_y=844; sc.view_settings.view_transform='Standard'
sc.eevee.taa_render_samples=4
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; day=mode=='day'
bg.inputs[0].default_value=(0.2,0.5,0.8,1) if day else (0.03,0.05,0.12,1); bg.inputs[1].default_value=1.0 if day else 0.35
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sc.collection.objects.link(sun)
sun.data.energy=3.5 if day else 0.5; sun.data.color=(1,0.96,0.88) if day else (0.6,0.7,1.0); sun.rotation_euler=(math.radians(50),0,math.radians(-35))
R=load_route(csvf)
m=bpy.data.materials.new('chr'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs[0].default_value=(1,.8,.15,1)
bpy.ops.mesh.primitive_cylinder_add(radius=.22,depth=1.5); ch=bpy.context.object; ch.data.materials.append(m)
c=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(c); sc.camera=c; c.data.sensor_fit='VERTICAL'; c.data.clip_start=.1; c.data.clip_end=1000
def look(p,t,f): c.location=g2b(p); c.rotation_euler=(g2b(t)-g2b(p)).to_track_quat('-Z','Y').to_euler(); c.data.angle=math.radians(f)
for d in [18,26,33,39,43,46]:
    ch.hide_render=False; ch.location=g2b(at(R,d))+Vector((0,0,.75)); look(*cam(R,d)); sc.render.filepath=f'{out}/mid_d{d:02d}_{mode}.png'; bpy.ops.render.render(write_still=True)
ch.hide_render=True; look(*board_cam_aspect(390/844)); sc.render.filepath=f'{out}/board09_{mode}.png'; bpy.ops.render.render(write_still=True)
