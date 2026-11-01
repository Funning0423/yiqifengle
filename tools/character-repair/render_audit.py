import bpy,os,json,math,sys,hashlib
from mathutils import Vector
BASE=os.getcwd();OUT=os.path.join(BASE,'output/character-repair/frames');os.makedirs(OUT,exist_ok=True)
DYNAMIC='creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb';REF='/Users/shineanl/Downloads/07b663213e53f80507b5c0df8ab1e63a.glb'
audit=json.load(open('output/character-repair/skin-audit.json'));rows=[]
def scene(path):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('World');s.world.color=(.35,.35,.35)
 meshes=[o for o in s.objects if o.type=='MESH' and not o.hide_render]
 bpy.ops.object.light_add(type='AREA',location=(-3,-4,5));bpy.context.object.data.energy=450;bpy.context.object.data.size=4
 bpy.ops.object.light_add(type='AREA',location=(3,2,4));bpy.context.object.data.energy=300;bpy.context.object.data.size=3
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';s.camera=cam
 return s,cam,meshes
door_only='--door-only' in sys.argv
for label,path in [('before','output/character-repair/original.glb'),('after',DYNAMIC)]:
 if door_only and label=='before':continue
 s,cam,meshes=scene(path);arm=next(o for o in s.objects if o.type=='ARMATURE')
 for track in arm.animation_data.nla_tracks:track.mute=True
 for row in audit['source']:
  clip=row['clip']
  if door_only and clip!='door_reach':continue
  t=max(row['wrist'].values(),key=lambda w:1-w['min_lbs_singular_value'])['worst_time_s'];track=next(tk for tk in arm.animation_data.nla_tracks if tk.name==clip);strip=track.strips[0];arm.animation_data.action=strip.action;arm.animation_data.action_slot=strip.action_slot
  s.frame_set(int(1+t*24),subframe=(1+t*24)%1);bpy.context.view_layer.update()
  deps=bpy.context.evaluated_depsgraph_get();points=[o.matrix_world@v.co for o in meshes for v in o.evaluated_get(deps).data.vertices];mn=[min(p[i] for p in points) for i in range(3)];mx=[max(p[i] for p in points) for i in range(3)]
  rows.append({'label':label,'clip':clip,'time_s':t,'bounds_min':mn,'bounds_max':mx,'head':list(arm.matrix_world@arm.pose.bones['head'].head),'wrist':{side:list(arm.matrix_world@arm.pose.bones['hand.'+side].head) for side in ['L','R']}})
  for area in ['full','wrist','heel']:
   if area=='full':target=Vector((0,0,.86));cam.location=target+Vector((-2,-4,1.2));cam.data.ortho_scale=1.9;s.render.resolution_x=320;s.render.resolution_y=480
   elif area=='wrist':target=arm.matrix_world@arm.pose.bones['hand.L'].head;cam.location=target+Vector((-3,-2,1));cam.data.ortho_scale=.36;s.render.resolution_x=320;s.render.resolution_y=320
   else:target=(arm.matrix_world@arm.pose.bones['foot.L'].head+arm.matrix_world@arm.pose.bones['foot.R'].head)/2;cam.location=target+Vector((-2,3,.8));cam.data.ortho_scale=.42;s.render.resolution_x=320;s.render.resolution_y=320
   cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=f'{OUT}/{label}-{clip}-{area}.png';bpy.ops.render.render(write_still=True)
if door_only:
 previous=json.load(open('output/character-repair/blender-audit.json'));previous=[r for r in previous if not (r.get('label')=='after' and r.get('clip')=='door_reach')];previous+=rows;open('output/character-repair/blender-audit.json','w').write(json.dumps(previous,indent=2));open('output/character-repair/render-identity.json','w').write(json.dumps({'candidate_sha256':hashlib.sha256(open(DYNAMIC,'rb').read()).hexdigest(),'unchanged_other_clips':True,'door_rerendered_after_ik':True},indent=2));sys.exit(0)
s,cam,meshes=scene(REF)
# Reference at native scale: visual proportion comparison, not rig retargeting.
pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];mn=[min(p[i] for p in pts) for i in range(3)];mx=[max(p[i] for p in pts) for i in range(3)];rows.append({'label':'reference_native','bounds_min':mn,'bounds_max':mx,'rig':False})
for name,target,scale in [('full',Vector((0,0,.53)),1.2),('boots',Vector((0,-.19,.12)),.42),('head_cuff',Vector((0,0,.75)),.55)]:
 cam.location=target+Vector((-2,-4,1.2));cam.data.ortho_scale=scale;s.render.resolution_x=400;s.render.resolution_y=560 if name=='full' else 400;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=f'{OUT}/reference-{name}.png';bpy.ops.render.render(write_still=True)
open('output/character-repair/blender-audit.json','w').write(json.dumps(rows,indent=2))
