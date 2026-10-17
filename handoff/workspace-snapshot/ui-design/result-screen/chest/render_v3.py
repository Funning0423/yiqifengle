import bpy,sys,math
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:];frame=int(argv[0]);out=argv[1];outline=argv[2]=='1'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspace/wechat-game/yiqifengle/creator-build-project/assets/bundles/board_art/chest/result_chest.glb")
sc=bpy.context.scene;sc.frame_set(frame)
m=bpy.data.materials['M_env_palette_piece'];nt=m.node_tree;b=nt.nodes['Principled BSDF']
t=nt.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load('/workspace/wechat-game/yiqifengle/art-src/board-ui/_deps/ui-props/textures/env_palette_256.png');t.interpolation='Closest'
h=nt.nodes.new('ShaderNodeHueSaturation');h.inputs['Value'].default_value=1.08;h.inputs['Saturation'].default_value=1.12;h.inputs['Hue'].default_value=0.505
nt.links.new(t.outputs[0],h.inputs['Color']);nt.links.new(h.outputs[0],b.inputs['Base Color'])
b.inputs['Roughness'].default_value=0.6
if 'Specular IOR Level' in b.inputs:b.inputs['Specular IOR Level'].default_value=0.35
for o in bpy.data.objects:
  if o.type=='MESH':
    for p in o.data.polygons:p.use_smooth=False   # faceted low-poly shading
# outline: inverted hull
if outline:
  om=bpy.data.materials.new('outline');om.use_nodes=True;om.use_backface_culling=True
  bb=om.node_tree.nodes['Principled BSDF'];bb.inputs['Base Color'].default_value=(0.16,0.07,0.03,1);bb.inputs['Roughness'].default_value=1
  e=om.node_tree.nodes.new('ShaderNodeEmission');e.inputs[0].default_value=(0.11,0.05,0.02,1)
  N=om.node_tree.nodes;g=N.new('ShaderNodeNewGeometry');tr=N.new('ShaderNodeBsdfTransparent');mx=N.new('ShaderNodeMixShader')
  om.node_tree.links.new(g.outputs['Backfacing'],mx.inputs[0]);om.node_tree.links.new(e.outputs[0],mx.inputs[1]);om.node_tree.links.new(tr.outputs[0],mx.inputs[2]);om.node_tree.links.new(mx.outputs[0],N['Material Output'].inputs[0])
  for o in [x for x in bpy.data.objects if x.type=='MESH']:
    o.data.materials.append(om);s=o.modifiers.new('ol','SOLIDIFY');s.thickness=0.018;s.offset=1;s.use_flip_normals=True;s.material_offset=len(o.data.materials)-1
# shadow catcher
bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,0));pl=bpy.context.object;pl.is_shadow_catcher=True
sc.render.engine='CYCLES';sc.cycles.samples=96;sc.cycles.use_denoising=True;sc.cycles.device='CPU'
sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=800
sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;bg=w.node_tree.nodes['Background'];bg.inputs[0].default_value=(1,.92,.80,1);bg.inputs[1].default_value=0.35
def L(name,t,loc,e,col,size=1,target=(0,0,0.4)):
  d=bpy.data.lights.new(name,t);d.energy=e;d.color=col
  if t=='AREA':d.size=size
  if t=='SUN':d.angle=0.35
  o=bpy.data.objects.new(name,d);o.location=loc;sc.collection.objects.link(o)
  o.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
L('key','SUN',(-1.6,-1.4,6),4.0,(1,.93,.80))          # top-left warm: lit top face
L('fill','AREA',(4,-3,1.5),90,(.80,.88,1),3)        # cool weak: side faces darker
L('rim','AREA',(0.5,3.5,3.5),260,(1,.82,.55),2)
if frame>0:L('inner','POINT',(0,0.05,0.7),90,(1,.80,.42))
cam=bpy.data.cameras.new('c');cam.lens=55;co=bpy.data.objects.new('c',cam);sc.collection.objects.link(co);sc.camera=co
el,az,dist=math.radians(36),math.radians(-38),5.6
tgt=Vector((0,0,0.55 if frame>0 else 0.42))
co.location=tgt+Vector((dist*math.cos(el)*math.sin(-az),-dist*math.cos(el)*math.cos(az),dist*math.sin(el)))
co.rotation_euler=(tgt-co.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=out;bpy.ops.render.render(write_still=True)
