# Night preview of the signpost with the lantern lit (M_signpost_lamp emission on + small warm point light).
import bpy, math, sys, os
from mathutils import Vector
OUT=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'ui_props.blend'))
sc=bpy.context.scene
for o in sc.objects:
    if o.type=='MESH': o.hide_render = not (o.name in ('ui_signpost','lamp_glass'))
sp=bpy.data.objects['ui_signpost']; lamp=bpy.data.objects['lamp_glass']
b=bpy.data.materials['M_signpost_lamp'].node_tree.nodes['Principled BSDF']; b.inputs['Emission Strength'].default_value=4.0
# palette emissive row would also glow the same; dim the rest of the palette emission for the night look
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=96; sc.cycles.use_denoising=True
sc.render.film_transparent=False; sc.render.resolution_x=sc.render.resolution_y=640
sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('night'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.035,0.06,0.14,1); bg.inputs['Strength'].default_value=1.0
md=bpy.data.lights.new('moon','SUN'); md.energy=0.35; md.color=(0.65,0.75,1.0)
moon=bpy.data.objects.new('moon',md); sc.collection.objects.link(moon); moon.rotation_euler=Vector((0.55,0.6,-0.75)).normalized().to_track_quat('-Z','Y').to_euler()
c=lamp.matrix_world@(sum((v.co for v in lamp.data.vertices),Vector())/len(lamp.data.vertices))
pd=bpy.data.lights.new('lampglow','POINT'); pd.energy=25; pd.color=(1.0,0.82,0.5); pd.shadow_soft_size=0.12
pl=bpy.data.objects.new('lampglow',pd); sc.collection.objects.link(pl); pl.location=c+Vector((0,-0.25,0))
# ground plane to catch the glow
bpy.ops.mesh.primitive_plane_add(size=8,location=(sp.location.x,sp.location.y,0))
g=bpy.context.active_object; gm=bpy.data.materials.new('g'); gm.use_nodes=True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.55,0.5,0.36,1); g.data.materials.append(gm)
cd=bpy.data.cameras.new('cam'); cd.type='ORTHO'; cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
el=math.radians(16); dirv=Vector((math.sin(math.radians(24))*math.cos(el),-math.cos(math.radians(24))*math.cos(el),math.sin(el)))
ctr=sp.location+Vector((-0.1,0,0.95)); cam.location=ctr+dirv*10; cam.rotation_euler=(-dirv).to_track_quat('-Z','Y').to_euler(); cd.ortho_scale=3.0
sc.render.filepath=os.path.join(OUT,'renders','ui_signpost_night.png'); bpy.ops.render.render(write_still=True)
