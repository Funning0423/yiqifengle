# blender -b head_r1_work.blend --python render_groups.py -- <out_dir> : color head parts by vertex group
import bpy, sys, math, os
from mathutils import Vector
OUT=sys.argv[sys.argv.index("--")+1]
sc=bpy.context.scene; body=bpy.data.objects['LOD0_G2_BODY']; me=body.data
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
if arm.animation_data: arm.animation_data.action=None
for pb in arm.pose.bones: pb.matrix_basis.identity()
gi={g.name:g.index for g in body.vertex_groups}
COL={'hair.fringe':(1.0,0.35,0.1),'hair.back':(0.1,0.8,0.3),'_tag_hair_shell':(0.1,0.15,0.45),'_tag_skull':(0.95,0.85,0.78),'_tag_hat':(0.8,0.7,0.45),'_tag_collar':(0.95,0.85,0.1),'_tag_neck':(0.9,0.75,0.7)}
ca=me.color_attributes.new('grp','FLOAT_COLOR','POINT')
for v in me.vertices:
    c=(0.6,0.6,0.6)
    for g,col in COL.items():
        if any(x.group==gi[g] and x.weight>0.5 for x in v.groups): c=col; break
    ca.data[v.index].color=(*c,1)
sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='VERTEX'; sh.show_specular_highlight=False
me.color_attributes.active_color=ca
w=bpy.data.worlds.new('w'); w.color=(0.85,0.87,0.9); sc.world=w; sh.background_type='WORLD'
sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam; cd.type='ORTHO'; cd.ortho_scale=0.36
sc.render.resolution_x=sc.render.resolution_y=700
for o in bpy.data.objects:
    if o.type=='MESH' and o!=body: o.hide_render=True
for name,az,el in (('front',0,0),('side',90,0),('back',180,0),('q34back',140,15)):
    a=math.radians(az); e=math.radians(el); t=Vector((0,0,1.55))
    d=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
    cam.location=t+d*3; cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(OUT,f'grp_{name}.png'); bpy.ops.render.render(write_still=True)
