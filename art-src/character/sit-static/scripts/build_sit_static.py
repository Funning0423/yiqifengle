#!/usr/bin/env python3
"""Fixed sitting mesh from the runtime heroine, not a new body.

Loads creator-build-project/.../chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb,
poses sit_down's last frame, then only rewrites vertex positions of that mesh:

- spine is set upright, arms put the real hands on the lap (palms down, fingers
  along the thighs, right hand stacked on the left)
- the yellow skirt's existing side hem stays; new cloth between the knees sits
  just in front of the socks and level with that hem, so the front covers the
  knees without puffing past the side
- the existing bow is translated, not rebuilt
- face, gloves, white calves and red boots stay the skinned vertices

Materials stay M_G2_*. No embedded images. No skeleton in the export.
Blender is Z-up; character numbers are glTF Y-up, +Z forward.
"""
import json
import math
import os
import traceback

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
CHR = os.path.join(
    REPO,
    'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb',
)
ROOM = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
OUT_DIR = os.path.join(REPO, 'art-src/character/sit-static')
PREVIEW = os.path.join(OUT_DIR, 'previews')
GLB_OUT = os.path.join(OUT_DIR, 'chr_sit_static.glb')
RUNTIME = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/sit-static/chr_sit_static.glb')
REF_DIR = os.environ.get('SIT_REF_DIR', '/home/ubuntu/.cursor/projects/workspace/assets')
MAX_TRIS = 8000
# Runtime glb is 1,373,744 bytes. 1.5 MiB leaves 199,120. Stay under that.
MAX_BYTES = 199000

# Reading-chair parts in the seated character frame (Y up, metres). Seat top is 0.38.
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
CLOTH_MARGIN = 0.008
# Cloth may rest on these; everything else is solid.
CLOTH_NAMES = ('M_G2_DRESS', 'M_G2_APRON', 'M_G2_BODY')

BASE_COLOR = {
    'M_G2_FACE': (0.93, 0.78, 0.68, 1),
    'M_G2_HEAD': (0.86, 0.74, 0.48, 1),
    'M_G2_HAIR': (0.16, 0.20, 0.36, 1),
    'M_G2_BODY': (0.93, 0.86, 0.74, 1),
    'M_G2_DRESS': (0.95, 0.82, 0.28, 1),
    'M_G2_APRON': (0.96, 0.94, 0.90, 1),
}

SEATED_ROOT = Vector((0.4327299768730942, 0.0, -4.207611558444886))
SEAT_YAW = -2.0


def log(msg):
    print(msg, flush=True)


def clamp(v, a, b):
    return max(a, min(b, v))


def lerp(a, b, t):
    return a + (b - a) * t


def to_c(v):
    return Vector((v.x, v.z, -v.y))


def to_b(v):
    return Vector((v.x, -v.z, v.y))


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
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def mat_key(obj):
    if obj.material_slots and obj.material_slots[0].material:
        return obj.material_slots[0].material.name.split('.')[0]
    return ''


def find_armature():
    arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if not arms:
        raise RuntimeError('no armature')
    return arms[0]


def find_mesh(prefix):
    for obj in mesh_objects():
        if obj.name.startswith(prefix):
            return obj
    raise RuntimeError('missing ' + prefix)


def bone_world_head_tail(arm, name):
    pb = arm.pose.bones[name]
    mw = arm.matrix_world
    return mw @ pb.head, mw @ pb.tail


def bone_char(arm, name):
    h, t = bone_world_head_tail(arm, name)
    return to_c(h), to_c(t)


def seg_dist(p, head, tail):
    ab = tail - head
    denom = ab.dot(ab) or 1.0
    u = clamp((p - head).dot(ab) / denom, 0.0, 1.0)
    return (p - (head + ab * u)).length, u


def box_to_b(lo, hi):
    corners = []
    for x in (lo[0], hi[0]):
        for y in (lo[1], hi[1]):
            for z in (lo[2], hi[2]):
                corners.append(to_b(Vector((x, y, z))))
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return (Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs))))


CHAIR_BOXES = {name: box_to_b(lo, hi) for name, (lo, hi) in CHAIR_BOXES_CHAR.items()}


def box_sdf(p, lo, hi):
    dx = max(lo.x - p.x, 0.0, p.x - hi.x)
    dy = max(lo.y - p.y, 0.0, p.y - hi.y)
    dz = max(lo.z - p.z, 0.0, p.z - hi.z)
    outside = math.sqrt(dx * dx + dy * dy + dz * dz)
    if outside > 0:
        return outside
    ix = max(lo.x - p.x, p.x - hi.x)
    iy = max(lo.y - p.y, p.y - hi.y)
    iz = max(lo.z - p.z, p.z - hi.z)
    return max(ix, iy, iz)


def nearest_box(p):
    best = None
    for lo, hi in CHAIR_BOXES.values():
        d = box_sdf(p, lo, hi)
        if best is None or d < best[0]:
            best = (d, lo, hi)
    return best


def capture_rest(arm):
    """Character-space rest positions, before the sit pose. Vertex order is stable until we split."""
    rest = {}
    sleeves = {}
    arm_segs = []
    for name in ('upper_arm.L', 'forearm.L', 'upper_arm.R', 'forearm.R'):
        arm_segs.append(bone_char(arm, name))
    for obj in mesh_objects():
        if not obj.name.startswith('LOD0'):
            continue
        mw = obj.matrix_world
        pts = [to_c(mw @ v.co) for v in obj.data.vertices]
        rest[obj.name] = pts
        if obj.name.startswith('LOD0_G2_DRESS'):
            flag = []
            for p in pts:
                near = False
                for h, t in arm_segs:
                    if seg_dist(p, h, t)[0] < 0.105 and p.y > 0.78:
                        near = True
                        break
                flag.append(near)
            sleeves[obj.name] = flag
    return rest, sleeves


def group_weight(obj, v, name):
    g = obj.vertex_groups.get(name)
    if g is None:
        return 0.0
    for sg in v.groups:
        if sg.group == g.index:
            return sg.weight
    return 0.0


def pose_clip(arm, clip):
    act = None
    for a in bpy.data.actions:
        if a.name == clip or a.name.endswith('|' + clip) or a.name.endswith(clip):
            act = a
            break
    if act is None:
        raise RuntimeError('missing action ' + clip)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    slots = getattr(act, 'slots', None)
    if slots and len(slots) and hasattr(arm.animation_data, 'action_slot'):
        arm.animation_data.action_slot = slots[0]
        log('action slot %s' % getattr(slots[0], 'identifier', repr(slots[0])))
    frame = int(round(act.frame_range[1]))
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    hy = bone_char(arm, 'hips')[0].y
    log('posed %s frame %s hips_y %.3f' % (act.name, frame, hy))
    if hy > 0.7:
        raise RuntimeError('sit_down did not reach the chair (hips y=%.3f)' % hy)
    return frame


def freeze_pose(arm):
    """Drop the action so later bone edits are not overwritten on update."""
    mats = {pb.name: pb.matrix.copy() for pb in arm.pose.bones}
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()
    for name, mat in mats.items():
        arm.pose.bones[name].matrix = mat
    bpy.context.view_layer.update()
    log('frozen hips_y %.3f' % bone_char(arm, 'hips')[0].y)


def rotate_world_x(arm, name, deg):
    pb = arm.pose.bones[name]
    mw = arm.matrix_world
    world = mw @ pb.matrix
    head_w = world.to_translation()
    q = Quaternion(Vector((1, 0, 0)), math.radians(deg))
    T = Matrix.Translation(head_w)
    new_world = T @ q.to_matrix().to_4x4() @ T.inverted() @ world
    pb.matrix = mw.inverted() @ new_world
    bpy.context.view_layer.update()


def bone_dz(arm, name):
    h, t = bone_char(arm, name)
    return t.z - h.z


def straighten(arm):
    """Pitch the torso back until the chest is nearly vertical. Hips stay."""
    before = {n: [round(x, 4) for x in bone_char(arm, n)[0]] for n in ('hips', 'chest', 'head', 'foot.L', 'foot.R')}
    for name in ('spine', 'chest', 'neck'):
        for _ in range(10):
            dz = bone_dz(arm, name)
            if dz < 0.018:
                break
            step = -3.0 if dz > 0.05 else -1.5
            trial = dz
            rotate_world_x(arm, name, step)
            if bone_dz(arm, name) > trial:
                rotate_world_x(arm, name, -2 * step)
                break
    # Head stays level: cancel leftover forward pitch, don't throw the chin up.
    for _ in range(8):
        dz = bone_dz(arm, 'head')
        if abs(dz) < 0.02:
            break
        rotate_world_x(arm, 'head', -1.5 if dz > 0 else 1.5)
    after = {n: [round(x, 4) for x in bone_char(arm, n)[0]] for n in ('hips', 'chest', 'head', 'foot.L', 'foot.R')}
    log('straighten before %s' % json.dumps(before))
    log('straighten after %s dz chest %.3f head %.3f' % (json.dumps(after), bone_dz(arm, 'chest'), bone_dz(arm, 'head')))
    for n in ('hips', 'foot.L', 'foot.R'):
        if max(abs(before[n][i] - after[n][i]) for i in range(3)) > 0.002:
            raise RuntimeError('straighten moved %s' % n)


def point_bone(arm, name, tail_world):
    """Rotate the bone around its head so the tail lands on tail_world. Twist stays."""
    pb = arm.pose.bones[name]
    mw = arm.matrix_world
    world = mw @ pb.matrix
    head_w = world.to_translation()
    old = (mw @ pb.tail) - (mw @ pb.head)
    new = tail_world - head_w
    if old.length < 1e-6 or new.length < 1e-6:
        return
    old.normalize()
    new.normalize()
    axis = old.cross(new)
    if axis.length < 1e-6:
        q = Quaternion()
        if old.dot(new) < 0:
            q = Quaternion(Vector((1, 0, 0)), math.pi)
    else:
        q = Quaternion(axis.normalized(), old.angle(new))
    T = Matrix.Translation(head_w)
    new_world = T @ q.to_matrix().to_4x4() @ T.inverted() @ world
    pb.matrix = mw.inverted() @ new_world
    bpy.context.view_layer.update()


