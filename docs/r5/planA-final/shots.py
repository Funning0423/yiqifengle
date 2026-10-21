import os,math
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
import json
if os.environ.get('META_ADD'):
    for _c,_d in json.load(open(os.environ['META_ADD'])).items(): MC[_c].update(_d)
for o in roomobjs: o.hide_render=True
OUT=os.environ['SOUT'];TAG=os.environ['TAG']
place('sit_hold',30)
sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='TEXTURE';sc.display.shading.show_cavity=True
sc.render.resolution_x=520;sc.render.resolution_y=640;sc.render.film_transparent=False
w=bpy.data.worlds.new('w');sc.world=w;w.color=(0.85,0.85,0.85)
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.lens=50
C=hc.location.copy()+Vector((0,0,0.55))
def look(pos,tgt):
    cam.location=pos;d=(tgt-pos);cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
# character faces fwd = Rz(YAW)@(0,-1,0)
def dirv(a): v=mathutils.Matrix.Rotation(YAW+a,3,'Z')@Vector((0,-1,0));return v
for name,az,el,dist,tgt in [('front',0,0,3.2,C),('side',math.pi/2,0,3.2,C),('back',math.pi,0,3.2,C),('34',math.pi/4,0,3.2,C),('top30',0,math.radians(30),3.2,C),('stool_close',math.radians(60),math.radians(10),1.3,hc.location+Vector((0,0,0.42)))]:
    v=dirv(az)*math.cos(el)+Vector((0,0,math.sin(el)));look(tgt+v*dist,tgt)
    sc.render.filepath=f'{OUT}/{TAG}_{name}.png';bpy.ops.render.render(write_still=True)
