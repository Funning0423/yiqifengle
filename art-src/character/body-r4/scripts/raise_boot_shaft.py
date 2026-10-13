# Raise the existing high-top shaft on the baked runtime body mesh.
# The sole rings stay where they are. Bones, IBM, and animation bytes are not rewritten.
#
#   blender -b --factory-startup -P art-src/character/body-r4/scripts/raise_boot_shaft.py
import json, os, struct, math
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
PARAMS = json.loads((ROOT / 'art-src/character/body-r4/data/params.json').read_text())
LG = PARAMS['legs']
NEW = LG['shoe_rings'][:6]
SOLE_Z = float(LG['sole_z'])
OLD_Z = (0.158, 0.15, 0.13, 0.112, 0.098, 0.086)

GLBS = [
    ROOT / 'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb',
    ROOT / 'art-src/character/body-r4/chr_b_r5g2_body-r4_TEST.glb',
    ROOT / 'art-src/character/body-r4/chr_b_r5g2_body-r4_walk-v2_TEST.glb',
]
NPZ = ROOT / 'art-src/character/body-r4/data/head_prims.npz'
RUNTIME = GLBS[0]


def smooth(t):
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return t * t * (3 - 2 * t)


def load_glb(path):
    raw = Path(path).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    gltf = json.loads(raw[20:20 + length])
    blob = bytearray(raw[28 + length:])
    return gltf, blob, raw, length


def acc_slice(gltf, index):
    acc = gltf['accessors'][index]
    view = gltf['bufferViews'][acc['bufferView']]
    off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    count = acc['count']
    comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc['type']]
    dtype = {5121: np.uint8, 5123: np.uint16, 5126: np.float32}[acc['componentType']]
    nbytes = count * comps * np.dtype(dtype).itemsize
    return off, nbytes, dtype, (count, comps)


def read_acc(blob, gltf, index):
    off, nbytes, dtype, shape = acc_slice(gltf, index)
    return np.frombuffer(blob[off:off + nbytes], dtype=dtype).reshape(shape).copy()


