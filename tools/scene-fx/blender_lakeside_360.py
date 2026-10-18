# Blender 4.5 preview of the lakeside far ring (场景特效bot r5 S2): the lakeside instances (lake-local, glTF Y-up) with
# LK_far_hills.glb taken from a given path; 8 free-camera azimuths around the landing pivot, Cycles + OpenImageDenoise.
#   blender -b --factory-startup -P blender_lakeside_360.py -- <repo> <LK_far_hills.glb> outdir tag [pitch dist]
# azimuth a (deg): lens at pivot + d*[cos p sin a, sin p, cos p cos a] (free_cam_audit convention, a 0 = lens on +z).
import bpy, json, sys, math, os
from mathutils import Matrix, Vector, Quaternion
argv = sys.argv[sys.argv.index('--') + 1:]
REPO, HILLS, OUT, TAG = argv[:4]
PITCH = float(argv[4]) if len(argv) > 4 else 12.0
DIST = float(argv[5]) if len(argv) > 5 else 10.0
os.makedirs(OUT, exist_ok=True)
B = REPO + '/creator-build-project/assets/bundles/region_lakeside/'
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))); Ci = C.inverted()
def g2b(p): return Vector((p[0], -p[2], p[1]))
def tr(v): m = Matrix.Identity(4); m.translation = Vector(v); return m
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def imp(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
T = json.load(open(B + 'scene_r5h_slim_transforms.json'))
SKIP = ('LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb')
lib = {}
hold = bpy.data.collections.new('lib'); sc.collection.children.link(hold)
for ins in T['instances']:
    g = ins.get('glb')
    if not isinstance(g, str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name') == g.replace('.glb', ''): continue
    if g not in lib:
        objs = imp(HILLS if g == 'LK_far_hills.glb' else B + 'models/' + g)
        for o in objs:
            for c in list(o.users_collection): c.objects.unlink(o)
            hold.objects.link(o)
        lib[g] = [(o.data, o.matrix_world.copy()) for o in objs if o.type == 'MESH']
    x, y, z, w = ins['rot_quat_xyzw']; q = Quaternion((w, x, y, z)).to_matrix().to_4x4()
    sx, sy, sz = ins['scale']; M = tr(ins['pos']) @ q @ Matrix.Diagonal((sx, sy, sz, 1))
    for data, mw in lib[g]:
        o = bpy.data.objects.new(ins['name'], data); sc.collection.objects.link(o); o.matrix_world = C @ M @ Ci @ mw
hold.hide_render = True
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sun.data.color = (1, .96, .9)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = (.55, .72, .92, 1); bg.inputs[1].default_value = .9
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = .05; cam.data.clip_end = 3000; cam.data.angle = math.radians(48)
sc.render.resolution_x, sc.render.resolution_y = 360, 780; sc.render.resolution_percentage = 100
piv = (1.2, 0.58 + 1.2, 36.0)
for a in range(0, 360, 45):
    p, ar = math.radians(PITCH), math.radians(a)
    pos = (piv[0] + DIST * math.cos(p) * math.sin(ar), piv[1] + DIST * math.sin(p), piv[2] + DIST * math.cos(p) * math.cos(ar))
    P, Tg = g2b(pos), g2b(piv); cam.location = P
    cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (Tg - P).normalized().to_track_quat('-Z', 'Y')
    sc.render.filepath = os.path.join(OUT, '%s_az%03d.png' % (TAG, a)); bpy.ops.render.render(write_still=True)
    print('Saved az', a)
print('ALLDONE')
