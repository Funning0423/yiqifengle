# 预览：workbench 五角度 + 特写。blender -b --python shots.py -- glb outdir tag [clip frame] ；EXTRA=lantern 配置 json
import bpy,sys,os,math,json
from mathutils import Vector,Matrix
glb,out,tag=sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=glb)
for o in bpy.data.objects:
    if o.name.startswith('Icosphere'): o.hide_render=True
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
clip=os.environ.get('CLIP','idle_breathing_loop');fr=float(os.environ.get('FR','0'))
act=bpy.data.actions.get(clip) or [a for a in bpy.data.actions if a.name.startswith(clip)][0]
arm.animation_data_create();arm.animation_data.action=act
try: arm.animation_data.action_slot=act.slots[0]
except Exception: pass
for t in arm.animation_data.nla_tracks: t.mute=True
for o in bpy.data.objects:
    if o.type=='MESH' and o.data.shape_keys:
        for kb in o.data.shape_keys.key_blocks[1:]: kb.value=json.loads(os.environ.get('MORPH_FORCE','{}')).get(kb.name,0)
sc.frame_set(int(act.frame_range[0]+fr))
if os.environ.get('LANTERN'):
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
    attach_lantern(arm,os.environ['LANTERN'])
    bpy.context.view_layer.update()
sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='TEXTURE';sc.display.shading.show_cavity=True
sc.render.resolution_x=int(os.environ.get('RX','480'));sc.render.resolution_y=int(os.environ.get('RY','640'))
w=bpy.data.worlds.new('w');sc.world=w;w.color=(0.86,0.86,0.86)
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.lens=50
def look(pos,tgt): cam.location=pos;cam.rotation_euler=(tgt-pos).to_track_quat('-Z','Y').to_euler()
C=Vector((0,0,0.88))
V=json.loads(os.environ.get('VIEWS','[["front",0,0,3.1,[0,0,0.88]],["side",90,0,3.1,[0,0,0.88]],["back",180,0,3.1,[0,0,0.88]],["34",45,0,3.1,[0,0,0.88]],["top30",0,30,3.1,[0,0,0.88]]]'))
for name,az,el,dist,tg in V:
    a=math.radians(az);e=math.radians(el);tg=Vector(tg)
    d=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
    look(tg+d*dist,tg);sc.render.filepath=f'{out}/{tag}_{name}.png';bpy.ops.render.render(write_still=True)
