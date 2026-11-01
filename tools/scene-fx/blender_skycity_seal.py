# Blender 4.5 preview for the skycity floor seal (场景特效bot r5 S2). Journey world = lakeside instances + skycity placed
# exactly like tools/lakeside-landing-cam/render_shots.py (运镜bot), Cycles + OpenImageDenoise.
#   blender -b --factory-startup -P blender_skycity_seal.py -- shots.json <env_skycity.glb> outdir tag [marker]
# shots.json: {scene:{lakeYawDeg,lakeRoot,skyYawDeg,skyOff,repo}, res:[w,h], shots:[{name,cam:{position,target,fov}}]}
# marker: a flat magenta sheet just under the lakeside ground plane over the audit's forbidden block (lake-local
# z 42..90, x -36..33) - every magenta pixel is a ray the south-bank rule counts as a leak.
import bpy, json, sys, math, os
from mathutils import Matrix, Vector, Quaternion
argv = sys.argv[sys.argv.index('--') + 1:]
J = json.load(open(argv[0])); SKY = argv[1]; OUT = argv[2]; TAG = argv[3]; MARK = len(argv) > 4 and argv[4] == 'marker'
os.makedirs(OUT, exist_ok=True)
S = J['scene']; B = S['repo'] + '/creator-build-project/assets/bundles/'
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))); Ci = C.inverted()
def g2b(p): return Vector((p[0], -p[2], p[1]))
def ry(deg):
    t = math.radians(deg); c, s = math.cos(t), math.sin(t)
    return Matrix(((c, 0, s, 0), (0, 1, 0, 0), (-s, 0, c, 0), (0, 0, 0, 1)))
def tr(v): m = Matrix.Identity(4); m.translation = Vector(v); return m
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def imp(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
def roots(objs): return [o for o in objs if o.parent is None or o.parent not in objs]
T = json.load(open(B + 'region_lakeside/scene_r5h_slim_transforms.json'))
SKIP = ('LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb')
lib = {}; lake = tr(S['lakeRoot']) @ ry(S['lakeYawDeg'])
hold = bpy.data.collections.new('lib'); sc.collection.children.link(hold)
for ins in T['instances']:
    g = ins.get('glb')
    if not isinstance(g, str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name') == g.replace('.glb', ''): continue
    if g not in lib:
        objs = imp(B + 'region_lakeside/models/' + g)
        for o in objs:
            for c in list(o.users_collection): c.objects.unlink(o)
            hold.objects.link(o)
        lib[g] = [(o.data, o.matrix_world.copy()) for o in objs if o.type == 'MESH']
    x, y, z, w = ins['rot_quat_xyzw']; q = Quaternion((w, x, y, z)).to_matrix().to_4x4()
    sx, sy, sz = ins['scale']; M = lake @ tr(ins['pos']) @ q @ Matrix.Diagonal((sx, sy, sz, 1))
    for data, mw in lib[g]:
        o = bpy.data.objects.new(ins['name'], data); sc.collection.objects.link(o); o.matrix_world = C @ M @ Ci @ mw
hold.hide_render = True
HIDE = ('cloudsea', 'cumulus_far', 'cloud_small', 'Icosphere', '_after')
objs = imp(SKY); emp = bpy.data.objects.new('sky_root', None); sc.collection.objects.link(emp)
for o in roots(objs): o.parent = emp
emp.matrix_world = C @ tr(S['skyOff']) @ ry(S['skyYawDeg']) @ Ci
for o in objs:
    if any(h in o.name for h in HIDE): o.hide_render = True
if MARK:
    me = bpy.data.meshes.new('leak_marker'); ys = 0.58 - 0.25
    pts = [(-36, ys, 42), (33, ys, 42), (33, ys, 90), (-36, ys, 90)]
    W = [lake @ Vector((p[0], p[1], p[2], 1)) for p in pts]
    me.from_pydata([g2b((v[0], v[1], v[2])) for v in W], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new('leak_marker', me); sc.collection.objects.link(ob)
    m = bpy.data.materials.new('leak'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1, 0, 1, 1); em.inputs[1].default_value = 1.5
    o_ = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], o_.inputs[0]); me.materials.append(m)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sun.data.color = (1, .96, .9)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = (.55, .72, .92, 1); bg.inputs[1].default_value = .9
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = .05; cam.data.clip_end = 3000
sc.render.resolution_x, sc.render.resolution_y = J['res']; sc.render.resolution_percentage = 100
only = os.environ.get('QF_SHOTS')
for sh in J['shots']:
    if only and sh['name'] not in only.split(','): continue
    p = g2b(sh['cam']['position']); t = g2b(sh['cam']['target']); cam.location = p
    cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (t - p).normalized().to_track_quat('-Z', 'Y')
    cam.data.angle = math.radians(sh['cam']['fov'])
    sc.render.filepath = os.path.join(OUT, '%s_%s.png' % (TAG, sh['name'])); bpy.ops.render.render(write_still=True)
    print('Saved', sh['name'])
print('ALLDONE')
