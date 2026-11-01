"""S2-1 preview (not shipped): the in-game journey composite. Island room GLB in world + env_meadow.glb turned 180 deg
about Y at sailMeadowRoot (-1.7,-1.35,79.1) (default island->meadow transport = sail). Like RegionJourneyAdapter,
meadow_far_hills and (daytime) meadow_sky_dome are hidden; the island sky dome / sea / cloud ring stay.
8 orbit azimuths around M3 (meadow-local azimuth a, 运镜bot convention) mapped to world.
blender -b --factory-startup -P blender_meadow_journey_360.py -- ROOM.glb MEADOW.glb OUTDIR TAG pitch dist"""
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
room, meadow, out, tag, pitch, dist = argv[0], argv[1], argv[2], argv[3], float(argv[4]), float(argv[5])
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=room)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=meadow)
new = [o for o in bpy.data.objects if o not in before]
ROOT = (-1.7, -1.35, 79.1)
def g2b(p): return Vector((p[0], -p[2], p[1]))
pivot_obj = bpy.data.objects.new('meadow_root', None); bpy.context.scene.collection.objects.link(pivot_obj)
pivot_obj.location = g2b(ROOT); pivot_obj.rotation_euler = (0, 0, math.pi)
for o in new:
    if o.parent is None: o.parent = pivot_obj
for o in list(bpy.data.objects):
    n = o.name
    if o.type in ('CAMERA', 'LIGHT') or n.startswith('meadow_far_hills') or n.startswith('meadow_sky_dome'):
        o.hide_render = True
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 12; sc.cycles.use_denoising = False; sc.cycles.max_bounces = 2
sc.render.resolution_x, sc.render.resolution_y = 300, 650
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.53, 0.75, 0.79, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(40), 0, math.radians(35))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = 0.1; cam.data.clip_end = 1000; cam.data.angle = math.radians(48)
rot = lambda p: (ROOT[0] - p[0], ROOT[1] + p[1], ROOT[2] - p[2])
piv_l = (-3.0, 4.0 + 1.15, -8.4)
for a in range(0, 360, 45):
    ar, pr = math.radians(a), math.radians(pitch)
    lens_l = (piv_l[0] + dist * math.cos(pr) * math.sin(ar), piv_l[1] + dist * math.sin(pr), piv_l[2] + dist * math.cos(pr) * math.cos(ar))
    cam.location = g2b(rot(lens_l)); d = g2b(rot(piv_l)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, '%s_az%03d.png' % (tag, a)); bpy.ops.render.render(write_still=True)
print('DONE', tag)
