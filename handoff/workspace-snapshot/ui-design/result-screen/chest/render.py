import bpy,sys,math
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:];frame=int(argv[0]);out=argv[1];bright=argv[2]=='1'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspace/wechat-game/yiqifengle/creator-build-project/assets/bundles/board_art/chest/result_chest.glb")
sc=bpy.context.scene;sc.frame_set(frame)
m=bpy.data.materials['M_env_palette_piece'];nt=m.node_tree;b=nt.nodes['Principled BSDF']
src=None
for n in nt.nodes:
  if n.type in('VERTEX_COLOR','ATTRIBUTE','TEX_IMAGE'):src=n
print("SRC",src and src.type,[l.from_node.type for l in b.inputs['Base Color'].links])
src=nt.nodes.new('ShaderNodeTexImage');src.image=bpy.data.images.load('/workspace/wechat-game/yiqifengle/art-src/board-ui/_deps/ui-props/textures/env_palette_256.png');src.interpolation='Closest'
if bright:
  hsv=nt.nodes.new('ShaderNodeHueSaturation');hsv.inputs['Value'].default_value=1.1;hsv.inputs['Saturation'].default_value=1.08;hsv.inputs['Hue'].default_value=0.505
  out_sock=src.outputs[0];nt.links.new(out_sock,hsv.inputs['Color']);nt.links.new(hsv.outputs[0],b.inputs['Base Color'])
  b.inputs['Roughness'].default_value=0.55
  if 'Coat Weight' in b.inputs:b.inputs['Coat Weight'].default_value=0.25
else:
  nt.links.new(src.outputs[0],b.inputs['Base Color'])
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=720
sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(1,.93,.82,1);w.node_tree.nodes['Background'].inputs[1].default_value=0.7 if bright else 0.5
def L(name,t,loc,e,col,size=2):
  d=bpy.data.lights.new(name,t);d.energy=e;d.color=col
  if t=='AREA':d.size=size
  o=bpy.data.objects.new(name,d);o.location=loc;sc.collection.objects.link(o)
  o.rotation_euler=(Vector((0,0,0.4))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
L('key','AREA',(-2.5,-3,4),700 if bright else 500,(1,.94,.85),3)
L('fill','AREA',(3,-2,2),250,(.86,.92,1),3)
L('rim','AREA',(0,3,3),400,(1,.85,.6),2)
if frame>0: L('inner','POINT',(0,0.05,0.75),120,(1,.82,.45))
cam=bpy.data.cameras.new('c');cam.lens=50;co=bpy.data.objects.new('c',cam);sc.collection.objects.link(co);sc.camera=co
co.location=(2.3,-4.3,3.0);co.rotation_euler=(Vector((0,0,0.62))-co.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=out;bpy.ops.render.render(write_still=True)
