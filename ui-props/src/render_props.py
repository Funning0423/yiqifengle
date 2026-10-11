# Render each prop to a transparent PNG, 3/4 view, sun upper-left-front (matches island reference).
import bpy, math, sys, os, json
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector, Euler
OUT=sys.argv[sys.argv.index('--')+1]; RES=int(sys.argv[sys.argv.index('--')+2]) if len(sys.argv)>sys.argv.index('--')+2 else 1024
SAMPLES=int(sys.argv[sys.argv.index('--')+3]) if len(sys.argv)>sys.argv.index('--')+3 else 128
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'ui_props.blend'))
sc=bpy.context.scene
props=[o for o in sc.objects if o.type=='MESH']
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES; sc.cycles.use_denoising=True
sc.render.film_transparent=True; sc.render.resolution_x=sc.render.resolution_y=RES
sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
sc.view_settings.exposure=0.0
# world: soft sky-blue ambient like the reference daylight
w=bpy.data.worlds.new('sky'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.62,0.80,0.95,1); bg.inputs['Strength'].default_value=0.55
# sun from upper-left-front, slightly soft
sd=bpy.data.lights.new('sun','SUN'); sd.energy=2.35; sd.angle=math.radians(8); sd.color=(1.0,0.97,0.92)
sun=bpy.data.objects.new('sun',sd); sc.collection.objects.link(sun)
# direction light travels: from (-x, -y, +z) towards origin
d=Vector((0.55,0.6,-0.75)).normalized()
sun.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('cam'); cd.type='ORTHO'
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
os.makedirs(os.path.join(OUT,'renders'),exist_ok=True)
for o in props:
    for p in props: p.hide_render=(p is not o)
    vs=[o.matrix_world@v.co for v in o.data.vertices]
    mn=Vector([min(v[i] for v in vs) for i in range(3)]); mx=Vector([max(v[i] for v in vs) for i in range(3)])
    c=(mn+mx)/2; size=(mx-mn).length
    az=math.radians(-28); el=math.radians(16)   # camera front-right-above -> 3/4 view
    dirv=Vector((math.sin(-az)*math.cos(el)*-1, -math.cos(az)*math.cos(el), math.sin(el)))
    dirv=Vector((math.sin(math.radians(24))*math.cos(el), -math.cos(math.radians(24))*math.cos(el), math.sin(el)))
    cam.location=c+dirv*10
    cam.rotation_euler=(-dirv).to_track_quat('-Z','Y').to_euler()
    cd.ortho_scale=max(mx.x-mn.x, mx.z-mn.z)*1.12+0.05
    sc.render.filepath=os.path.join(OUT,'renders',o.name+'.png')
    bpy.ops.render.render(write_still=True)
    if o.name=='ui_signpost':
        info=json.load(open(os.path.join(OUT,'props_info.json')))
        bpy.context.view_layer.update()
        q=[world_to_camera_view(sc,cam,o.matrix_world@Vector(p)) for p in info['ui_signpost']['text_quad_local']]
        json.dump([[v.x*RES,(1-v.y)*RES] for v in q],open(os.path.join(OUT,'renders','ui_signpost_textquad.json'),'w'))