def node_world(index, nodes):
    parent = {}
    for i, node in enumerate(nodes):
        for child in node.get('children', []):
            parent[child] = i
    chain = []
    while index is not None:
        chain.append(index)
        index = parent.get(index)
    world = np.eye(4)
    for i in reversed(chain):
        node = nodes[i]
        if 'matrix' in node:
            local = np.array(node['matrix'], float).reshape(4, 4).T
        else:
            t = np.array(node.get('translation', [0, 0, 0]), float)
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            s = np.array(node.get('scale', [1, 1, 1]), float)
            rot = np.array([
                [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
            ])
            local = np.eye(4)
            local[:3, :3] = rot * s
            local[:3, 3] = t
        world = world @ local
    return world


def ring_pts(cx, cy, z, fr, bk, hw, n=16):
    """Same ring as build_body.shoe, returned in glTF (x, z_up, -y)."""
    e = LG['shoe_ex']
    toe_ex = LG['toe_ex']
    toe_taper = LG['toe_taper']
    taper_z = LG['taper_z']
    out = []
    for k in range(n):
        theta = 2 * math.pi * k / n
        s, c = math.sin(theta), math.cos(theta)
        ee = e if c > 0 else toe_ex
        taper = 1 - toe_taper * max(0.0, -c) ** 2 * smooth((taper_z - z) / 0.03)
        x = cx + hw * taper * math.copysign(abs(s) ** ee, s)
        y = cy + (bk if c > 0 else fr) * math.copysign(abs(c) ** ee, c)
        out.append((x, z, -y))
    return np.array(out, np.float64)


def leg_w(z, y_bl, ankle_y):
    shaft = smooth((z - LG['ank_z0']) / (LG['ank_z1'] - LG['ank_z0']))
    shaft *= smooth((y_bl - (ankle_y - 0.075)) / 0.035)
    foot = 1.0 - shaft
    return 1.0 - foot, foot


def body_prim(gltf):
    mesh = next(m for m in gltf['meshes'] if m['name'] == 'LOD0_G2_BODY')
    return mesh['primitives'][0]


def clusters(pos, mask):
    groups = {}
    for index in np.where(mask)[0]:
        key = round(float(pos[index, 1]), 4)
        groups.setdefault(key, []).append(int(index))
    return sorted(groups.items(), key=lambda item: -item[0])


def match_ring(pos, indices, generated, cx, cy):
    """Pair an existing 16-vert ring to generated spokes.

    atan2(±pi) flips a seam vertex from one end of the sort to the other on
    the positive-X shoe, so a plain argsort is one spoke off. The right cyclic
    shift is the one that moves each vertex the least.
    """
    indices = np.asarray(indices)

    def ang(x, z):
        return np.arctan2(x - cx, -z - cy)

    order = np.argsort(ang(pos[indices, 0], pos[indices, 2]), kind='mergesort')
    gorder = np.argsort(ang(generated[:, 0], generated[:, 2]), kind='mergesort')
    ordered = indices[order]
    generated = generated[gorder]
    best = None
    for shift in range(len(ordered)):
        rolled = np.roll(generated, shift, axis=0)
        err = float(np.max(np.linalg.norm(pos[ordered] - rolled, axis=1)))
        if best is None or err < best[0]:
            best = (err, rolled)
    return ordered, best[1]


def shade_normals(pos, triangles, shoe_set, previous):
    mesh = bmesh.new()
    verts = [mesh.verts.new(Vector((float(p[0]), float(p[1]), float(p[2])))) for p in pos]
    mesh.verts.ensure_lookup_table()
    for tri in triangles:
        if any(int(v) in shoe_set for v in tri):
            mesh.faces.new([verts[int(v)] for v in tri])
    mesh.normal_update()
    dots = []
    for index in shoe_set:
        n = verts[index].normal
        if n.length < 1e-8:
            continue
        dots.append(n.dot(Vector(previous[index])))
    flip = float(np.median(dots)) < 0
    out = previous.copy()
    for index in shoe_set:
        n = verts[index].normal
        if n.length < 1e-8:
            continue
        if flip:
            n = -n
        out[index] = (n.x, n.y, n.z)
    print('normal flip', flip, 'median dot', float(np.median(dots)))
    mesh.free()
    return out


def edit_arrays(gltf, blob):
    prim = body_prim(gltf)
    pos = read_acc(blob, gltf, prim['attributes']['POSITION']).astype(np.float64)
    normal = read_acc(blob, gltf, prim['attributes']['NORMAL']).astype(np.float64)
    uv = read_acc(blob, gltf, prim['attributes']['TEXCOORD_0']).astype(np.float64)
    joints = read_acc(blob, gltf, prim['attributes']['JOINTS_0']).astype(np.int32)
    weights = read_acc(blob, gltf, prim['attributes']['WEIGHTS_0']).astype(np.float64)
    triangles = read_acc(blob, gltf, prim['indices']).reshape(-1, 3).astype(np.int32)
    original = pos.copy()

    names = [node.get('name') for node in gltf['nodes']]
    joint_names = [gltf['nodes'][i]['name'] for i in gltf['skins'][0]['joints']]
    shin = {side: joint_names.index(f'shin.{side}') for side in ('L', 'R')}
    foot = {side: joint_names.index(f'foot.{side}') for side in ('L', 'R')}
    ankles = {}
    for side in ('L', 'R'):
        world = node_world(names.index(f'foot.{side}'), gltf['nodes'])
        ankles[side] = (float(world[0, 3]), float(-world[2, 3]))
    print('ankles', ankles)

    shoe = (np.abs(uv[:, 0] - 0.75) < 0.02) & (uv[:, 1] > 0.54) & (uv[:, 1] < 0.62) & (pos[:, 1] < 0.25)
    leather = uv[shoe & (np.abs(uv[:, 1] - 0.555) < 0.01)][0].copy()
    sole = uv[shoe & (np.abs(uv[:, 1] - 0.6) < 0.01)][0].copy()
    print('uv leather', leather.tolist(), 'sole', sole.tolist())

    # The ring under the shaft is still the authored 0.074 section. It must match before any move.
    for side in ('L', 'R'):
        cx, cy = ankles[side]
        mask = shoe & ((pos[:, 0] > 0) if side == 'R' else (pos[:, 0] < 0))
        rings = [(y, ix) for y, ix in clusters(pos, mask) if len(ix) == 16]
        control = next(ix for y, ix in rings if abs(y - 0.074) < 1e-3)
        spec = next(row for row in LG['shoe_rings'] if abs(row[0] - 0.074) < 1e-6)
        matched, generated = match_ring(pos, control, ring_pts(cx, cy, *spec), cx, cy)
        err = np.max(np.abs(pos[matched] - generated))
        print(side, 'control ring mm', err * 1000)
        if err > 1e-5:
            raise SystemExit(f'{side} shoe ring does not match the existing shaft')

    moved = []
    for side in ('L', 'R'):
        cx, cy = ankles[side]
        mask = shoe & ((pos[:, 0] > 0) if side == 'R' else (pos[:, 0] < 0))
        rings = [(y, ix) for y, ix in clusters(pos, mask) if len(ix) == 16]
        top = rings[:6]
        got = tuple(y for y, _ in top)
        if max(abs(a - b) for a, b in zip(got, OLD_Z)) > 1e-3:
            raise SystemExit(f'{side} top rings {got} are not the short shaft')
        for spec, (_, indices) in zip(NEW, top):
            matched, generated = match_ring(pos, indices, ring_pts(cx, cy, *spec), cx, cy)
            for index, point in zip(matched, generated):
                if original[index, 1] < 0.08:
                    raise SystemExit('refusing to move a sole vertex')
                pos[index] = point
                shin_w, foot_w = leg_w(point[1], -point[2], cy)
                pairs = [(w, bone) for w, bone in ((shin_w, shin[side]), (foot_w, foot[side])) if w > 1e-4]
                total = sum(w for w, _ in pairs)
                pairs = [(w / total, bone) for w, bone in pairs]
                pairs.sort(reverse=True)
                pairs += [(0.0, 0)] * (4 - len(pairs))
                joints[index] = [bone for _, bone in pairs]
                weights[index] = [w for w, _ in pairs]
                moved.append(int(index))

    moved = np.array(sorted(set(moved)), np.int32)
    if len(moved) != 192:
        raise SystemExit(f'moved {len(moved)} verts, expected 192')

    for index in np.where(shoe)[0]:
        uv[index] = sole if pos[index, 1] < SOLE_Z else leather

    shoe_set = set(int(i) for i in np.where(shoe)[0])
    moved_set = set(int(i) for i in moved)
    # One ring of neighbours only. Growing the set inside the loop would flood the whole shoe.
    touched = set(moved_set)
    for tri in triangles:
        if any(int(v) in moved_set for v in tri):
            touched.update(int(v) for v in tri if int(v) in shoe_set)
    shaded = shade_normals(pos, triangles, shoe_set, normal)
    # Keep the sole and the unmoved upper byte-for-byte. Only the shaft and its seam get new normals.
    for index in shoe_set - touched:
        shaded[index] = normal[index]
    normal = shaded

    amin = np.array(gltf['accessors'][prim['attributes']['POSITION']]['min'], float)
    amax = np.array(gltf['accessors'][prim['attributes']['POSITION']]['max'], float)
    if np.any(pos.min(0) < amin - 1e-5) or np.any(pos.max(0) > amax + 1e-5):
        raise SystemExit(f'shaft left the accessor bounds {pos.min(0)} {pos.max(0)}')

    sole_band = shoe & (original[:, 1] <= 0.0115 + 1e-4)
    sole_move = np.max(np.abs(pos[sole_band] - original[sole_band])) if sole_band.any() else 0
    print('moved', len(moved), 'collar', float(pos[moved, 1].max()), 'sole move m', float(sole_move))
    if sole_move != 0:
        raise SystemExit('sole vertices moved')
    return pos, normal, uv, joints, weights, moved, touched


def write_attr(blob, gltf, accessor, array):
    off, nbytes, dtype, shape = acc_slice(gltf, accessor)
    packed = np.ascontiguousarray(array.astype(dtype, copy=False)).reshape(shape)
    raw = packed.tobytes()
    if len(raw) != nbytes:
        raise SystemExit(f'accessor {accessor} size {len(raw)} != {nbytes}')
    blob[off:off + nbytes] = raw


def patch_file(path, pos, normal, uv, joints, weights):
    gltf, blob, raw, length = load_glb(path)
    before = bytes(blob)
    prim = body_prim(gltf)
    write_attr(blob, gltf, prim['attributes']['POSITION'], pos.astype(np.float32))
    write_attr(blob, gltf, prim['attributes']['NORMAL'], normal.astype(np.float32))
    write_attr(blob, gltf, prim['attributes']['TEXCOORD_0'], uv.astype(np.float32))
    write_attr(blob, gltf, prim['attributes']['JOINTS_0'], joints.astype(np.uint8))
    write_attr(blob, gltf, prim['attributes']['WEIGHTS_0'], weights.astype(np.float32))
    json_chunk = raw[20:20 + length]
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, 12 + 8 + length + 8 + len(blob))
    out += struct.pack('<I', length) + b'JSON' + json_chunk
    out += struct.pack('<I', len(blob)) + b'BIN\0' + blob
    Path(path).write_bytes(out)
    check, blob2, _, _ = load_glb(path)
    if json.dumps(check, sort_keys=True) != json.dumps(gltf, sort_keys=True):
        raise SystemExit('json chunk changed ' + str(path))
    ibm = gltf['accessors'][gltf['skins'][0]['inverseBindMatrices']]['bufferView']
    if view_bytes(gltf, before, ibm) != view_bytes(check, blob2, ibm):
        raise SystemExit('IBM changed ' + str(path))
    for anim in gltf['animations']:
        for sampler in anim['samplers']:
            for which in ('input', 'output'):
                view = gltf['accessors'][sampler[which]]['bufferView']
                if view_bytes(gltf, before, view) != view_bytes(check, blob2, view):
                    raise SystemExit(f'anim changed {path} {anim["name"]}')
    print('patched', path, os.path.getsize(path))