def ik_arm(arm, side, target_c, pole_c):
    upper = 'upper_arm.' + side
    fore = 'forearm.' + side
    a = arm.data.bones[upper].length
    b = arm.data.bones[fore].length
    sh, _ = bone_world_head_tail(arm, upper)
    target = to_b(target_c)
    pole = to_b(pole_c)
    dist = (target - sh).length
    dist = clamp(dist, abs(a - b) + 1e-3, a + b - 1e-3)
    D = (target - sh).normalized()
    pole_v = pole - sh
    pole_v = pole_v - D * pole_v.dot(D)
    if pole_v.length < 1e-5:
        pole_v = Vector((0, 0, -1))
    pole_v.normalize()
    cos_a = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1.0, 1.0)
    sin_a = math.sqrt(max(0.0, 1.0 - cos_a * cos_a))
    elbow = sh + D * (a * cos_a) + pole_v * (a * sin_a)
    point_bone(arm, upper, elbow)
    # forearm head follows the upper tail
    fh, _ = bone_world_head_tail(arm, fore)
    # aim forearm at the target from wherever its head actually is
    direction = (target - fh)
    if direction.length < 1e-5:
        return
    point_bone(arm, fore, fh + direction.normalized() * arm.data.bones[fore].length)


def hand_palm_local(arm, body, bone_name):
    """Average face normal of the hand, in the bone's local axes, at the current pose."""
    pb = arm.pose.bones[bone_name]
    bone_world = arm.matrix_world @ pb.matrix
    inv = bone_world.inverted()
    mw = body.matrix_world
    g = body.vertex_groups.get(bone_name)
    if g is None:
        return Vector((0, 0, 1))
    acc = Vector((0, 0, 0))
    n = 0
    for poly in body.data.polygons:
        heavy = False
        for vi in poly.vertices:
            if group_weight(body, body.data.vertices[vi], bone_name) > 0.5:
                heavy = True
                break
        if not heavy:
            continue
        normal_w = (mw.to_3x3() @ poly.normal).normalized()
        acc += (inv.to_3x3() @ normal_w)
        n += 1
    if n == 0 or acc.length < 1e-6:
        return Vector((0, 0, 1))
    return acc.normalized()


def orient_hand(arm, name, finger_dir_c, palm_world, palm_local):
    """Point the fingertip (+Y of the bone) along finger_dir. Palm normal maps to palm_world."""
    pb = arm.pose.bones[name]
    mw = arm.matrix_world
    head_w = mw @ pb.head
    y = to_b(finger_dir_c).normalized()
    palm = palm_world.normalized()
    # Remove the component along the finger so the palm axis stays perpendicular.
    palm = palm - y * palm.dot(y)
    if palm.length < 1e-5:
        palm = Vector((0, 0, -1))
    palm.normalize()
    local = palm_local.normalized()
    # Build a rotation whose Y axis is the finger and which sends local palm to world palm.
    # Start from an orthonormal frame.
    z = palm
    x = y.cross(z)
    if x.length < 1e-5:
        x = Vector((1, 0, 0))
    x.normalize()
    z = x.cross(y).normalized()
    # This frame has columns (x, y, z) if local palm were +Z and local finger +Y.
    # Correct for the actual local palm axis.
    basis = Matrix((x, y, z)).transposed()  # columns x, y, z
    # local axes: finger is +Y. We want M @ local_palm = palm, M @ (0,1,0) = y.
    # If local palm is not +Z, remap.
    src = Matrix.Identity(3)
    # Express desired: M @ Y = y, M @ local = palm.
    # Find M such that M @ [Y | local | Y×local] = [y | palm | y×palm]
    y_l = Vector((0, 1, 0))
    side_l = y_l.cross(local)
    if side_l.length < 1e-5:
        side_l = Vector((1, 0, 0))
    side_l.normalize()
    local_p = side_l.cross(y_l).normalized()
    src = Matrix((side_l, y_l, local_p)).transposed()
    side_w = y.cross(palm)
    if side_w.length < 1e-5:
        side_w = Vector((1, 0, 0))
    side_w.normalize()
    palm_p = side_w.cross(y).normalized()
    dst = Matrix((side_w, y, palm_p)).transposed()
    rot = dst @ src.inverted()
    new_world = Matrix.Translation(head_w) @ rot.to_4x4()
    pb.matrix = mw.inverted() @ new_world
    bpy.context.view_layer.update()


def clear_to_rest(arm):
    if arm.animation_data:
        arm.animation_data.action = None
    activate(arm)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.transforms_clear()
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()


def place_hands(arm, palms):
    """Wrists on the lap, fingers lying forward along the thighs, right hand above the left."""
    # Thighs rise toward the knees, so the fingers stay nearly level instead of pointing up the forearm.
    ik_arm(arm, 'L', Vector((-0.04, 0.58, 0.18)), Vector((-0.30, 0.25, 0.02)))
    ik_arm(arm, 'R', Vector((0.02, 0.63, 0.16)), Vector((0.30, 0.32, 0.02)))
    palm_down = Vector((0, 0, -1))
    orient_hand(arm, 'hand.L', Vector((0.10, -0.04, 0.98)), palm_down, palms['L'])
    orient_hand(arm, 'hand.R', Vector((-0.08, -0.08, 0.96)), palm_down, palms['R'])
    for side in ('L', 'R'):
        h, t = bone_char(arm, 'hand.' + side)
        log('hand %s head %s tail %s' % (side, [round(x, 3) for x in h], [round(x, 3) for x in t]))


def level_feet(arm):
    """Drop a raised toe onto the floor. Ankles stay."""
    for name in ('foot.L', 'foot.R'):
        h, t = bone_char(arm, name)
        if t.y <= 0.02:
            log('foot %s already low %.3f' % (name, t.y))
            continue
        # Small pitches around world X until the tail is near the floor.
        for _ in range(6):
            h, t = bone_char(arm, name)
            if t.y <= 0.015:
                break
            rotate_world_x(arm, name, 2.0)
            h2, t2 = bone_char(arm, name)
            if t2.y > t.y:
                rotate_world_x(arm, name, -4.0)
                break
        h, t = bone_char(arm, name)
        log('foot %s head %s tail %s' % (name, [round(x, 3) for x in h], [round(x, 3) for x in t]))


def set_shape_keys():
    for obj in mesh_objects():
        if obj.type != 'MESH' or not obj.data.shape_keys:
            continue
        kb = obj.data.shape_keys.key_blocks.get('sit_drape')
        if kb:
            kb.value = 1.0
            log('shape %s sit_drape' % obj.name)


def bake_shape_keys(obj):
    if not obj.data.shape_keys:
        return
    mods = [m for m in obj.modifiers if m.type == 'ARMATURE']
    saved = [(m, m.show_viewport) for m in mods]
    for m, _ in saved:
        m.show_viewport = False
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    me = ev.to_mesh()
    coords = [v.co.copy() for v in me.vertices]
    ev.to_mesh_clear()
    for m, vis in saved:
        m.show_viewport = vis
    obj.shape_key_clear()
    if len(coords) != len(obj.data.vertices):
        raise RuntimeError('shape bake vertex count changed on %s' % obj.name)
    for i, c in enumerate(coords):
        obj.data.vertices[i].co = c
    obj.data.update()
    log('baked shape %s' % obj.name)


def apply_armature(obj):
    activate(obj)
    for mod in list(obj.modifiers):
        if mod.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    activate(obj)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def sample_curve(keys, v):
    n = len(keys) - 1
    t = clamp(v, 0.0, 1.0) * n
    i = min(n - 1, int(t))
    f = t - i
    return keys[i] * (1.0 - f) + keys[i + 1] * f


def skirt_target(theta, v):
    """Kept for the stretch probe. The bake itself does not teleport onto this sheet."""
    half = math.radians(78)
    z = sample_curve((0.12, 0.28, 0.48, 0.58, 0.50, 0.42), v)
    y = sample_curve((0.58, 0.54, 0.50, 0.42, 0.34, 0.30), v)
    x = math.sin(theta) * (0.12 + 0.06 * v)
    if abs(theta) <= half:
        x = (theta / half) * (0.14 + 0.06 * v)
    return Vector((x, y, z))


def cover_z(y):
    """Front of the skirt, in front of the knees, hem still ahead of the shins."""
    keys = ((0.66, 0.14), (0.58, 0.28), (0.51, 0.62), (0.42, 0.58), (0.32, 0.52), (0.18, 0.42))
    if y >= keys[0][0]:
        return keys[0][1]
    if y <= keys[-1][0]:
        return keys[-1][1]
    for i in range(len(keys) - 1):
        y0, z0 = keys[i]
        y1, z1 = keys[i + 1]
        if y0 >= y >= y1:
            t = (y0 - y) / (y0 - y1)
            return z0 * (1.0 - t) + z1 * t
    return keys[-1][1]


def mesh_neighbors(obj):
    n = len(obj.data.vertices)
    nbrs = [[] for _ in range(n)]
    seen = [set() for _ in range(n)]
    for poly in obj.data.polygons:
        vs = list(poly.vertices)
        for i, a in enumerate(vs):
            b = vs[(i + 1) % len(vs)]
            if b not in seen[a]:
                seen[a].add(b)
                nbrs[a].append(b)
            if a not in seen[b]:
                seen[b].add(a)
                nbrs[b].append(a)
    return nbrs


