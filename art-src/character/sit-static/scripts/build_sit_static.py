#!/usr/bin/env python3
"""Bake a boneless sitting mesh for the reading chair.

The sit_down / stand_up clips are not edited. This script poses the existing
rig at the sit_down last frame, optionally straightens the bake (hips and feet
stay), applies that pose, and replaces the skirt and apron with a new low-poly
drape that sits on the chair boxes. No shape keys and no cloth simulation.

Blender is Z-up. The character and the chair numbers are glTF Y-up
(+Z forward). Geometry is authored in character space and converted.
"""
import addon_utils
import json
import math
import os
import traceback

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

addon_utils.enable('io_scene_gltf2')

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
CHR = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
OUT_DIR = os.path.join(REPO, 'art-src/character/sit-static')
PREVIEW = os.path.join(OUT_DIR, 'previews')
GLB_OUT = os.path.join(OUT_DIR, 'chr_sit_static.glb')
RUNTIME = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/sit-static/chr_sit_static.glb')
REF_DIR = os.environ.get('SIT_REF_DIR', '/home/ubuntu/.cursor/projects/workspace/assets')
MAX_BYTES = 185000
MAX_TRIS = 8000

# Chair parts in the seated-root / character frame (Y up, +Z forward).
CHAIR_BOXES_CHAR = {
    'seat': ([-0.247, 0.341, -0.177], [0.247, 0.380, 0.205]),
    'leg_fr': ([-0.258, -0.001, 0.153], [-0.195, 0.365, 0.215]),
    'leg_br': ([-0.258, -0.001, -0.208], [-0.195, 0.365, -0.125]),
    'leg_fl': ([0.195, -0.001, 0.153], [0.258, 0.365, 0.216]),
    'leg_bl': ([0.195, -0.001, -0.208], [0.258, 0.365, -0.125]),
    'stretch_r': ([-0.246, 0.122, -0.177], [-0.220, 0.147, 0.205]),
    'stretch_l': ([0.220, 0.122, -0.177], [0.246, 0.147, 0.205]),
    'stretch_f': ([-0.223, 0.114, 0.192], [0.223, 0.140, 0.218]),
    'post_r': ([-0.242, 0.366, -0.251], [-0.199, 0.865, -0.142]),
    'post_l': ([0.199, 0.366, -0.251], [0.242, 0.865, -0.142]),
    'rail_low': ([-0.223, 0.461, -0.195], [0.223, 0.497, -0.158]),
    'rail_top': ([-0.223, 0.829, -0.263], [0.223, 0.895, -0.196]),
    'spindle_r': ([-0.141, 0.484, -0.242], [-0.113, 0.853, -0.164]),
    'spindle_c': ([-0.014, 0.484, -0.242], [0.014, 0.853, -0.164]),
    'spindle_l': ([0.113, 0.484, -0.242], [0.141, 0.853, -0.164]),
}
SEAT_TOP = 0.380
CLEAR = 0.006

BASE_COLOR = {
    'M_G2_FACE': (0.93, 0.78, 0.68, 1),
    'M_G2_HEAD': (0.86, 0.74, 0.48, 1),
    'M_G2_HAIR': (0.16, 0.20, 0.36, 1),
    'M_G2_BODY': (0.93, 0.86, 0.74, 1),
    'M_G2_DRESS': (0.95, 0.82, 0.28, 1),
    'M_G2_APRON': (0.96, 0.94, 0.90, 1),
}

RATIOS = {
    'M_G2_FACE': 0.46,
    'M_G2_HAIR': 0.30,
    'M_G2_HEAD': 0.55,
    'M_G2_BODY': 0.85,
    'M_G2_DRESS': 0.50,
}


def log(msg):
    print(msg, flush=True)


def to_b(x, y, z):
    """glTF Y-up, +Z forward -> Blender Z-up."""
    return (x, -z, y)


def to_c(x, y, z):
    """Blender Z-up -> glTF Y-up."""
    return (x, z, -y)


def box_to_b(lo, hi):
    corners = []
    for x in (lo[0], hi[0]):
        for y in (lo[1], hi[1]):
            for z in (lo[2], hi[2]):
                corners.append(to_b(x, y, z))
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    zs = [c[2] for c in corners]
    return ([min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)])


CHAIR_BOXES = {name: box_to_b(lo, hi) for name, (lo, hi) in CHAIR_BOXES_CHAR.items()}


