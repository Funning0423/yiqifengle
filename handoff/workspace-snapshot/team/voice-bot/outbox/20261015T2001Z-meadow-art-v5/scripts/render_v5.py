# v5 preview: Eevee, lighting approximating Cocos meadow runtime (see README mapping)
import bpy,sys,math,os
from mathutils import Vector
glb,outdir,tag,mode=sys.argv[-4:]; os.makedirs(outdir,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.eevee.taa_render_samples=8
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
def srgb(c): return [((x/255+0.055)/1.055)**2.4 for x in c]
w=bpy.data.worlds.new('w'); w.use_nodes=True; bg=w.node_tree.nodes['Background']
sky=srgb((51,128,204)); bg.inputs[0].default_value=(*[0.78*s for s in sky],1); bg.inputs[1].default_value=1.0; sc.world=w
def sun(name,d,strength,col):
    o=bpy.data.objects.new(name,bpy.data.lights.new(name,'SUN')); o.data.energy=strength; o.data.color=col
    o.rotation_euler=Vector(d).to_track_quat('-Z','Y').to_euler(); sc.collection.objects.link(o); return o
sun('cocos_main_dir',(0.433,0.75,-0.5),1.69,(1,1,1))
kd=(Vector((0,0,5))-Vector((-25,-25,80))).normalized()
sun('MeadowKeyLight_approx',tuple(kd),0.6,tuple(srgb((255,243,218))))
def cam(name,loc,tgt,lens=35):
    c=bpy.data.objects.new(name,bpy.data.cameras.new(name)); sc.collection.objects.link(c); c.location=loc
    c.rotation_euler=(Vector(tgt)-Vector(loc)).to_track_quat('-Z','Y').to_euler(); c.data.lens=lens; c.data.clip_end=1000; return c
gp=bpy.data.objects['CAM_spawn_pov']; gp.data.clip_end=1000
if mode=='stills':
    shots=[('08_gameplay_portrait_750x1624',gp,750,1624,'VERTICAL'),('01_gameplay_spawn_pov',gp,960,540,'AUTO'),
      ('09_cloud_closeup',cam('cc',(29,95,48),(29,150,60),45),960,540,'AUTO'),
      ('10_grass_closeup',cam('gc',(4,-16,2.6),(-2,-8,1.6),35),960,540,'AUTO'),
      ('02_windmill_full',cam('c2',(9,10,11),(0,29,12)),960,540,'AUTO')]
    for k,c,rx,ry,fit in shots:
        sc.render.resolution_x,sc.render.resolution_y=rx,ry; c.data.sensor_fit=fit; sc.camera=c
        sc.render.filepath=f'{outdir}/{tag}_{k}.png'; bpy.ops.render.render(write_still=True)
else:
    sc.eevee.taa_render_samples=4; sc.render.resolution_x,sc.render.resolution_y=540,720
    c=cam('fly',(0,0,0),(0,0,1),35); sc.camera=c; N=96
    for f in range(1,N+1):
        a=f/N*math.pi*0.9-0.45*math.pi; c.location=(24*math.sin(a),27.05-24*math.cos(a),12+2*math.sin(a))
        c.rotation_euler=(Vector((0,27.5,10.5))-c.location).to_track_quat('-Z','Y').to_euler(); c.keyframe_insert('location',frame=f); c.keyframe_insert('rotation_euler',frame=f)
    sc.frame_start,sc.frame_end=1,N; sc.render.fps=24; sc.render.filepath=f'{outdir}/frames_{tag}/f_'; bpy.ops.render.render(animation=True)
