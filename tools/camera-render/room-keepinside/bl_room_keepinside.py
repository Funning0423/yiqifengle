"""运镜bot r5 room keepInside: measure the room's inner walls and render the home free-orbit lens with the heroine seated.
World: creator-project/assets/firstslice/combined_visual_m.glb (the runtime world, extract with git show).
  blender -b --factory-startup -P bl_room_keepinside.py -- measure WORLD.glb OUT.json
  blender -b --factory-startup -P bl_room_keepinside.py -- render WORLD.glb POSES.json OUTDIR CHAR.glb
measure: inner-wall polygon in Cocos XZ, from rays out of the room centre every 2°, taking the nearest hit over heights
         0.85..2.2 m on the walls (env_interior_shell + door + lighthouse ext + window glass), plus floor and ceiling.
render:  POSES.json = [{name, position, target, fov}] from orbit_poses.cjs (the real FreeOrbit.solve). Single-sided
         materials get Cocos-like back-face culling, so a lens outside a wall shows what the game would show. Writes the
         exact lens clearance (BVH nearest, all scene geometry except her and backdrops) to OUTDIR/clearance.json."""
import bpy, sys, math, os, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
A = sys.argv[sys.argv.index('--') + 1:]
mode, world = A[0], A[1]
B = lambda p: Vector((p[0], -p[2], p[1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=world)
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.data.objects:
    if o.name.startswith('Icosphere'): o.hide_render = True
dg = bpy.context.evaluated_depsgraph_get()
BACKDROP = ('sky', 'cloud', 'sea_', 'foam', 'wave', 'Icosphere')
WALLS = ('env_interior_shell', 'env_lighthouse_door', 'env_lighthouse_ext', 'env_interior_glass')
def tree(o):
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    t = BVHTree.FromPolygons([oe.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons]); oe.to_mesh_clear(); return t
scene_trees = [(o.name, tree(o)) for o in bpy.data.objects if o.type == 'MESH' and not any(s in o.name for s in BACKDROP)]
wall_trees = [(n, t) for n, t in scene_trees if n in WALLS]
def ray(trees, o, d):
    best = (1e9, None)
    for n, t in trees:
        h = t.ray_cast(B(o), B(d))
        if h[0] is not None and h[3] < best[0]: best = (h[3], n)
    return best
def nearest(trees, p):
    best = (1e9, None)
    for n, t in trees:
        h = t.find_nearest(B(p), best[0])
        if h[0] is not None and h[3] < best[0]: best = (h[3], n)
    return best
if mode == 'measure':
    C = (0.0, -2.6); poly = []
    for a in range(0, 360, 2):
        d = (math.sin(math.radians(a)), 0, math.cos(math.radians(a)))
        r = min(ray(wall_trees, (C[0], h, C[1]), d)[0] for h in (0.85, 1.2, 1.55, 1.9, 2.2))
        poly.append([round(C[0] + d[0] * r, 4), round(C[1] + d[2] * r, 4)])
    floor = max(1.5 - ray(wall_trees, (x, 1.5, z), (0, -1, 0))[0] for x, z in ((0, -2.6), (0.43, -4.2), (-1, -2), (1, -2)))
    ceil = min(1.5 + ray(wall_trees, (x, 1.5, z), (0, 1, 0))[0] for x, z in ((0, -2.6), (0.43, -4.2), (-1, -2), (1, -2), (0, -1.2), (0, -4.4)))
    json.dump(dict(source='creator-project/assets/firstslice/combined_visual_m.glb (feat/free-camera-r1 a79ee49a)', walls=WALLS, centre=C, stepDeg=2,
                   heights=[0.85, 1.2, 1.55, 1.9, 2.2], floorY=round(floor, 4), ceilingY=round(ceil, 4), polygonXZ=poly), open(A[2], 'w'), separators=(',', ':'))
    print('MEASURED', len(poly), floor, ceil, 'rmin', min(math.hypot(p[0] - C[0], p[1] - C[1]) for p in poly)); sys.exit(0)
poses, out, char = json.load(open(A[2])), A[3], A[4]
os.makedirs(out, exist_ok=True)
for m in bpy.data.materials:  # Cocos-like back-face culling for single-sided glTF materials
    if not m.use_nodes or not m.use_backface_culling: continue
    nt = m.node_tree; on = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL']
    if not on or not on[0].inputs['Surface'].links: continue
    src = on[0].inputs['Surface'].links[0].from_socket
    geo = nt.nodes.new('ShaderNodeNewGeometry'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(geo.outputs['Backfacing'], mix.inputs[0]); nt.links.new(src, mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], on[0].inputs['Surface'])
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=char); new = [o for o in bpy.data.objects if o not in before]
piv = bpy.data.objects.new('char_pivot', None); bpy.context.scene.collection.objects.link(piv)
for o in new:
    if o.name.startswith('Icosphere'): o.hide_render = True
    if o.parent is None: o.parent = piv
SEAT, SEAT_YAW = (0.4327299768730942, 0.0, -4.207611558444886), -2.0   # CHARACTER_REFERENCE.seatedRoot / seatYawRad
piv.location = B(SEAT); piv.rotation_euler = (0, 0, SEAT_YAW)
arm = [o for o in new if o.type == 'ARMATURE']; act = bpy.data.actions.get('sit_hold')
if arm and act: arm[0].animation_data_create(); arm[0].animation_data.action = act
sc = bpy.context.scene; sc.frame_set(24)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', '24')); sc.cycles.use_denoising = True
sc.cycles.max_bounces = 3; sc.cycles.transparent_max_bounces = 16
sc.render.resolution_x, sc.render.resolution_y = 360, 780
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.78, 0.85, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(35))
lamp = bpy.data.objects.new('roomlamp', bpy.data.lights.new('roomlamp', 'POINT')); sc.collection.objects.link(lamp)
lamp.data.energy = 220; lamp.data.shadow_soft_size = 1.5; lamp.location = B((-0.3, 3.2, -2.6))
cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.clip_start = 0.1; cd.clip_end = 1000
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
her = [o for o in new if o.type == 'MESH' and not o.hide_render]
rows = []
for p in poses:
    cd.angle_y = math.radians(p['fov']); cam.location = B(p['position']); cam.rotation_euler = (B(p['target']) - B(p['position'])).to_track_quat('-Z', 'Y').to_euler()
    na = nearest(scene_trees, p['position']); nw = nearest(wall_trees, p['position'])
    # is she on screen and unblocked: rays from the lens to her head / chest / knees
    from bpy_extras.object_utils import world_to_camera_view
    vis = []
    for name, off in (('head', 1.25), ('chest', 1.0), ('lap', 0.6)):
        q = (SEAT[0], off, SEAT[2]); v = world_to_camera_view(sc, cam, B(q)); d = Vector(q) - Vector(p['position']); L = d.length
        hit = ray(scene_trees, p['position'], tuple(d / L)); vis.append(dict(part=name, onScreen=0 <= v.x <= 1 and 0 <= v.y <= 1 and v.z > 0, blockedBy=hit[1] if hit[0] < L - 0.35 else None))
    rows.append(dict(name=p['name'], position=p['position'], clearanceAllM=round(na[0], 3), nearest=na[1], clearanceWallsM=round(nw[0], 3), nearestWall=nw[1], her=vis))
    sc.render.filepath = os.path.join(out, p['name'] + '.png'); bpy.ops.render.render(write_still=True); print('SHOT', json.dumps(rows[-1]))
json.dump(dict(char=char, world=world, rows=rows), open(os.path.join(out, 'clearance.json'), 'w'), indent=1)
