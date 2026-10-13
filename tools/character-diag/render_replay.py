"""Blender diagnostic of frozen actual runtime frames; not Cocos/game footage.
blender -b -P tools/character-diag/render_replay.py -- --glb file --replay frames.json.gz --out dir --frames 0,240 --view front
"""
import sys,json,hashlib,argparse,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import numpy as np
from replay_skin import ReplaySkin,read_frames
p=argparse.ArgumentParser();p.add_argument('--glb',required=True);p.add_argument('--replay',required=True);p.add_argument('--out',required=True);p.add_argument('--frames',default='0');p.add_argument('--view',choices=['front','side','q34'],default='q34');p.add_argument('--size',type=int,default=720);p.add_argument('--validate-only',action='store_true');p.add_argument('--morph-zero',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
frames=read_frames(a.replay);ids=[int(x) for x in a.frames.split(',')];skin=ReplaySkin(a.glb)
report=dict(source_sha256=hashlib.sha256(Path(a.glb).read_bytes()).hexdigest(),replay_sha256=hashlib.sha256(Path(a.replay).read_bytes()).hexdigest(),scope='Reconstructed exact runtime TRS/root/yaw/morph Blender diagnostic, not Cocos; no scene room or door geometry',morph_zero=a.morph_zero,checks=[skin.verify(frames[i]) for i in ids])
if a.validate_only:(out/'validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));raise SystemExit(0)
import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=a.size;s.render.resolution_y=a.size;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.world=bpy.data.worlds.new('World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.75,.8,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45;s.view_settings.view_transform='Standard';s.view_settings.look='None'
materials=[]
for mi,m in enumerate(skin.g.j['materials']):
 mat=bpy.data.materials.new(m.get('name',str(mi)));mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');pb=m.get('pbrMetallicRoughness',{});bs.inputs['Base Color'].default_value=pb.get('baseColorFactor',[1,1,1,1]);bs.inputs['Metallic'].default_value=pb.get('metallicFactor',0);bs.inputs['Roughness'].default_value=pb.get('roughnessFactor',.8)
 if 'baseColorTexture' in pb:
  tex=skin.g.j['textures'][pb['baseColorTexture']['index']];im=skin.g.j['images'][tex['source']];imagepath=out/(im.get('name','image'+str(mi))+'.jpg');imagepath.write_bytes(skin.g.view(im['bufferView']));img=bpy.data.images.load(str(imagepath),check_existing=True);node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=img;mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 materials.append(mat)
objects=[]
for part in skin.parts:
 mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata(part['position'].tolist(),[],part['faces'].tolist());mesh.update();uv=mesh.uv_layers.new()
 for poly in mesh.polygons:
  poly.use_smooth=True
  for li in poly.loop_indices:uv.data[li].uv=(part['uv'][mesh.loops[li].vertex_index,0],1-part['uv'][mesh.loops[li].vertex_index,1])
 obj=bpy.data.objects.new(part['name'],mesh);s.collection.objects.link(obj);mesh.materials.append(materials[part['material']]);objects.append(obj)
# A metric checkerboard stays fixed in world space so actual translation/sliding remains visible.
bpy.ops.mesh.primitive_plane_add(size=60,location=(0,0,-.001));floor=bpy.context.object;fm=bpy.data.materials.new('0.5m checker ground diagnostic');fm.use_nodes=True;nt=fm.node_tree;tc=nt.nodes.new('ShaderNodeTexCoord');ck=nt.nodes.new('ShaderNodeTexChecker');ck.inputs['Scale'].default_value=2;ck.inputs['Color1'].default_value=(.68,.7,.72,1);ck.inputs['Color2'].default_value=(.5,.53,.57,1);nt.links.new(tc.outputs['Object'],ck.inputs['Vector']);nt.links.new(ck.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color']);floor.data.materials.append(fm)
first=frames[ids[0]];center=Vector((first['root'][0],-first['root'][2],.85));yaw=first['yaw'];v={'front':(0,1,.2),'side':(1,0,.15),'q34':(.7,.7,.2)}[a.view];dx=math.cos(yaw)*v[0]+math.sin(yaw)*v[1];dz=-math.sin(yaw)*v[0]+math.cos(yaw)*v[1];direction=Vector((dx,-dz,v[2])).normalized();cam=bpy.data.objects.new('diagnostic camera',bpy.data.cameras.new('diagnostic camera'));s.collection.objects.link(cam);s.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.25;cam.location=center+direction*5;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=55
light=bpy.data.objects.new('soft key',bpy.data.lights.new('soft key','AREA'));s.collection.objects.link(light);light.data.energy=700;light.data.size=5;light.location=center+Vector((-3,-4,6));light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
report['camera']={'fixed':True,'location':list(cam.location),'rotation_euler':list(cam.rotation_euler),'ortho_scale':cam.data.ortho_scale};report['renders']=[]
for i in ids:
 f=frames[i]
 if a.morph_zero:f={**f,'morph':[]}
 verts,_=skin.deform(f)
 for obj,v in zip(objects,verts):
  b=v[:,[0,2,1]].copy();b[:,1]*=-1;obj.data.vertices.foreach_set('co',b.reshape(-1));obj.data.update()
 fn=f'{i:05d}_{a.view}.png';s.render.filepath=str(out/fn);bpy.ops.render.render(write_still=True);report['renders'].append(dict(file=fn,sample_index=i,recorded_frame=f['frame'],time=f['t'],clip=f['clip'],clip_time=f['time'],root=f['root'],yaw=f['yaw']))
(out/'render-manifest.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
