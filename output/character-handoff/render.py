import bpy,os,math,json
from mathutils import Vector
base=os.getcwd(); rows=[]
def imported(path):
 old=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=os.path.join(base,path));return list(set(bpy.context.scene.objects)-old)
def setup():
 bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=12;bpy.context.scene.cycles.use_denoising=True
 bpy.context.scene.render.resolution_x=480;bpy.context.scene.render.resolution_y=720;bpy.context.scene.render.resolution_percentage=100
 bpy.context.scene.world=bpy.data.worlds.new('World');bpy.context.scene.world.color=(.25,.25,.25)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002));floor=bpy.context.object
 mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.2,.22,.24,1);floor.data.materials.append(mat)
 bpy.ops.object.light_add(type='AREA',location=(-1,2,4));bpy.context.object.data.energy=350;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
 bpy.ops.object.camera_add(location=(-1.32,2.114,1.386));cam=bpy.context.object;target=Vector((.04,4.45,1.0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.1;bpy.context.scene.camera=cam
for label,t,chair in [('home',0,False),('before-first',0,False),('after-first',0,True),('after-0.1',.1,True),('after-0.3',.3,True)]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if label=='home':
  objs=imported('creator-build-project/assets/bundles/static_seat_preview/actor/user_static_seated_2k.glb');parent=bpy.data.objects.new('HOME',None);bpy.context.collection.objects.link(parent)
  for o in objs:
   if not o.parent:o.parent=parent
  yaw=-2;s=1.2;sx=.00037;sz=-.09094;parent.location=(.4203000068664551-s*(math.cos(yaw)*sx+math.sin(yaw)*sz),-(-4.2133002281188965-s*(-math.sin(yaw)*sx+math.cos(yaw)*sz)),.000126);parent.rotation_euler[2]=yaw;parent.scale=(s,s,s)
 else:
  objs=imported('creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');arm=next(o for o in objs if o.type=='ARMATURE');track=next(tk for tk in arm.animation_data.nla_tracks if tk.name=='stand_up');strip=track.strips[0];action=strip.action;slot=strip.action_slot
  for tk in arm.animation_data.nla_tracks:tk.mute=True
  arm.animation_data.action=action;arm.animation_data.action_slot=slot
  sourceRoot=next(o for o in objs if not o.parent);root=bpy.data.objects.new('Controller',None);bpy.context.collection.objects.link(root);sourceRoot.parent=root;p=t/1.2666670083999634;root.location=(.4327299768730942+(-.016162758009872102-.4327299768730942)*p,-(-4.207611558444886+(-4.413050709661525+4.207611558444886)*p),0);root.rotation_euler[2]=-2
  bpy.context.scene.frame_set(int(1+t*24),subframe=(1+t*24)%1)
  bpy.context.view_layer.update()
  rows.append({'label':label,'time':t,'root':list(root.location),'bones':{b:list(arm.matrix_world@arm.pose.bones[b].head) for b in ['hips','foot.L','foot.R','hand.L','hand.R']}})
  if chair:imported('creator-build-project/assets/bundles/region_island/character_support/reading_chair.glb')
 setup();bpy.context.scene.render.filepath=os.path.join(base,'output/character-handoff/'+label+'.png');bpy.ops.render.render(write_still=True)
open('output/character-handoff/blender-frames.json','w').write(json.dumps(rows,indent=2))