def smooth_coords(coords, nbrs, mask, iterations, factor):
    for _ in range(iterations):
        nxt = [c.copy() for c in coords]
        for i, on in enumerate(mask):
            if not on or not nbrs[i]:
                continue
            acc = Vector((0.0, 0.0, 0.0))
            for j in nbrs[i]:
                acc += coords[j]
            nxt[i] = coords[i].lerp(acc / float(len(nbrs[i])), factor)
        coords = nxt
    return coords


def apron_target(u, v):
    """u -1..1 across the bib, v 0 at the waist and 1 at the apron hem. Sits under the hands."""
    y = sample_curve((0.62, 0.58, 0.54, 0.50, 0.47), v)
    z = sample_curve((0.12, 0.20, 0.30, 0.38, 0.42), v)
    x = u * (0.07 + 0.09 * v)
    return Vector((x, y, z))


def smoothstep(t):
    t = clamp(t, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def probe_cloth(dress, apron, bow, rest, sleeves, leg_segs):
    def bounds(obj):
        pts = [to_c(v.co) for v in obj.data.vertices]
        return {
            'n': len(pts),
            'min': [round(min(p[i] for p in pts), 3) for i in range(3)],
            'max': [round(max(p[i] for p in pts), 3) for i in range(3)],
        }

    log('PROBE dress %s' % json.dumps(bounds(dress)))
    log('PROBE apron %s' % json.dumps(bounds(apron)))
    log('PROBE bow %s' % json.dumps(bounds(bow)))
    flags = sleeves.get(dress.name, [])
    pts = rest[dress.name]
    bands = {}
    inside = 0
    for i, v in enumerate(dress.data.vertices):
        p = to_c(v.co)
        if i < len(flags) and flags[i]:
            continue
        if pts[i].y >= 1.0:
            continue
        key = round(p.y * 5) / 5
        bands.setdefault(key, []).append(p)
        for h, t, radius in leg_segs:
            if seg_dist(p, h, t)[0] < radius and p.z > -0.05:
                inside += 1
                break
    log('PROBE dress inside legs %d' % inside)
    for key in sorted(bands):
        row = bands[key]
        front = [p for p in row if abs(p.x) < 0.22 and p.z > 0.0]
        if not front:
            continue
        zs = [p.z for p in front]
        log('PROBE y=%.2f n=%d front=%d z %.3f..%.3f' % (key, len(row), len(front), min(zs), max(zs)))
    ap = rest[apron.name]
    front = [to_c(apron.data.vertices[i].co) for i, p in enumerate(ap) if p.z > 0.04 and p.y < 1.05]
    if front:
        log('PROBE apron front n=%d x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f' % (
            len(front),
            min(p.x for p in front), max(p.x for p in front),
            min(p.y for p in front), max(p.y for p in front),
            min(p.z for p in front), max(p.z for p in front),
        ))
    # How far a rest-theta warp sends each edge, so a discontinuous sheet shows up here.
    hip = Vector((0.004, 1.06, 0.04))
    worst = 0.0
    long_edges = 0
    edges = 0
    seen = set()
    for poly in dress.data.polygons:
        vs = list(poly.vertices)
        for a, b in zip(vs, vs[1:] + vs[:1]):
            key = (min(a, b), max(a, b))
            if key in seen:
                continue
            seen.add(key)
            edges += 1
            pa, pb = pts[a], pts[b]
            if (a < len(flags) and flags[a]) or (b < len(flags) and flags[b]):
                continue
            if pa.y >= 1.0 or pb.y >= 1.0:
                continue
            ta = math.atan2(pa.x - hip.x, pa.z - hip.z)
            tb = math.atan2(pb.x - hip.x, pb.z - hip.z)
            va = clamp((1.0 - pa.y) / 0.58, 0.0, 1.0)
            vb = clamp((1.0 - pb.y) / 0.58, 0.0, 1.0)
            da = skirt_target(ta, va)
            db = skirt_target(tb, vb)
            stretch = (da - db).length / max(0.001, (pa - pb).length)
            if stretch > worst:
                worst = stretch
            if stretch > 8.0:
                long_edges += 1
    log('PROBE skirt edges %d stretch>8 %d worst %.1f' % (edges, long_edges, worst))


def push_out_of_legs(co, leg_segs):
    """Move a vertex out of a thigh or shin without snapping a whole row onto one plane."""
    for h, t, radius in leg_segs:
        dist, u = seg_dist(co, h, t)
        if dist >= radius:
            continue
        cp = h.lerp(t, u)
        away = Vector((co.x - cp.x, 0.0, co.z - cp.z))
        if away.length < 1e-5:
            away = Vector((0.0, 0.0, 1.0))
        away.normalize()
        landed = cp + away * (radius + 0.01)
        co = Vector((landed.x, co.y, landed.z))
    return co


def lift_hem(co):
    """The skinned hem reaches the ankles. Raise it to just under the knees so the calves show."""
    if co.y >= 0.36:
        return co
    t = clamp((co.y - 0.18) / (0.36 - 0.18), 0.0, 1.0)
    return Vector((co.x, lerp(0.305, 0.36, t), co.z))


def clamp_edges(coords, nbrs, mask, max_edge, passes):
    """Pull torn vertices back until every skirt edge is short. The panel itself stays."""
    for _ in range(passes):
        nxt = [c.copy() for c in coords]
        moved = 0
        for i, on in enumerate(mask):
            if not on or not nbrs[i]:
                continue
            acc = Vector((0.0, 0.0, 0.0))
            n = 0
            for j in nbrs[i]:
                d = coords[j] - coords[i]
                dist = d.length
                if dist > max_edge and dist > 1e-8:
                    acc += coords[i] + d * ((dist - max_edge) / dist)
                    n += 1
            if n:
                nxt[i] = acc / float(n)
                moved += 1
        coords = nxt
        if moved == 0:
            break
    return coords


def sheet_pos(u, v):
    """u -1..1 across the front, v 0 at the waist and 1 at the hem."""
    y = sample_curve((0.58, 0.54, 0.48, 0.40, 0.33, 0.28), v)
    z = sample_curve((0.10, 0.22, 0.42, 0.60, 0.54, 0.44), v)
    x = u * (0.11 + 0.09 * v)
    return Vector((x, y, z))


def drape_at(theta, v):
    """One surface around the body. Front hangs over the knees, back rests on the seat."""
    a = abs(theta)
    front_u = clamp(theta / math.radians(75), -1.0, 1.0)
    front = sheet_pos(front_u, v)
    back = Vector((math.sin(theta) * 0.11, lerp(0.56, 0.42, v), lerp(-0.02, -0.07, v)))
    if a <= math.radians(70):
        return front
    if a >= math.radians(150):
        return back
    t = (a - math.radians(70)) / (math.radians(150) - math.radians(70))
    t = smoothstep(t)
    return front.lerp(back, t)


def regrid_skirt(dress, rest, sleeves):
    """Replace the torn lower dress with one sheet built from the dress's own vertices."""
    hip = Vector((0.004, 1.06, 0.04))
    pts = rest[dress.name]
    flags = sleeves.get(dress.name, [False] * len(pts))
    nu, nv = 32, 12
    cell = {}
    members = {}
    skirt = [False] * len(pts)
    for i, p in enumerate(pts):
        if (i < len(flags) and flags[i]) or p.y >= 0.86:
            continue
        skirt[i] = True
        theta = math.atan2(p.x - hip.x, p.z - hip.z)
        # Wrap the seam so -pi and pi share the back column.
        u = (theta + math.pi) / (2.0 * math.pi)
        v = clamp((0.86 - p.y) / (0.86 - 0.40), 0.0, 1.0)
        iu = min(nu - 1, max(0, int(round(u * (nu - 1)))))
        iv = min(nv - 1, max(0, int(round(v * (nv - 1)))))
        members.setdefault((iu, iv), []).append(i)
        cell.setdefault((iu, iv), i)
    extras = []
    for idxs in members.values():
        extras.extend(idxs[1:])
    empty = [(iu, iv) for iu in range(nu) for iv in range(nv) if (iu, iv) not in cell]
    for slot, i in zip(empty, extras):
        cell[slot] = i
        members[slot] = [i]
    log('skirt grid filled %d empty, %d left' % (min(len(empty), len(extras)), max(0, len(empty) - len(extras))))
    for (iu, iv), idxs in members.items():
        theta = (iu / float(nu - 1)) * 2.0 * math.pi - math.pi
        v = iv / float(nv - 1)
        pos = to_b(drape_at(theta, v))
        for i in idxs:
            dress.data.vertices[i].co = pos
    dress.data.update()
    uv_of = {}
    if dress.data.uv_layers.active:
        uvdata = dress.data.uv_layers.active.data
        for poly in dress.data.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices):
                if vi not in uv_of:
                    uv_of[vi] = uvdata[li].uv.copy()
    bm = bmesh.new()
    bm.from_mesh(dress.data)
    bm.verts.ensure_lookup_table()
    by_index = {v.index: v for v in bm.verts}
    uv_layer = bm.loops.layers.uv.active
    doomed = []
    for face in bm.faces:
        if any(skirt[v.index] for v in face.verts):
            doomed.append(face)
    bmesh.ops.delete(bm, geom=doomed, context='FACES_ONLY')
    made = 0
    for iu in range(nu):
        iu2 = (iu + 1) % nu
        for iv in range(nv - 1):
            # v increases down the skirt. Wind so the front of the cloth faces +Z / outward.
            corners = [cell.get((iu, iv)), cell.get((iu, iv + 1)), cell.get((iu2, iv + 1)), cell.get((iu2, iv))]
            if any(c is None for c in corners):
                continue
            try:
                face = bm.faces.new([by_index[c] for c in corners])
            except ValueError:
                continue
            face.material_index = 0
            made += 1
            if uv_layer is not None:
                for loop in face.loops:
                    loop[uv_layer].uv = uv_of.get(loop.vert.index, (0.5, 0.5))
    bm.to_mesh(dress.data)
    bm.free()
    dress.data.update()
    pts_c = [to_c(v.co) for i, v in enumerate(dress.data.vertices) if skirt[i]]
    if pts_c:
        log('skirt bbox y %.3f..%.3f z %.3f..%.3f' % (
            min(p.y for p in pts_c), max(p.y for p in pts_c),
            min(p.z for p in pts_c), max(p.z for p in pts_c),
        ))
    log('skirt regrid cells %d faces %d' % (len(cell), made))


