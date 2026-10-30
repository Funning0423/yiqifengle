# r5d: export the coast board pieces as 2D board sprites the same way the island set is shipped
# (192x192 RGBA, transparent, 55deg board camera, matte baked paint = emission of the vertex colours).
# usage (1, render):  blender -b --python export_piece_sprites.py -- <coast_pieces.glb> <rawdir>
# usage (2, sprites): python3 export_piece_sprites.py post <rawdir> <outdir> [--size 192|128]
#   crops each raw render to its alpha bbox, scales the longest side to the island median (140 px at 192, i.e. 0.729 of the canvas),
#   centres it at the island sprite centre (y 98.5 at 192, scaled), adds a soft warm contact shadow; filenames piece_<kind>.png (bb238126 names).
import sys
if len(sys.argv)>1 and sys.argv[1]=='post':
  import os,glob;from PIL import Image,ImageFilter,ImageDraw;import numpy as np
  raw,out=sys.argv[2],sys.argv[3];N=int(sys.argv[sys.argv.index('--size')+1]) if '--size' in sys.argv else 192;os.makedirs(out,exist_ok=True)
  LONG=140/192*N;CY=98.5/192*N
  for f in sorted(glob.glob(os.path.join(raw,'piece_*_raw.png'))):
    im=Image.open(f).convert('RGBA');a=np.asarray(im);ys,xs=np.nonzero(a[...,3]>128);im=im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    w,h=im.size;k=LONG/max(w,h);im=im.resize((max(1,round(w*k)),max(1,round(h*k))),Image.LANCZOS);w,h=im.size
    c=Image.new('RGBA',(N,N),(0,0,0,0));sh=Image.new('RGBA',(N,N),(0,0,0,0));d=ImageDraw.Draw(sh);bx=(N-w)//2;by=int(CY-h/2)
    d.ellipse((N/2-w*0.42,by+h-h*0.16,N/2+w*0.42,by+h+h*0.06),fill=(122,102,82,95));sh=sh.filter(ImageFilter.GaussianBlur(5*N/192))
    c=Image.alpha_composite(c,sh);c.alpha_composite(im,(bx,by));n=os.path.basename(f).replace('_raw','');c.save(os.path.join(out,n));print(n,N,(w,h))
  sys.exit(0)
import bpy,sys,math,os
argv=sys.argv[sys.argv.index('--')+1:];GLB,OUT=argv;os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.device='CPU'
sc.render.resolution_x=sc.render.resolution_y=384;sc.render.film_transparent=True;sc.view_settings.view_transform='Standard'
sc.world=bpy.data.worlds.new('w');sc.world.color=(0,0,0)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));sc.collection.objects.link(cam);sc.camera=cam
cam.data.type='ORTHO';cam.data.ortho_scale=1.4
p=math.radians(55);d=5
cam.location=(0,-math.cos(p)*d,math.sin(p)*d+0.15);cam.rotation_euler=(math.pi/2-p,0,0)
objs=[o for o in sc.objects if o.type=='MESH']
for o in objs:
  me=o.data;ca=me.color_attributes[0].name if me.color_attributes else None
  m=bpy.data.materials.new('e_'+o.name);m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
  out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');at=nt.nodes.new('ShaderNodeVertexColor');at.layer_name=ca or ''
  g=nt.nodes.new('ShaderNodeGamma');g.inputs[1].default_value=1.0   # glb piece colours are sRGB values (see coastshot PIECE_SRGB)
  nt.links.new(at.outputs['Color'],g.inputs[0]);nt.links.new(g.outputs[0],em.inputs['Color']);nt.links.new(em.outputs[0],out.inputs[0])
  me.materials.clear();me.materials.append(m)
for o in objs:
  for q in objs:q.hide_render=(q is not o)
  o.location=(0,0,0);o.rotation_euler=(0,0,0)
  nm=o.name.split('.')[0]
  sc.render.filepath=os.path.join(OUT,nm+'_raw.png');bpy.ops.render.render(write_still=True)
print('SPRITES',[o.name for o in objs])