def object_mode():
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def activate(obj):
    object_mode()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def tris_of(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def mat_key(obj):
    if obj.material_slots and obj.material_slots[0].material:
        return obj.material_slots[0].material.name.split('.')[0]
    return ''


def bone_world(arm, name):
    pb = arm.pose.bones[name]
    head = arm.matrix_world @ pb.head
    return Vector((head.x, head.y, head.z))


def find_armature():
    arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if not arms:
        raise RuntimeError('no armature after gltf import')
    return arms[0]


def find_action(clip):
    for act in bpy.data.actions:
        if act.name == clip or act.name.endswith('|' + clip) or act.name.endswith(clip):
            return act
    raise RuntimeError('missing action %s' % clip)


def pose_clip(arm, clip):
    act = find_action(clip)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    frame = int(round(act.frame_range[1]))
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    log('posed %s frame %s' % (act.name, frame))
    return frame


def rotate_local(pb, axis, deg):
    pb.rotation_mode = 'QUATERNION'
    q = Quaternion(Vector(axis), math.radians(deg))
    pb.rotation_quaternion = q @ pb.rotation_quaternion
    bpy.context.view_layer.update()


def ccd(arm, bone_names, end_name, target, steps=14, max_ang=0.45):
    target = Vector(target)
    for _ in range(steps):
        end = bone_world(arm, end_name)
        if (end - target).length < 0.008:
            break
        for name in reversed(bone_names):
            pb = arm.pose.bones[name]
            head = bone_world(arm, name)
            end = bone_world(arm, end_name)
            to_end = end - head
            to_tgt = target - head
            if to_end.length < 1e-5 or to_tgt.length < 1e-5:
                continue
            axis = to_end.normalized().cross(to_tgt.normalized())
            if axis.length < 1e-6:
                continue
            ang = math.acos(max(-1.0, min(1.0, to_end.normalized().dot(to_tgt.normalized()))))
            ang = max(-max_ang, min(max_ang, ang))
            axis.normalize()
            q = Quaternion(axis, ang)
            T = Matrix.Translation(pb.head)
            pb.matrix = T @ q.to_matrix().to_4x4() @ Matrix.Translation(-pb.head) @ pb.matrix
            bpy.context.view_layer.update()


def polish_pose(arm):
    """Bake-only. Hips and legs are not touched, so pelvis height and feet stay
    on the sit_down last frame. Spine pitch and the arms are posed so the
    static mesh sits upright with the hands stacked. No keys are inserted."""
    before = {n: [round(v, 4) for v in to_c(*bone_world(arm, n))] for n in ('hips', 'head', 'hand.L', 'hand.R', 'foot.L', 'foot.R')}
    for name, deg in (('spine', -10), ('chest', -6), ('neck', -3)):
        rotate_local(arm.pose.bones[name], (1, 0, 0), deg)
    # Wrists on the thighs, right slightly over left. Targets are Blender Z-up.
    ccd(arm, ['upper_arm.L', 'forearm.L'], 'hand.L', to_b(-0.05, 0.40, 0.20))
    ccd(arm, ['upper_arm.R', 'forearm.R'], 'hand.R', to_b(0.01, 0.43, 0.16))
    after = {n: [round(v, 4) for v in to_c(*bone_world(arm, n))] for n in ('hips', 'chest', 'head', 'hand.L', 'hand.R', 'foot.L', 'foot.R')}
    log('pose before ' + json.dumps(before))
    log('pose after ' + json.dumps(after))
    for n in ('hips', 'foot.L', 'foot.R'):
        if max(abs(before[n][i] - after[n][i]) for i in range(3)) > 0.002:
            raise RuntimeError('polish moved %s' % n)
    return after


def apply_pose_modifiers(obj):
    activate(obj)
    if obj.data.shape_keys:
        obj.shape_key_clear()
    for mod in list(obj.modifiers):
        if mod.type == 'ARMATURE':
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception as exc:
                log('modifier apply failed %s %s' % (obj.name, exc))


def clear_parent_apply(obj):
    activate(obj)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def drop_vertex_groups(obj):
    obj.vertex_groups.clear()
    for mod in list(obj.modifiers):
        obj.modifiers.remove(mod)


def separate_by_material(obj):
    if len(obj.material_slots) < 2:
        return
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')


def segment_dist(p, head, tail):
    ab = tail - head
    denom = ab.dot(ab) or 1.0
    t = max(0.0, min(1.0, (p - head).dot(ab) / denom))
    q = head + ab * t
    return (p - q).length


def dress_keep_point(p, torso, arms):
    # Bodice only. Sleeves are rebuilt as short tubes so the puff survives decimation.
    for head, tail in torso:
        if segment_dist(p, head, tail) < 0.18 and p.z > 0.44:
            return True
    return False


def split_dress_upper(dress, arm):
    """Delete the skirt in place. Keep the bodice and puffy sleeves."""
    mw = dress.matrix_world
    torso = []
    for name in ('spine', 'chest'):
        pb = arm.pose.bones[name]
        torso.append((arm.matrix_world @ pb.head, arm.matrix_world @ pb.tail))
    arms = []
    for name in ('upper_arm.L', 'forearm.L', 'upper_arm.R', 'forearm.R'):
        pb = arm.pose.bones[name]
        arms.append((name, arm.matrix_world @ pb.head, arm.matrix_world @ pb.tail))
    bm = bmesh.new()
    bm.from_mesh(dress.data)
    bm.verts.ensure_lookup_table()
    drop = []
    kept = 0
    for v in bm.verts:
        if dress_keep_point(mw @ v.co, torso, arms):
            kept += 1
        else:
            drop.append(v)
    log('dress upper verts %d / %d' % (kept, kept + len(drop)))
    if kept < 40:
        bm.free()
        return None
    bmesh.ops.delete(bm, geom=drop, context='VERTS')
    bm.normal_update()
    bm.to_mesh(dress.data)
    dress.data.update()
    bm.free()
    dress.name = 'SitDressUpper'
    log('dress upper tris %d' % tris_of(dress))
    return dress


def decimate(obj, ratio):
    if ratio >= 0.98:
        return
    before = tris_of(obj)
    if before < 40:
        return
    activate(obj)
    mod = obj.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = max(0.05, min(1.0, ratio))
    mod.use_collapse_triangulate = True
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as exc:
        log('decimate failed %s %s' % (obj.name, exc))
        obj.modifiers.remove(mod)
        return
    log('decimate %s %d -> %d (%.2f)' % (obj.name, before, tris_of(obj), ratio))


def box_sdf(p, lo, hi):
    dx = max(lo[0] - p[0], 0.0, p[0] - hi[0])
    dy = max(lo[1] - p[1], 0.0, p[1] - hi[1])
    dz = max(lo[2] - p[2], 0.0, p[2] - hi[2])
    outside = math.sqrt(dx * dx + dy * dy + dz * dz)
    if outside > 0:
        return outside
    ix = max(lo[0] - p[0], p[0] - hi[0])
    iy = max(lo[1] - p[1], p[1] - hi[1])
    iz = max(lo[2] - p[2], p[2] - hi[2])
    return max(ix, iy, iz)


def nearest_box(p):
    best = None
    for lo, hi in CHAIR_BOXES.values():
        d = box_sdf(p, lo, hi)
        if best is None or d < best[0]:
            best = (d, lo, hi)
    return best


def push_out_of_chair(obj, margin):
    mesh = obj.data
    moved = 0
    worst = 0.0
    for v in mesh.vertices:
        p = [v.co.x, v.co.y, v.co.z]
        best = nearest_box(p)
        if best is None or best[0] >= margin:
            if v.co.z < 0.012:
                v.co.z = 0.012
                moved += 1
            continue
        d, lo, hi = best
        g = [0.0, 0.0, 0.0]
        e = 1e-4
        for k in range(3):
            pp = p[:]
            pm = p[:]
            pp[k] += e
            pm[k] -= e
            g[k] = (box_sdf(pp, lo, hi) - box_sdf(pm, lo, hi)) / (2 * e)
        glen = math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) or 1.0
        lift = margin - d
        v.co.x += g[0] / glen * lift
        v.co.y += g[1] / glen * lift
        v.co.z += g[2] / glen * lift
        if v.co.z < 0.012:
            v.co.z = 0.012
        moved += 1
        if -d > worst:
            worst = -d
    mesh.update()
    log('push %s moved %d worst %.4f' % (obj.name, moved, worst))


