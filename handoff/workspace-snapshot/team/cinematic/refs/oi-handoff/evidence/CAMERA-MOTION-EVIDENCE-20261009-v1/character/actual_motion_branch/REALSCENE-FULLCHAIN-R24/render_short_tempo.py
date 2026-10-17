exec(open('/workspace/shared/grok-takeover/character/actual_motion_branch/full_chain_preparation/render_full_chain_keys.py').read().split('shots=')[0])
S.render.engine='BLENDER_WORKBENCH'
for mat in bpy.data.materials:
 if mat.use_nodes:
  node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if node:mat.diffuse_color=node.inputs['Base Color'].default_value

for mat in bpy.data.materials:
 if mat.use_nodes:
  n=next((n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE'),None)
  if n:mat.node_tree.nodes.active=n
S.world.color=(.65,.65,.65);S.display.shading.studio_light='paint.sl';S.display.shading.light='STUDIO';S.display.shading.color_type='TEXTURE';S.display.shading.show_shadows=True;S.display.shading.show_cavity=False;S.display.render_aa='8';S.render.resolution_x=320;S.render.resolution_y=414;S.render.film_transparent=False
out=O/'tempo_short_30fps';out.mkdir(exist_ok=True);manifest=[]
for tag,a,b,pos in [('pivot',3.,4.5,[-1.15,1.4,-4.12]),('close',19.8,20.8,[-.85,1.35,-1.4])]:
 folder=out/tag;folder.mkdir(exist_ok=True)
 for index,fr in enumerate(range(round(1+a*30),round(1+b*30)+1)):
  S.frame_set(fr);root=C.T@np.array(ctrl.location);target=root+np.array([0,.80,0]);position=np.array(pos);cam.location=C@position;tar=Vector(C@target);cam.rotation_euler=(tar-cam.location).to_track_quat('-Z','Y').to_euler();S.render.filepath=str(folder/f'{index:04d}.png');bpy.ops.render.render(write_still=True)
 manifest.append({'clip':tag,'source_start_seconds':a,'source_end_seconds':b,'unique_frames':index+1,'render_fps':30,'playback_fps':30,'camera_game_m':pos})
(out/'manifest.json').write_text(json.dumps({'blend_sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'render_mode':'Workbench with existing material base colors for motion-only review; original blend unchanged. Clothing remains failing. No duplicate/interpolated display frames.','clips':manifest},indent=2))
