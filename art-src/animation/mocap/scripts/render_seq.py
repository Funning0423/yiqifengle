# Preview renderer (Blender workbench, headless).  blender -b -P render_seq.py -- <glb> <seq.json> <outdir> [views] [res]
# seq.json: {"frames": [[clip, t_s, x, z, yaw_rad], ...], "follow": true, "cam_at": [x, z]}
#   follow=false: cameras stay on cam_at (default: the first frame's root).
#   root pose per frame in glTF character space (x = her left, z = forward, yaw + = to her left), as the driver places her.
# views: comma list of side,front,back,q34,top,fixed34 (default side,front).  Output: <outdir>/<view>_<i:04d>.png
import bpy, sys, math, os, json
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index('--') + 1:]
GLB, SEQ, OUTD = a[:3]
VIEWS = (a[3] if len(a) > 3 else 'side,front').split(',')
RESY = int(a[4]) if len(a) > 4 else 600
S = json.load(open(SEQ))
FR = S['frames']
FPS = 30
bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
sc = bpy.context.scene
sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=GLB)
for o in list(bpy.data.objects):
    if o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
rootobj = arm
while rootobj.parent is not None:
    rootobj = rootobj.parent
if arm.animation_data:
    for t in arm.animation_data.nla_tracks:
        t.mute = True
else:
    arm.animation_data_create()
# glTF clip seconds -> importer frames
import struct
raw = open(GLB, 'rb').read()
jl = struct.unpack('<I', raw[12:16])[0]
GJ = json.loads(raw[20:20 + jl])
DUR = {an['name']: max(GJ['accessors'][s['input']]['max'][0] for s in an['samplers']) for an in GJ['animations']}


def fscale(name):
    act = bpy.data.actions[name]
    return (act.frame_range[1] - act.frame_range[0]) / DUR[name] if DUR[name] > 0 else 1.0


def froot(name):
    return bpy.data.actions[name].frame_range[0]


# ground: 10 cm grid
gm = bpy.data.materials.new('g')
gm.diffuse_color = (0.42, 0.45, 0.40, 1)
tm = bpy.data.materials.new('t')
tm.diffuse_color = (0.12, 0.12, 0.12, 1)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.0015))
g = bpy.context.object
g.scale = (12, 12, 1)
g.data.materials.append(gm)
for i in range(-40, 41):
    for axis in (0, 1):
        loc = (i * 0.1, 0, 0) if axis == 0 else (0, i * 0.1, 0)
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        c = bpy.context.object
        w = 0.007 if i % 5 == 0 else 0.003
        c.scale = (w, 8, 0.002) if axis == 0 else (8, w, 0.002)
        c.data.materials.append(tm)
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.color_type = 'TEXTURE'
sh.show_shadows = True
sh.show_cavity = True
sh.cavity_type = 'WORLD'
sh.background_type = 'WORLD'
wd = bpy.data.worlds.new('w')
wd.color = (0.16, 0.17, 0.19)
sc.world = wd
sc.view_settings.view_transform = 'Standard'
sc.render.film_transparent = False


def cam(name, ortho, scale=2.1, lens=50):
    cd = bpy.data.cameras.new(name)
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = scale
    else:
        cd.lens = lens
    c = bpy.data.objects.new(name, cd)
    sc.collection.objects.link(c)
    return c


EL = math.radians(8)
cams = {v: cam(v, v not in ('q34', 'fixed34'), 2.1 if v != 'top' else 1.2, 55) for v in VIEWS}
os.makedirs(OUTD, exist_ok=True)
R0 = FR[0]
for i, (clip, t, x, z, yaw) in enumerate(FR):
    act = bpy.data.actions[clip]
    arm.animation_data.action = act
    f = froot(clip) + t * fscale(clip)
    M = Matrix.Rotation(yaw, 4, 'Z')
    M.translation = Vector((x, -z, 0))
    rootobj.matrix_world = M
    sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    ca = S.get('cam_at') or [R0[2], R0[3]]
    p = Vector((x, -z, 0)) if S.get('follow', True) else Vector((ca[0], -ca[1], 0))
    fy = S.get('cam_yaw', 0.0)
    Rz = Matrix.Rotation(fy, 4, 'Z')
    for v in VIEWS:
        c = cams[v]
        if v == 'side':      # camera on her left (+X), looking at her left side
            off, rot = Vector((4.0, 0, 0)), (math.radians(90) - EL, 0, math.radians(90))
        elif v == 'front':
            off, rot = Vector((0, -4.0, 0)), (math.radians(90) - EL, 0, 0)
        elif v == 'back':
            off, rot = Vector((0, 4.0, 0)), (math.radians(90) - EL, 0, math.radians(180))
        elif v == 'top':
            off, rot = Vector((0, 0, 3.0)), (0, 0, 0)
        else:                # 3/4 front-left, perspective
            off, rot = Vector((2.2, -2.6, 0)), (math.radians(90) - math.radians(10), 0, math.radians(40))
        o = Rz @ off
        c.location = p + o + Vector((0, 0, 0.82 + o.length * math.tan(EL if v != 'q34' else math.radians(10)) if v != 'top' else 0))
        c.rotation_euler = (rot[0], rot[1], rot[2] + fy)
        sc.camera = c
        sc.render.resolution_y = RESY
        sc.render.resolution_x = int(RESY * (0.6 if v != 'top' else 1.0))
        sc.render.filepath = os.path.join(OUTD, '%s_%04d.png' % (v, i))
        bpy.ops.render.render(write_still=True)
print('RENDERED', len(FR), VIEWS)