def bridge_knees(dress):
    """Add a strip of the existing skirt across the gap in front of the knees."""
    coords = [to_c(v.co) for v in dress.data.vertices]
    rows = 7
    y0, y1 = 0.30, 0.56
    bands = []
    for r in range(rows):
        ya = y0 + (y1 - y0) * r / float(rows)
        yb = y0 + (y1 - y0) * (r + 1) / float(rows)
        left = None
        right = None
        for i, c in enumerate(coords):
            if c.y < ya or c.y >= yb or c.z < 0.12 or abs(c.x) > 0.22:
                continue
            if c.x <= 0.02 and (left is None or c.x > coords[left].x):
                left = i
            if c.x >= -0.02 and (right is None or c.x < coords[right].x):
                right = i
        if left is not None and right is not None and left != right:
            bands.append((left, right))
    if len(bands) < 2:
        log('knee bridge skipped %d' % len(bands))
        return
    for left, right in bands:
        for idx in (left, right):
            c = coords[idx]
            c = Vector((c.x * 0.25, c.y, max(c.z, 0.56)))
            coords[idx] = c
            dress.data.vertices[idx].co = to_b(c)
    dress.data.update()
    bm = bmesh.new()
    bm.from_mesh(dress.data)
    by = {v.index: v for v in bm.verts}
    made = 0
    for a, b in zip(bands, bands[1:]):
        try:
            bm.faces.new([by[a[0]], by[b[0]], by[b[1]], by[a[1]]])
            made += 1
        except ValueError:
            continue
    bm.to_mesh(dress.data)
    bm.free()
    dress.data.update()
    log('knee bridge faces %d' % made)


def probe_front(dress):
    """Log the knee gap: side hem versus the cloth between the knees, and how far the stockings sit in front of it."""
    coords = [to_c(v.co) for v in dress.data.vertices]
    mask = skirt_mask(dress)
    log('PROBE skirt verts %d / %d' % (sum(1 for m in mask if m), len(mask)))
    for y0 in (0.28, 0.36, 0.44, 0.52, 0.60):
        parts = []
        for x0, x1, label in ((-0.26, -0.12, 'L'), (-0.12, 0.08, 'C'), (0.08, 0.26, 'R')):
            zs = [c.z for i, c in enumerate(coords) if mask[i] and y0 <= c.y < y0 + 0.08 and x0 <= c.x < x1 and c.z > -0.05]
            if zs:
                parts.append('%s n=%d z %.2f..%.2f' % (label, len(zs), min(zs), max(zs)))
        log('PROBE dress y %.2f %s' % (y0, ' | '.join(parts)))
    legs = leg_points()
    log('PROBE stocking samples %d' % len(legs))
    if legs:
        log('PROBE stocking x %.2f..%.2f y %.2f..%.2f z %.2f..%.2f' % (
            min(p.x for p in legs), max(p.x for p in legs),
            min(p.y for p in legs), max(p.y for p in legs),
            min(p.z for p in legs), max(p.z for p in legs),
        ))
    # Hop distance from the seat (z<0.08) to the side hem, along skirt edges.
    nbrs = mesh_neighbors(dress)
    seeds = [i for i, c in enumerate(coords) if mask[i] and c.z < 0.08 and 0.30 < c.y < 0.60 and abs(c.x) < 0.16]
    dist = {i: 0 for i in seeds}
    wave = list(seeds)
    while wave:
        nxt = []
        for i in wave:
            for j in nbrs[i]:
                if j in dist or not mask[j]:
                    continue
                dist[j] = dist[i] + 1
                nxt.append(j)
        wave = nxt
    front = [i for i, c in enumerate(coords) if mask[i] and c.z > 0.45 and 0.34 < c.y < 0.56 and abs(c.x) < 0.22]
    hops = [dist[i] for i in front if i in dist]
    log('PROBE front hem reachable %d/%d hops %s' % (len(hops), len(front), (min(hops), max(hops)) if hops else None))


def skirt_mask(obj):
    """Dress vertices that are the skirt, not the sleeves lying on the lap."""
    skirt_names = (
        'skirt.front', 'skirt.front.low', 'skirt.front.low.mid', 'skirt.front.mid',
        'skirt.left', 'skirt.left.low', 'skirt.back', 'skirt.back.low',
        'skirt.right', 'skirt.right.low',
    )
    arm_names = ('upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R')
    mask = []
    for v in obj.data.vertices:
        skirt_w = sum(group_weight(obj, v, name) for name in skirt_names)
        arm_w = sum(group_weight(obj, v, name) for name in arm_names)
        mask.append(skirt_w > 0.25 and arm_w < 0.4)
    return mask


def leg_points():
    """Front-of-knee vertices. Gloves sit further back; boots and the head stay out."""
    pts = []
    for obj in mesh_objects():
        if obj.type != 'MESH' or obj.name.startswith('LOD0_G2_DRESS') or obj.name.startswith('LOD0_G2_APRON') or obj.name.startswith('LOD0_G2_BOW'):
            continue
        if mat_key(obj) not in ('M_G2_FACE', 'M_G2_BODY'):
            continue
        for v in obj.data.vertices:
            foot = group_weight(obj, v, 'foot.L') + group_weight(obj, v, 'foot.R')
            head = group_weight(obj, v, 'head')
            if foot > 0.45 or head > 0.4:
                continue
            p = to_c(v.co)
            # Gloves on the lap are around z 0.30. The white knee is further forward.
            if 0.34 <= p.y <= 0.58 and abs(p.x) < 0.20 and p.z > 0.42:
                pts.append(p)
    return pts


def side_sheet_z(coords, mask):
    """Front z of the side drape that already covers the knee in profile. The centre must not pass this."""
    samples = []
    for i, c in enumerate(coords):
        if not mask[i]:
            continue
        if 0.11 <= abs(c.x) <= 0.26 and c.z > 0.38 and 0.28 <= c.y <= 0.68:
            samples.append((c.y, c.z))
    return samples


