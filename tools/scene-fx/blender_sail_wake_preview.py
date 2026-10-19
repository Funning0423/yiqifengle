# QA only (not shipped). blender -b --factory-startup -P blender_sail_wake_preview.py -- frames.json out_dir mode [res_x res_y samples]
# mode: new = SailWakeCore trail (wake_trail), old = authored 9 m wake_strips card on wake_root (bc81575f look).
# Offline NON-NATIVE replica of the sail transit: Cycles CPU, one sun. Boat pose, camera (sailCamera), wake mesh / UV /
# vertex alpha per frame come from the REAL TransportLeg + SailWakeCore (sail_wake_sim.cjs dump). The wake is drawn
# unlit (emission × foam_strip texture × vertex colour, alpha blend) like builtin-unlit; sea/boat are approximations.
import bpy, json, sys, math, os, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
cfg = json.load(open(a[0])); OUT = a[1]; MODE = a[2]; os.makedirs(OUT, exist_ok=True)
RX, RY = (int(a[3]), int(a[4])) if len(a) > 4 else (390, 844); SAMPLES = int(a[5]) if len(a) > 5 else 16
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../creator-build-project/assets/bundles/transport_sail')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def v(p): return mathutils.Vector((p[0], -p[2], p[1]))
def srgb2lin(x): x = x / 255; return x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4
def imp(f):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(D, f)); return [o for o in bpy.data.objects if o not in before]
boat_objs = imp('sailboat.glb'); sea_objs = imp('transit_sea.glb'); props = imp('transit_sea_props.glb')
boat = bpy.data.objects.new('boat_rig', None); sc.collection.objects.link(boat); boat.rotation_mode = 'XYZ'
for o in boat_objs:
    if o.parent is None: o.parent = boat
    if o.name.startswith(('sail_furled',)): o.hide_render = True
