import bpy,sys,math
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; glb,out=a[0],a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene
for m in bpy.data.materials:
    if not m.node_tree: continue
    nt=m.node_tree; tex=[n for n in nt.nodes if n.type=='TEX_IMAGE']; bs=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED']
    if tex and bs: nt.links.new(tex[0].outputs['Color'],bs[0].inputs['Base Color'])
for ob in sc.objects:
    if ob.type=='MESH' and not ob.material_slots: ob.hide_render=True
arm=[o for o in sc.objects if o.type=='ARMATURE'][0]; arm.data.pose_position='REST'
sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='TEXTURE'
sh.show_shadows=True; sh.shadow_intensity=0.35; sc.display.light_direction=(0.45,-0.55,0.7)
sh.background_type='VIEWPORT'; sh.background_color=(0.82,0.86,0.9)
sc.render.resolution_x=768; sc.render.resolution_y=1024; sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
cd.type='ORTHO'; cd.sensor_fit='VERTICAL'
H=1.7565; head=Vector((0.0,-0.0204,1.7565-H*0.10))
def shot(name,yaw,scale):
    d=Vector((math.sin(math.radians(yaw)),-math.cos(math.radians(yaw)),0))*H*4
    cam.location=head+d; cam.rotation_euler=(head-cam.location).to_track_quat('-Z','Y').to_euler()
    cd.ortho_scale=scale; sc.render.filepath=f'{out}/{name}.png'; bpy.ops.render.render(write_still=True)
shot('face_side',90,H*0.24); shot('face_side34',55,H*0.24)
print('ok')
