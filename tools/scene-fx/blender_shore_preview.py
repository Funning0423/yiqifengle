# QA only (not shipped, 场景特效bot r5 S2 stage 2). Shore foam before/after, NON-NATIVE offline replica (Cycles + OIDN).
#   blender -b --factory-startup -P blender_shore_preview.py -- frames.json before|after out_dir tag samples res_x res_y [every]
# frames.json from dump_shore_frames.cjs: the foam is the REAL ShoreFoamCore.sampleShoreFoam baked per frame into an atlas on the
# real ribbon (island: unlit x islandFoamTint like the effect without USE_LIT; lake: lit diffuse like USE_LIT). Island "before" =
# the old lip (shoreWashGeometry, alpha foamA x shorePeak); lake "before" = the old LK_shore_foam.glb with its palette material.
# Scene light: one sun + world colour; night = dim blue sun/world (approximation, not the game's lighting).
import bpy, json, sys, math, os
from mathutils import Matrix, Vector, Quaternion
a = sys.argv[sys.argv.index('--') + 1:]
cfg = json.load(open(a[0])); VAR = a[1]; OUT = a[2]; TAG = a[3]; SAMPLES = int(a[4]); RX, RY = int(a[5]), int(a[6]); EVERY = int(a[7]) if len(a) > 7 else 1
ONLY = [int(x) for x in os.environ.get('QF_FRAMES', '').split(',') if x != '']
os.makedirs(OUT, exist_ok=True)
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
NIGHT = cfg['night'] >= 0.5; KIND = cfg['kind']
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))); Ci = C.inverted()
def g2b(p): return Vector((p[0], -p[2], p[1]))
def tr(v): m = Matrix.Identity(4); m.translation = Vector(v); return m
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = int(round(cfg['fps']))
def imp(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
if KIND == 'island':
    imp(os.environ['QF_ISLAND_GLB'])  # wave_line_01/02 hidden: ShoreBreak sinks them under the sea (SHORE.sinkY)
    HIDE = ('env_sea_wave_line_0', 'env_lighthouse_beam_night_v22', 'env_chimney_smoke_', 'env_anim_seagull_fly_0', 'col_', 'character_height_reference', 'env_interior_floor_skirt_preview')
    for o in bpy.data.objects:
        if any(o.name.startswith(h) for h in HIDE): o.hide_render = True
        elif '_night_v22' in o.name: o.hide_render = not NIGHT
        elif (o.name.startswith('env_sky_dome') or o.name.startswith('env_cloud_layer')) and NIGHT: o.hide_render = True
        elif o.name in ('env_sea_foam', 'env_sea_surf_foam_v22') and NIGHT and o.type == 'MESH':
            # game: bindUnlitBackdrop multiplies the authored foam by SHORE.night at night (same multiply as foamMultiply)
            for m in o.data.materials:
                if not m or not m.use_nodes: continue
                nt = m.node_tree
                for nd in list(nt.nodes):
                    for nm in ('Base Color', 'Emission Color', 'Color'):
                        if nd.type not in ('BSDF_PRINCIPLED', 'EMISSION') or nm not in nd.inputs: continue
                        inp = nd.inputs[nm]; mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
                        mx.inputs[7].default_value = (0.35, 0.48, 0.64, 1)
                        if inp.is_linked: src = inp.links[0].from_socket; nt.links.new(src, mx.inputs[6])
                        else: mx.inputs[6].default_value = tuple(inp.default_value)
                        nt.links.new(mx.outputs[2], inp)
        elif o.name.startswith('env_sea_surface') and NIGHT and o.type == 'MESH':
            for m in o.data.materials:
                b = m and m.use_nodes and next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                if b and not b.inputs['Base Color'].is_linked:
                    c = b.inputs['Base Color'].default_value; b.inputs['Base Color'].default_value = (c[0] * .21, c[1] * .34, c[2] * .45, 1)
else:
    B = REPO + '/creator-build-project/assets/bundles/region_lakeside/'
    T = json.load(open(B + 'scene_r5h_slim_transforms.json'))
    SKIP = ('LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb')
    lib = {}; hold = bpy.data.collections.new('lib'); sc.collection.children.link(hold)
    for ins in T['instances']:
        g = ins.get('glb')
        if not isinstance(g, str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name') == g.replace('.glb', ''): continue
        if g == 'LK_shore_foam.glb' and VAR == 'after': continue   # in game the new ribbon only draws with shore-foam (added below)
        if g not in lib:
            path = os.environ['QF_LK_SHORE_BEFORE'] if g == 'LK_shore_foam.glb' else B + 'models/' + g
            objs = imp(path)
            for o in objs:
                for c in list(o.users_collection): c.objects.unlink(o)
                hold.objects.link(o)
            lib[g] = [(o.data, o.matrix_world.copy()) for o in objs if o.type == 'MESH']
        x, y, z, w = ins['rot_quat_xyzw']; q = Quaternion((w, x, y, z)).to_matrix().to_4x4()
        sx, sy, sz = ins['scale']; M = tr(ins['pos']) @ q @ Matrix.Diagonal((sx, sy, sz, 1))
        for data, mw in lib[g]:
            o = bpy.data.objects.new(ins['name'], data); sc.collection.objects.link(o); o.matrix_world = C @ M @ Ci @ mw
    hold.hide_render = True
    FILL = {'near': (0.104, 0.196, 0.025), 'far': (0.043, 0.087, 0.107), 'foliage': (0.019, 0.065, 0.0), 'wall': (0.023, 0.02, 0.017), 'rock': (0.079, 0.079, 0.079)}
    CLS = {'LK_terrain': 'near', 'LK_far_hills': 'far', 'LK_far_shore': 'far', 'LK_tree_conifer': 'foliage', 'LK_tree_round': 'foliage',
           'LK_bush': 'foliage', 'LK_house_A': 'wall', 'LK_house_B': 'wall', 'LK_house_C': 'wall', 'LK_rock': 'rock'}
    k = 0.3 if NIGHT else 1.0; fm = {}
    for g, objs in lib.items():
        c = CLS.get(g.replace('.glb', ''))
        if not c: continue
        for data, mw in objs:
            for si, mat in enumerate(data.materials):
                if mat is None: continue
                key = (mat.name, c)
                if key not in fm:
                    m2 = mat.copy(); bs = m2.node_tree.nodes.get('Principled BSDF')
                    if bs: bs.inputs['Emission Color'].default_value = tuple(f * k for f in FILL[c]) + (1,); bs.inputs['Emission Strength'].default_value = 1.0
                    fm[key] = m2
                data.materials[si] = fm[key]
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.rotation_mode = 'QUATERNION'
sun.rotation_quaternion = g2b((-0.4182, -0.3983, 0.8164) if KIND == 'lake' else (-0.45, -0.6, 0.66)).normalized().to_track_quat('-Z', 'Y')
sun.data.energy, sun.data.color = (0.45, (.6, .7, 1)) if NIGHT else (3.4, (1, .86, .72))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = (.035, .05, .11, 1) if NIGHT else (.55, .72, .92, 1); bg.inputs[1].default_value = .9
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x, sc.render.resolution_y = RX, RY; sc.render.resolution_percentage = 100
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = .05; cam.data.clip_end = 3000; cam.data.angle = math.radians(float(os.environ.get('QF_FOV', '50')))
P, Tg = g2b(cfg['camera']['pos']), g2b(cfg['camera']['target']); cam.location = P; cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = (Tg - P).normalized().to_track_quat('-Z', 'Y')
def fx_mesh(name, pos, cols, idx, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(g2b(pos[i:i + 3])) for i in range(0, len(pos), 3)], [], [tuple(idx[i:i + 3]) for i in range(0, len(idx), 3)]); me.update()
    ca = me.color_attributes.new('fx', 'FLOAT_COLOR', 'POINT')
    for i in range(len(pos) // 3): ca.data[i].color = tuple(cols[i * 4:i * 4 + 4])
    if uvs:
        ul = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index; ul.data[li].uv = (uvs[2 * vi], uvs[2 * vi + 1])
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); return ob
def blended(m):
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    m.use_backface_culling = False
img = None; lip = None; lipmat = None
if VAR == 'after':
    G = cfg['geometry']; rib = fx_mesh('shore_foam', G['positions'], G['colors'], G['indices'], G['uvs'])
    base = [v.co.copy() for v in rib.data.vertices]
    m = bpy.data.materials.new('shore_foam'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); blended(m)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); tx = nt.nodes.new('ShaderNodeTexImage'); tx.interpolation = 'Linear'; tx.extension = 'EXTEND'
    img = bpy.data.images.load(cfg['frames'][0]['tex']); img.alpha_mode = 'STRAIGHT'; tx.image = img
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'fx'
    al = nt.nodes.new('ShaderNodeMath'); al.operation = 'MULTIPLY'; nt.links.new(tx.outputs['Alpha'], al.inputs[0]); nt.links.new(vc.outputs['Alpha'], al.inputs[1])
    if KIND == 'island': sh = nt.nodes.new('ShaderNodeEmission'); nt.links.new(tx.outputs['Color'], sh.inputs['Color'])
    else: sh = nt.nodes.new('ShaderNodeBsdfDiffuse'); nt.links.new(tx.outputs['Color'], sh.inputs['Color'])
    trn = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(al.outputs[0], mx.inputs[0]); nt.links.new(trn.outputs[0], mx.inputs[1]); nt.links.new(sh.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
    rib.data.materials.append(m); rib.visible_shadow = False
elif KIND == 'island':
    lipmat = bpy.data.materials.new('old_lip'); lipmat.use_nodes = True; nt = lipmat.node_tree; nt.nodes.clear(); blended(lipmat)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'fx'
    lipA = nt.nodes.new('ShaderNodeValue'); lipA.name = 'A'; lipC = nt.nodes.new('ShaderNodeRGB'); lipC.name = 'C'
    al = nt.nodes.new('ShaderNodeMath'); al.operation = 'MULTIPLY'; nt.links.new(vc.outputs['Alpha'], al.inputs[0]); nt.links.new(lipA.outputs[0], al.inputs[1])
    col = nt.nodes.new('ShaderNodeMix'); col.data_type = 'RGBA'; col.blend_type = 'MULTIPLY'; col.inputs['Factor'].default_value = 1
    nt.links.new(lipC.outputs[0], col.inputs[6]); nt.links.new(vc.outputs['Color'], col.inputs[7])
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(col.outputs[2], em.inputs['Color']); trn = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(al.outputs[0], mx.inputs[0]); nt.links.new(trn.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
for k, f in enumerate(cfg['frames']):
    if (ONLY and k not in ONLY) or (not ONLY and k % EVERY): continue
    if VAR == 'after':
        img.filepath = f['tex']; img.reload()
        if KIND == 'island':
            cols = cfg['geometry']['colors']
            for i, v in enumerate(rib.data.vertices): v.co = base[i] + Vector((0, 0, f['lift'] * cols[i * 4]))
            rib.data.update()
    elif KIND == 'island':
        if lip: bpy.data.objects.remove(lip, do_unlink=True)
        lip = None; b = f['before']
        if b['alpha'] > 1 / 255:
            lip = fx_mesh('old_lip', b['positions'], b['colors'], b['indices']); lip.data.materials.append(lipmat); lip.visible_shadow = False
            lipmat.node_tree.nodes['A'].outputs[0].default_value = b['alpha']; lipmat.node_tree.nodes['C'].outputs[0].default_value = tuple(b['rgb']) + (1,)
    sc.render.filepath = os.path.join(OUT, '%s_f%05d.png' % (TAG, k)); bpy.ops.render.render(write_still=True)
    print('Saved', k, f['t'])
print('ALLDONE')