byname = {o.name: o for o in bpy.data.objects}
for o in props: o.hide_render = True
def foam_mat(name, img, alpha_attr):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    out = nt.nodes.new('ShaderNodeOutputMaterial'); tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.extension = 'EXTEND' if alpha_attr == 'obj' else 'REPEAT'
    uv = nt.nodes.new('ShaderNodeUVMap'); nt.links.new(uv.outputs[0], tex.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    al = nt.nodes.new('ShaderNodeMath'); al.operation = 'MULTIPLY'; nt.links.new(tex.outputs['Alpha'], al.inputs[0])
    if alpha_attr == 'obj':
        oa = nt.nodes.new('ShaderNodeAttribute'); oa.attribute_type = 'OBJECT'; oa.attribute_name = 'fxa'; nt.links.new(oa.outputs['Fac'], al.inputs[1])
        oc = nt.nodes.new('ShaderNodeAttribute'); oc.attribute_type = 'OBJECT'; oc.attribute_name = 'fxc'
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
        nt.links.new(tex.outputs['Color'], mul.inputs[6]); nt.links.new(oc.outputs['Color'], mul.inputs[7]); nt.links.new(mul.outputs[2], em.inputs['Color'])
    else:
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'fx'; nt.links.new(vc.outputs['Alpha'], al.inputs[1])
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
        nt.links.new(tex.outputs['Color'], mul.inputs[6]); nt.links.new(vc.outputs['Color'], mul.inputs[7]); nt.links.new(mul.outputs[2], em.inputs['Color'])
    nt.links.new(al.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
    m.use_backface_culling = False
    return m
FOAM = bpy.data.images.load(os.path.join(D, 'textures/foam_strip_512x128.png'))
OLDM = foam_mat('old_foam', FOAM, 'obj')
# hull_foam_ring is kept in both modes (SailArt still paints it alpha × 0.9); wake_strips only in 'old'.
ring = byname.get('hull_foam_ring'); strips = byname.get('wake_strips'); wroot = byname.get('wake_root')
for o in (ring, strips):
    if not o: continue
    o.parent = None; o.data.materials.clear(); o.data.materials.append(OLDM); o.hide_render = False
ring.parent = boat; ring.location = (0, 0, 0.02)
if strips: strips.parent = boat; strips.location = (0, 2.2, 0.03); strips.hide_render = MODE != 'old'  # wake_root (0,0,-2.2) → Blender +Y
# Sea: sea_plane at the route middle, ×3.2, texture tiling ×3.2 (SailArt seaOff).
plane = byname.get('sea_plane'); tile = byname.get('sea_tile_39m')
if tile: tile.hide_render = True
route = cfg['route']; mid = route[len(route) // 2]
plane.location = v([mid[0], cfg['seaY'], mid[2]]); plane.scale = (3.2 * plane.scale[0], 3.2 * plane.scale[1], plane.scale[2])
SEA_TINT = []
for m in plane.data.materials:
    nt = m.node_tree; b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    texn = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
    if texn:
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (3.2, 3.2, 1)
        nt.links.new(tc.outputs['UV'], mp.inputs[0]); nt.links.new(mp.outputs[0], texn.inputs[0]); texn.extension = 'REPEAT'
    if b:
        b.inputs['Roughness'].default_value = 1
        for k in ('Specular IOR Level',):
            if k in b.inputs: b.inputs[k].default_value = 0
        inp = b.inputs['Base Color']; mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        if inp.is_linked: nt.links.new(inp.links[0].from_socket, mx.inputs[6])
        else: mx.inputs[6].default_value = tuple(inp.default_value)
        nt.links.new(mx.outputs[2], inp); SEA_TINT.append(mx)
# New wake mesh (rebuilt per frame).
NEWM = foam_mat('wake_trail', FOAM, 'vcol')
def wake_obj(g):
    me = bpy.data.meshes.new('wake_trail'); P = g['positions']; I = g['indices']
    me.from_pydata([tuple(v(P[i:i + 3])) for i in range(0, len(P), 3)], [], [tuple(I[i:i + 3]) for i in range(0, len(I), 3)]); me.update()
    uvl = me.uv_layers.new(name='UVMap'); UV = g['uvs']; C = g['colors']
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index; uvl.data[li].uv = (UV[vi * 2], 1 - UV[vi * 2 + 1])
    ca = me.color_attributes.new('fx', 'FLOAT_COLOR', 'POINT')
    for i in range(len(P) // 3): ca.data[i].color = (srgb2lin(C[i * 4] * 255), srgb2lin(C[i * 4 + 1] * 255), srgb2lin(C[i * 4 + 2] * 255), C[i * 4 + 3])
    me.materials.append(NEWM); ob = bpy.data.objects.new('wake_trail', me); sc.collection.objects.link(ob); return ob
cam = bpy.data.cameras.new('cam'); cam.sensor_fit = 'VERTICAL'; cam.clip_start = .1; cam.clip_end = 1400
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
sun = bpy.data.lights.new('sun', 'SUN'); sun.use_shadow = True; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(48), 0, math.radians(-30)); sun.angle = math.radians(6)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 3; sc.cycles.transparent_max_bounces = 16
sc.render.resolution_x, sc.render.resolution_y = RX, RY; sc.view_settings.view_transform = 'Standard'
night = cfg['night']
sun.energy = 0.9 if night else 3.0; sun.color = (180 / 255, 198 / 255, 232 / 255) if night else (1, .97, .92)
bg.inputs[0].default_value = (.034, .07, .2, 1) if night else (.45, .65, .85, 1); bg.inputs[1].default_value = .5 if night else 1.0
tint = [srgb2lin(c) for c in ((150, 185, 220) if night else (255, 255, 255))]
for mx in SEA_TINT: mx.inputs[7].default_value = tuple(tint) + (1,)
cur = None
for f in cfg['frames']:
    b = f['boat']; boat.location = v(b['pos']); boat.rotation_euler = (0, -b['roll'], b['yaw'])
    rm = 1 if b['sail'] > 0.18 else 0
    for o in boat_objs:
        if o.name.startswith('sail_furled'): o.hide_render = bool(rm)
        if o.name.startswith(('sail_main', 'sail_jib')): o.hide_render = not rm
    ring['fxa'] = f['oldAlpha'] * 0.9
    rt = f.get('ringTint', [255, 255, 255]) if MODE == 'new' else [255, 255, 255]; ring['fxc'] = [srgb2lin(c) for c in rt]
    if strips: strips['fxc'] = [1.0, 1.0, 1.0]
    if strips: strips['fxa'] = f['oldAlpha']
    if cur: bpy.data.objects.remove(cur, do_unlink=True)
    cur = None
    if MODE == 'new': cur = wake_obj(f['wake'])
    c = f['cam']
    if os.environ.get('WAKE_CAM') == 'wide':  # QA-only overview (not a game lens): high on the port quarter, looking down the wake
        yw = b['yaw']; fx, fz = math.sin(yw), math.cos(yw); rx, rz = fz, -fx; bp = b['pos']
        c = {'position': [bp[0] + fx * 9 - rx * 8, bp[1] + 12, bp[2] + fz * 9 - rz * 8], 'target': [bp[0] - fx * 8, bp[1], bp[2] - fz * 8], 'fovVerticalDeg': 55}
    p = v(c['position']); t = v(c['target']); co.location = p; co.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler(); cam.angle_y = math.radians(c['fovVerticalDeg'])
    sc.render.filepath = os.path.join(OUT, f['name'] + '.png'); bpy.ops.render.render(write_still=True)
print('DONE', OUT)
