"""S2-1 preview (not shipped): import env_meadow.glb, render 8 orbit azimuths (0..315 step 45, 运镜bot convention
lens = pivot + d*[cos p sin a, sin p, cos p cos a], glTF coords) around M3 + lookM, plus the board portrait pose.
blender -b --factory-startup -P blender_meadow_360.py -- GLB OUTDIR TAG [pitch] [dist] [extra]
QF_CLEAN=1 in the environment: 64 samples + denoise, board portrait at 540x1170."""
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
glb, out, tag = argv[0], argv[1], argv[2]
pitch = float(argv[3]) if len(argv) > 3 else 20.0
dist = float(argv[4]) if len(argv) > 4 else 14.0
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if o.type == 'CAMERA' or o.type == 'LIGHT':
        bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; clean = os.environ.get('QF_CLEAN') == '1'  # review renders: more samples + OpenImageDenoise
sc.cycles.samples = 64 if clean else 12; sc.cycles.use_denoising = clean
if clean: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 2
sc.render.resolution_x, sc.render.resolution_y = (360, 780) if clean else (300, 650)
sc.render.film_transparent = False
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.53, 0.75, 0.79, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(40), 0, math.radians(35))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = 0.1; cam.data.clip_end = 1000
def g2b(p): return Vector((p[0], -p[2], p[1]))
def shoot(pos, tgt, fov, name):
    cam.data.angle = math.radians(fov)
    cam.location = g2b(pos)
    d = g2b(tgt) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, name)
    bpy.ops.render.render(write_still=True)
piv = (-3.0, 4.0 + 1.15, -8.4)
if len(argv) > 5 and argv[5] == 'river':  # both river ends: along the river from inside the meadow + oblique from above
    sc.render.resolution_x, sc.render.resolution_y = (720, 480)
    shoot((45, 7, 27), (86, -5, 33), 45, '%s_river_east_along.png' % tag)
    shoot((66, 24, 2), (85, -5, 35), 50, '%s_river_east_above.png' % tag)
    shoot((-45, 7, 50), (-86, -5, 43), 45, '%s_river_west_along.png' % tag)
    shoot((-64, 24, 72), (-85, -5, 42), 50, '%s_river_west_above.png' % tag)
    print('DONE', tag); sys.exit(0)
if len(argv) > 5 and argv[5] == 'extra':  # ring overview + outside/back-slope check (not a gameplay lens)
    sc.render.resolution_x, sc.render.resolution_y = 640, 400
    shoot((0, 120, 150), (0, 0, -20), 50, '%s_x_aerial.png' % tag)
    for o in bpy.data.objects:  # check views from outside the ring: hide the sky dome so the back slopes are visible
        if o.name.startswith('meadow_sky_dome'): o.hide_render = True
    shoot((60, 45, -330), (0, 10, -180), 40, '%s_x_backslope_s.png' % tag)
    shoot((-330, 45, 40), (-180, 10, 0), 40, '%s_x_backslope_w.png' % tag)
    print('DONE', tag); sys.exit(0)
for a in range(0, 360, 45):
    ar, pr = math.radians(a), math.radians(pitch)
    pos = (piv[0] + dist * math.cos(pr) * math.sin(ar), piv[1] + dist * math.sin(pr), piv[2] + dist * math.cos(pr) * math.cos(ar))
    shoot(pos, piv, 48, '%s_az%03d.png' % (tag, a))
if clean: sc.render.resolution_x, sc.render.resolution_y = 540, 1170
shoot((9, 19, 42), (0.3274661665889038, 5.509406509325702, -15.81687522999821), 49.426, '%s_board_portrait.png' % tag)
print('DONE', tag)
