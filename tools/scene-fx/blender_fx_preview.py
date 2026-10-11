# QA only (not shipped). blender -b --factory-startup -P blender_fx_preview.py -- frames.json out_dir [res_x res_y samples every]
# Offline NON-NATIVE replica: Cycles (CPU) + one sun approximates the island light. The FX meshes, vertex alpha, transforms,
# colours and alphas per frame come from the REAL IslandAtmosphereFxCore (dump_fx_frames.cjs). Blending is rebuilt with
# Blender nodes (additive = emission + transparent, smoke = alpha mix), not the Cocos builtin-unlit shader itself.
import bpy, json, sys, math, os, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
cfg = json.load(open(a[0])); OUT = a[1]; os.makedirs(OUT, exist_ok=True)
RX, RY = (int(a[2]), int(a[3])) if len(a) > 3 else (390, 844); SAMPLES = int(a[4]) if len(a) > 4 else 12; EVERY = int(a[5]) if len(a) > 5 else 1
GLB = cfg.get('glb') or os.path.join(os.path.dirname(__file__), '../../creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = cfg['fps']
def v(p): return mathutils.Vector((p[0], -p[2], p[1]))
def q(r): return mathutils.Quaternion((r[3], r[0], -r[2], r[1]))
bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))
HIDE = ('env_lighthouse_beam_night_v22', 'env_chimney_smoke_', 'col_', 'character_height_reference', 'env_interior_floor_skirt_preview')
night_objs, sky, clouds = [], [], []
for o in bpy.data.objects:
    if any(o.name.startswith(h) for h in HIDE): o.hide_render = True
    elif '_night_v22' in o.name: night_objs.append(o)
    elif o.name.startswith('env_sky_dome'): sky.append(o)
    elif o.name.startswith('env_cloud_layer'): clouds.append(o)
