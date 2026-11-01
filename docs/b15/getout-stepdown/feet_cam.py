import bpy, os
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__)); sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='MATERIAL'
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,-0.03)); gp=bpy.context.active_object; mt=bpy.data.materials.new('g'); mt.diffuse_color=(.35,.45,.3,1); gp.data.materials.append(mt)
cd=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam; cam.data.angle=0.6; sc.render.resolution_x, sc.render.resolution_y = 640, 480
for o in bpy.data.objects:
    if o.name=='balloon_basket':
        m=o.modifiers.new('W','WIREFRAME'); m.thickness=0.006
for f in range(66,126):
    sc.frame_set(f); look=Vector((0.0,-0.95,0.12)); loc=Vector((-1.6,-1.0,0.35))
    cam.location=loc; cam.rotation_euler=(look-loc).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=OUT+f'/frames/sd3_feet_{f:03d}.png'; bpy.ops.render.render(write_still=True)
