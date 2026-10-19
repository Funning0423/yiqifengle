"""运镜bot r5 room keepInside: measure the room's inner walls and render the home free-orbit lens with the heroine seated.
World: creator-project/assets/firstslice/combined_visual_m.glb (the runtime world, extract with git show).
  blender -b --factory-startup -P bl_room_keepinside.py -- measure WORLD.glb OUT.json
  blender -b --factory-startup -P bl_room_keepinside.py -- render WORLD.glb POSES.json OUTDIR CHAR.glb
  blender -b --factory-startup -P bl_room_keepinside.py -- probe  WORLD.glb POSES.json OUTDIR CHAR.glb   (no images)
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
# render/probe: the game at home writes HOME layers (WorldFlowCore: exterior off; env_lighthouse_ext stays on with the
# interior; v22 day effects follow exterior). Exterior-layer names from FirstsliceFacts.ts renderers.
HOME_HIDDEN = ('env_island_main', 'env_island_props_merged', 'env_prop_palm_tall_01', 'env_prop_palm_lean_01', 'env_prop_palm_young_01',
               'env_anim_seagull_01', 'env_anim_crab_01', 'env_anim_cat_tuxedo_01', 'env_anim_turtle_01')
if mode != 'measure':
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and (any(o.name.startswith(n) for n in HOME_HIDDEN) or ('_v22' in o.name and '_night_v22' not in o.name)):
            bpy.data.objects.remove(o, do_unlink=True)
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
RES = [int(v) for v in os.environ.get('RES', '360x780').split('x')]   # r7: RES=390x844 for the acceptance sheets
sc.render.resolution_x, sc.render.resolution_y = RES[0], RES[1]
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.78, 0.85, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(35))
lamp = bpy.data.objects.new('roomlamp', bpy.data.lights.new('roomlamp', 'POINT')); sc.collection.objects.link(lamp)
lamp.data.energy = 220; lamp.data.shadow_soft_size = 1.5; lamp.location = B((-0.3, 3.2, -2.6))
cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.clip_start = 0.1; cd.clip_end = 1000
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
her = [o for o in new if o.type == 'MESH' and not o.hide_render]
dg = bpy.context.evaluated_depsgraph_get(); her_trees = [('her:' + o.name, tree(o)) for o in her]
def coverage(p, nx=20, ny=43):
    # frame coverage by object: a ray grid over the (portrait) frame from the lens. herFrac = share of rays that hit her
    # first; nearFrac = share whose first hit is closer than 0.9 m (what fills the frame when the lens nears something).
    f = Vector(p['target']) - Vector(p['position']); f.normalize(); up = Vector((0, 1, 0)); r = f.cross(up); r.normalize(); u = r.cross(f)
    ty = math.tan(math.radians(p['fov']) / 2); tx = ty * RES[0] / RES[1]; hits = {}; near = {}; herN = 0; n = 0; herBox = [1, -1, 1, -1]
    for j in range(ny):
        for i in range(nx):
            sx, sy = (i + 0.5) / nx * 2 - 1, (j + 0.5) / ny * 2 - 1; d = f + r * (sx * tx) + u * (sy * ty); d.normalize()
            a = ray(scene_trees, p['position'], tuple(d)); b = ray(her_trees, p['position'], tuple(d)); n += 1
            if b[0] < a[0]:
                herN += 1; herBox = [min(herBox[0], sx), max(herBox[1], sx), min(herBox[2], sy), max(herBox[3], sy)]; continue
            if a[1] is None: continue
            hits[a[1]] = hits.get(a[1], 0) + 1
            if a[0] < 0.9: near[a[1]] = near.get(a[1], 0) + 1
    top = sorted(hits.items(), key=lambda kv: -kv[1])[:4]
    return dict(herFrac=round(herN / n, 3), herBoxNDC=[round(v, 2) for v in herBox] if herN else None,
                nearFrac={k: round(v / n, 3) for k, v in near.items()}, top={k: round(v / n, 3) for k, v in top})
rows = []
for p in poses:
    cd.angle_y = math.radians(p['fov']); cam.location = B(p['position']); cam.rotation_euler = (B(p['target']) - B(p['position'])).to_track_quat('-Z', 'Y').to_euler()
    na = nearest(scene_trees, p['position']); nw = nearest(wall_trees, p['position'])
    rows.append(dict(name=p['name'], position=p['position'], clearanceAllM=round(na[0], 3), nearest=na[1], clearanceWallsM=round(nw[0], 3), nearestWall=nw[1], frame=coverage(p)))
    if mode == 'render': sc.render.filepath = os.path.join(out, p['name'] + '.png'); bpy.ops.render.render(write_still=True)
    print('SHOT', json.dumps(rows[-1]))
json.dump(dict(char=char, world=world, rows=rows), open(os.path.join(out, 'clearance.json' if mode == 'render' else 'probe.json'), 'w'), indent=1)