def mesh_obj(name, g):
    me = bpy.data.meshes.new(name); P = g['positions']; I = g['indices']
    me.from_pydata([tuple(v(P[i:i + 3])) for i in range(0, len(P), 3)], [], [tuple(I[i:i + 3]) for i in range(0, len(I), 3)]); me.update()
    ca = me.color_attributes.new('fx', 'FLOAT_COLOR', 'POINT'); C = g['colors']
    for i in range(len(P) // 3): ca.data[i].color = (C[i * 4], C[i * 4 + 1], C[i * 4 + 2], C[i * 4 + 3])
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); ob.rotation_mode = 'QUATERNION'; ob['fxa'] = 0.0; ob['fxc'] = [1.0, 1.0, 1.0]; return ob
def material(name, additive):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    m.use_backface_culling = False
    out = nt.nodes.new('ShaderNodeOutputMaterial'); vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'fx'
    aa = nt.nodes.new('ShaderNodeAttribute'); aa.attribute_type = 'OBJECT'; aa.attribute_name = 'fxa'
    ac = nt.nodes.new('ShaderNodeAttribute'); ac.attribute_type = 'OBJECT'; ac.attribute_name = 'fxc'
    al = nt.nodes.new('ShaderNodeMath'); al.operation = 'MULTIPLY'; nt.links.new(vc.outputs['Alpha'], al.inputs[0]); nt.links.new(aa.outputs['Fac'], al.inputs[1])
    col = nt.nodes.new('ShaderNodeMix'); col.data_type = 'RGBA'; col.blend_type = 'MULTIPLY'; col.inputs['Factor'].default_value = 1
    nt.links.new(ac.outputs['Color'], col.inputs[6]); nt.links.new(vc.outputs['Color'], col.inputs[7])
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(col.outputs[2], em.inputs['Color']); tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    if additive:  # SRC_ALPHA, ONE: background + rgb * a
        nt.links.new(al.outputs[0], em.inputs['Strength']); ad = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(em.outputs[0], ad.inputs[0]); nt.links.new(tr.outputs[0], ad.inputs[1]); nt.links.new(ad.outputs[0], out.inputs[0])
    else:         # SRC_ALPHA, ONE_MINUS_SRC_ALPHA
        mx = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(al.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
    return m
# Cocos tints the unlit cloud layer to [.22,.28,.43] at night (bindUnlitBackdrop); same here by material swap.
NIGHT_CLOUD = bpy.data.materials.new('night_cloud'); NIGHT_CLOUD.use_nodes = True
_e = NIGHT_CLOUD.node_tree.nodes.new('ShaderNodeEmission'); _e.inputs['Color'].default_value = (.04, .065, .155, 1)
NIGHT_CLOUD.node_tree.links.new(_e.outputs[0], NIGHT_CLOUD.node_tree.nodes['Material Output'].inputs[0])
DAY_CLOUD = {o.name: [m for m in o.data.materials] for o in clouds}
G = cfg['geometry']; ADD = material('fx_add', True); BLEND = material('fx_blend', False)
beam = mesh_obj('fx_lighthouse_beam', G['beam']); glow = mesh_obj('fx_lighthouse_glow', G['glow']); glint = mesh_obj('fx_lighthouse_seaglint', G['glint'])
for o in (beam, glow, glint): o.data.materials.append(ADD)
beam.location = v(cfg['lamp']); glint.location = v([cfg['lamp'][0], cfg['seaY'], cfg['lamp'][2]])
puffs = []
for i in range(len(cfg['frames'][0]['puffs'])):
    o = mesh_obj('fx_chimney_smoke_puff_%d' % i, G['puff%d' % (i % 2)]); o.data.materials.append(BLEND); puffs.append(o)
c = cfg['camera']; cam = bpy.data.cameras.new('cam'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(c['fov']); cam.clip_start = .05; cam.clip_end = 1000
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
p = v(c['pos']); t = v(c['target']); co.location = p; co.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.lights.new('sun', 'SUN'); sun.use_shadow = os.environ.get('FX_SHADOW', '0') == '1'; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(50), 0, math.radians(-35)); sun.angle = math.radians(8)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
ENGINE = os.environ.get('FX_ENGINE', 'CYCLES')  # software-GL EEVEE drops the palette texture on this box (black patches)
if ENGINE == 'CYCLES':
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 16
else: sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = SAMPLES
for attr, val in (('use_raytracing', False), ('use_gtao', False), ('use_shadows', os.environ.get('FX_SHADOW', '0') == '1')):
    try: setattr(sc.eevee, attr, val)
    except Exception as e: print('eevee option', attr, e)
sc.render.resolution_x, sc.render.resolution_y = RX, RY; sc.view_settings.view_transform = 'Standard'
def lerp(x, y, k): return tuple(x[i] + (y[i] - x[i]) * k for i in range(len(x)))
def srgb2lin(c): return [((x / 255) / 12.92 if x / 255 <= .04045 else (((x / 255) + .055) / 1.055) ** 2.4) for x in c]
COL = {k: srgb2lin(cfg['colors'][k]) for k in ('beam', 'glow', 'glint')}
def setfx(o, a, rgb):
    o['fxa'] = float(a); o['fxc'] = list(rgb); o.hide_render = a <= 1 / 255
for k, f in enumerate(cfg['frames']):
    if k % EVERY: continue
    n = f['night']
    sun.energy = 3.2 + (0.9 - 3.2) * n; sun.color = lerp((1, .97, .92), (180 / 255, 198 / 255, 232 / 255), n)
    bg.inputs[0].default_value = lerp((.55, .7, .8, 1), (.03, .05, .12, 1), n); bg.inputs[1].default_value = .9 + (.5 - .9) * n
    for o in sky: o.hide_render = n > .5
    for o in night_objs: o.hide_render = n < .5
    for o in clouds:
        for i in range(len(o.data.materials)): o.data.materials[i] = NIGHT_CLOUD if n >= .5 else DAY_CLOUD[o.name][i]
    sc.frame_set(int(round(f['t'] * cfg['fps'])) % int(12 * cfg['fps']) + 1)
    beam.rotation_quaternion = q(f['beam']['rot']); setfx(beam, f['beam']['alpha'], COL['beam'])
    glow.location = v(f['glow']['pos']); glow.rotation_quaternion = q(f['glow']['rot']); s = f['glow']['scale']; glow.scale = (s, s, s); setfx(glow, f['glow']['alpha'], COL['glow'])
    glint.rotation_quaternion = q(f['glint']['rot']); setfx(glint, f['glint']['alpha'], COL['glint'])
    for o, pf in zip(puffs, f['puffs']):
        o.location = v(pf['pos']); o.rotation_quaternion = q(pf['rot']); sx, sy, sz = pf['scale']; o.scale = (sx, sz, sy); setfx(o, pf['alpha'], srgb2lin(pf['color']))
    sc.render.filepath = os.path.join(OUT, 'f%05d.png' % k); bpy.ops.render.render(write_still=True)
print('DONE', OUT)
