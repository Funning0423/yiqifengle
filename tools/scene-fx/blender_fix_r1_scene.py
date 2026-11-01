# QA only (场景特效bot r5 S3 fix_r1): one game-camera still of a region scene + the production heroine (grokbot2), Cycles + OIDN.
#   blender -b --factory-startup -P blender_fix_r1_scene.py -- spec.json
# spec: {out, res:[w,h], samples, camera:{position,target,fovV} (glTF world),
#   imports:[{glb, keep?:regex, hide?:regex, pos?, yawDeg?, scale?, tex?:{imageName: png}}],
#   lakeside?:{repo, transforms?}  (lake-local instances, like blender_lakeside_360.py incl. the land fills),
#   heroine?:{glb, pos, yawDeg}, puffs?:[{p:[x,y,z], r, rgb:[..], a}], sun?:{dir:[x,y,z] (glTF, light travels along), energy, rgb},
#   world?:{rgb, strength}, hideRe?: regex over all object names, frame?: animation frame (default 1),
#   nodeYaw?:{name: deg} (freeze the clip pose at `frame`, then add a yaw about the parent's up axis, like SkycityPennantWind)}
#   heroine.snap?: drop her onto the ground under pos; border?: [x0,y0,x1,y1] normalised from the top-left (crop of the same camera)
import bpy, json, sys, math, os, re
from mathutils import Matrix, Vector, Quaternion
J = json.load(open(sys.argv[sys.argv.index('--') + 1]))
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))); Ci = C.inverted()
def g2b(p): return Vector((p[0], -p[2], p[1]))
def tr(v): m = Matrix.Identity(4); m.translation = Vector(v); return m
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
def imp(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
def place(objs, pos, yaw, s):
    h = bpy.data.objects.new('H', None); sc.collection.objects.link(h)
    for o in objs:
        if o.parent is None: o.parent = h
    h.matrix_world = Matrix.Translation(g2b(pos)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Scale(s, 4)
for it in J.get('imports', []):
    objs = imp(it['glb'])
    for o in objs:
        if o.type in ('CAMERA', 'LIGHT'): o.hide_render = True
        if o.type == 'MESH':
            if it.get('keep') and not re.search(it['keep'], o.name): o.hide_render = True
            if it.get('hide') and re.search(it['hide'], o.name): o.hide_render = True
    for name, png in (it.get('tex') or {}).items():
        im = bpy.data.images.get(name)
        if im is None: raise SystemExit('no image ' + name + ' in ' + str([i.name for i in bpy.data.images]))
        im.filepath = png; im.source = 'FILE'; im.reload()
    if 'pos' in it or 'yawDeg' in it or 'scale' in it: place(objs, it.get('pos', [0, 0, 0]), it.get('yawDeg', 0), it.get('scale', 1))
sc.frame_set(J.get('frame', 1))
for name, deg in (J.get('nodeYaw') or {}).items():  # like SkycityPennantWind: clip pose at `frame`, then yaw in the PARENT frame
    o = bpy.data.objects[name]; q0 = o.matrix_basis.to_quaternion(); o.animation_data_clear(); o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Quaternion((0, 0, 1), math.radians(deg)) @ q0
LK = J.get('lakeside')
if LK:
    B = LK['repo'] + '/creator-build-project/assets/bundles/region_lakeside/'
    T = json.load(open(LK.get('transforms') or B + 'scene_r5h_slim_transforms.json'))
    SKIP = ('LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb'); lib = {}
    hold = bpy.data.collections.new('lib'); sc.collection.children.link(hold)
    for ins in T['instances']:
        g = ins.get('glb')
        if not isinstance(g, str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name') == g.replace('.glb', ''): continue
        if g not in lib:
            objs = imp(B + 'models/' + g)
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
    fm = {}
    for g, objs in lib.items():
        c = CLS.get(g.replace('.glb', ''))
        if not c: continue
        for data, mw in objs:
            for si, mat in enumerate(data.materials):
                if mat is None: continue
                key = (mat.name, c)
                if key not in fm:
                    m2 = mat.copy(); bs = m2.node_tree.nodes.get('Principled BSDF')
                    if bs: bs.inputs['Emission Color'].default_value = FILL[c] + (1,); bs.inputs['Emission Strength'].default_value = 1.0
                    fm[key] = m2
                data.materials[si] = fm[key]
if J.get('hideRe'):
    for o in bpy.data.objects:
        if o.type == 'MESH' and re.search(J['hideRe'], o.name): o.hide_render = True
HZ = J.get('heroine')
if HZ:
    objs = imp(HZ['glb'])
    for o in objs:
        if o.type == 'MESH' and o.name.startswith('Icosphere'): o.hide_render = True
    pos = list(HZ['pos'])
    if HZ.get('snap'):  # drop onto the visible ground under pos (ray from 30 m above)
        dg = bpy.context.evaluated_depsgraph_get(); hero = set(objs)
        for o in objs: o.hide_set(True)
        for o in bpy.data.objects:
            if o.hide_render and o.name in bpy.context.view_layer.objects: o.hide_set(True)
        dg = bpy.context.evaluated_depsgraph_get()
        hit, loc, *_ = sc.ray_cast(dg, g2b([pos[0], pos[1] + 30, pos[2]]), Vector((0, 0, -1)))
        for o in objs: o.hide_set(False)
        if hit: pos[1] = loc.z
        print('FIXR1 heroine snap', hit, pos)
    place(objs, pos, HZ.get('yawDeg', 0), 1)
for i, p in enumerate(J.get('puffs', [])):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=p['r'], location=g2b(p['p']), segments=20, ring_count=10); o = bpy.context.object
    m = bpy.data.materials.new('puff%d' % i); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = tuple(p['rgb']) + (1,); bs.inputs['Alpha'].default_value = p['a']; bs.inputs['Roughness'].default_value = 1
    o.data.materials.append(m); bpy.ops.object.shade_smooth()
S = J.get('sun', {}); sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = S.get('energy', 3.4); sun.data.color = tuple(S.get('rgb', (1, .92, .82))); sun.data.angle = math.radians(4)
sun.rotation_mode = 'QUATERNION'; sun.rotation_quaternion = g2b(S.get('dir', (-0.4182, -0.3983, 0.8164))).normalized().to_track_quat('-Z', 'Y')
W = J.get('world', {}); w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = tuple(W.get('rgb', (.55, .72, .92))) + (1,); bg.inputs[1].default_value = W.get('strength', .9)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = J.get('samples', 64); sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
K = J['camera']; cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(K['fovV']); cam.data.clip_start = K.get('near', .1); cam.data.clip_end = K.get('far', 3000)
eye, tgt = g2b(K['position']), g2b(K['target']); cam.location = eye; cam.rotation_euler = (tgt - eye).to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = J['res']; sc.render.resolution_percentage = 100; sc.render.filepath = J['out']
if J.get('border'):  # [x0, y0, x1, y1] normalised, y from the TOP (image coords): same camera, cropped high-res inset
    b = J['border']; r = sc.render; r.use_border = True; r.use_crop_to_border = True
    r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y = b[0], b[2], 1 - b[3], 1 - b[1]
bpy.ops.render.render(write_still=True); print('FIXR1', J['out'])
