# Blender 4.5 preview for env_sky_cloudsea_soft (场景特效bot r5 skyground). Everything in env_skycity.glb node space.
#   blender -b --factory-startup -P blender_cloudsea_preview.py -- <env_skycity.glb> <soft.glb|-> <palette.png> <out.png> <cam> <day|night>
# soft.glb given: env_sky_cloudsea + env_sky_cumulus_far hidden, soft GLB added (M_env_palette -> palette.png, closest).
# soft.glb '-': the baseline clouds as they are. cam: r2 = pos [30,12,6] look [30,-12,-44]; S6 = pivot [0.2,0.032,-27.8]
# yaw 90 pitch 8 dist 10 (FreeOrbit: look = pivot + 1.25 up, cam = look + 10*orbitDir). fov 48 vertical, 390x844.
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; SKY, SOFT, PAL, OUT, CAM, MODE = a
HIDE = ('env_sky_cloudsea', 'env_sky_cumulus_far')
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
def g2b(p): return Vector((p[0], -p[2], p[1]))
def imp(p):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=p); return [o for o in bpy.data.objects if o not in before]
sky = imp(SKY)
if SOFT != '-':
    for o in sky:
        if o.name.split('.')[0] in HIDE: bpy.data.objects.remove(o, do_unlink=True)
    img = bpy.data.images.load(PAL)
    for o in imp(SOFT):
        for m in (o.data.materials if o.type == 'MESH' else []):
            nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
            nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.9
            b.inputs['Emission Strength'].default_value = 0.0
if CAM == 'r2': pos, look = [30, 12, 6], [30, -12, -44]
else:
    lk = [0.2, 0.032 + 1.25, -27.8]; y, p = math.radians(90), math.radians(8)
    d = [math.cos(p) * math.sin(y), math.sin(p), math.cos(p) * math.cos(y)]; pos = [lk[i] + 10 * d[i] for i in range(3)]; look = lk
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(48); cam.data.clip_end = 3000
cam.location = g2b(pos); cam.rotation_euler = (g2b(look) - g2b(pos)).to_track_quat('-Z', 'Y').to_euler()
night = MODE == 'night'
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
if night: sun.data.energy = 0.35; sun.data.color = (0.62, 0.72, 1.0); sun.rotation_euler = (math.radians(40), 0, math.radians(-30))
else: sun.data.energy = 3.2; sun.data.color = (1, .96, .9); sun.rotation_euler = (math.radians(40), 0, math.radians(35))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.035, 0.05, 0.12, 1) if night else (0.50, 0.68, 0.92, 1); bg.inputs[1].default_value = 0.6 if night else 1.0
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 390, 844; sc.view_settings.view_transform = 'Standard'
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