def sheet_z(samples, y):
    """Depth of the side hem's front edge. Most side verts sit back by the hip."""
    band = [z for yy, z in samples if abs(yy - y) <= 0.045]
    if len(band) < 3:
        band = [z for yy, z in samples if abs(yy - y) <= 0.09]
    if not band:
        return None
    band.sort()
    front = [z for z in band if z >= band[-1] - 0.018]
    return front[len(front) // 2]


def tri_front_z(tris, x, y):
    """Highest character-space z of a triangle that covers this front-view point."""
    best = None
    for tri in tris:
        a, b, c = tri
        den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if abs(den) < 1e-12:
            continue
        w0 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den
        w1 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den
        w2 = 1.0 - w0 - w1
        if w0 < -1e-3 or w1 < -1e-3 or w2 < -1e-3:
            continue
        z = w0 * a.z + w1 * b.z + w2 * c.z
        if best is None or z > best:
            best = z
    return best


def stocking_covered(dress_tris, legs):
    """Sock points the skirt does not hide. Returns the open count and a few samples."""
    open_n = 0
    samples = []
    for leg in legs:
        if leg.z < 0.38 or abs(leg.x) > 0.18 or not (0.36 <= leg.y <= 0.58):
            continue
        front = tri_front_z(dress_tris, leg.x, leg.y)
        if front is None or front < leg.z + 0.004:
            open_n += 1
            if len(samples) < 6:
                samples.append((leg.x, leg.y, leg.z, front))
    return open_n, samples


def dress_yellow_uv(dress):
    """A texel on T_G2_DRESS that is the skirt yellow, not the black band in that atlas."""
    fallback = Vector((0.35, 0.78))
    mat = dress.material_slots[0].material if dress.material_slots else None
    if mat is None or not mat.use_nodes:
        return fallback
    img = None
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image is not None:
            img = node.image
            break
    if img is None or img.size[0] < 8:
        return fallback
    w, h = img.size
    px = list(img.pixels)
    best = None
    step = max(4, w // 64)
    for y in range(0, h, step):
        for x in range(0, w, step):
            i = (y * w + x) * 4
            r, g, b = px[i], px[i + 1], px[i + 2]
            if r > 0.75 and g > 0.55 and b < 0.25 and r + g > 1.5:
                score = r + g - b
                if best is None or score > best[0]:
                    best = (score, (x + 0.5) / float(w), (y + 0.5) / float(h))
    if best is None:
        return fallback
    return Vector((best[1], best[2]))


def cover_knees(dress, bones=None):
    """Close the opening between the knees.

    Existing vertices stay put. New cloth sits just in front of the socks and
    level with the side hem, one clearance per quad, so the lap stays even
    instead of puffing into a lump. White shows only below that hem.
    """
    mask = skirt_mask(dress)
    coords = [to_c(v.co) for v in dress.data.vertices]
    samples = side_sheet_z(coords, mask)
    if len(samples) < 12:
        log('cover_knees skipped, side samples %d' % len(samples))
        return
    legs = [p for p in leg_points() if 0.34 <= p.y <= 0.59 and p.z > 0.38]
    # Triangle centres, not only vertices. A sock face can show through between its corners.
    for obj in mesh_objects():
        if obj.type != 'MESH' or mat_key(obj) not in ('M_G2_FACE', 'M_G2_BODY'):
            continue
        if obj.name.startswith('LOD0_G2_DRESS') or obj.name.startswith('LOD0_G2_APRON') or obj.name.startswith('LOD0_G2_BOW'):
            continue
        obj.data.calc_loop_triangles()
        verts = obj.data.vertices
        for lt in obj.data.loop_triangles:
            c = (to_c(verts[lt.vertices[0]].co) + to_c(verts[lt.vertices[1]].co) + to_c(verts[lt.vertices[2]].co)) / 3.0
            if 0.34 <= c.y <= 0.58 and abs(c.x) < 0.18 and c.z > 0.45:
                legs.append(c)
    if len(legs) < 8:
        log('cover_knees skipped, socks %d' % len(legs))
        return
    orig = []
    dress.data.calc_loop_triangles()
    for lt in dress.data.loop_triangles:
        orig.append([coords[i] for i in lt.vertices])
    knees = []
    for name in ('thigh.L', 'thigh.R'):
        tail = (bones or {}).get(name, {}).get('tail')
        if tail:
            knees.append((tail[0], tail[1]))
    if not knees:
        knees = [(-0.13, 0.50), (0.05, 0.51)]

    def sock_z(x, y):
        near = [p.z for p in legs if abs(p.y - y) <= 0.045 and abs(p.x - x) <= 0.055]
        return max(near) if near else None

    def lift_at(x, y):
        lift = 0.0
        for kx, ky in knees:
            d = math.hypot((x - kx) / 0.085, (y - ky) / 0.065)
            if d < 1.0:
                lift = max(lift, math.cos(d * math.pi * 0.5) * 0.010)
        return max(0.0, lift)

    xs = [p.x for p in legs]
    ys = [p.y for p in legs]
    xl = min(xs) - 0.02
    xr = max(xs) + 0.02
    y0 = max(0.34, min(ys) - 0.03)
    y1 = min(0.585, max(ys) + 0.012)
    if xr - xl < 0.08 or y1 - y0 < 0.05:
        log('cover_knees skipped, span x %.3f..%.3f y %.3f..%.3f' % (xl, xr, y0, y1))
        return
    rows, segs = 9, 6
    before = tris_of(dress)
    bm = bmesh.new()
    bm.from_mesh(dress.data)
    uv_layer = bm.loops.layers.uv.active
    yellow = dress_yellow_uv(dress)
    grid = []
    for r in range(rows):
        v = r / float(rows - 1)
        row = []
        for k in range(segs + 1):
            u = k / float(segs)
            x = xl + (xr - xl) * u
            y = y0 + (y1 - y0) * v
            sock = sock_z(x, y)
            oz = tri_front_z(orig, x, y)
            side = sheet_z(samples, y)
            open_pt = sock is not None and (oz is None or oz < sock + 0.003)
            if open_pt:
                clear = sock + 0.007
                z = clear + lift_at(x, y)
                if side is not None:
                    z = min(z, max(side + 0.005, clear))
            else:
                z = oz
            row.append({'x': x, 'y': y, 'z': z, 'open': open_pt, 'sock': sock})
        grid.append(row)
    # One clearance for the whole quad. Shared corners then sit on one plane, so flat
    # shading does not turn the lap into a checker, and a recessed corner cannot open a hole.
    for r in range(rows - 1):
        for k in range(segs):
            corners = [grid[r][k], grid[r][k + 1], grid[r + 1][k + 1], grid[r + 1][k]]
            if not any(pt['open'] for pt in corners):
                continue
            xlo = min(pt['x'] for pt in corners) - 0.02
            xhi = max(pt['x'] for pt in corners) + 0.02
            ylo = min(pt['y'] for pt in corners) - 0.015
            yhi = max(pt['y'] for pt in corners) + 0.015
            inside = [p.z for p in legs if xlo <= p.x <= xhi and ylo <= p.y <= yhi]
            if not inside:
                continue
            req = max(inside) + 0.006
            for pt in corners:
                if pt['z'] is None or pt['z'] < req:
                    pt['z'] = req
    made = []
    new_verts = []
    vert_of = {}

    def corner_vert(r, k):
        key = (r, k)
        if key in vert_of:
            return vert_of[key]
        pt = grid[r][k]
        if pt['z'] is None:
            return None
        vert = bm.verts.new(to_b(Vector((pt['x'], pt['y'], pt['z']))))
        new_verts.append(vert)
        vert_of[key] = vert
        return vert

    for r in range(rows - 1):
        for k in range(segs):
            ids = ((r, k), (r, k + 1), (r + 1, k + 1), (r + 1, k))
            corners = [grid[rr][kk] for rr, kk in ids]
            if not any(pt['open'] for pt in corners):
                continue
            known = [pt['z'] for pt in corners if pt['z'] is not None and pt['open']]
            if not known:
                known = [pt['z'] for pt in corners if pt['z'] is not None]
            if not known:
                continue
            fill = sum(known) / float(len(known))
            for pt in corners:
                if pt['z'] is None:
                    pt['z'] = fill
            verts = tuple(corner_vert(rr, kk) for rr, kk in ids)
            if any(v is None for v in verts):
                continue
            try:
                face = bm.faces.new(verts)
            except ValueError:
                continue
            face.material_index = 0
            face.smooth = True
            if uv_layer is not None:
                for loop in face.loops:
                    loop[uv_layer].uv = yellow
            made.append(face)
    used_verts = set()
    for face in made:
        used_verts.update(face.verts)
    for vert in new_verts:
        if vert not in used_verts:
            bm.verts.remove(vert)
    bm.normal_update()
    for face in made:
        # Character +Z is Blender -Y. The new cloth faces the room.
        if face.normal.y > 0.0:
            face.normal_flip()
    bm.to_mesh(dress.data)
    bm.free()
    dress.data.update()
    recalc_normals(dress)
    coords = [to_c(v.co) for v in dress.data.vertices]
    tris = []
    dress.data.calc_loop_triangles()
    for lt in dress.data.loop_triangles:
        tris.append([coords[i] for i in lt.vertices])
    open_n, open_samples = stocking_covered(tris, legs) if legs else (0, [])
    open_pts = sum(1 for row in grid for pt in row if pt['open'])
    zs = [pt['z'] for row in grid for pt in row if pt['open'] and pt['z'] is not None]
    if zs:
        log('cover z %.3f..%.3f' % (min(zs), max(zs)))
    log('cover_knees faces %d tris+%d open_pts %d span x %.3f..%.3f y %.3f..%.3f stockings_open %d/%d' % (
        len(made), tris_of(dress) - before, open_pts, xl, xr, y0, y1, open_n, len(legs)))
    for x, y, z, front in open_samples:
        log('stocking still open x %.3f y %.3f sock %.3f cloth %s' % (x, y, z, '%.3f' % front if front is not None else '-'))
    if open_n:
        raise RuntimeError('skirt still open over %d stocking samples' % open_n)
    if total_tris() > MAX_TRIS:
        raise RuntimeError('cover pushed triangles to %d' % total_tris())


def recalc_normals(obj):
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as exc:
        log('normal clear skipped %s' % exc)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def portrait_uv(u, v):
    """Blender UV, v up. The face portrait and the closed-eye tile. Boot bars are not in here."""
    if u < 0.55 and v < 0.62:
        return True
    if u > 0.55 and v < 0.30:
        return True
    return False


def pin_patch_uvs(obj, bone_names, thresh, allowed):
    """Leave the runtime boot and glove UVs. Only a loop that samples the face portrait moves."""
    idxs = []
    for name in bone_names:
        g = obj.vertex_groups.get(name)
        if g:
            idxs.append(g.index)
    if not idxs or not obj.data.uv_layers.active:
        return 0
    heavy = set()
    for v in obj.data.vertices:
        for sg in v.groups:
            if sg.group in idxs and sg.weight > thresh:
                heavy.add(v.index)
                break
    if not heavy:
        return 0
    uv = obj.data.uv_layers.active.data
    snapped = 0
    for poly in obj.data.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            if vi not in heavy:
                continue
            u, v = uv[li].uv
            if not portrait_uv(u, v):
                continue
            nearest = min(allowed, key=lambda ab: (u - ab[0]) ** 2 + (v - ab[1]) ** 2)
            uv[li].uv = nearest
            snapped += 1
    return snapped


def canonical_material(name):
    for mat in bpy.data.materials:
        if mat.name == name:
            return mat
    for mat in bpy.data.materials:
        if mat.name.split('.')[0] == name:
            try:
                mat.name = name
            except Exception:
                pass
            return mat
    raise RuntimeError('missing material ' + name)


def use_material(obj, name):
    mat = canonical_material(name)
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def material_names(obj):
    names = []
    for slot in obj.material_slots:
        if not slot.material:
            continue
        name = slot.material.name.split('.')[0]
        if name not in names:
            names.append(name)
    return names


def assemble_body(bow):
    """One LOD0_G2_BODY, with the same material slots the runtime body mesh uses.

    separate() leaves the hair chunk named LOD0_G2_BODY. The join below puts the
    skin chunk first and renames the result, so the exported mesh is not the hair
    material. Shoes and hands stay on M_G2_FACE — that is the runtime atlas — but
    only the boot bars and the glove patch, never the face portrait. The bow keeps
    M_G2_BODY, which is the runtime bow primitive.
    """
    skin = []
    hair = []
    hat = []
    face_parts = []
    for obj in mesh_objects():
        if not obj.get('sit') or obj == bow or obj.name.startswith('LOD0_G2_DRESS') or obj.name.startswith('LOD0_G2_APRON'):
            continue
        key = mat_key(obj)
        if key == 'M_G2_BODY':
            skin.append(obj)
        elif key == 'M_G2_HAIR':
            hair.append(obj)
        elif key == 'M_G2_HEAD':
            hat.append(obj)
        elif key == 'M_G2_FACE':
            face_parts.append(obj)
    if not skin:
        raise RuntimeError('body skin chunk missing')
    # Boots: leather / sole / sock. Gloves: the skin patch. Blender UV, v up.
    boot_uv = ((0.75, 0.445), (0.75, 0.40), (0.75, 0.37))
    hand_uv = ((0.80, 0.72),)
    snapped = 0
    for obj in face_parts:
        snapped += pin_patch_uvs(obj, ('foot.L', 'foot.R'), 0.25, boot_uv)
        snapped += pin_patch_uvs(obj, ('hand.L', 'hand.R'), 0.25, hand_uv)
    log('uv pin snapped %d' % snapped)
    leftover = 0
    for obj in face_parts:
        leftover += pin_patch_uvs(obj, ('foot.L', 'foot.R'), 0.25, boot_uv)
        leftover += pin_patch_uvs(obj, ('hand.L', 'hand.R'), 0.25, hand_uv)
    if leftover:
        raise RuntimeError('shoes or hands still sample the face portrait (%d)' % leftover)
    use_material(skin[0], 'M_G2_BODY')
    for obj in hair:
        use_material(obj, 'M_G2_HAIR')
    for obj in hat:
        use_material(obj, 'M_G2_HEAD')
    face_mat = canonical_material('M_G2_FACE')
    for obj in face_parts:
        use_material(obj, 'M_G2_FACE')
        if obj.data.materials[0] != face_mat:
            obj.data.materials[0] = face_mat
    use_material(bow, 'M_G2_BODY')
    base = skin[0]
    others = skin[1:] + face_parts + hat + hair
    activate(base)
    for obj in others:
        obj.select_set(True)
    if others:
        bpy.ops.object.join()
    for me in bpy.data.meshes:
        if me != base.data and me.name.split('.')[0] == 'LOD0_G2_BODY':
            me.name = 'sit_retired_body'
    base.name = 'LOD0_G2_BODY'
    base.data.name = 'LOD0_G2_BODY'
    base['sit'] = 1
    # Slot order follows the runtime body primitives: face, hat, body, hair.
    # The skin chunk was active, so M_G2_BODY is slot 0 until we reorder.
    order = ['M_G2_FACE', 'M_G2_HEAD', 'M_G2_BODY', 'M_G2_HAIR']
    present = material_names(base)
    log('body slots before reorder %s' % present)
    reorder_slots(base, order)
    names = material_names(base)
    log('body slots %s' % names)
    if base.name != 'LOD0_G2_BODY' or names != order:
        raise RuntimeError('body export slots %s %s' % (base.name, names))
    if mat_key(bow) != 'M_G2_BODY':
        raise RuntimeError('bow material ' + mat_key(bow))
    return base


def reorder_slots(obj, order):
    """Reorder material slots. Clearing the slots drops face indices, so they are written back after."""
    me = obj.data
    old_names = []
    for slot in obj.material_slots:
        if slot.material:
            old_names.append(slot.material.name.split('.')[0])
    wanted = [name for name in order if name in old_names]
    if not wanted or wanted == old_names:
        return
    remap = {old_names.index(name): new_i for new_i, name in enumerate(wanted)}
    stored = [remap.get(poly.material_index, 0) for poly in me.polygons]
    me.materials.clear()
    for name in wanted:
        me.materials.append(canonical_material(name))
    for poly, mi in zip(me.polygons, stored):
        poly.material_index = mi
    counts = [0] * len(wanted)
    for mi in stored:
        if 0 <= mi < len(counts):
            counts[mi] += 1
    log('slot faces %s' % list(zip(wanted, counts)))


def material_index(obj, mat_name):
    for i, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name.split('.')[0] == mat_name:
            return i
    return None


def polys_of(obj, mi):
    verts = []
    faces = []
    used = {}
    for poly in obj.data.polygons:
        if poly.material_index != mi:
            continue
        ids = []
        for vi in poly.vertices:
            if vi not in used:
                used[vi] = len(verts)
                verts.append(obj.data.vertices[vi].co.copy())
            ids.append(used[vi])
        if len(ids) == 3:
            faces.append(tuple(ids))
        elif len(ids) == 4:
            faces.append((ids[0], ids[1], ids[2]))
            faces.append((ids[0], ids[2], ids[3]))
    return verts, faces


def pull_hair_off_face(body):
    """Hair inside the face is moved back out along the face normal. The scalp stays."""
    hair_i = material_index(body, 'M_G2_HAIR')
    face_i = material_index(body, 'M_G2_FACE')
    if hair_i is None or face_i is None:
        log('pull hair skipped, slots %s' % material_names(body))
        return 0.0
    face_verts, face_faces = polys_of(body, face_i)
    head_faces = []
    for f in face_faces:
        c = (face_verts[f[0]] + face_verts[f[1]] + face_verts[f[2]]) / 3.0
        if to_c(c).y > 0.75:
            head_faces.append(f)
    if len(head_faces) < 8:
        log('pull hair skipped, head faces %d' % len(head_faces))
        return 0.0
    tree = BVHTree.FromPolygons(face_verts, head_faces)
    hair_ids = set()
    for poly in body.data.polygons:
        if poly.material_index == hair_i:
            hair_ids.update(poly.vertices)
    original = {vi: body.data.vertices[vi].co.copy() for vi in hair_ids}
    moved = 0
    worst = 0.0
    for _attempt in range(3):
        step = 0
        for vi in hair_ids:
            co = body.data.vertices[vi].co
            loc, normal, index, dist = tree.find_nearest(co)
            if loc is None or normal is None or dist is None or dist > 0.05:
                continue
            if normal.length < 1e-8:
                continue
            normal = normal.normalized()
            signed = (co - loc).dot(normal)
            if signed >= -0.002:
                continue
            depth = -signed
            if depth > worst:
                worst = depth
            dest = loc + normal * 0.003
            delta = dest - original[vi]
            if delta.length > 0.030:
                dest = original[vi] + delta.normalized() * 0.030
            # Drop a step that sinks further into the head.
            probe, probe_n, _, _ = tree.find_nearest(dest)
            if probe is None or probe_n is None or probe_n.length < 1e-8:
                continue
            if (dest - probe).dot(probe_n.normalized()) < signed - 0.001:
                continue
            body.data.vertices[vi].co = dest
            step += 1
        body.data.update()
        moved += step
        if step == 0:
            break
    left = 0.0
    for vi in hair_ids:
        co = body.data.vertices[vi].co
        loc, normal, index, dist = tree.find_nearest(co)
        if loc is None or normal is None or dist is None or dist > 0.05 or normal.length < 1e-8:
            continue
        signed = (co - loc).dot(normal.normalized())
        if signed < -left:
            left = -signed
    log('pull hair out of face moved %d was %.1fmm left %.1fmm' % (moved, worst * 1000, left * 1000))
    return left


def push_material(obj, mat_name):
    """Push one material's vertices out of the chair. The hat brim is the 19 mm case."""
    mi = None
    for i, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name.split('.')[0] == mat_name:
            mi = i
            break
    if mi is None:
        if mat_key(obj) == mat_name:
            push_cloth(obj)
        return
    used = set()
    for poly in obj.data.polygons:
        if poly.material_index == mi:
            used.update(poly.vertices)
    moved = 0
    worst = 0.0
    for index in used:
        v = obj.data.vertices[index]
        p = v.co.copy()
        best = nearest_box(p)
        if best and best[0] < CLOTH_MARGIN:
            d, lo, hi = best
            g = Vector((0, 0, 0))
            e = 1e-4
            for k in range(3):
                pp = p.copy()
                pm = p.copy()
                pp[k] += e
                pm[k] -= e
                g[k] = (box_sdf(pp, lo, hi) - box_sdf(pm, lo, hi)) / (2 * e)
            if g.length < 1e-8:
                g = Vector((0, 0, 1))
            g.normalize()
            p += g * (CLOTH_MARGIN - d)
            moved += 1
            if -d > worst:
                worst = -d
        v.co = p
    obj.data.update()
    log('push %s/%s moved %d worst %.4f' % (obj.name, mat_name, moved, worst))


def warp_cloth(dress, apron, rest, sleeves, leg_segs):
    """Keep the skinned sit drape. The apron lap is spread so the bib stays closed."""
    if apron is None or apron.name not in rest:
        return
    ap = rest[apron.name]
    front_idx = [i for i, p in enumerate(ap) if p.z > 0.04 and p.y < 1.05]
    if len(front_idx) < 8:
        log('apron front verts %d, left skinned' % len(front_idx))
        return
    xs = [ap[i].x for i in front_idx]
    x0, x1 = min(xs), max(xs)
    span = (x1 - x0) or 1.0
    acoords = [to_c(v.co) for v in apron.data.vertices]
    for i in front_idx:
        p = ap[i]
        u = (p.x - x0) / span * 2.0 - 1.0
        vparam = clamp((1.02 - p.y) / (1.02 - 0.55), 0.0, 1.0)
        # Straps stay. The lap panel spreads so the centre of the bib does not open.
        w = smoothstep(clamp((vparam - 0.18) / 0.22, 0.0, 1.0))
        acoords[i] = acoords[i].lerp(apron_target(u, vparam), w)
    for i, co in enumerate(acoords):
        apron.data.vertices[i].co = to_b(co)
    apron.data.update()
    log('apron front %d' % len(front_idx))


def posed_leg_segments(arm):
    segs = []
    for name, radius in (('thigh.L', 0.075), ('thigh.R', 0.075), ('shin.L', 0.055), ('shin.R', 0.055)):
        h, t = bone_char(arm, name)
        segs.append((h, t, radius))
    return segs


def settle_bow(bow):
    """Keep the bow mesh. Lift it as a rigid shape so the tails clear the seat."""
    if bow is None:
        return
    pts = [to_c(v.co) for v in bow.data.vertices]
    min_y = min(p.y for p in pts)
    dy = 0.0
    if min_y < 0.405:
        dy = 0.405 - min_y
    for i, p in enumerate(pts):
        bow.data.vertices[i].co = to_b(Vector((p.x, p.y + dy, p.z)))
    bow.data.update()
    log('bow lift dy %.3f' % dy)


def push_cloth(obj):
    """Skirt, apron and bow stay out of the chair and off the floor. Other meshes are not touched."""
    moved = 0
    worst = 0.0
    for v in obj.data.vertices:
        p = v.co.copy()
        best = nearest_box(p)
        if best and best[0] < CLOTH_MARGIN:
            d, lo, hi = best
            g = Vector((0, 0, 0))
            e = 1e-4
            for k in range(3):
                pp = p.copy()
                pm = p.copy()
                pp[k] += e
                pm[k] -= e
                g[k] = (box_sdf(pp, lo, hi) - box_sdf(pm, lo, hi)) / (2 * e)
            if g.length < 1e-8:
                g = Vector((0, 0, 1))
            g.normalize()
            p += g * (CLOTH_MARGIN - d)
            moved += 1
            if -d > worst:
                worst = -d
        if p.z < 0.006:
            p.z = 0.006
            moved += 1
        v.co = p
    obj.data.update()
    log('push %s moved %d worst %.4f' % (obj.name, moved, worst))


def count_penetration(obj):
    inside = 0
    worst = 0.0
    floor = 0
    for v in obj.data.vertices:
        if v.co.z < -0.001:
            floor += 1
        best = nearest_box(v.co)
        if best and best[0] < 0:
            inside += 1
            if -best[0] > worst:
                worst = -best[0]
    return {'inside': inside, 'worst_m': round(worst, 5), 'below_floor': floor, 'verts': len(obj.data.vertices), 'tris': tris_of(obj)}


def separate_material(obj):
    if len(obj.material_slots) < 2:
        return
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')


def split_weight(obj, names, thresh, new_name):
    """Split faces that belong to these bones into their own object. Returns the new object or None."""
    idxs = []
    for name in names:
        g = obj.vertex_groups.get(name)
        if g:
            idxs.append(g.index)
    if not idxs:
        return None
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(obj.data)
    dl = bm.verts.layers.deform.active
    if dl is None:
        bpy.ops.object.mode_set(mode='OBJECT')
        return None
    picked = 0
    for f in bm.faces:
        f.select = False
        heavy = False
        for v in f.verts:
            w = v[dl]
            for i in idxs:
                if w.get(i, 0.0) > thresh:
                    heavy = True
                    break
            if heavy:
                break
        if heavy:
            f.select = True
            picked += 1
    bmesh.update_edit_mesh(obj.data)
    if picked < 8:
        bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        return None
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    created = [o for o in bpy.context.selected_objects if o != obj and o.type == 'MESH']
    if not created:
        return None
    created[0].name = new_name
    log('split %s faces %d -> %s tris %d' % (obj.name, picked, new_name, tris_of(created[0])))
    return created[0]


def decimate(obj, ratio):
    if obj is None or ratio >= 0.98:
        return
    before = tris_of(obj)
    if before < 80:
        return
    activate(obj)
    mod = obj.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = clamp(ratio, 0.05, 1.0)
    mod.use_collapse_triangulate = True
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as exc:
        log('decimate failed %s %s' % (obj.name, exc))
        obj.modifiers.remove(mod)
        return
    log('decimate %s %d -> %d' % (obj.name, before, tris_of(obj)))


def weld(obj, dist):
    """Collapse the skirt's inner layer onto the outer one so decimate cannot open a hole."""
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=dist)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    log('weld %s verts %d tris %d' % (obj.name, len(obj.data.vertices), tris_of(obj)))
    worst = 0.0
    long_n = 0
    seen = set()
    for poly in obj.data.polygons:
        vs = list(poly.vertices)
        for i, a in enumerate(vs):
            b = vs[(i + 1) % len(vs)]
            key = (a, b) if a < b else (b, a)
            if key in seen:
                continue
            seen.add(key)
            d = (obj.data.vertices[a].co - obj.data.vertices[b].co).length
            if d > worst:
                worst = d
            if d > 0.06:
                long_n += 1
    log('edges %s worst %.3f over6cm %d' % (obj.name, worst, long_n))


def drop_groups(obj):
    obj.vertex_groups.clear()
    for mod in list(obj.modifiers):
        obj.modifiers.remove(mod)


def char_to_world(v):
    fwd = Vector((math.sin(SEAT_YAW), 0.0, math.cos(SEAT_YAW)))
    right = Vector((math.cos(SEAT_YAW), 0.0, -math.sin(SEAT_YAW)))
    return SEATED_ROOT + right * v.x + Vector((0, 1, 0)) * v.y + fwd * v.z


def world_to_char(p):
    fwd = Vector((math.sin(SEAT_YAW), 0.0, math.cos(SEAT_YAW)))
    right = Vector((math.cos(SEAT_YAW), 0.0, -math.sin(SEAT_YAW)))
    d = p - SEATED_ROOT
    return Vector((d.dot(right), d.y, d.dot(fwd)))


def blender_to_game(p):
    """glTF import stores Y-up world as Blender Z-up (x, -z, y)."""
    return Vector((p.x, p.z, -p.y))


def build_chair_visual():
    """Real reading-chair triangles from the room glb, moved into the character frame."""
    tagged = set(id(o) for o in bpy.context.scene.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=ROOM)
    except Exception as exc:
        log('room import failed %s' % exc)
        return box_chair()
    fresh = [o for o in bpy.context.scene.objects if id(o) not in tagged]
    corners = []
    for lo, hi in CHAIR_BOXES_CHAR.values():
        corners.append(Vector(lo))
        corners.append(Vector(hi))
    mins = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners))) - Vector((0.05, 0.02, 0.05))
    maxs = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners))) + Vector((0.05, 0.06, 0.05))
    source = None
    for obj in fresh:
        if obj.type == 'MESH' and obj.name.startswith('env_interior_props_merged'):
            source = obj
            break
    if source is not None:
        activate(source)
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    if source is None:
        for obj in fresh:
            bpy.data.objects.remove(obj, do_unlink=True)
        log('chair extract missing props, using boxes')
        return box_chair()
    mw = source.matrix_world.copy()
    me = source.data
    keep = [False] * len(me.polygons)
    kept_n = 0
    game_verts = [blender_to_game(mw @ v.co) for v in me.vertices]
    for pi, poly in enumerate(me.polygons):
        c = Vector((0.0, 0.0, 0.0))
        for i in poly.vertices:
            c += world_to_char(game_verts[i])
        c /= float(len(poly.vertices))
        if c.x < mins.x or c.x > maxs.x or c.y < mins.y or c.y > maxs.y or c.z < mins.z or c.z > maxs.z:
            continue
        # The AABB also covers empty air beside the spindles. Keep faces that actually touch the chair.
        near = nearest_box(to_b(c))
        if near is None or near[0] > 0.04:
            continue
        keep[pi] = True
        kept_n += 1
    if kept_n < 20:
        for obj in fresh:
            bpy.data.objects.remove(obj, do_unlink=True)
        log('chair extract %d faces, using boxes' % kept_n)
        return box_chair()
    activate(source)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(source.data)
    bm.faces.ensure_lookup_table()
    doomed = [f for f in bm.faces if not keep[f.index]]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.update_edit_mesh(source.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in source.data.vertices:
        game = blender_to_game(mw @ v.co)
        v.co = to_b(world_to_char(game))
    source.data.update()
    source.matrix_world = Matrix.Identity(4)
    source.name = 'ReadingChair'
    for obj in fresh:
        if obj != source:
            bpy.data.objects.remove(obj, do_unlink=True)
    log('chair extract faces %d' % kept_n)
    return [source]


def box_chair():
    mat = bpy.data.materials.new('ChairWood')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.93, 0.91, 0.86, 1)
    parts = []
    for name, (lo, hi) in CHAIR_BOXES.items():
        bpy.ops.mesh.primitive_cube_add(location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2))
        obj = bpy.context.active_object
        obj.name = 'chair_' + name
        obj.scale = ((hi.x - lo.x) / 2, (hi.y - lo.y) / 2, (hi.z - lo.z) / 2)
        activate(obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.data.materials.append(mat)
        parts.append(obj)
    return parts


def look_at(cam, eye, target):
    eye_v = Vector(eye)
    fwd = (Vector(target) - eye_v)
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
    cam.matrix_world = Matrix.Translation(eye_v) @ Matrix((x_axis, y_axis, z_axis)).transposed().to_4x4()


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.taa_render_samples = int(os.environ.get('SIT_SAMPLES', '16'))
    world = scene.world or bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.93, 0.93, 0.92, 1)
        bg.inputs[1].default_value = 0.45
    bpy.ops.object.light_add(type='AREA', location=to_b(Vector((0.6, 1.6, 1.5))))
    key = bpy.context.active_object
    key.data.energy = 220
    key.data.size = 1.8
    key['sit_light'] = 1
    bpy.ops.object.light_add(type='AREA', location=to_b(Vector((-1.3, 1.2, -0.2))))
    fill = bpy.context.active_object
    fill.data.energy = 70
    fill.data.size = 2.0
    fill['sit_light'] = 1
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    cam.data.lens = 58
    return cam


