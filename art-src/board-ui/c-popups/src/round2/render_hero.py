# 首次获得道具弹窗的大图：直接打开 (b) v3.1 的 board_props.blend（只读，不保存），用 (b) 的焦点灯光和 tool 机位，
# 只把分辨率从 192 提到 720。blender -b b-board/src/board_props.blend -P render_hero.py -- <outdir> tool_starlight[,tool_windbell,...]
import bpy, sys, os, math
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]; OUT=argv[0]; names=argv[1].split(','); RES=int(argv[2]) if len(argv)>2 else 720
for im in bpy.data.images:
    if 'env_palette' in im.name or 'env_palette' in im.filepath: im.filepath='/workspace/yiqifengle/work/grokbot/ui-props/textures/env_palette_256.png'; im.reload()
sc=bpy.context.scene; sc.cycles.samples=96
cam=sc.camera; cd=cam.data
focus=bpy.data.collections.get('focus_props')
sun=bpy.data.objects['sun']; top=bpy.data.objects['top']; rim=bpy.data.objects['rim']; catcher=bpy.data.objects['catcher']
bg=sc.world.node_tree.nodes['Background']
for n in names:
    for o in bpy.data.objects:
        if o.type=='MESH': o.hide_render=(o.name not in (n,'catcher'))
    ob=bpy.data.objects[n]; ob.location=(0,0,0); ob.scale=(1,1,1)
    top.hide_render=False; rim.hide_render=False; sun.light_linking.receiver_collection=focus
    bg.inputs['Strength'].default_value=0.22; sun.data.energy=3.5
    el,az,osc,cz=38,0,1.25,0.42
    d=Vector((math.sin(math.radians(az))*math.cos(math.radians(el)),-math.cos(math.radians(az))*math.cos(math.radians(el)),math.sin(math.radians(el))))
    cam.location=Vector((0,0,cz))+d*20; cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler(); cd.ortho_scale=osc
    sc.render.resolution_x=sc.render.resolution_y=RES; cd.sensor_fit='AUTO'
    sc.render.filepath=os.path.join(OUT,n+'_hero.png'); bpy.ops.render.render(write_still=True)
print('HERO DONE')
