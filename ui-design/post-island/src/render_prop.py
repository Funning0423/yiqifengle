# 用法: blender -b -P render_prop.py -- <glb> <out.png> <size> <yawDeg> <elevDeg> [hideRegex]
import bpy,sys,math,re
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:];glb,out,size,yaw,elev=a[0],a[1],int(a[2]),float(a[3]),float(a[4]);hide=a[5] if len(a)>5 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene
for o in list(bpy.data.objects):
  if o.type!='MESH' or (hide and re.search(hide,o.name)): o.hide_render=True
  else:
    for p in o.data.polygons:p.use_smooth=False
ms=[o for o in bpy.data.objects if o.type=='MESH' and not o.hide_render]
pts=[o.matrix_world@Vector(c) for o in ms for c in o.bound_box]
mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)));mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
c=(mn+mx)/2;r=(mx-mn).length/2
cam=bpy.data.cameras.new('c');cam.lens=60;co=bpy.data.objects.new('c',cam);sc.collection.objects.link(co);sc.camera=co
y,e=math.radians(yaw),math.radians(elev);d=r/math.tan(math.atan(18/60))*1.12
co.location=c+Vector((math.sin(y)*math.cos(e),-math.cos(y)*math.cos(e),math.sin(e)))*d
co.rotation_euler=(c-co.location).to_track_quat('-Z','Y').to_euler()
def L(t,rot,col,en,ang=0.3):
  l=bpy.data.lights.new(t,'SUN');l.color=col;l.energy=en;l.angle=ang;o=bpy.data.objects.new(t,l);o.rotation_euler=rot;sc.collection.objects.link(o)
L('key',(math.radians(40),0,math.radians(-35)),(1,.93,.8),4.0)
L('fill',(math.radians(70),0,math.radians(120)),(.8,.88,1),.8)
L('rim',(math.radians(-50),0,math.radians(170)),(1,.82,.55),2.0)
w=bpy.data.worlds.new('w');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(1,.92,.8,1);w.node_tree.nodes['Background'].inputs[1].default_value=.45;sc.world=w
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=size;sc.render.filepath=out
sc.view_settings.view_transform='Standard'
try: sc.eevee.taa_render_samples=64
except: pass
bpy.ops.render.render(write_still=True)
