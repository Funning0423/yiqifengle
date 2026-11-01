# QA only (docs/r5/scene-lod-scale.md): scale lineup of shipped GLBs next to the heroine, front orthographic, Cycles 64 + OIDN.
# blender -b --factory-startup -P blender_lod_scale_lineup.py -- out.png layout.json   (env QF_ISLAND_GLB = combined_visual_m.glb 77bff8b3)
import bpy, sys, os, json, math, re
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; OUT, LAYOUT = a[0], a[1]
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'creator-build-project', 'assets', 'bundles')
ISL = os.environ['QF_ISLAND_GLB']
# (key, glb, object names (None = all meshes), uniform scale, yaw deg about up)
ITEMS = [
 ('heroine', 'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb', ['LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW'], 1, 0),
 ('stool', 'region_island/character_support/reading_chair.glb', None, 1, 0),
 ('door', ISL, ['env_lighthouse_door'], 1, 0),
 ('tuft', 'region_lakeside/models/LK_grass_tuft.glb', None, 2.61, 0),
 ('reed', 'region_lakeside/models/LK_reed_card.glb', None, 1.29, 0),
 ('bush', 'region_lakeside/models/LK_bush.glb', None, 1, 0),
 ('barrel', 'region_lakeside/models/LK_barrel.glb', None, 1, 0),
 ('sailboat', 'transport_sail/sailboat.glb', None, 1, 90),
 ('house', 'region_lakeside/models/LK_house_B.glb', None, 1, 0),
 ('pavilion', 'region_lakeside/models/LK_pavilion.glb', None, 1, 0),
 ('tree_round', 'region_lakeside/models/LK_tree_round.glb', None, 2.69, 0),
 ('conifer', 'region_lakeside/models/LK_tree_conifer.glb', None, 3.13, 0),
 ('palm_tall', ISL, ['env_prop_palm_tall_01'], 1, 0),
 ('lighthouse', ISL, ['env_lighthouse_ext'], 1, 0),
 ('gate', 'region_skycity/env_skycity.glb', ['state_gate_before'], 1, 0),
 ('robot', 'region_skycity/env_skycity.glb', ['chr_robot_gardener_mesh'], 1, 0),
 ('windmill', 'region_meadow/env_meadow.glb', ['windmill_static_merged', 'windmill_sails'], 1, 0),
 ('balloon', 'region_transit_balloon/transport_balloon.glb', None, 1, 0),
]
ITEMS = ITEMS[:int(os.environ.get('QF_LINEUP_N', len(ITEMS)))]  # close-up panel: first N items
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; GAP = 0.7; x = 0.0; lay = []
for key, glb, names, s, yaw in ITEMS:
    path = glb if os.path.isabs(glb) else os.path.join(A, glb)
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    keep = [o for o in new if o.type == 'MESH' and (names is None or re.sub(r'\.\d{3}$', '', o.name) in names) and not o.name.startswith('Icosphere')]
    for o in new:
        if o not in keep and o.type == 'MESH': o.hide_render = True; o.hide_viewport = True
        if o.type in ('CAMERA', 'LIGHT'): o.hide_render = True
    holder = bpy.data.objects.new('L_' + key, None); sc.collection.objects.link(holder)
    roots = [o for o in new if o.parent is None]
    for o in roots: o.parent = holder
    holder.matrix_world = Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Scale(s, 4)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in keep:
        me = o.evaluated_get(dg).to_mesh(); pts += [o.matrix_world @ v.co for v in me.vertices]; o.evaluated_get(dg).to_mesh_clear()
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    holder.location = Vector((x - mn.x, -(mn.y + mx.y) / 2, -mn.z))
    lay.append({'key': key, 'x0': x, 'x1': x + mx.x - mn.x, 'h': mx.z - mn.z, 'w': mx.x - mn.x, 'scale': s})
    x += mx.x - mn.x + GAP
W = x - GAP; Hmax = max(l['h'] for l in lay)
bpy.ops.mesh.primitive_plane_add(size=1, location=(W / 2, 0, -0.005)); g = bpy.context.object; g.scale = (W + 6, 30, 1)
gm = bpy.data.materials.new('ground'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.62, 0.6, 0.56, 1); g.data.materials.append(gm)
bpy.ops.mesh.primitive_plane_add(size=1, location=(W / 2, 8, 10)); wall = bpy.context.object; wall.rotation_euler = (math.radians(90), 0, 0); wall.scale = (W + 6, 24, 1)
wm = bpy.data.materials.new('wall'); wm.use_nodes = True; wm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.82, 0.84, 1); wall.data.materials.append(wm)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = math.radians(8); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(-25))
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.8, 0.86, 1); sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
MARGIN = 1.2; VW = W + 2 * MARGIN; RX = int(os.environ.get('QF_LINEUP_RX', 3600)); RY = int(round(RX * (Hmax + 2.2) / VW / 2) * 2)
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = VW; cd.sensor_fit = 'HORIZONTAL'
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); cz = (Hmax + 2.2) / 2 - 1.0
cam.location = (W / 2, -60, cz); cam.rotation_euler = (math.radians(90), 0, 0); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'; sc.cycles.device = 'CPU'
sc.render.resolution_x = RX; sc.render.resolution_y = RY; sc.render.resolution_percentage = 100; sc.view_settings.view_transform = 'Standard'
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
json.dump({'items': lay, 'cam': {'cx': W / 2, 'cz': cz, 'vw': VW, 'rx': RX, 'ry': RY}}, open(LAYOUT, 'w'), indent=1); print('LINEUP', OUT, RX, RY)