def count_penetration(obj):
    n = 0
    worst = 0.0
    floor = 0
    for v in obj.data.vertices:
        p = (v.co.x, v.co.y, v.co.z)
        if p[2] < -0.001:
            floor += 1
        best = nearest_box(p)
        if best and best[0] < 0:
            n += 1
            if -best[0] > worst:
                worst = -best[0]
    return {'inside': n, 'worst_m': round(worst, 5), 'below_floor': floor, 'verts': len(obj.data.vertices), 'tris': tris_of(obj)}


def push_body_off_seat(obj):
    lo, hi = CHAIR_BOXES['seat']
    moved = 0
    for v in obj.data.vertices:
        p = v.co
        if p.x < lo[0] or p.x > hi[0] or p.y < lo[1] or p.y > hi[1]:
            continue
        if lo[2] - 0.01 < p.z < hi[2] + 0.002:
            v.co.z = hi[2] + 0.004
            moved += 1
    obj.data.update()
    log('seat lift %s %d' % (obj.name, moved))


def new_mesh(name, verts_c, faces, mat, uv):
    verts = [to_b(*v) for v in verts_c]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        if mat.name not in [s.name for s in obj.data.materials]:
            obj.data.materials.append(mat)
    mesh.uv_layers.new(name='UVMap')
    layer = mesh.uv_layers.active.data
    for poly in mesh.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            layer[li].uv = uv
    return obj


