import bpy,sys,math,os
from mathutils import Vector
G,OUT=sys.argv[-2:];bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=G);arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute=True
for o in bpy.data.objects:
  if o.type=='MESH' and not o.name.startswith('LOD0_G2'): o.hide_render=True
sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.show_cavity=True
sc.render.resolution_x,sc.render.resolution_y=360,540
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.angle=math.radians(30)
bpy.ops.mesh.primitive_plane_add(size=4)
PB=arm.pose.bones;os.makedirs(OUT,exist_ok=True);i=0
for c in ['walk_start','walk_loop','walk_loop','walk_stop_bodyL']:
  a=bpy.data.actions[c];arm.animation_data.action=a
  try: arm.animation_data.action_slot=a.slots[0]
  except: pass
  for f in range(int(round(a.frame_range[1]))):
    sc.frame_set(f)
    for v,pos in (('back',Vector((0,-3.2,0.9))),('side',Vector((3.2,0,0.9)))):
      look=Vector((0,0,0.8));cam.location=pos;cam.rotation_euler=(look-pos).to_track_quat('-Z','Y').to_euler()
      sc.render.filepath=f'{OUT}/{v}_{i:04d}.png';bpy.ops.render.render(write_still=True)
    i+=1
