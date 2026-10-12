# blender -b -P build_sit_static.py
# Pose the int/v1 body-r4 runtime GLB at sit_down's last frame, place it on the
# reading chair (seat_anchor / seatedRoot / yaw -2), apply the armature, then
# drape the dress and apron onto the chair with position-based constraints.
# The export is a static mesh in room world space (no skin, no bones).
import bpy, json, math, os, time
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
CHAR = os.path.join(ROOT, 'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
ROOM = os.path.join(ROOT, 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
OUT_DIR = os.path.join(ROOT, 'art-src/character/sit-static')
OUT_GLB = os.path.join(OUT_DIR, 'chr_sit_static.glb')
QA_PATH = os.path.join(OUT_DIR, 'data/qa_sit_static.json')

# Game placement. seatedRoot + seatYawRad from CharacterReference / seat_anchor.
SEATED = (0.4327299768730942, 0.0, -4.207611558444886)
YAW = -2.0
# Chair frame (column-major world matrix of col_int_chair_*, Y of the node is 0).
CHAIR_X = (-0.4161469429061029, 0.0, 0.9092975120454767)   # local +X, game
CHAIR_Z = (-0.9092975120454767, 0.0, -0.4161469429061029)  # local +Z = front, game
CHAIR_T = (0.4203000068664551, 0.0, -4.2133002281188965)
SEAT_TOP = 0.38
SEAT_HALF_W = 0.2473
SEAT_HALF_D = 0.1908
MARGIN_BODY = 0.007
MARGIN_CHAIR = 0.004
MARGIN_FLOOR = 0.003
MARGIN_DRESS = 0.006

def game_to_blender(x, y, z):
    return (x, -z, y)

def placement_matrix():
    c, s = math.cos(YAW), math.sin(YAW)
    rx, ry, rz = SEATED
    # Maps a character-local Blender point (Z-up, facing -Y) into room Blender
    # space so the glTF exporter's Z-up -> Y-up conversion lands on game world.
    return Matrix((
        (c, -s, 0, rx),
        (s,  c, 0, -rz),
        (0,  0, 1, ry),
        (0,  0, 0, 1),
    ))

def chair_axes_blender():
    # game (x,y,z) -> blender (x, -z, y)
    def ax(v):
        return Vector((v[0], -v[2], v[1]))
    return ax(CHAIR_X), Vector((0, 0, 1)), ax(CHAIR_Z), Vector(game_to_blender(*CHAIR_T))

def dominant_group(obj, name):
    idx = obj.vertex_groups[name].index
    out = np.zeros(len(obj.data.vertices), dtype=bool)
    for v in obj.data.vertices:
        if not v.groups:
            continue
        g = max(v.groups, key=lambda x: x.weight)
        if g.group == idx and g.weight > 0.45:
            out[v.index] = True
    return out

def rest_edges(obj):
    edges = np.array([(e.vertices[0], e.vertices[1]) for e in obj.data.edges], dtype=np.int32)
    co = np.array([v.co[:] for v in obj.data.vertices], dtype=np.float64)
    rest = np.linalg.norm(co[edges[:, 1]] - co[edges[:, 0]], axis=1)
    return edges, rest

def deformed_world(obj, M):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    me.transform(M @ obj.matrix_world)
    return me

def make_bvh(me):
    return BVHTree.FromPolygons([v.co[:] for v in me.vertices], [list(p.vertices) for p in me.polygons])

def project_edges(P, e0, e1, rest, pin):
    d = P[e1] - P[e0]
    L = np.linalg.norm(d, axis=1)
    ok = L > 1e-8
    scale = np.zeros_like(L)
    # Small step. Allow a little extra length so the sheet can span the lap.
    target = rest * 1.04
    scale[ok] = (L[ok] - target[ok]) / L[ok]
    corr = d * (scale * 0.12)[:, None]
    f0 = ~pin[e0]
    f1 = ~pin[e1]
    both = f0 & f1
    only0 = f0 & ~f1
    only1 = f1 & ~f0
    acc = np.zeros_like(P)
    cnt = np.zeros(len(P), dtype=np.float64)
    if both.any():
        np.add.at(acc, e0[both], corr[both])
        np.add.at(acc, e1[both], -corr[both])
        np.add.at(cnt, e0[both], 1)
        np.add.at(cnt, e1[both], 1)
    if only0.any():
        np.add.at(acc, e0[only0], corr[only0] * 2)
        np.add.at(cnt, e0[only0], 1)
    if only1.any():
        np.add.at(acc, e1[only1], -corr[only1] * 2)
        np.add.at(cnt, e1[only1], 1)
    m = cnt > 0
    P[m] += acc[m] / cnt[m, None]

def smooth_free(P, e0, e1, pin, amount):
    acc = np.zeros_like(P)
    cnt = np.zeros(len(P), dtype=np.float64)
    np.add.at(acc, e0, P[e1])
    np.add.at(acc, e1, P[e0])
    np.add.at(cnt, e0, 1)
    np.add.at(cnt, e1, 1)
    m = (cnt > 0) & (~pin)
    P[m] += (acc[m] / cnt[m, None] - P[m]) * amount

def push_bvh(P, bvh, margin, free, search):
    n = 0
    deepest = 0.0
    for i in np.flatnonzero(free):
        p = Vector(P[i])
        hit = bvh.find_nearest(p, search)
        if hit[0] is None:
            continue
        loc, normal, _idx, _dist = hit
        signed = (p - loc).dot(normal)
        if signed < margin:
            P[i] = np.array(loc + normal * margin)
            n += 1
            deepest = max(deepest, margin - signed)
    return n, deepest

def push_floor(P, free, margin):
    m = free & (P[:, 2] < margin)
    P[m, 2] = margin
    return int(m.sum())

def count_behind(P, bvh, free, limit):
    n = 0
    deep = 0.0
    for i in np.flatnonzero(free):
        p = Vector(P[i])
        hit = bvh.find_nearest(p, limit)
        if hit[0] is None:
            continue
        loc, normal, _i, _d = hit
        signed = (p - loc).dot(normal)
        if signed < 0.0005:
            n += 1
            deep = max(deep, -signed)
    return n, deep

def orient_bvh(me, probe):
    bvh = make_bvh(me)
    hit = bvh.find_nearest(probe, 2.0)
    if hit[0] is None:
        return bvh, 1.0
    loc, normal, _i, _d = hit
    signed = (probe - loc).dot(normal)
    # A point above the seat must be outside. Flip stored normals if it is not.
    return bvh, (1.0 if signed >= 0 else -1.0)

def push_bvh_sign(P, bvh, sign, margin, free, search):
    n = 0
    deepest = 0.0
    for i in np.flatnonzero(free):
        p = Vector(P[i])
        hit = bvh.find_nearest(p, search)
        if hit[0] is None:
            continue
        loc, normal, _idx, _dist = hit
        normal = normal * sign
        signed = (p - loc).dot(normal)
        if signed < margin:
            P[i] = np.array(loc + normal * margin)
            n += 1
            deepest = max(deepest, margin - signed)
    return n, deepest

def lay_on_seat(P, free):
    """Cloth inside the seat footprint rests on the slab. Cloth inside the slab
    but near an edge exits through that edge so the hem can hang."""
    seat_a = CHAIR_BOXES[0][1]
    seat_b = CHAIR_BOXES[0][2]
    n = 0
    for i in np.flatnonzero(free):
        lx, ly, lz = blender_to_chair_local(P[i])
        inner = abs(lx) < (SEAT_HALF_W - 0.03) and -0.12 < lz < (SEAT_HALF_D - 0.04)
        if inner and ly < SEAT_TOP + MARGIN_CHAIR:
            P[i] = chair_local_to_blender(lx, SEAT_TOP + MARGIN_CHAIR, lz)
            n += 1
            continue
        if not in_box(lx, ly, lz, seat_a, seat_b, 0.0):
            continue
        cands = (
            (abs(lx - (seat_a[0] - MARGIN_CHAIR)), seat_a[0] - MARGIN_CHAIR, 'x'),
            (abs(lx - (seat_b[0] + MARGIN_CHAIR)), seat_b[0] + MARGIN_CHAIR, 'x'),
            (abs(lz - (seat_a[2] - MARGIN_CHAIR)), seat_a[2] - MARGIN_CHAIR, 'z'),
            (abs(lz - (seat_b[2] + MARGIN_CHAIR)), seat_b[2] + MARGIN_CHAIR, 'z'),
            (abs(ly - (SEAT_TOP + MARGIN_CHAIR)), SEAT_TOP + MARGIN_CHAIR, 'y'),
        )
        _d, plane, axis = min(cands, key=lambda t: t[0])
        if axis == 'x':
            lx = plane
        elif axis == 'z':
            lz = plane
        else:
            ly = plane
        P[i] = chair_local_to_blender(lx, ly, lz)
        n += 1
    return n

def _smooth01(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)

def skirt_surface(theta, h, scale_x=1.0, z_push=0.0, y_push=0.0):
    """Chair-local point on a single-sheet skirt. theta 0 is the front of the
    dress (bind-pose -Y). h 0 is the hem, h 1 is the waist. The sheet stays
    inside the armrests until it has dropped below them, hangs in front of the
    shins, and stops on the seat in front of the backrest."""
    s = math.sin(theta)
    c = math.cos(theta)
    wx = s * 0.125 * scale_x
    wz = -0.02 + c * 0.09 + z_push
    wy = 0.50 + y_push
    x_mid = s * 0.16 * scale_x
    z_mid = -0.05 + 0.42 * (0.5 + 0.5 * c) + z_push
    y_mid = 0.42 + 0.16 * max(c, 0.0) + y_push
    x_hem = s * (0.15 + 0.12 * (1.0 - c * c)) * scale_x
    z_hem = -0.12 + 0.78 * (0.5 + 0.5 * c) + z_push
    y_hem = 0.07 + (SEAT_TOP + 0.012 - 0.07) * max(-c, 0.0) + y_push
    if h < 0.45:
        t = _smooth01(h / 0.45)
        return (
            x_hem + (x_mid - x_hem) * t,
            y_hem + (y_mid - y_hem) * t,
            z_hem + (z_mid - z_hem) * t,
        )
    t = _smooth01((h - 0.45) / 0.55)
    return (
        x_mid + (wx - x_mid) * t,
        y_mid + (wy - y_mid) * t,
        z_mid + (wz - z_mid) * t,
    )

def fit_sheet(P, rest, edges, pin, scale_x=1.0, z_push=0.0, y_push=0.0, keep_waist=True):
    """Re-author every free vertex from bind-pose angle and height so the
    cloth stays one sheet. A thin ring next to the pinned waist keeps the
    posed seam."""
    free = np.flatnonzero(~pin)
    if len(free) < 3:
        return 0
    x = rest[free, 0]
    y = rest[free, 1]
    z = rest[free, 2]
    theta = np.arctan2(x, -y)
    z0, z1 = float(z.min()), float(z.max())
    h = (z - z0) / (z1 - z0 + 1e-8)
    designed = np.array([skirt_surface(float(theta[k]), float(h[k]), scale_x, z_push, y_push) for k in range(len(free))])
    world = np.array([chair_local_to_blender(*designed[k]) for k in range(len(free))])
    if keep_waist:
        e0, e1 = edges[:, 0], edges[:, 1]
        near = pin.copy()
        near[e1] |= pin[e0]
        near[e0] |= pin[e1]
        for k, i in enumerate(free):
            # Only the waistband ring keeps the posed seam. The posed hem
            # hangs through the chair, so it must not pull the sheet back.
            _lx, ly, _lz = blender_to_chair_local(P[i])
            if near[i] and ly > 0.48:
                world[k] = P[i] * 0.65 + world[k] * 0.35
    for k, i in enumerate(free):
        P[i] = world[k]
    print('  fit', len(free), 'theta', round(float(theta.min()), 2), round(float(theta.max()), 2),
          'h', round(z0, 3), round(z1, 3))
    return len(free)

def fit_apron_panel(P, rest, pin, dress_bvh=None, body_bvh=None, body_sign=1.0):
    """One analytic panel down the centre of the skirt, in the gap between the
    hands. Bind-pose width and height only — no ray cast, so the panel cannot
    fold onto a side normal."""
    free = np.flatnonzero(~pin)
    if len(free) < 3:
        return 0
    x = rest[free, 0]
    z = rest[free, 2]
    def unit(v):
        a, b = float(v.min()), float(v.max())
        return (v - a) / (b - a + 1e-8)
    s = unit(x) * 2.0 - 1.0
    u = unit(z)
    # (u, height, depth, half-width). Sitting folds the hip-weighted bib onto
    # the seat, so every apron vertex — including those pins — is re-authored.
    # Width stays inside the gap between the hands from y 0.42 to 0.70.
    keys = (
        (0.00, 0.14, 0.63, 0.12),
        (0.18, 0.30, 0.54, 0.10),
        (0.30, 0.40, 0.40, 0.055),
        (0.42, 0.52, 0.26, 0.022),
        (0.58, 0.64, 0.22, 0.030),
        (0.75, 0.70, 0.20, 0.082),
        (1.00, 0.74, 0.18, 0.088),
    )
    for k, i in enumerate(free):
        uu = float(u[k])
        y, zc, half = keys[-1][1], keys[-1][2], keys[-1][3]
        for a, bseg in zip(keys, keys[1:]):
            if uu <= bseg[0] + 1e-8:
                t = _smooth01((uu - a[0]) / (bseg[0] - a[0] + 1e-8))
                y = a[1] + (bseg[1] - a[1]) * t
                zc = a[2] + (bseg[2] - a[2]) * t
                half = a[3] + (bseg[3] - a[3]) * t
                break
        P[i] = chair_local_to_blender(float(s[k]) * half, y, zc)
    print('  apron panel', len(free))
    return len(free)

def tuck_bow(P, pin):
    """Sit the bow on the seat against the backrest. The posed tails fall
    through the opening under the seat."""
    n = 0
    for i in np.flatnonzero(~pin):
        lx, ly, lz = blender_to_chair_local(P[i])
        changed = False
        if ly < SEAT_TOP + 0.016:
            ly = SEAT_TOP + 0.016
            changed = True
        if lz < -0.145:
            lz = -0.145
            changed = True
        if changed:
            P[i] = chair_local_to_blender(lx, ly, lz)
            n += 1
    return n

def separate_chair(P, free, chair_bvh, margin):
    """Move cloth that touches the visual chair out along the direction away
    from the seat volume. Face normals on the unwelded chair are not reliable."""
    center = chair_local_to_blender(0.0, 0.36, 0.0)
    n = 0
    deep = 0.0
    for i in np.flatnonzero(free):
        p = Vector(P[i])
        hit = chair_bvh.find_nearest(p, margin + 0.01)
        if hit[0] is None:
            continue
        loc, _normal, _idx, dist = hit
        delta = p - loc
        if dist >= margin and delta.dot(loc - Vector(center)) >= 0:
            continue
        outward = loc - Vector(center)
        if outward.length < 1e-6:
            continue
        outward.normalize()
        P[i] = np.array(loc + outward * margin)
        n += 1
        deep = max(deep, margin - float(delta.dot(outward)))
    return n, deep

def sculpt(P, edges, pin, body_bvh, body_sign, chair_bvh, chair_sign, dress_bvh=None, lock=None):
    """Move only the vertices that penetrate. Leave the posed sheet alone otherwise."""
    e0, e1 = edges[:, 0], edges[:, 1]
    free = ~pin if lock is None else (~pin & ~lock)
    for _ in range(6):
        before = P.copy()
        lay_on_seat(P, free)
        push_boxes(P, free, MARGIN_CHAIR)
        block_back(P, free)
        push_bvh_sign(P, body_bvh, body_sign, MARGIN_BODY, free, 0.06)
        push_bvh_sign(P, chair_bvh, chair_sign, MARGIN_CHAIR, free, 0.06)
        if dress_bvh is not None:
            push_outside_layer(P, dress_bvh, body_bvh, free, MARGIN_DRESS, 0.06)
        push_floor(P, free, MARGIN_FLOOR)
        delta = np.linalg.norm(P - before, axis=1)
        ring = delta > 1e-4
        if not ring.any():
            break
        ring[e0] |= ring[e1]
        ring[e1] |= ring[e0]
        smooth_free(P, e0, e1, ~ring | pin, 0.4)
    return int((np.linalg.norm(P - before, axis=1) > 1e-4).sum()) if len(P) else 0

def push_outside_layer(P, layer_bvh, body_bvh, free, margin, search=0.08):
    """Move cloth to the side of `layer` that faces away from the body."""
    n = 0
    deep = 0.0
    for i in np.flatnonzero(free):
        p = Vector(P[i])
        hit = layer_bvh.find_nearest(p, search)
        if hit[0] is None:
            continue
        loc, normal, _idx, _dist = hit
        bh = body_bvh.find_nearest(loc, 0.45)
        if bh[0] is not None and (loc - bh[0]).dot(normal) < 0:
            normal = -normal
        signed = (p - loc).dot(normal)
        if signed < margin:
            P[i] = np.array(loc + normal * margin)
            n += 1
            deep = max(deep, margin - signed)
    return n, deep

def block_back(P, free):
    """Keep cloth in front of the slatted back. Local -Z is behind the sitter."""
    n = 0
    for i in np.flatnonzero(free):
        lx, ly, lz = blender_to_chair_local(P[i])
        if lz < -0.150 and abs(lx) < 0.28 and 0.28 < ly < 0.92:
            P[i] = chair_local_to_blender(lx, ly, -0.150)
            n += 1
    return n

def solve(P, edges, rest, pin, colliders, iters, smooth=0.5):
    # Shrink toward the bind-pose cloth length slowly. Smoothing stays stronger than
    # the shrink so the sheet cannot collapse into spikes.
    e0, e1 = edges[:, 0], edges[:, 1]
    report = []
    for it in range(iters):
        project_edges(P, e0, e1, rest, pin)
        smooth_free(P, e0, e1, pin, smooth)
        stats = {}
        for name, bvh, sign, margin, search in colliders:
            n, deep = push_bvh_sign(P, bvh, sign, margin, ~pin, search)
            stats[name] = (n, round(deep, 4))
        nb, db = push_boxes(P, ~pin, MARGIN_CHAIR)
        stats['boxes'] = (nb, round(db, 4))
        stats['back'] = block_back(P, ~pin)
        stats['floor'] = push_floor(P, ~pin, MARGIN_FLOOR)
        if it in (0, iters // 2, iters - 1):
            report.append({'iter': it, 'stats': {k: v for k, v in stats.items()}})
            print('  iter', it, stats)
    return report

def write_mesh(obj_name, me, P):
    for i, v in enumerate(me.vertices):
        v.co = P[i]
    me.update()
    ob = bpy.data.objects.new(obj_name, me)
    bpy.context.collection.objects.link(ob)
    return ob

# Collision proxies (chair-local metres). The seat box in the sidecar reaches the
# floor; only the wooden slab is solid. Legs come from the visual mesh.
CHAIR_BOXES = [
    ('seat', (-0.2473, 0.3411, -0.1908), (0.2473, 0.3800, 0.1908)),
    ('back', (-0.2473, 0.3800, -0.2738), (0.2473, 0.8920, -0.1608)),
    ('armL', (0.2373, 0.3800, -0.1908), (0.2823, 0.6100, 0.2208)),
    ('armR', (-0.2823, 0.3800, -0.1908), (-0.2373, 0.6100, 0.2208)),
]
# Visual fragments to keep: the solids above, plus the leg column under the seat.
CHAIR_KEEP = CHAIR_BOXES + [
    ('legs', (-0.28, 0.0, -0.30), (0.28, 0.3411, 0.22)),
]

def blender_to_chair_local(p):
    gx, gy, gz = p[0], p[2], -p[1]
    dx, dy, dz = gx - CHAIR_T[0], gy, gz - CHAIR_T[2]
    lx = dx * CHAIR_X[0] + dy * CHAIR_X[1] + dz * CHAIR_X[2]
    lz = dx * CHAIR_Z[0] + dy * CHAIR_Z[1] + dz * CHAIR_Z[2]
    return lx, dy, lz

def chair_local_to_blender(lx, ly, lz):
    wx = CHAIR_T[0] + lx * CHAIR_X[0] + lz * CHAIR_Z[0]
    wy = ly
    wz = CHAIR_T[2] + lx * CHAIR_X[2] + lz * CHAIR_Z[2]
    return np.array((wx, -wz, wy), dtype=np.float64)

def in_box(lx, ly, lz, a, b, pad=0.0):
    return (a[0] - pad) <= lx <= (b[0] + pad) and (a[1] - pad) <= ly <= (b[1] + pad) and (a[2] - pad) <= lz <= (b[2] + pad)

def push_boxes(P, free, margin):
    """Push points out of the seat slab, back and armrests. Returns (count, depth)."""
    n = 0
    deep = 0.0
    for i in np.flatnonzero(free):
        lx, ly, lz = blender_to_chair_local(P[i])
        for _name, a, b in CHAIR_BOXES:
            if not in_box(lx, ly, lz, a, b, 0.0):
                continue
            # nearest face of the expanded box
            faces = (
                (0, a[0] - margin, -1), (0, b[0] + margin, 1),
                (1, a[1] - margin, -1), (1, b[1] + margin, 1),
                (2, a[2] - margin, -1), (2, b[2] + margin, 1),
            )
            best = None
            pt = [lx, ly, lz]
            for axis, plane, _sign in faces:
                dist = abs(pt[axis] - plane)
                if best is None or dist < best[0]:
                    best = (dist, axis, plane)
            dist, axis, plane = best
            pt[axis] = plane
            P[i] = chair_local_to_blender(*pt)
            lx, ly, lz = pt
            n += 1
            deep = max(deep, dist)
    return n, deep

def extract_chair():
    props = bpy.data.objects['env_interior_props_merged']
    src = props.data
    keep = set()
    for v in src.vertices:
        lx, ly, lz = blender_to_chair_local(v.co)
        if any(in_box(lx, ly, lz, a, b, 0.025) for _n, a, b in CHAIR_KEEP):
            keep.add(v.index)
    faces = []
    used = set()
    for p in src.polygons:
        ids = [v for v in p.vertices if v in keep]
        if len(ids) == len(p.vertices):
            faces.append(tuple(p.vertices))
            used.update(p.vertices)
    old = sorted(used)
    mp = {old[i]: i for i in range(len(old))}
    me = bpy.data.meshes.new('reading_chair')
    me.from_pydata([src.vertices[i].co[:] for i in old], [], [tuple(mp[v] for v in f) for f in faces])
    me.update()
    ob = bpy.data.objects.new('reading_chair', me)
    bpy.context.collection.objects.link(ob)
    print('chair', len(me.vertices), 'verts', len(me.polygons), 'polys from', len(keep), 'candidates')
    return ob

def main():
    t0 = time.time()
    os.makedirs(os.path.dirname(QA_PATH), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CHAR)
    M = placement_matrix()
    parts = {}
    for name in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW'):
        obj = bpy.data.objects[name]
        edges, rest = rest_edges(obj)
        pin = dominant_group(obj, 'hips')
        # The bow's loops sit on skirt.back; keep the knot (hips) pinned.
        parts[name] = {'obj': obj, 'edges': edges, 'rest': rest, 'pin': pin,
                       'rest_co': np.array([v.co[:] for v in obj.data.vertices], dtype=np.float64)}
        print(name, 'verts', len(pin), 'pinned', int(pin.sum()), 'edges', len(edges))

    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    act = bpy.data.actions['sit_down']
    arm.animation_data_create()
    arm.animation_data.action = act
    arm.animation_data.action_slot = act.slots[0]
    end = int(round(act.frame_range[1]))
    bpy.context.scene.frame_set(end)
    bpy.context.view_layer.update()
    print('sit_down end frame', end)

    meshes = {}
    arrays = {}
    for name, info in parts.items():
        me = deformed_world(info['obj'], M)
        P = np.array([v.co[:] for v in me.vertices], dtype=np.float64)
        meshes[name] = me
        arrays[name] = P
        print(name, 'aabb', np.round(P.min(0), 3), np.round(P.max(0), 3))

    # Room chair, already in Blender Z-up (importer converted the game GLB).
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ROOM)
    chair = extract_chair()
    for o in list(bpy.data.objects):
        if o not in before and o is not chair and o.name != 'reading_chair':
            if o.type == 'MESH' and o.name != 'reading_chair':
                bpy.data.objects.remove(o, do_unlink=True)

    seat_probe = Vector(game_to_blender(CHAIR_T[0], SEAT_TOP + 0.12, CHAIR_T[2]))
    chair_bvh, chair_sign = orient_bvh(chair.data, seat_probe)
    print('chair normal sign', chair_sign, 'probe', [round(x, 3) for x in seat_probe])
    body_bvh, body_sign = orient_bvh(meshes['LOD0_G2_BODY'], Vector(arrays['LOD0_G2_BODY'].mean(0) + np.array([0, 0, 0.4])))
    # A point above the head must be outside the body.
    head = arrays['LOD0_G2_BODY'][np.argmax(arrays['LOD0_G2_BODY'][:, 2])]
    body_bvh, body_sign = orient_bvh(meshes['LOD0_G2_BODY'], Vector(head) + Vector((0, 0, 0.08)))
    print('body normal sign', body_sign)

    # Body vs chair boxes and the visual chair. Only move vertices that are actually
    # inside the wood, and only by a shallow amount so the face and hands stay put.
    bodyP = arrays['LOD0_G2_BODY']
    free_body = np.ones(len(bodyP), dtype=bool)
    n, deep = push_boxes(bodyP, free_body, 0.002)
    n2, deep2 = push_bvh_sign(bodyP, chair_bvh, chair_sign, 0.002, free_body, 0.025)
    print('body pushed out of chair boxes', n, round(deep, 4), 'mesh', n2, round(deep2, 4))
    for i, v in enumerate(meshes['LOD0_G2_BODY'].vertices):
        v.co = bodyP[i]
    meshes['LOD0_G2_BODY'].update()
    body_bvh = make_bvh(meshes['LOD0_G2_BODY'])

    coll_dress = [
        ('body', body_bvh, body_sign, MARGIN_BODY, 0.06),
        ('chair', chair_bvh, chair_sign, MARGIN_CHAIR, 0.08),
    ]
    def gmask(obj):
        names = ('skirt.front', 'skirt.front.low', 'skirt.back', 'skirt.back.low', 'skirt.left', 'skirt.left.low',
                 'skirt.right', 'skirt.right.low', 'skirt.front.mid', 'skirt.front.low.mid')
        return {n: (dominant_group(obj, n) if n in obj.vertex_groups else np.zeros(len(obj.data.vertices), dtype=bool)) for n in names}
    # One sheet from the bind pose. Side, front and back share the same
    # parameterisation so the triangles that join them stay a surface.
    print('fit dress sheet')
    dress_log = fit_sheet(arrays['LOD0_G2_DRESS'], parts['LOD0_G2_DRESS']['rest_co'],
                          parts['LOD0_G2_DRESS']['edges'], parts['LOD0_G2_DRESS']['pin'])
    for i, v in enumerate(meshes['LOD0_G2_DRESS'].vertices):
        v.co = arrays['LOD0_G2_DRESS'][i]
    meshes['LOD0_G2_DRESS'].update()
    bow_log = tuck_bow(arrays['LOD0_G2_BOW'], parts['LOD0_G2_BOW']['pin'])
    print('tuck bow', bow_log)
    # Dress only: push points that enter the body or the wood. The apron panel
    # is authored outside the hands, so a nearest-surface push would fold it
    # onto the fingers again.
    dress_free = ~parts['LOD0_G2_DRESS']['pin']
    P = arrays['LOD0_G2_DRESS']
    dress_moves = 0
    for _ in range(4):
        lay_on_seat(P, dress_free)
        push_boxes(P, dress_free, MARGIN_CHAIR)
        block_back(P, dress_free)
        n1, _d1 = push_bvh_sign(P, body_bvh, body_sign, MARGIN_BODY, dress_free, 0.05)
        n2, _d2 = push_bvh_sign(P, chair_bvh, chair_sign, MARGIN_CHAIR, dress_free, 0.05)
        push_floor(P, dress_free, MARGIN_FLOOR)
        dress_moves += n1 + n2
        if n1 + n2 == 0:
            break
    dress_log = dress_moves
    print('clear dress', dress_moves)
    for i, v in enumerate(meshes['LOD0_G2_DRESS'].vertices):
        v.co = arrays['LOD0_G2_DRESS'][i]
    meshes['LOD0_G2_DRESS'].update()
    dress_bvh = make_bvh(meshes['LOD0_G2_DRESS'])
    print('fit apron panel')
    apron_log = fit_apron_panel(arrays['LOD0_G2_APRON'], parts['LOD0_G2_APRON']['rest_co'],
                                np.zeros(len(arrays['LOD0_G2_APRON']), dtype=bool),
                                dress_bvh, body_bvh, body_sign)
    # Sagittal clearance in front of the body, so the apron panel can sit outside it.
    print('sagittal signed distance (y rows, z cols), mm, + is outside')
    ys = (0.70, 0.62, 0.55, 0.48, 0.40, 0.30, 0.18)
    zs = (0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65)
    for y in ys:
        row = []
        for z in zs:
            p = Vector(chair_local_to_blender(0.0, y, z))
            hit = body_bvh.find_nearest(p, 0.35)
            if hit[0] is None:
                row.append('  .')
                continue
            loc, normal, _i, _d = hit
            signed = (p - loc).dot(normal * body_sign) * 1000
            row.append(f'{signed:4.0f}')
        print(f'  y={y:.2f}', ' '.join(row))
    for name in ('LOD0_G2_APRON', 'LOD0_G2_BOW'):
        free = ~parts[name]['pin']
        push_boxes(arrays[name], free, MARGIN_CHAIR)
        block_back(arrays[name], free)
        push_floor(arrays[name], free, MARGIN_FLOOR)
        for i, v in enumerate(meshes[name].vertices):
            v.co = arrays[name][i]
        meshes[name].update()

    def audit(name, P, free):
        bc_n, bc_d = count_behind(P, chair_bvh if False else make_bvh(chair.data), free, 0.05)
        # recount with sign
        n_c = d_c = 0.0
        n_c = 0
        for i in np.flatnonzero(free):
            hit = chair_bvh.find_nearest(Vector(P[i]), 0.05)
            if hit[0] is None:
                continue
            loc, normal, _i, _d = hit
            signed = (Vector(P[i]) - loc).dot(normal * chair_sign)
            if signed < 0.0005:
                n_c += 1
                d_c = max(d_c, -signed)
        n_b = 0
        d_b = 0.0
        bvh = body_bvh if name != 'LOD0_G2_BODY' else None
        if bvh is not None:
            for i in np.flatnonzero(free):
                hit = bvh.find_nearest(Vector(P[i]), 0.05)
                if hit[0] is None:
                    continue
                loc, normal, _i, _d = hit
                signed = (Vector(P[i]) - loc).dot(normal * body_sign)
                if signed < 0.0005:
                    n_b += 1
                    d_b = max(d_b, -signed)
        floor_n = int((P[:, 2] < -0.0005).sum())
        return {
            'inside_chair': n_c, 'chair_depth_m': round(d_c, 5),
            'inside_body': n_b, 'body_depth_m': round(d_b, 5),
            'below_floor': floor_n,
            'aabb_min_blender': [round(x, 4) for x in P.min(0)],
            'aabb_max_blender': [round(x, 4) for x in P.max(0)],
        }

    dress_bvh = make_bvh(meshes['LOD0_G2_DRESS'])
    qa = {'parts': {}, 'dress_log': dress_log, 'apron_log': apron_log, 'bow_log': bow_log}
    for name in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW'):
        free = np.ones(len(arrays[name]), dtype=bool) if name == 'LOD0_G2_BODY' else ~parts[name]['pin']
        qa['parts'][name] = audit(name, arrays[name], np.ones(len(arrays[name]), dtype=bool))
        qa['parts'][name]['free'] = audit(name, arrays[name], free)
        print(name, 'all', qa['parts'][name]['inside_chair'], qa['parts'][name]['inside_body'],
              'free', qa['parts'][name]['free']['inside_chair'], qa['parts'][name]['free']['inside_body'],
              'free_chair_mm', round(qa['parts'][name]['free']['chair_depth_m'] * 1000, 2),
              'free_body_mm', round(qa['parts'][name]['free']['body_depth_m'] * 1000, 2))

    # Apron vs dress
    n_ad = 0
    d_ad = 0.0
    P = arrays['LOD0_G2_APRON']
    for i in range(len(P)):
        hit = dress_bvh.find_nearest(Vector(P[i]), 0.04)
        if hit[0] is None:
            continue
        loc, normal, _i, _d = hit
        bh = body_bvh.find_nearest(loc, 0.45)
        if bh[0] is not None and (loc - bh[0]).dot(normal) < 0:
            normal = -normal
        signed = (Vector(P[i]) - loc).dot(normal)
        if signed < 0.0005:
            n_ad += 1
            d_ad = max(d_ad, -signed)
    qa['apron_inside_dress'] = {'count': n_ad, 'depth_m': round(d_ad, 5)}
    print('apron inside dress', qa['apron_inside_dress'])

    # Drop the skinned originals and the armature before the static copies take their names.
    for o in list(bpy.data.objects):
        if o.type != 'MESH' or o.name != 'reading_chair':
            if o.name != 'reading_chair':
                bpy.data.objects.remove(o, do_unlink=True)
    keep_meshes = set(meshes.values())
    for me in list(bpy.data.meshes):
        if me.users == 0 and me not in keep_meshes:
            bpy.data.meshes.remove(me)
    exported = []
    for name in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW'):
        meshes[name].name = name
        ob = bpy.data.objects.new(name, meshes[name])
        bpy.context.collection.objects.link(ob)
        exported.append(ob)

    bpy.ops.object.select_all(action='DESELECT')
    for ob in exported:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = exported[0]
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_yup=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_image_format='NONE',
        export_texcoords=True,
        export_normals=True,
        export_vertex_color='ACTIVE',
    )
    qa['glb_bytes_with_material_names'] = os.path.getsize(OUT_GLB)
    qa['seconds'] = round(time.time() - t0, 2)
    qa['placement'] = {
        'seatedRoot': list(SEATED),
        'yawRad': YAW,
        'seatAnchor': [0.4203000068664551, 0.3799999952316284, -4.2133002281188965],
        'space': 'room world, Y-up metres, identity under scene_root',
        'pose': 'sit_down last frame, armature applied, then cloth drape',
    }
    with open(QA_PATH, 'w') as f:
        json.dump(qa, f, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath='/tmp/sitwork/preview.blend')
    print('WROTE', OUT_GLB, qa['glb_bytes_with_material_names'], 'in', qa['seconds'], 's')

if __name__ == '__main__':
    main()
