import bpy,os,json,sys
from mathutils import Vector
root=os.getcwd(); path=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'
out=sys.argv[sys.argv.index('--')+2] if '--' in sys.argv else 'output/character-repair/probe'
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.abspath(path));arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for t in arm.animation_data.nla_tracks:t.mute=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('World');scene.world.color=(.35,.35,.35)
bpy.ops.object.light_add(type='AREA',location=(-3,-4,5));bpy.context.object.data.energy=450;bpy.context.object.data.size=4
bpy.ops.object.light_add(type='AREA',location=(3,2,4));bpy.context.object.data.energy=300;bpy.context.object.data.size=3
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
for clip,time,area in [('walk_loop',.3,'full'),('walk_loop',.3,'wrist'),('idle_breathing_loop',0,'feet'),('sit_hold',0,'full'),('door_reach',.6,'wrist')]:
 t=next(t for t in arm.animation_data.nla_tracks if t.name==clip);s=t.strips[0];arm.animation_data.action=s.action;arm.animation_data.action_slot=s.action_slot;scene.frame_set(int(1+time*24),subframe=(1+time*24)%1);bpy.context.view_layer.update()
 if area=='full':target=Vector((0,0,.9));cam.location=target+Vector((-2,-4,1.2));cam.data.ortho_scale=1.95
 elif area=='wrist':target=arm.matrix_world@arm.pose.bones['hand.L'].head;cam.location=target+Vector((-2,-4,.5));cam.data.ortho_scale=.38
 else:target=Vector((-.065,0,.1));cam.location=target+Vector((-3,-4,.8));cam.data.ortho_scale=.4
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.abspath(f'{out}/{clip}-{area}.png');bpy.ops.render.render(write_still=True)
