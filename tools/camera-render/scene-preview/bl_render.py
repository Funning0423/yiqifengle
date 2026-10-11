import bpy, sys, json, math, mathutils
argv=sys.argv[sys.argv.index('--')+1:]; glb=argv[0]; shots=json.loads(open(argv[1]).read()); out=argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if any(o.name.startswith(p) for p in ('env_sky','env_cloud','env_sky_moon','env_lighthouse_beam')): o.hide_render=True
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='MATERIAL'
sc.display.shading.show_shadows=False; sc.render.resolution_x=293; sc.render.resolution_y=633; sc.render.film_transparent=False
w=bpy.data.worlds.new('w'); sc.world=w; w.color=(0.35,0.55,0.8)
cam_data=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cam_data); sc.collection.objects.link(cam); sc.camera=cam
cam_data.sensor_fit='VERTICAL'; cam_data.clip_start=0.05; cam_data.clip_end=500
def bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
for i,s in enumerate(shots):
    # optional character proxy box
    for o in [o for o in bpy.data.objects if o.name.startswith('proxy')]: bpy.data.objects.remove(o)
    if s.get('root'):
        r=s['root']; h=s.get('h',1.72)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.22,depth=h,location=bl([r[0],r[1]+h/2,r[2]]))
        p=bpy.context.object; p.name='proxy'; m=bpy.data.materials.new('pm'); m.diffuse_color=(1,0.85,0.1,1); p.data.materials.append(m)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.3,depth=0.08,location=bl([r[0],r[1]+h-0.02,r[2]]))
        p2=bpy.context.object; p2.name='proxyhat'; m2=bpy.data.materials.new('ph'); m2.diffuse_color=(0.95,0.75,0.6,1); p2.data.materials.append(m2)
    cam.location=bl(s['position']); d=bl(s['target'])-cam.location
    cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); cam_data.angle=math.radians(s['fov'])
    sc.render.filepath=f"{out}_{i:02d}.png"; bpy.ops.render.render(write_still=True)
