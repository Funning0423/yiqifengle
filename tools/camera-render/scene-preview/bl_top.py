import bpy, sys, json, math, mathutils
argv=sys.argv[sys.argv.index('--')+1:]; glb=argv[0]; paths=json.loads(open(argv[1]).read()); out=argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if any(o.name.startswith(p) for p in ('env_sky','env_cloud','env_lighthouse_beam','env_sea_surface','env_chimney')): o.hide_render=True
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='FLAT'; sc.display.shading.color_type='MATERIAL'
sc.render.resolution_x=900; sc.render.resolution_y=900
w=bpy.data.worlds.new('w'); sc.world=w; w.color=(0.1,0.2,0.4)
def bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
for name,pts,col in paths:
    m=bpy.data.materials.new(name); m.diffuse_color=col
    for p in pts:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12,location=bl([p[0],3.5,p[2]])); o=bpy.context.object; o.data.materials.append(m)
cd=bpy.data.cameras.new('c'); cd.type='ORTHO'; cd.ortho_scale=14; cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=bl([-3.5,40,3.5]); cam.rotation_euler=(0,0,0); cd.clip_end=200
sc.render.filepath=out; bpy.ops.render.render(write_still=True)
