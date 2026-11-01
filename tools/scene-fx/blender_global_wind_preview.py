# QA only (r5 S3 global wind): sail-journey berth with the real meadow grass (CPU copy of meadow-grass-wind.effect), the
# sailboat pennant and sails driven like SailArt.sync + GlobalWind.ts. Cycles + OIDN. Projected arrow anchors -> JSON.
# blender -b --factory-startup -P blender_global_wind_preview.py -- out.png arrows.json before|after azDeg tSec samples resX
# tSec = 'seq:N:fps' renders N frames (t = i/fps) to out_%03d.png in one session.
import bpy, sys, os, json, math
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
a = sys.argv[sys.argv.index('--') + 1:]; OUT, ARR, MODE, AZ, T, SPP, RX = a[0], a[1], a[2], float(a[3]), a[4], int(a[5]), int(a[6])
SEQ = T.startswith('seq:'); TS = [i / float(T.split(':')[2]) for i in range(int(T.split(':')[1]))] if SEQ else [float(T)]
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'creator-build-project', 'assets', 'bundles')
def g2b(p): return Vector((p[0], -p[2], p[1]))
ROOT = (-1.7, -1.35, 79.1); BERTH = (-4.4, -0.91, 48.8); BOAT_YAW = 0.0   # TransportLeg sailMeadowRoot / sailBerthWorld, heading +z
K, OM = 0.2415, 2 * math.pi / 4
W = (math.sin(math.radians(AZ)), math.cos(math.radians(AZ)))               # GlobalWind world blows-to
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(B, 'region_meadow/env_meadow.glb')); meadow = [o for o in bpy.data.objects if o not in before]
KEEP = ('meadow_terrain', 'meadow_river', 'meadow_river_bank', 'meadow_grass_instances', 'meadow_flower_instances', 'meadow_path', 'meadow_fence_merged')
for o in meadow:
    if o.type == 'MESH' and not o.name.startswith(KEEP): o.hide_render = True
    if o.type in ('CAMERA', 'LIGHT'): o.hide_render = True
mr = bpy.data.objects.new('meadow_root', None); sc.collection.objects.link(mr)
for o in meadow:
    if o.parent is None: o.parent = mr
mr.matrix_world = Matrix.Translation(g2b(ROOT)) @ Matrix.Rotation(math.pi, 4, 'Z')   # journey: setRotationFromEuler(0,180,0)
bpy.context.view_layer.update()
# grass: mesh-space displacement exactly as the effect (before = old constant axis, after = world uniform through cc_matWorld)
yaw_m = math.pi; c, s = math.cos(yaw_m), math.sin(yaw_m)
lx, lz = c * W[0] - s * W[1], s * W[0] + c * W[1]
grass_pts = []; GR = []
for o in meadow:
    if o.type != 'MESH' or not o.name.startswith('meadow_grass_instances'): continue
    me = o.data; uv1 = me.uv_layers[1].data; col = me.color_attributes[0]
    vr = {}
    for li, lp in enumerate(me.loops):
        if lp.vertex_index in vr: continue
        u = uv1[li].uv; al = col.data[li].color[3] if col.domain == 'CORNER' else col.data[lp.vertex_index].color[3]
        vr[lp.vertex_index] = (u[0], 1.0 - u[1], al)
    rows = []
    for v in me.vertices:
        r, ph, al = vr.get(v.index, (0, 0, 0)); g = (v.co.x, v.co.z, -v.co.y)
        if MODE == 'before': ax, az_ = 0.944, -0.330
        else: ax, az_ = lx, lz; ph = ph + K * (g[0] * (lx - 0.944) + g[2] * (lz + 0.330))
        rows.append((v.index, v.co.copy(), r, ph, al * 1.5 * r * r, ax, az_))
        if r < 0.05: grass_pts.append(o.matrix_world @ v.co)
    GR.append((me, rows))
def grass_at(t):
    for me, rows in GR:
        for i, co, r, ph, amp, ax, az_ in rows:
            d = amp * (0.36 * math.sin(ph - OM * t) - 0.26 * math.sin(OM * t))
            me.vertices[i].co = co + g2b((ax * d, -0.3 * d * r, az_ * d))
        me.update()
# boat
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(B, 'transport_sail/sailboat.glb')); boat = [o for o in bpy.data.objects if o not in before]
bt = [o for o in boat if o.name.startswith('transport_sailboat')][0]
bt.matrix_world = Matrix.Translation(g2b(BERTH)) @ Matrix.Rotation(BOAT_YAW, 4, 'Z')
for o in boat:
    if o.name.startswith(('sail_furled',)): o.hide_render = True
def node(n): return [o for o in boat if o.name.split('.')[0] == n][0]
side, pyaw = 1, 0.0
if MODE == 'after':  # GlobalWind.ts at rest: apparent = true wind (speed 0)
    t = (W[0] * math.cos(BOAT_YAW) - W[1] * math.sin(BOAT_YAW), W[0] * math.sin(BOAT_YAW) + W[1] * math.cos(BOAT_YAW))
    side = -1 if t[0] / math.hypot(*t) < -0.15 else 1
    pyaw = math.atan2(t[0], t[1]) - math.radians(172)