def blend_profiles(front, side, back, n_ang):
    rows = len(front)
    verts = []
    for i in range(n_ang):
        theta = (i / n_ang) * math.tau
        cf = max(0.0, math.cos(theta)) ** 1.15
        cs = abs(math.sin(theta)) ** 1.15
        cb = max(0.0, -math.cos(theta)) ** 1.15
        w = cf + cs + cb or 1.0
        cf, cs, cb = cf / w, cs / w, cb / w
        for r in range(rows):
            y = front[r][0] * cf + side[r][0] * cs + back[r][0] * cb
            rx = front[r][1] * cf + side[r][1] * cs + back[r][1] * cb
            rz = front[r][2] * cf + side[r][2] * cs + back[r][2] * cb
            cz = front[r][3] * cf + side[r][3] * cs + back[r][3] * cb
            x = math.sin(theta) * rx
            z = cz + math.cos(theta) * rz
            verts.append((x, y, z))
    faces = []
    for i in range(n_ang):
        i2 = (i + 1) % n_ang
        for r in range(rows - 1):
            a = i * rows + r
            b = i2 * rows + r
            c = i2 * rows + r + 1
            d = i * rows + r + 1
            faces.append((a, b, c, d))
    return verts, faces


def skirt_geometry():
    # (height, radius_x, radius_z, center_z) waist -> hem. +Z is her front.
    # Height only falls. The front reaches past the knees (they sit near z=0.51)
    # then the hem drops in front of the shins so the calves still show.
    front = [
        (0.520, 0.130, 0.060, 0.02),
        (0.480, 0.160, 0.050, 0.16),
        (0.440, 0.190, 0.040, 0.32),
        (0.400, 0.220, 0.030, 0.48),
        (0.340, 0.210, 0.020, 0.52),
        (0.280, 0.190, 0.016, 0.50),
        (0.230, 0.170, 0.012, 0.46),
    ]
    side = [
        (0.520, 0.140, 0.080, 0.00),
        (0.460, 0.200, 0.060, 0.04),
        (0.400, 0.260, 0.040, 0.08),
        (0.340, 0.280, 0.030, 0.10),
        (0.280, 0.240, 0.025, 0.08),
        (0.230, 0.200, 0.020, 0.06),
        (0.200, 0.180, 0.016, 0.04),
    ]
    back = [
        (0.520, 0.120, 0.050, -0.02),
        (0.480, 0.150, 0.040, -0.04),
        (0.440, 0.170, 0.030, -0.07),
        (0.410, 0.160, 0.020, -0.09),
        (0.400, 0.150, 0.016, -0.08),
        (0.396, 0.140, 0.012, -0.07),
        (0.392, 0.130, 0.010, -0.06),
    ]
    return blend_profiles(front, side, back, 32)


def apron_geometry():
    # Bib and front panel, a few centimetres in front of the yellow skirt.
    line = [(0.64, 0.12), (0.54, 0.20), (0.46, 0.34), (0.38, 0.48), (0.30, 0.52), (0.24, 0.46)]
    half = [0.055, 0.075, 0.095, 0.115, 0.125, 0.110]
    nu = 7
    verts = []
    for (y, z), h in zip(line, half):
        for i in range(nu):
            x = (-1 + 2 * i / (nu - 1)) * h
            verts.append((x, y, z + 0.018))
    faces = []
    nv = len(line)
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = j * nu + i
            # Counter-clockwise from the front (+Z): the normal faces the camera.
            faces.append((a, a + 1, a + nu + 1, a + nu))
    straps = [
        [(-0.05, 0.64, 0.11), (-0.12, 0.74, 0.02), (-0.02, 0.58, -0.05), (0.07, 0.50, -0.07)],
        [(0.05, 0.64, 0.11), (0.12, 0.74, 0.02), (0.02, 0.58, -0.05), (-0.07, 0.50, -0.07)],
    ]
    for pts in straps:
        base = len(verts)
        half = 0.018
        for i, (x, y, z) in enumerate(pts):
            side = 1 if x >= 0 else -1
            # width in X, a little in Z so the strap has thickness from the back
            verts.append((x - half, y, z))
            verts.append((x + half, y + 0.004, z + 0.004))
        for i in range(len(pts) - 1):
            a = base + i * 2
            faces.append((a, a + 1, a + 3, a + 2))
    return verts, faces


