"""运镜bot r5 meadow pitch floor: render the before/after lens pair (pair_poses.cjs) in the meadow with the heroine.
  blender -b --factory-startup -P bl_meadow_pair.py -- MEADOW.glb CHAR.glb POSES.json OUTDIR
env: RES (390x844), SAMPLES (24), CLIP (idle_breathing_loop), FRAME (1).
Coordinates: Cocos (x, y, z) -> Blender (x, -z, y). She stands on the terrain at the node (ray down) facing the lens.
Writes OUTDIR/<pose name>.png and OUTDIR/probe.json (terrain height under her, lens height above the terrain under it)."""
import bpy, sys, math, os, json
from mathutils import Vector
A = sys.argv[sys.argv.index('--') + 1:]
scene_glb, char_glb, poses_json, out = A[0], A[1], A[2], A[3]
os.makedirs(out, exist_ok=True)
B = lambda p: Vector((p[0], -p[2], p[1]))
P = json.load(open(poses_json))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=scene_glb)
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get()
def down(x, z):
    hit, loc, n, i, ob, m = sc.ray_cast(dg, B((x, 50, z)), Vector((0, 0, -1)))
    return (loc.z, ob.name) if hit else (None, None)
fy, fname = down(P['feet'][0], P['feet'][2])
feet = [P['feet'][0], fy if fy is not None else P['feet'][1], P['feet'][2]]
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=char_glb); new = [o for o in bpy.data.objects if o not in before]
piv = bpy.data.objects.new('char_pivot', None); sc.collection.objects.link(piv)
for o in new:
    if o.name.startswith('Icosphere'): o.hide_render = True
    if o.parent is None: o.parent = piv
cam0 = P['poses'][0]['position']; yaw = math.atan2(cam0[0] - feet[0], cam0[2] - feet[2])
piv.location = B(feet); piv.rotation_euler = (0, 0, yaw)
arm = [o for o in new if o.type == 'ARMATURE']; act = bpy.data.actions.get(os.environ.get('CLIP', 'idle_breathing_loop'))
if arm and act: arm[0].animation_data_create(); arm[0].animation_data.action = act
sc.frame_set(int(os.environ.get('FRAME', '1')))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', '24')); sc.cycles.use_denoising = True
RES = [int(v) for v in os.environ.get('RES', '390x844').split('x')]; sc.render.resolution_x, sc.render.resolution_y = RES
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.8, 0.95, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(45), 0, math.radians(30))
cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.clip_start = 0.05; cd.clip_end = 1000
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
probe = dict(feetNode=P['feet'], terrainUnderHer=fy, terrainObject=fname, rows=[])
for p in P['poses']:
    cd.angle_y = math.radians(p['fov']); cam.location = B(p['position'])
    cam.rotation_euler = (B(p['target']) - B(p['position'])).to_track_quat('-Z', 'Y').to_euler()
    ty, tn = down(p['position'][0], p['position'][2])
    probe['rows'].append(dict(name=p['name'], lensY=p['position'][1], terrainUnderLens=ty, lensAboveTerrainM=None if ty is None else round(p['position'][1] - ty, 3)))
    sc.render.filepath = os.path.join(out, p['name'] + '.png'); bpy.ops.render.render(write_still=True)
json.dump(probe, open(os.path.join(out, 'probe.json'), 'w'), indent=1); print('PROBE', json.dumps(probe))