def render_to(path, cam, eye_c, target_c, w, h):
    look_at(cam, to_b(Vector(eye_c)), to_b(Vector(target_c)))
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.filepath = path
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    log('rendered %s' % path)


def flatten_material(mat):
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
    try:
        mat.name = name
    except Exception:
        pass


def export_glb(path, normals):
    char_objs = [o for o in mesh_objects() if o.get('sit')]
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
    try:
        kwargs['export_vertex_color'] = 'ACTIVE'
    except Exception:
        pass
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        kwargs.pop('export_vertex_color', None)
        bpy.ops.export_scene.gltf(**kwargs)


def total_tris():
    return sum(tris_of(o) for o in mesh_objects() if o.get('sit'))


def main():
    os.makedirs(PREVIEW, exist_ok=True)
    os.makedirs(os.path.dirname(RUNTIME), exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, 'data'), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CHR)
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and not obj.name.startswith('LOD0'):
            bpy.data.objects.remove(obj, do_unlink=True)
    arm = find_armature()
    body = find_mesh('LOD0_G2_BODY')
    dress = find_mesh('LOD0_G2_DRESS')
    apron = find_mesh('LOD0_G2_APRON')
    bow = find_mesh('LOD0_G2_BOW')
    rest, sleeves = capture_rest(arm)
    clear_to_rest(arm)
    palms = {}
    for side in ('L', 'R'):
        palms[side] = hand_palm_local(arm, body, 'hand.' + side)
        log('palm local %s %s' % (side, [round(x, 3) for x in palms[side]]))
    pose_clip(arm, 'sit_down')
    freeze_pose(arm)
    set_shape_keys()
    straighten(arm)
    place_hands(arm, palms)
    level_feet(arm)
    legs = posed_leg_segments(arm)
    bones = {}
    for name in ('hips', 'chest', 'head', 'hand.L', 'hand.R', 'foot.L', 'foot.R', 'thigh.L', 'thigh.R'):
        h, t = bone_char(arm, name)
        bones[name] = {'head': [round(x, 4) for x in h], 'tail': [round(x, 4) for x in t]}
    log('bones %s' % json.dumps(bones))

    for obj in (dress, apron, bow, body):
        bake_shape_keys(obj)
        apply_armature(obj)
    for obj in list(bpy.context.scene.objects):
        if obj.type in ('ARMATURE', 'EMPTY'):
            bpy.data.objects.remove(obj, do_unlink=True)

    if os.environ.get('SIT_PROBE') == '1':
        probe_cloth(dress, apron, bow, rest, sleeves, legs)
        return
    warp_cloth(dress, apron, rest, sleeves, legs)
    weld(dress, 0.006)
    weld(apron, 0.003)
    if os.environ.get('SIT_STOP') == '1':
        return
    settle_bow(bow)
    for obj in (dress, apron, bow):
        push_cloth(obj)
        push_cloth(obj)

    # Keep the face, the gloves and the red boots whole. Decimate hair, hat, hidden skin and the skirt.
    separate_material(body)
    face = None
    hair = None
    hat = None
    skin = None
    for obj in list(mesh_objects()):
        key = mat_key(obj)
        if key == 'M_G2_FACE' and face is None:
            face = obj
        elif key == 'M_G2_HAIR':
            hair = obj
        elif key == 'M_G2_HEAD':
            hat = obj
        elif key == 'M_G2_BODY' and obj != bow:
            skin = obj
    shoes = split_weight(face, ('foot.L', 'foot.R'), 0.35, 'SitShoes') if face else None
    hands = split_weight(face, ('hand.L', 'hand.R'), 0.4, 'SitHands') if face else None
    head = split_weight(face, ('head',), 0.3, 'SitFace') if face else None
    # Whatever of the face material is left is arms and thighs. Decimate that, not the split pieces.
    decimate(hair, 0.20)
    decimate(hat, 0.35)
    decimate(face, 0.28)
    decimate(skin, 0.55)
    decimate(head, 0.85)
    decimate(dress, 0.95)
    # Hands and shoes are not decimated: they are the heroine's.
    for obj in mesh_objects():
        if obj.name.startswith('LOD0') or obj.name.startswith('Sit') or mat_key(obj) in BASE_COLOR:
            obj['sit'] = 1

    total = total_tris()
    log('TOTAL TRIS %d' % total)
    protected = ('SitShoes', 'SitHands', 'SitFace')
    guard = 0
    while total > MAX_TRIS and guard < 8:
        guard += 1
        ratio = 0.7 if guard < 3 else clamp((MAX_TRIS / float(total)) * 0.94, 0.6, 0.97)
        candidates = []
        for obj in mesh_objects():
            if not obj.get('sit') or obj.name in protected or tris_of(obj) < 220:
                continue
            # Keep the skirt until hair, hat and the hidden limbs have given up triangles.
            if guard < 3 and obj in (dress, apron, bow):
                continue
            candidates.append(obj)
        if not candidates:
            candidates = [obj for obj in mesh_objects() if obj.get('sit') and obj.name not in protected and tris_of(obj) >= 220]
        if not candidates:
            break
        candidates.sort(key=tris_of, reverse=True)
        decimate(candidates[0], ratio)
        total = total_tris()
    log('TOTAL TRIS after budget %d' % total)
    if total > MAX_TRIS:
        raise RuntimeError('triangle budget exceeded: %d' % total)

    # Dress decimate runs above. Close the knee gap on the verts that will ship.
    if os.environ.get('SIT_DRY') == '1':
        probe_front(dress)
        return
    cover_knees(dress, bones)
    for obj in (dress, apron, bow):
        if obj:
            push_cloth(obj)
    for obj in mesh_objects():
        if obj.get('sit') and mat_key(obj) == 'M_G2_HEAD':
            push_material(obj, 'M_G2_HEAD')
    body_mesh = assemble_body(bow)
    stray = [obj.name for obj in mesh_objects() if obj.name.startswith('Sit')]
    if stray:
        raise RuntimeError('split meshes left in the export %s' % stray)
    pull_hair_off_face(body_mesh)
    push_material(body_mesh, 'M_G2_HEAD')
    for obj in mesh_objects():
        if obj.get('sit'):
            drop_groups(obj)
            obj.data.name = obj.name

    report = {'bones_character_y_up': bones, 'parts': {}, 'source': os.path.basename(CHR)}
    for obj in mesh_objects():
        if not obj.get('sit'):
            continue
        stats = count_penetration(obj)
        names = material_names(obj)
        stats['material'] = names[0] if len(names) == 1 else '+'.join(names)
        stats['materials'] = names
        report['parts'][obj.name] = stats
        log('part %s %s' % (obj.name, json.dumps(stats)))
    report['triangles'] = total_tris()
    cloth_inside = 0
    for obj in (dress, apron, bow):
        if obj and obj.get('sit'):
            cloth_inside += count_penetration(obj)['inside']
            cloth_inside += count_penetration(obj)['below_floor']
    report['cloth_inside_or_floor'] = cloth_inside
    if cloth_inside:
        log('WARNING cloth penetration %d' % cloth_inside)

    # Preview uses the real textures. The runtime file does not.
    chair = build_chair_visual()
    floor_mat = bpy.data.materials.new('Floor')
    floor_mat.use_nodes = True
    bsdf = next(n for n in floor_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.94, 0.94, 0.93, 1)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(floor_mat)
    for mat in bpy.data.materials:
        mat.use_backface_culling = False
    cam = setup_render()
    target = (0.0, 0.48, 0.12)
    shots = {
        'front': ((0.0, 0.50, 2.05), target),
        'side': ((-2.15, 0.50, 0.18), target),
        'back': ((0.0, 0.52, -1.95), target),
    }
    want = [s for s in os.environ.get('SIT_SHOTS', 'front,side,back').split(',') if s]
    for name, (eye, tgt) in shots.items():
        if name not in want:
            continue
        render_to(os.path.join(PREVIEW, name + '_chair.png'), cam, eye, tgt, 900, 1100)
    if os.environ.get('SIT_FIGURE', '1') != '0':
        for obj in chair:
            obj.hide_render = True
        floor.hide_render = True
        for name, (eye, tgt) in shots.items():
            if name not in want:
                continue
            render_to(os.path.join(PREVIEW, name + '_figure.png'), cam, eye, tgt, 720, 960)

    seen = {}
    for obj in mesh_objects():
        if not obj.get('sit'):
            continue
        for slot in obj.material_slots:
            mat = slot.material
            if mat and mat.name not in seen:
                flatten_material(mat)
                seen[mat.name] = True
    for img in list(bpy.data.images):
        try:
            bpy.data.images.remove(img)
        except Exception:
            pass

    export_glb(GLB_OUT, True)
    size = os.path.getsize(GLB_OUT)
    log('glb %d' % size)
    if size > MAX_BYTES:
        export_glb(GLB_OUT, False)
        size = os.path.getsize(GLB_OUT)
        log('glb without normals %d' % size)
    if size > MAX_BYTES:
        for obj in mesh_objects():
            if obj.get('sit') and obj.name not in ('LOD0_G2_BODY', 'SitShoes', 'SitHands', 'SitFace', dress.name, apron.name, bow.name) and tris_of(obj) > 400:
                decimate(obj, 0.8)
        export_glb(GLB_OUT, False)
        size = os.path.getsize(GLB_OUT)
        report['triangles'] = total_tris()
        log('glb squeezed %d tris %d' % (size, report['triangles']))
    if size > MAX_BYTES or report.get('triangles', total) > MAX_TRIS:
        raise RuntimeError('budget glb %d tris %s' % (size, report.get('triangles')))
    data = open(GLB_OUT, 'rb').read()
    open(RUNTIME, 'wb').write(data)
    report['glb_bytes'] = len(data)
    report['runtime_plus_sit_bytes'] = len(data) + os.path.getsize(CHR)
    with open(os.path.join(OUT_DIR, 'data', 'qa_sit_static.json'), 'w') as f:
        json.dump(report, f, indent=2)
    log('done %s' % json.dumps({'tris': report['triangles'], 'bytes': len(data), 'sum': report['runtime_plus_sit_bytes'], 'cloth': cloth_inside}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        raise
