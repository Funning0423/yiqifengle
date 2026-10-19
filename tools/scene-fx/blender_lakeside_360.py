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
OV = os.environ.get('QF_LK_MODELS')  # optional dir of replacement GLBs (+ transforms.json) for before/after previews
T = json.load(open(OV + '/transforms.json' if OV and os.path.exists(OV + '/transforms.json') else B + 'scene_r5h_slim_transforms.json'))
SKIP = ('LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb')
lib = {}
hold = bpy.data.collections.new('lib'); sc.collection.children.link(hold)
for ins in T['instances']:
    g = ins.get('glb')
    if not isinstance(g, str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name') == g.replace('.glb', ''): continue
    if g not in lib:
        objs = imp(OV + '/' + g if OV and os.path.exists(OV + '/' + g) else HILLS if g == 'LK_far_hills.glb' else B + 'models/' + g)
        for o in objs:
            for c in list(o.users_collection): c.objects.unlink(o)
            hold.objects.link(o)
        lib[g] = [(o.data, o.matrix_world.copy()) for o in objs if o.type == 'MESH']
    x, y, z, w = ins['rot_quat_xyzw']; q = Quaternion((w, x, y, z)).to_matrix().to_4x4()
    sx, sy, sz = ins['scale']; M = tr(ins['pos']) @ q @ Matrix.Diagonal((sx, sy, sz, 1))
    for data, mw in lib[g]:
        o = bpy.data.objects.new(ins['name'], data); sc.collection.objects.link(o); o.matrix_world = C @ M @ Ci @ mw
hold.hide_render = True
# game lighting direction (LAKESIDE_DIR_LIGHT_PARAMS.sunForward, board yaw 0) and the per-class land fills of
# lakesideModeLighting('day') as emission (Cocos adds emissive x emissiveScale the same way), so the preview shows the
# in-game near / far split (the far class gets the cool haze)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.4; sun.data.color = (1, .86, .72); sun.rotation_mode = 'QUATERNION'
sun.rotation_quaternion = g2b((-0.4182, -0.3983, 0.8164)).normalized().to_track_quat('-Z', 'Y')
FILL = {'near': (0.104, 0.196, 0.025), 'far': (0.043, 0.087, 0.107), 'foliage': (0.019, 0.065, 0.0), 'wall': (0.023, 0.02, 0.017), 'rock': (0.079, 0.079, 0.079)}
CLS = {'LK_terrain': 'near', 'LK_far_hills': 'far', 'LK_far_shore': 'far', 'LK_tree_conifer': 'foliage', 'LK_tree_round': 'foliage',
       'LK_bush': 'foliage', 'LK_house_A': 'wall', 'LK_house_B': 'wall', 'LK_house_C': 'wall', 'LK_rock': 'rock'}
if os.environ.get('QF_NOFILL') != '1':
    fm = {}
    for g, objs in lib.items():
        c = CLS.get(g.replace('.glb', ''))
        if not c: continue
        for data, mw in objs:
            for si, mat in enumerate(data.materials):
                if mat is None: continue
                key = (mat.name, c)
                if key not in fm:
                    m2 = mat.copy(); bs = m2.node_tree.nodes.get('Principled BSDF')
                    if bs: bs.inputs['Emission Color'].default_value = FILL[c] + (1,); bs.inputs['Emission Strength'].default_value = 1.0
                    fm[key] = m2
                data.materials[si] = fm[key]
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
BOARD = os.environ.get('QF_BOARD')  # 'px,py,pz,qx,qy,qz,qw,fovV,W,H': one board-background still (Cocos pose, lens looks -z)
if BOARD:
    v = [float(t) for t in BOARD.split(',')]
    sc.render.resolution_x, sc.render.resolution_y = int(v[8]), int(v[9]); cam.data.angle = math.radians(v[7])
    q = Quaternion((v[6], v[3], v[4], v[5]))
    cam.location = g2b(v[:3]); cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = C.to_quaternion() @ q  # glTF Y-up -> Blender Z-up (both cameras look -z, up +y locally)
    sc.render.filepath = os.path.join(OUT, '%s_board_portrait.png' % TAG); bpy.ops.render.render(write_still=True)
    print('ALLDONE'); sys.exit(0)
for a in range(0, 360, 45):
    p, ar = math.radians(PITCH), math.radians(a)
    pos = (piv[0] + DIST * math.cos(p) * math.sin(ar), piv[1] + DIST * math.sin(p), piv[2] + DIST * math.cos(p) * math.cos(ar))
    P, Tg = g2b(pos), g2b(piv); cam.location = P
    cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (Tg - P).normalized().to_track_quat('-Z', 'Y')
    sc.render.filepath = os.path.join(OUT, '%s_az%03d.png' % (TAG, a)); bpy.ops.render.render(write_still=True)
    print('Saved az', a)
print('ALLDONE')
