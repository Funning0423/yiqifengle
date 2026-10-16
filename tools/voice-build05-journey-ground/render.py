import sys,os; exec(open('/tmp/vbw/common.py').read())
glb,out,mode=sys.argv[-3],sys.argv[-2],sys.argv[-1]   # mode day|night
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
for n in ['state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_bridge_after','state_ring_after_stars','Icosphere']:
    o=bpy.data.objects.get(n); 
    if o: o.hide_render=True
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=540; sc.render.resolution_y=1170
sc.view_settings.view_transform='Standard'
try: sc.eevee.taa_render_samples=8
except Exception: pass
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']
day=mode=='day'
bg.inputs[0].default_value=(0.2,0.5,0.8,1) if day else (0.03,0.05,0.12,1); bg.inputs[1].default_value=1.0 if day else 0.35
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sc.collection.objects.link(sun)
sun.data.energy=3.5 if day else 0.5; sun.data.color=(1,0.96,0.88) if day else (0.6,0.7,1.0)
sun.rotation_euler=(math.radians(50),0,math.radians(-35))
bvh,_=ground_bvh(); P=route_local(); L=length(P)
mat=bpy.data.materials.new('chr'); mat.diffuse_color=(1,.8,.15,1); mat.use_nodes=True; mat.node_tree.nodes['Principled BSDF'].inputs[0].default_value=(1,.8,.15,1)
bpy.ops.mesh.primitive_cylinder_add(radius=.22,depth=1.5); ch=bpy.context.object; ch.data.materials.append(mat)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam
cam.data.sensor_fit='VERTICAL'; cam.data.clip_start=.1; cam.data.clip_end=1000
def look(pos,tgt,fov):
    cam.location=g2b(pos); d=g2b(tgt)-g2b(pos); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); cam.data.angle=math.radians(fov)
shots={}
for back in LATE_BACKS:
    q=lifted(sample(P,L-back),bvh); shots['late_back%04.1fm'%back]=q
for name,q in shots.items():
    ch.hide_render=False; ch.location=g2b(q)+Vector((0,0,.75)); look(*journey_cam(q)); sc.render.filepath=f'{out}/{name}_{mode}.png'; bpy.ops.render.render(write_still=True)
ch.hide_render=True; look(*board_cam_aspect(9/19.5)); sc.render.filepath=f'{out}/board09_{mode}.png'; bpy.ops.render.render(write_still=True)
