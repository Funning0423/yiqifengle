# U3 加载页底图出图：u3_scene.py 搭的 bc81575f 场景（房间 + 圆凳 + cand6 sit_hold f0 + morph）
# 渲染设置照搬运镜bot loading-base/render_base.py：EEVEE、AgX、32 采样、暖色天光 (1.0,0.93,0.82)×0.9、暖色平行光 3.0（无投影）、镜头方向面光 120 W、
# 机位 = RegionCameraData sitting-room（home_shot.json），竖直 FOV 75°，shift_y −0.14，景深 f/1.8 焦点在她身上。唯一差别：角色 scale 1（生产版），旧版 1.0612。
# blender -b -P u3_render.py -- OUT_PNG      env: LB_PRE=mask_girl.py（出人物遮罩）、LB_SAMPLES、LB_SHIFT_Y、LB_FSTOP、LB_VIEW、LB_SUN、LB_WORLD、LB_FILL
import bpy, sys, os, json, math, mathutils
out = sys.argv[sys.argv.index('--') + 1:][0]
exec(open('/workspace/u3/tools/u3_scene.py').read())
shot = json.load(open(os.environ.get('U3_SHOT', '/workspace/u3/src/tools/camera-render/loading-base/home_shot.json')))[0]
chobjs = [o for o in bpy.data.objects if o in set(chobjs)]
roomobjs = [o for o in bpy.data.objects if o not in set(chobjs) and o.type == 'MESH']
for m in bpy.data.materials:
    if not m.use_nodes: continue
    for l in m.node_tree.links:
        if l.to_socket.name == 'Base Color' and l.from_node.type == 'TEX_IMAGE': m.node_tree.nodes.active = l.from_node
OPAQUE_SKIP = ('glass', 'sky', 'cloud', 'foam', 'beam', 'halo', 'glow', 'window_view')
for m in bpy.data.materials:
    if not m.use_nodes or any(k in m.name.lower() for k in OPAQUE_SKIP): continue
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            for l in list(n.inputs['Alpha'].links): m.node_tree.links.remove(l)
            n.inputs['Alpha'].default_value = 1.0
    if m.name.startswith('M_env_palette') and os.environ.get('LB_KEEP_EMIT') != '1':
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                for l in list(n.inputs['Emission Color'].links): m.node_tree.links.remove(l)
                n.inputs['Emission Strength'].default_value = 0.0
    try: m.blend_method = 'OPAQUE'
    except Exception: pass
for o in bpy.data.objects:
    if any(o.name.startswith(p) for p in ('env_lighthouse_beam', 'env_sky_moon')): o.hide_render = True
    if o.name.startswith('col_'): o.hide_render = True
sc = bpy.context.scene; W, H = 750, 1624
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = os.environ.get('LB_VIEW', 'AgX'); sc.view_settings.look = 'None'; sc.view_settings.exposure = float(os.environ.get('LB_EXPOSURE', '0'))
w = sc.world or bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (1.0, 0.93, 0.82, 1); bg.inputs[1].default_value = float(os.environ.get('LB_WORLD', '0.9'))
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = int(os.environ.get('LB_SAMPLES', '32'))
try: sc.eevee.use_shadows = True
except Exception: pass
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = float(os.environ.get('LB_SUN', '3.0')); sd.color = (1.0, 0.90, 0.74); sd.angle = math.radians(12); sd.use_shadow = False
so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(-120))
fd = bpy.data.lights.new('fill', 'AREA'); fd.energy = float(os.environ.get('LB_FILL', '120')); fd.color = (1.0, 0.93, 0.84); fd.size = 3; fd.use_shadow = False
fo = bpy.data.objects.new('fill', fd); sc.collection.objects.link(fo)
cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.clip_start = 0.05; cd.clip_end = 1000
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
conv = mathutils.Quaternion((1, 0, 0), math.radians(90)); q = shot['rot']; qc = mathutils.Quaternion((q[3], q[0], q[1], q[2]))
cam.location = bl(shot['pos']); cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = conv @ qc
cd.lens_unit = 'FOV'; cd.angle = math.radians(shot['fov']); cd.shift_y = float(os.environ.get('LB_SHIFT_Y', '-0.14'))
fo.location = cam.location + mathutils.Vector((0, 0, 0.6)); fo.rotation_mode = 'QUATERNION'; fo.rotation_quaternion = cam.rotation_quaternion
fs = float(os.environ.get('LB_FSTOP', '1.8'))
if fs > 0:
    cd.dof.use_dof = True; cd.dof.focus_distance = (bl([root[0], 1.0, root[2]]) - cam.location).length; cd.dof.aperture_fstop = fs
if os.environ.get('LB_CAM'):   # 特写机位：'x,y,z;tx,ty,tz;lens_mm'（Blender 坐标），关景深、关 shift，补光跟随机位
    a,t,ln=os.environ['LB_CAM'].split(';'); cam.location=mathutils.Vector([float(v) for v in a.split(',')]); tv=mathutils.Vector([float(v) for v in t.split(',')])
    cam.rotation_quaternion=(tv-cam.location).to_track_quat('-Z','Y'); cd.lens_unit='MILLIMETERS'; cd.lens=float(ln); cd.shift_y=0; cd.dof.use_dof=False; fs=0
    fo.location=cam.location+mathutils.Vector((0,0,0.6)); fo.rotation_quaternion=cam.rotation_quaternion
    sc.render.resolution_x=int(os.environ.get('LB_W','900')); sc.render.resolution_y=int(os.environ.get('LB_H','900'))
print('U3RENDER', json.dumps(dict(view=sc.view_settings.view_transform, exposure=sc.view_settings.exposure, world=bg.inputs[1].default_value, sun=sd.energy, fill=fd.energy,
      samples=sc.eevee.taa_render_samples, shift_y=cd.shift_y, fov=shot['fov'], fstop=fs, cam=shot['pos'], rot=shot['rot'], engine=sc.render.engine)))
if os.environ.get('LB_PRE'): exec(open(os.environ['LB_PRE']).read())
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = out; bpy.ops.render.render(write_still=True); print('RENDERED', out)
