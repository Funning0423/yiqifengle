import bpy,sys,math
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; glb,out,tag=a[0],a[1],(a[2] if len(a)>2 else 'game')
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
sh.background_type='VIEWPORT'; sh.background_color=(0.55,0.62,0.58)  # soft outdoor-ish
# game phone frame ~ 375x667 logical; character head often ~80-110 px tall in play
sc.render.resolution_x=375; sc.render.resolution_y=667; sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
cd.type='ORTHO'; cd.sensor_fit='VERTICAL'
H=1.7565; c=Vector((0.0,-0.0204,0.95))  # upper body framing like follow cam
d=Vector((0,-1,0.08))*H*3.2
cam.location=c+d; cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
cd.ortho_scale=H*1.15  # full-ish body so head is game-small
sc.render.filepath=f'{out}/{tag}_scale_full.png'; bpy.ops.render.render(write_still=True)
# tighter play-distance bust
c2=Vector((0.0,-0.02,1.35)); d2=Vector((0.15,-1,0.05))*H*2.5
cam.location=c2+d2; cam.rotation_euler=(c2-cam.location).to_track_quat('-Z','Y').to_euler()
cd.ortho_scale=H*0.55
sc.render.filepath=f'{out}/{tag}_scale_bust.png'; bpy.ops.render.render(write_still=True)
print('game-scale ok', tag)