def bow_geometry():
    """White bow at the back of the waist, in front of the chair posts."""
    def ribbon(pts, half):
        vs = []
        fs = []
        for i, (x, y, z) in enumerate(pts):
            vs.append((x, y - half[1], z))
            vs.append((x, y + half[1], z + half[2]))
        for i in range(len(pts) - 1):
            a = i * 2
            fs.append((a, a + 2, a + 3, a + 1))
        return vs, fs

    parts = []
    # knot
    parts.append((
        [(-0.016, 0.49, -0.09), (0.016, 0.49, -0.09), (0.016, 0.53, -0.07), (-0.016, 0.53, -0.07),
         (-0.016, 0.49, -0.075), (0.016, 0.49, -0.075), (0.016, 0.53, -0.055), (-0.016, 0.53, -0.055)],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)],
    ))
    # loops
    parts.append(ribbon(
        [(-0.02, 0.52, -0.12), (-0.10, 0.60, -0.13), (-0.16, 0.54, -0.12), (-0.10, 0.46, -0.12), (-0.02, 0.50, -0.11)],
        (0, 0.028, 0.012)))
    parts.append(ribbon(
        [(0.02, 0.52, -0.12), (0.10, 0.60, -0.13), (0.16, 0.54, -0.12), (0.10, 0.46, -0.12), (0.02, 0.50, -0.11)],
        (0, 0.028, 0.012)))
    # tails
    parts.append(ribbon(
        [(-0.015, 0.50, -0.11), (-0.06, 0.38, -0.12), (-0.045, 0.28, -0.11)],
        (0, 0.02, 0.008)))
    parts.append(ribbon(
        [(0.015, 0.50, -0.11), (0.065, 0.36, -0.12), (0.045, 0.26, -0.11)],
        (0, 0.02, 0.008)))
    verts = []
    faces = []
    for vs, fs in parts:
        b = len(verts)
        verts.extend(vs)
        for f in fs:
            faces.append(tuple(b + i for i in f))
    return verts, faces


