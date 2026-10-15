import bpy,sys,math,os
from mathutils import Vector
glb,outdir,tag,mode=sys.argv[-4:]
os.makedirs(outdir,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='TEXTURE'; sh.show_shadows=True; sh.show_cavity=True; sh.cavity_type='WORLD'; sc.display.render_aa='8'
sc.render.resolution_x,sc.render.resolution_y=960,540
w=bpy.data.worlds.new('w'); w.color=(0.6,0.7,0.85); sc.world=w
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sun.data.energy=3; sun.rotation_euler=(math.radians(50),0,math.radians(30)); sc.collection.objects.link(sun)
def cam(name,loc,tgt,lens=35):
    c=bpy.data.objects.new(name,bpy.data.cameras.new(name)); sc.collection.objects.link(c); c.location=loc
    c.rotation_euler=(Vector(tgt)-Vector(loc)).to_track_quat('-Z','Y').to_euler(); c.data.lens=lens; c.data.clip_end=1000; return c
door=bpy.data.objects['windmill_door_point'].matrix_world.translation
wp=lambda i: bpy.data.objects[f'walk_path_{i:02d}'].matrix_world.translation
shots={'01_gameplay_spawn_pov':bpy.data.objects.get('CAM_spawn_pov'),
 '02_windmill_full':cam('c2',(9,10,11),(0,29,12)),
 '03_windmill_door_closeup':cam('c3',(2.5,21.5,8.2),(0,25.8,6.7)),
 '04_sails_closeup':cam('c4',(4,20,15),(0,27,13.6),40),
 '05_path_edge_closeup':cam('c5',wp(6)+Vector((2.5,-2.5,1.2)),wp(8),40),
 '06_path_edge_lowangle':cam('c6',wp(13)+Vector((1.8,-1,0.45)),wp(14),45),
 '07_path_overview':cam('c7',(14,-12,14),(0,5,3),30)}
sc.frame_set(1)
if mode=='stills':
    for k,c in shots.items():
        if c is None: continue
        if c.type=='CAMERA': c.data.clip_end=1000
        sc.camera=c; sc.render.filepath=f'{outdir}/{tag}_{k}.png'; bpy.ops.render.render(write_still=True)
elif mode=='portrait':
    c=bpy.data.objects['CAM_spawn_pov']; c.data.clip_end=1000; c.data.sensor_fit='VERTICAL'
    sc.render.resolution_x,sc.render.resolution_y=750,1624; sc.camera=c; sc.render.filepath=f'{outdir}/{tag}_08_gameplay_portrait_750x1624.png'; bpy.ops.render.render(write_still=True)
else:
    sc.display.render_aa='FXAA'; sc.render.resolution_x,sc.render.resolution_y=640,360
    c=cam('fly',(0,0,0),(0,0,1)); sc.camera=c; N=96
    for f in range(1,N+1):
        a=f/N*2*math.pi*0.6-1.2; c.location=(18*math.sin(a)*0.9, 29-18*math.cos(a), 10+3*math.sin(a))
        c.rotation_euler=(Vector((0,27,9))-c.location).to_track_quat('-Z','Y').to_euler(); c.keyframe_insert('location',frame=f); c.keyframe_insert('rotation_euler',frame=f)
    sc.frame_start,sc.frame_end=1,N; sc.render.fps=24
    sc.render.filepath=f'{outdir}/frames_{tag}/f_'; bpy.ops.render.render(animation=True)