def view_bytes(gltf, blob, index):
    view = gltf['bufferViews'][index]
    off = view.get('byteOffset', 0)
    return bytes(blob[off:off + view['byteLength']])


def render_previews():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module='io_scene_gltf2')
    bpy.ops.import_scene.gltf(filepath=str(RUNTIME))
    # The dress hides the shaft. Previews are the boots and the stocking above them.
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and obj.name != 'LOD0_G2_BODY':
            obj.hide_render = True

    def boot_points(side):
        found = []
        for obj in bpy.context.scene.objects:
            if obj.type != 'MESH' or obj.hide_render:
                continue
            for vert in obj.data.vertices:
                world = obj.matrix_world @ vert.co
                if world.z > 0.28:
                    continue
                if side == 'R' and world.x > -0.01:
                    continue
                if side == 'L' and world.x < 0.01:
                    continue
                found.append(world.copy())
        return found

    right = boot_points('R')
    both = boot_points(None)
    if len(right) < 10 or len(both) < 10:
        raise RuntimeError('no boot vertices after import')

    def center_of(samples):
        return Vector((
            sum(p.x for p in samples) / len(samples),
            sum(p.y for p in samples) / len(samples),
            sum(p.z for p in samples) / len(samples),
        ))

    def aim(cam_obj, eye, target):
        from mathutils import Matrix
        eye = Vector(eye)
        direction = (Vector(target) - eye).normalized()
        # Local -Z looks at the target. Local +Y stays parallel to world +Z.
        z_axis = -direction
        x_axis = Vector((0, 0, 1)).cross(z_axis).normalized()
        y_axis = z_axis.cross(x_axis).normalized()
        cam_obj.matrix_world = Matrix((
            (x_axis.x, y_axis.x, z_axis.x, eye.x),
            (x_axis.y, y_axis.y, z_axis.y, eye.y),
            (x_axis.z, y_axis.z, z_axis.z, eye.z),
            (0.0, 0.0, 0.0, 1.0),
        ))
        up = cam_obj.matrix_world.to_3x3() @ Vector((0, 1, 0))
        print('camera', cam_obj.name, 'up', tuple(round(v, 3) for v in up))

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 90
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_shadows = False
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('boot_preview')
    scene.world = world
    world.color = (0.86, 0.88, 0.90)
    floor = bpy.data.meshes.new('floor')
    floor.from_pydata([(-1, -1, -0.002), (1, -1, -0.002), (1, 1, -0.002), (-1, 1, -0.002)], [], [(0, 1, 2, 3)])
    floor_obj = bpy.data.objects.new('floor', floor)
    scene.collection.objects.link(floor_obj)

    share = ROOT / 'art-src/character/body-r4/share'
    shots = Path('/opt/cursor/artifacts/screenshots')
    share.mkdir(parents=True, exist_ok=True)
    shots.mkdir(parents=True, exist_ok=True)

    # ortho_scale is the world-space height of the camera view.
    right_c = center_of(right)
    side = bpy.data.objects.new('boot_side', bpy.data.cameras.new('boot_side'))
    scene.collection.objects.link(side)
    side.data.type = 'ORTHO'
    side.data.ortho_scale = 0.36
    side.data.clip_start = 0.01
    side.data.clip_end = 10
    aim(side, (right_c.x - 0.5, right_c.y, right_c.z), right_c)
    scene.camera = side
    scene.render.filepath = str(shots / 'boot_side.jpg')
    bpy.ops.render.render(write_still=True)

    both_c = center_of(both)
    front = bpy.data.objects.new('boot_front', bpy.data.cameras.new('boot_front'))
    scene.collection.objects.link(front)
    front.data.type = 'ORTHO'
    front.data.ortho_scale = 0.42
    front.data.clip_start = 0.01
    front.data.clip_end = 10
    # Toe is -Y after the glTF import. Look from the toe side.
    aim(front, (both_c.x, both_c.y - 0.6, both_c.z), both_c)
    scene.camera = front
    scene.render.filepath = str(shots / 'boot_front.jpg')
    bpy.ops.render.render(write_still=True)
    for name in ('boot_side.jpg', 'boot_front.jpg'):
        data = (shots / name).read_bytes()
        (share / name).write_bytes(data)
        print('preview', share / name, len(data))


