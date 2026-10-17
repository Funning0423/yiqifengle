import bpy, math
from mathutils import Vector, Matrix
def setup(res=(900,900)):
    sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'
    sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='MATERIAL'; sh.show_backface_culling=False; sh.show_xray=False
    sh.show_cavity=False; sh.show_object_outline=True
    sc.render.resolution_x,sc.render.resolution_y=res; sc.render.film_transparent=False
    sc.view_settings.view_transform='Standard'
    c=bpy.data.collections.get('ENV_COL_PROXIES')
    if c: c.hide_render=True
def cam(name,loc,target,lens=50,ortho=None):
    c=bpy.data.objects.get(name)
    if c is None:
        c=bpy.data.objects.new(name,bpy.data.cameras.new(name)); bpy.context.scene.collection.objects.link(c)
    c.location=Vector(loc); d=(Vector(target)-Vector(loc)); c.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    c.data.lens=lens; c.data.clip_start=0.01
    if ortho: c.data.type='ORTHO'; c.data.ortho_scale=ortho
    else: c.data.type='PERSP'
    return c
def shoot(c,path,hide=()):
    sc=bpy.context.scene; sc.camera=c; hidden=[]
    for n in hide:
        o=bpy.data.objects.get(n)
        if o and not o.hide_render: o.hide_render=True; hidden.append(o)
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
    for o in hidden: o.hide_render=False