def solid_uv(mat):
    img = None
    if mat and mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                img = node.image
                break
    if img is None or img.size[0] < 2:
        return (0.5, 0.5)
    w, h = img.size
    px = list(img.pixels)
    best = None
    step = max(4, w // 40)
    half = 2
    for y in range(half, h - half, step):
        for x in range(half, w - half, step):
            acc = [0.0, 0.0, 0.0]
            acc2 = [0.0, 0.0, 0.0]
            n = 0
            for dy in range(-half, half + 1):
                for dx in range(-half, half + 1):
                    i = ((y + dy) * w + (x + dx)) * 4
                    for c in range(3):
                        acc[c] += px[i + c]
                        acc2[c] += px[i + c] * px[i + c]
                    n += 1
            mean = [acc[c] / n for c in range(3)]
            var = sum(acc2[c] / n - mean[c] * mean[c] for c in range(3))
            bright = sum(mean) / 3.0
            if bright < 0.25 or var > 0.0015:
                continue
            score = bright - var * 8
            if best is None or score > best[0]:
                best = (score, (x + 0.5) / w, (y + 0.5) / h, mean)
    if best is None:
        return (0.5, 0.5)
    log('uv %s -> (%.3f, %.3f) %s' % (mat.name, best[1], best[2], [round(c, 3) for c in best[3]]))
    return (best[1], best[2])


def texture_only(mat):
    """glTF apron/bow materials mix the texture with a vertex color. New meshes
    have no color attribute, so the mix renders black. Preview uses the texture."""
    if mat is None or not mat.use_nodes:
        return
    for node in mat.node_tree.nodes:
        if node.type != 'MIX':
            continue
        for sock in node.inputs:
            if sock.name.startswith('Factor') and not sock.is_linked:
                try:
                    sock.default_value = 0.0
                except Exception:
                    pass


def flatten_material(mat):
    if mat is None:
        return
    name = mat.name.split('.')[0]
    color = BASE_COLOR.get(name, (0.8, 0.8, 0.8, 1))
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = color
    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = 0.0
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = 0.62
    mat.use_backface_culling = False
    mat.diffuse_color = color
    try:
        mat.name = name
    except Exception:
        pass


def export_glb(path, normals):
    char_objs = [o for o in mesh_objects() if o.get('sit')]
    if not char_objs:
        char_objs = list(mesh_objects())
    bpy.ops.object.select_all(action='DESELECT')
    for obj in char_objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = char_objs[0]
    kwargs = dict(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_texcoords=True,
        export_normals=normals,
        export_tangents=False,
        export_materials='EXPORT',
        export_yup=True,
        export_image_format='NONE',
    )
    bpy.ops.export_scene.gltf(**kwargs)


def build_chair_visual():
    wood = bpy.data.materials.new('ChairWood')
    wood.use_nodes = True
    bsdf = next(n for n in wood.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.90, 0.88, 0.84, 1)
    bsdf.inputs['Roughness'].default_value = 0.72
    parts = []
    for name, (lo, hi) in CHAIR_BOXES.items():
        bpy.ops.mesh.primitive_cube_add(location=((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
        obj = bpy.context.active_object
        obj.name = 'chair_' + name
        obj.scale = ((hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, (hi[2] - lo[2]) / 2)
        activate(obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.data.materials.append(wood)
        parts.append(obj)
    return parts


def look_at(cam, eye, target):
    """Camera looks at target with world +Z up. Blender cameras look down -Z."""
    eye_v = Vector(eye)
    fwd = Vector(target) - eye_v
    if fwd.length < 1e-8:
        return
    fwd.normalize()
    z_axis = -fwd
    x_axis = Vector((0, 0, 1)).cross(z_axis)
    if x_axis.length < 1e-6:
        x_axis = Vector((1, 0, 0))
    x_axis.normalize()
    y_axis = z_axis.cross(x_axis).normalized()
    if y_axis.z < 0:
        x_axis.negate()
        y_axis.negate()
    rot = Matrix((x_axis, y_axis, z_axis)).transposed().to_4x4()
    cam.matrix_world = Matrix.Translation(eye_v) @ rot


def sleeve_geometry(arm):
    """Short puffed sleeves along the posed arms. Character space, Y up."""
    verts = []
    faces = []
    n = 8
    for side in ('L', 'R'):
        shoulder = Vector(to_c(*bone_world(arm, 'upper_arm.' + side)))
        elbow = Vector(to_c(*bone_world(arm, 'forearm.' + side)))
        hand = Vector(to_c(*bone_world(arm, 'hand.' + side)))
        cuff = elbow.lerp(hand, 0.42)
        mid = shoulder.lerp(elbow, 0.5)
        pts = [shoulder, mid, elbow, cuff]
        rad = [0.048, 0.072, 0.055, 0.040]
        base = len(verts)
        for i, p in enumerate(pts):
            if i == 0:
                tangent = (pts[1] - pts[0])
            elif i == len(pts) - 1:
                tangent = (pts[i] - pts[i - 1])
            else:
                tangent = (pts[i + 1] - pts[i - 1])
            tangent.normalize()
            side_v = tangent.cross(Vector((0, 1, 0)))
            if side_v.length < 1e-4:
                side_v = tangent.cross(Vector((1, 0, 0)))
            side_v.normalize()
            up_v = side_v.cross(tangent).normalized()
            for k in range(n):
                ang = (k / n) * math.tau
                o = (side_v * math.cos(ang) + up_v * math.sin(ang)) * rad[i]
                verts.append((p.x + o.x, p.y + o.y, p.z + o.z))
        for i in range(len(pts) - 1):
            for k in range(n):
                k2 = (k + 1) % n
                faces.append((base + i * n + k, base + i * n + k2, base + (i + 1) * n + k2, base + (i + 1) * n + k))
    return verts, faces


def render_to(path, cam, w, h):
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.filepath = path
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    log('rendered %s' % path)


def setup_render():
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        try:
            scene.render.engine = 'BLENDER_EEVEE'
        except Exception:
            scene.render.engine = 'CYCLES'
    log('render engine %s' % scene.render.engine)
    samples = int(os.environ.get('SIT_SAMPLES', '8'))
    if hasattr(scene, 'eevee'):
        scene.eevee.taa_render_samples = samples
    if scene.render.engine == 'CYCLES':
        scene.cycles.samples = samples
    world = scene.world or bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.93, 0.93, 0.92, 1)
        bg.inputs[1].default_value = 0.35
    bpy.ops.object.light_add(type='AREA', location=to_b(0.4, 1.5, 1.6))
    key = bpy.context.active_object
    key.data.energy = 180
    key.data.size = 1.6
    bpy.ops.object.light_add(type='AREA', location=to_b(-1.2, 1.1, -0.4))
    fill = bpy.context.active_object
    fill.data.energy = 60
    fill.data.size = 1.8
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    cam.data.lens = 58
    return cam


def composite_sheet(paths, out_path):
    labels = ['front', 'side', 'back']
    refs = []
    rends = []
    for label in labels:
        refs.append(bpy.data.images.load(os.path.join(REF_DIR, label + '.jpg')))
        rends.append(bpy.data.images.load(paths[label]))
    cell_w, cell_h = 480, 640
    sheet = bpy.data.images.new('sheet', cell_w * 2, cell_h * 3, alpha=True)
    px = [0.96, 0.96, 0.96, 1.0] * (cell_w * 2 * cell_h * 3)

    def paste(img, x0, y0):
        w, h = img.size
        src = list(img.pixels)
        sw, sh = cell_w, cell_h
        for y in range(sh):
            sy = min(h - 1, int(y * h / sh))
            row = sy * w
            for x in range(sw):
                sx = min(w - 1, int(x * w / sw))
                si = (row + sx) * 4
                di = ((y0 + y) * (cell_w * 2) + (x0 + x)) * 4
                px[di] = src[si]
                px[di + 1] = src[si + 1]
                px[di + 2] = src[si + 2]
                px[di + 3] = src[si + 3]

    for i, label in enumerate(labels):
        y = (len(labels) - 1 - i) * cell_h
        paste(refs[i], 0, y)
        paste(rends[i], cell_w, y)
    sheet.pixels.foreach_set(px)
    sheet.filepath_raw = out_path
    sheet.file_format = 'PNG'
    sheet.save()
    log('sheet %s' % out_path)


def sole_and_pelvis(arm_bones):
    lowest = 1e9
    for obj in mesh_objects():
        if mat_key(obj) not in ('M_G2_FACE', 'M_G2_BODY'):
            continue
        for v in obj.data.vertices:
            if v.co.z < lowest:
                lowest = v.co.z
    return {'pelvis_y': arm_bones['hips'][1], 'sole_y': round(lowest, 4)}


def main():
    os.makedirs(PREVIEW, exist_ok=True)
    os.makedirs(os.path.dirname(RUNTIME), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CHR)
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and not obj.name.startswith('LOD0'):
            bpy.data.objects.remove(obj, do_unlink=True)
    arm = find_armature()
    pose_clip(arm, 'sit_down')
    bones = polish_pose(arm)

    for obj in list(mesh_objects()):
        if obj.name.startswith('LOD0'):
            apply_pose_modifiers(obj)
            clear_parent_apply(obj)

    by_name = {o.name: o for o in mesh_objects()}
    dress = by_name.get('LOD0_G2_DRESS')
    upper = split_dress_upper(dress, arm) if dress else None
    if dress and upper is None:
        bpy.data.objects.remove(dress, do_unlink=True)
    for obj in list(mesh_objects()):
        if obj.name.startswith('LOD0_G2_APRON') or obj.name.startswith('LOD0_G2_BOW'):
            bpy.data.objects.remove(obj, do_unlink=True)

    body = None
    for obj in list(mesh_objects()):
        if obj.name.startswith('LOD0_G2_BODY'):
            body = obj
    if body:
        separate_by_material(body)

    for obj in list(mesh_objects()):
        drop_vertex_groups(obj)
        key = mat_key(obj)
        if key == 'M_G2_FACE':
            push_body_off_seat(obj)
        if key == 'M_G2_DRESS':
            push_out_of_chair(obj, CLEAR)
        if key in RATIOS:
            decimate(obj, RATIOS[key])
        log('part-pre %s %s tris %d' % (obj.name, key, tris_of(obj)))

    dress_mat = bpy.data.materials.get('M_G2_DRESS') or bpy.data.materials.new('M_G2_DRESS')
    apron_mat = bpy.data.materials.get('M_G2_APRON') or bpy.data.materials.new('M_G2_APRON')
    uv_dress = solid_uv(dress_mat)
    uv_apron = solid_uv(apron_mat)
    skirt = new_mesh('SitDress', *skirt_geometry(), dress_mat, uv_dress)
    apron = new_mesh('SitApron', *apron_geometry(), apron_mat, uv_apron)
    bow = new_mesh('SitBow', *bow_geometry(), apron_mat, uv_apron)
    sleeves = new_mesh('SitSleeve', *sleeve_geometry(arm), dress_mat, uv_dress)
    for obj in (skirt, apron, bow, sleeves):
        push_out_of_chair(obj, CLEAR)
        push_out_of_chair(obj, CLEAR)

    for obj in list(bpy.context.scene.objects):
        if obj.type in ('ARMATURE', 'EMPTY'):
            bpy.data.objects.remove(obj, do_unlink=True)

    for obj in mesh_objects():
        obj['sit'] = 1
        mat = obj.material_slots[0].material if obj.material_slots else None
        if mat:
            mat.use_backface_culling = False

    report = {'bones_character_y_up': bones, 'parts': {}}
    total = 0
    for obj in mesh_objects():
        stats = count_penetration(obj)
        report['parts'][obj.name] = stats
        total += stats['tris']
        log('part %s %s' % (obj.name, json.dumps(stats)))
    report['triangles'] = total
    report['alignment'] = sole_and_pelvis(bones)
    log('TOTAL TRIS %d' % total)
    if total > MAX_TRIS:
        log('over triangle budget, decimating body once')
        for obj in mesh_objects():
            if tris_of(obj) < 500:
                continue
            decimate(obj, 0.7)
        total = sum(tris_of(o) for o in mesh_objects())
        report['triangles'] = total
        log('TOTAL TRIS %d' % total)
        if total > MAX_TRIS:
            raise RuntimeError('triangle budget exceeded: %d' % total)

    texture_only(bpy.data.materials.get('M_G2_APRON'))
    chair = build_chair_visual()
    floor_mat = bpy.data.materials.new('Floor')
    floor_mat.use_nodes = True
    bsdf = next(n for n in floor_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.94, 0.94, 0.93, 1)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(floor_mat)

    cam = setup_render()
    target_c = (0.0, 0.46, 0.12)
    target = to_b(*target_c)
    shots_c = {
        'front': (0.0, 0.50, 2.15),
        'side': (-2.20, 0.50, 0.20),
        'back': (0.0, 0.52, -2.05),
        'chair': (1.7, 0.85, 1.7),
    }
    paths = {}
    for name, eye_c in shots_c.items():
        eye = to_b(*eye_c)
        look = target if name != 'chair' else to_b(0.0, 0.42, 0.02)
        look_at(cam, eye, look)
        w, h = (1280, 960) if name == 'chair' else (720, 960)
        path = os.path.join(PREVIEW, name + '.png')
        render_to(path, cam, w, h)
        paths[name] = path

    for obj in chair:
        obj.hide_render = True
    floor.hide_render = True
    for name in ('front', 'side', 'back'):
        look_at(cam, to_b(*shots_c[name]), target)
        path = os.path.join(PREVIEW, name + '_figure.png')
        render_to(path, cam, 720, 960)
        paths[name] = path
    try:
        composite_sheet(paths, os.path.join(PREVIEW, 'compare_views.png'))
    except Exception:
        log('sheet failed\n' + traceback.format_exc())

    # Preview used the real M_G2 textures. The runtime glb keeps UVs and a flat
    # fallback color; the game rebinds the shared materials, so the images stay out.
    seen = {}
    for obj in mesh_objects():
        if not obj.get('sit'):
            continue
        mat = obj.material_slots[0].material if obj.material_slots else None
        if mat and mat.name not in seen:
            flatten_material(mat)
            seen[mat.name] = True
        cols = getattr(obj.data, 'color_attributes', None)
        if cols:
            for attr in list(cols):
                cols.remove(attr)
    for img in list(bpy.data.images):
        if img.users == 0 or True:
            try:
                bpy.data.images.remove(img)
            except Exception:
                pass

    export_glb(GLB_OUT, True)
    size = os.path.getsize(GLB_OUT)
    log('glb %d bytes' % size)
    if size > MAX_BYTES:
        log('glb over budget, re-export without normals')
        export_glb(GLB_OUT, False)
        size = os.path.getsize(GLB_OUT)
        log('glb %d bytes' % size)
    if size > MAX_BYTES:
        log('still over, decimate body and re-export')
        for obj in mesh_objects():
            if not obj.get('sit') or tris_of(obj) < 500:
                continue
            decimate(obj, 0.75)
        export_glb(GLB_OUT, False)
        size = os.path.getsize(GLB_OUT)
        total = sum(tris_of(o) for o in mesh_objects() if o.get('sit'))
        report['triangles'] = total
        log('glb %d bytes tris %d' % (size, total))
    data = open(GLB_OUT, 'rb').read()
    open(RUNTIME, 'wb').write(data)
    report['glb_bytes'] = len(data)
    if len(data) > MAX_BYTES:
        raise RuntimeError('glb still %d bytes' % len(data))

    os.makedirs(os.path.join(OUT_DIR, 'data'), exist_ok=True)
    with open(os.path.join(OUT_DIR, 'data', 'qa_sit_static.json'), 'w') as f:
        json.dump(report, f, indent=2)
    log('done')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        raise
