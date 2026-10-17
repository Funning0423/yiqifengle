import bpy,json,hashlib,math,sys,time,numpy as np
from pathlib import Path
from mathutils import Vector
O=Path(bpy.data.filepath).parent;P=json.load(open(O/'camera_render_plan.json'));SHA=hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest();assert SHA==P['blend_sha256'];full='full' in sys.argv;S=bpy.context.scene;C=np.array([[1,0,0],[0,0,-1],[0,1,0]]);out=O/('full_motion_preview' if full else 'camera_keyframes');out.mkdir(exist_ok=True);images=out/'frames';images.mkdir(exist_ok=True);lookup={round(r['time'],8):r for r in P['poses']}
cd=bpy.data.cameras.new('INTERNAL_MOTION_REVIEW_CAMERA');cam=bpy.data.objects.new(cd.name,cd);S.collection.objects.link(cam);S.camera=cam;cd.type='PERSP';cd.sensor_fit='VERTICAL';cd.sensor_height=36;cd.clip_start=.03;cd.clip_end=1000
S.render.engine='BLENDER_WORKBENCH';S.display.shading.light='STUDIO';S.display.shading.studio_light='paint.sl';S.display.shading.color_type='TEXTURE';S.display.shading.show_shadows=True;S.display.shading.show_cavity=False;S.display.render_aa='8';S.render.resolution_x=384;S.render.resolution_y=496;S.render.resolution_percentage=100;S.render.image_settings.file_format='PNG';S.render.fps=30;S.render.film_transparent=False
for mat in bpy.data.materials:
 if mat.use_nodes:
  n=next((n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE'),None)
  if n:mat.node_tree.nodes.active=n
frames=list(range(1,991)) if full else [1,40,91,121,136,211,295,310,346,382,421,469,538,568,608,646,697,781,799,832,841,877,928,967]
manifest={'blend_sha256':SHA,'camera_plan_sha256':hashlib.sha256((O/'camera_render_plan.json').read_bytes()).hexdigest(),'frame_count':len(frames),'source_frame_rate':30,'render_frame_rate':30,'playback_frame_rate':30,'duration_seconds':33 if full else None,'image_size':[384,496],'renderer':'Blender Workbench8AA with original active atlas textures. Internal motion review, not final material/cloth rendering.','scope':'Full-chain kinematic preparation. Source LBS garments/sleeves/cuffs/bow-tail and same-leg knee skin self-contact remain unaccepted. No contour or cloth physics merged.','images':[]};(out/'render_manifest.json').write_text(json.dumps(manifest,indent=2))
for index,fr in enumerate(frames):
 t=(fr-1)/30.;r=lookup[round(t,8)];S.frame_set(fr);p=np.array(r['position_game_m']);target=np.array(r['target_game_m']);cam.location=C@p;tar=Vector(C@target);cam.rotation_euler=(tar-cam.location).to_track_quat('-Z','Y').to_euler();cd.lens=18/math.tan(math.radians(r['vfov_deg']/2));dst=images/f'{fr:04d}.png';S.render.filepath=str(dst)
 if not dst.exists():bpy.ops.render.render(write_still=True)
 manifest['images'].append({'frame':fr,'source_time_seconds':t,'shot':r['shot'],'file':str(dst.relative_to(out))});(out/'render_manifest.json').write_text(json.dumps(manifest,indent=2))
 if index%30==0:print('RENDER_PROGRESS',index+1,len(frames),t,flush=True)
print('ALL_FRAMES_READY',len(frames),flush=True)
