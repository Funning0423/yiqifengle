"""S2-2 preview (not shipped): room_no_original_chair.glb (+ optional extra GLB) rendered from inside the room.
Single-sided materials (glTF doubleSided=false) get Cocos-like back-face culling (Backfacing -> Transparent), so a
missing wall shows exactly what the game shows (the outside / the island), not a convenient grey back face.
Shots: 8 world yaws (0..315 step 45, yaw = atan2(x,z) of the view direction) at pitch 0 from the approved home lens
(sitting-room, fov 75) and from the keepInside centre.
blender -b --factory-startup -P blender_room_360.py -- ROOM.glb OUTDIR TAG [EXTRA.glb|- [after|close]]
'after' mirrors RoomShell360 at runtime: env_interior_shell drawn two-sided (no culling emulation), the blind card and the
rear leaf card hidden (their replacements come from EXTRA.glb), plus close-ups of the shutter and the rear window."""
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
room, out, tag = argv[0], argv[1], argv[2]
extra = argv[3] if len(argv) > 3 else None
mode = argv[4] if len(argv) > 4 else ''
after = mode == 'after'
close_only = mode == 'close'  # original look (culling emulated, cards shown), close-ups only
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=room)
if extra and extra != '-': bpy.ops.import_scene.gltf(filepath=extra)
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
keep2 = set()
if after:
    for name in ('env_window_blind_cards', 'env_rear_window_plant'):
        o = bpy.data.objects.get(name)
        if o: o.hide_render = True; print('HIDE', name)
        else: print('MISSING', name)
    sh = bpy.data.objects.get('env_interior_shell')
    if sh:
        for s_ in sh.material_slots:
            if s_.material: keep2.add(s_.material.name)
    print('TWOSIDE', keep2)
for m in bpy.data.materials:
    if m.name in keep2: continue
    if not m.use_nodes or not m.use_backface_culling: continue
    nt = m.node_tree; outn = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL']
    if not outn or not outn[0].inputs['Surface'].links: continue
    o = outn[0]; src = o.inputs['Surface'].links[0].from_socket
    geo = nt.nodes.new('ShaderNodeNewGeometry'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(geo.outputs['Backfacing'], mix.inputs[0]); nt.links.new(src, mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], o.inputs['Surface'])
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16; sc.cycles.use_denoising = False; sc.cycles.max_bounces = 3
sc.cycles.transparent_max_bounces = 16
sc.render.resolution_x, sc.render.resolution_y = 300, 650
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.78, 0.85, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(35))
def g2b(p): return Vector((p[0], -p[2], p[1]))
lamp = bpy.data.objects.new('roomlamp', bpy.data.lights.new('roomlamp', 'POINT')); sc.collection.objects.link(lamp)
lamp.data.energy = 220; lamp.data.shadow_soft_size = 1.5; lamp.location = g2b((-0.3, 3.2, -2.6))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = 0.05; cam.data.clip_end = 1000; cam.data.angle = math.radians(75)
def shoot(pos, yaw, pitch, name):
    d = (math.cos(math.radians(pitch)) * math.sin(math.radians(yaw)), math.sin(math.radians(pitch)), math.cos(math.radians(pitch)) * math.cos(math.radians(yaw)))
    cam.location = g2b(pos); cam.rotation_euler = (g2b(d)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, name); bpy.ops.render.render(write_still=True)
HOME = (-1.32022071, 1.38613379, -2.11374307)
for yaw in ([] if close_only else range(0, 360, 45)):
    shoot(HOME, yaw, 0, '%s_home_yaw%03d.png' % (tag, yaw))
# FreeOrbit 'home' (feat/free-camera-r1): pivot = seatedRoot + lookM 1.05, dist 3.35 shortened until inside keepInside, fov 60.
PIV = (0.4327299768730942, 1.05, -4.207611558444886); BOX = ((-1.85, 0.7, -4.72), (1.05, 2.2, -1.55))
cam.data.angle = math.radians(60)
inside = lambda q: all(BOX[0][k] <= q[k] <= BOX[1][k] for k in range(3))
for a in ([] if close_only else range(0, 360, 45)):
    pr, ar = math.radians(10), math.radians(a)
    u = (math.cos(pr) * math.sin(ar), math.sin(pr), math.cos(pr) * math.cos(ar))
    d = 3.35
    while d > 1.25 and not inside([PIV[k] + d * u[k] for k in range(3)]): d -= 0.05
    pos = [min(max(PIV[k] + d * u[k], BOX[0][k]), BOX[1][k]) for k in range(3)]
    v = [PIV[k] - pos[k] for k in range(3)]
    yaw = math.degrees(math.atan2(v[0], v[2])); pitch = math.degrees(math.asin(v[1] / math.sqrt(sum(x * x for x in v))))
    shoot(pos, yaw, pitch, '%s_orbit_yaw%03d.png' % (tag, a))
    print('ORBIT', a, [round(x, 2) for x in pos], round(d, 2))
if after or close_only:
    cam.data.angle = math.radians(50)
    # shutter centre ~(1.79, 2.41, -0.78); rear plant origin (1.367, 1.91, -4.568); all looked at from inside the room
    shoot((0.95, 2.2, -1.62), 45, 10, '%s_close_shutter.png' % tag)
    shoot((1.25, 2.0, -1.2), 52, 30, '%s_close_shutter_side.png' % tag)
    shoot((0.9, 2.2, -3.4), 158, -13, '%s_close_rear.png' % tag)
    shoot((0.3, 2.4, -3.0), 146, -15, '%s_close_rear_wide.png' % tag)
print('DONE', tag)