def main():
    gltf, blob, _, _ = load_glb(RUNTIME)
    pos0 = read_acc(blob, gltf, body_prim(gltf)['attributes']['POSITION'])
    pos, normal, uv, joints, weights, moved, touched = edit_arrays(gltf, blob)
    # Other copies of this body must still be the untouched 45d0fdb mesh.
    for path in GLBS:
        other, other_blob, _, _ = load_glb(path)
        got = read_acc(other_blob, other, body_prim(other)['attributes']['POSITION'])
        if got.shape != pos0.shape or not np.array_equal(got, pos0):
            raise SystemExit('body positions diverged ' + str(path))
        patch_file(path, pos, normal, uv, joints, weights)
    with np.load(NPZ) as source:
        packed = {key: np.array(source[key]) for key in source.files}
    same = np.ascontiguousarray(packed['M_G2_FACE__P'])
    if same.shape != pos0.shape or not np.array_equal(same, pos0):
        raise SystemExit('head_prims positions diverged')
    packed['M_G2_FACE__P'] = np.ascontiguousarray(pos.astype(np.float32))
    packed['M_G2_FACE__N'] = np.ascontiguousarray(normal.astype(np.float32))
    packed['M_G2_FACE__U'] = np.ascontiguousarray(uv.astype(np.float32))
    packed['M_G2_FACE__J'] = np.ascontiguousarray(joints.astype(np.uint8))
    packed['M_G2_FACE__W'] = np.ascontiguousarray(weights.astype(np.float32))
    np.savez(NPZ, **packed)
    print('npz updated', len(moved), 'shaft verts,', len(touched), 'reshaded')
    render_previews()


if __name__ == '__main__':
    main()