for n in ('boom_pivot', 'sail_root', 'jib_root'): o = node(n); o.scale = (side, o.scale[1], o.scale[2])
node('pennant').rotation_mode = 'QUATERNION'; node('pennant').rotation_quaternion = Matrix.Rotation(pyaw, 4, 'Z').to_quaternion() @ node('pennant').rotation_quaternion
bpy.context.view_layer.update()
# water + light + camera
bpy.ops.mesh.primitive_plane_add(size=1, location=(BERTH[0], -BERTH[2], BERTH[1] - 0.02)); wpl = bpy.context.object; wpl.scale = (80, 80, 1)
wm = bpy.data.materials.new('water'); wm.use_nodes = True; pb = wm.node_tree.nodes['Principled BSDF']; pb.inputs['Base Color'].default_value = (0.08, 0.32, 0.38, 1); pb.inputs['Roughness'].default_value = 0.35; wpl.data.materials.append(wm)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0; sun.angle = math.radians(6); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(42), 0, math.radians(150))
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.72, 0.85, 1); sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
focus = g2b((BERTH[0] + 1.0, BERTH[1] + 1.2, BERTH[2] + 3.5)); eye = g2b((BERTH[0] - 9.5, BERTH[1] + 11.0, BERTH[2] - 7.5))
cd = bpy.data.cameras.new('cam'); cd.lens_unit = 'FOV'; cd.angle = math.radians(52); cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam)
cam.location = eye; cam.rotation_euler = (focus - eye).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.samples = SPP; sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'; sc.cycles.device = 'CPU'
sc.render.resolution_x = RX; sc.render.resolution_y = int(RX * 0.75); sc.view_settings.view_transform = 'Standard'
bpy.context.view_layer.update()
def px(p): q = world_to_camera_view(sc, cam, p); return [q.x * sc.render.resolution_x, (1 - q.y) * sc.render.resolution_y, q.z]
bw = bt.matrix_world; R = bw.to_3x3()
flag = node('pennant_flag'); fc = sum((flag.matrix_world @ v.co for v in flag.data.vertices), Vector()) / len(flag.data.vertices); pv = node('pennant').matrix_world.translation
sm = node('sail_main'); smc = sum((sm.matrix_world @ v.co for v in sm.data.vertices), Vector()) / len(sm.data.vertices); mast = node('sail_root').matrix_world.translation
gw = g2b((BERTH[0] + 4.0, 0, BERTH[2] + 6.0)); gp = min(grass_pts, key=lambda p: (p.x - gw.x) ** 2 + (p.y - gw.y) ** 2) if grass_pts else gw
gdir = (-0.944, 0.330) if MODE == 'before' else W     # world blows-to of the grass gust/sway (meadow yaw 180)
def tip(p, d2, L): return p + Vector((d2[0], -d2[1], 0)) * L
lee = R @ Vector((side, 0, 0)); lee.z = 0; lee.normalize()   # leeward = the side the sail sets on (boat-local +x * side)
fd = (fc - pv); fd.z = 0; fd.normalize(); sd = (smc - mast); sd.z = 0; sd.normalize()
out = {'mode': MODE, 'az': AZ, 'side': side, 'pennantYawDeg': math.degrees(pyaw), 'res': [sc.render.resolution_x, sc.render.resolution_y],
       'wind': [px(g2b((BERTH[0], BERTH[1] + 5.5, BERTH[2] + 9))), px(tip(g2b((BERTH[0], BERTH[1] + 5.5, BERTH[2] + 9)), W, 3.0))],
       'grass': [px(gp), px(tip(gp, gdir, 2.5))], 'pennant': [px(Vector((pv.x, pv.y, fc.z))), px(Vector((pv.x, pv.y, fc.z)) + fd * 1.6)], 'sail': [px(mast + Vector((0, 0, 1.2))), px(mast + Vector((0, 0, 1.2)) + lee * 2.2)], 'sailChord': [px(mast + Vector((0, 0, 1.2))), px(mast + Vector((0, 0, 1.2)) + sd * 2.2)],
       'windAt': [px(bw.translation + Vector((0, 0, 1.5))), px(bw.translation + Vector((0, 0, 1.5)) + Vector((W[0], -W[1], 0)) * 2.0)],
       'worldDirs': {'grass': list(gdir), 'pennant': [fd.x, -fd.y], 'sail': [lee.x, -lee.y], 'sailChord': [sd.x, -sd.y], 'wind': list(W)}}
json.dump(out, open(ARR, 'w'), indent=1)
for i, t in enumerate([] if os.environ.get('QF_NO_RENDER') else TS):
    grass_at(t); sc.render.filepath = OUT.replace('.png', '_%03d.png' % i) if SEQ else OUT
    bpy.ops.render.render(write_still=True)
print('WINDPREV', OUT, len(TS))
