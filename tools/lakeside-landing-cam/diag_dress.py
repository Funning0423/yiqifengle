import bpy,sys,math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1])
wd=bpy.data.worlds.new('w');sc.world=wd;wd.use_nodes=True;wd.node_tree.nodes['Background'].inputs[0].default_value=(.2,.6,.25,1)
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));sc.collection.objects.link(sun);sun.data.energy=3;sun.rotation_euler=(math.radians(50),0,math.radians(35))
sc.render.engine='BLENDER_EEVEE_NEXT';sc.view_settings.view_transform='Standard';sc.render.resolution_x=300;sc.render.resolution_y=600
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));sc.collection.objects.link(cam);sc.camera=cam
cam.location=(0.8,3.0,1.1);d=(Vector((0,0,0.85))-cam.location).normalized();cam.rotation_mode='QUATERNION';cam.rotation_quaternion=d.to_track_quat('-Z','Y');cam.data.angle=math.radians(40)
for tag,hide in (('all',()),('nodress',('LOD0_G2_DRESS',)),('nobody',('LOD0_G2_BODY',))):
    for o in bpy.data.objects:
        if o.type=='MESH':o.hide_render=o.name in hide
    sc.render.filepath='/tmp/dr2_%s.png'%tag;bpy.ops.render.render(write_still=True)
