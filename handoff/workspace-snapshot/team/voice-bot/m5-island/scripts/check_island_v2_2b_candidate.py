"""M5 A5.1 checks: v2.2a (before) vs v2.2b candidate (after). Read-only. Blender 4.5.14:
    blender-4.5 -b --factory-startup -P scripts/check_island_v2_2b_candidate.py
Writes docs/check_report.json. Exit status in the JSON ('status': passed/failed) + printed CHECK_STATUS line.
"""
import sys, os, json, math, subprocess, struct, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from m5_common import *
from m5_bl import *

CBLEND = OUT + '/candidate/scene/env_scene_island_v2_2b_candidate.blend'
CGLB = OUT + '/candidate/glb/env_scene_island_v2_2b_candidate.glb'
CCOL = OUT + '/candidate/collision/env_exterior_collision_v2_2b_candidate.glb'
REPORT = OUT + '/docs/check_report.json'
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
FENCE_X = -1.66
COTTAGE_FOOT = (1.419, 4.763, -0.989, 2.997); DOORWAY = (0.735, 2.42)
R = {}
ok = {}
gp = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)] if len(p) == 3 else [round(p[0], 4), round(-p[1], 4)]  # Blender -> glTF (x,y,z) or (x,z)

def scene_state(blend):
    bpy.ops.wm.open_mainfile(filepath=blend)
    st = {}
    o = bpy.data.objects['env_island_props_merged']; V, F = world_mesh(o)
    comps = components_vf(V, F)
    fence = [(vi, fi) for vi, fi in comps if min(V[i].x for i in vi) > FENCE_X - 0.06 and max(V[i].x for i in vi) < FENCE_X + 0.06
             and min(V[i].y for i in vi) > -2.40 and max(V[i].y for i in vi) < -0.20]
    gb = ground_bvh()
    posts = []
    for vi, fi in fence:
        zs = [V[i].z for i in vi]
        if len(vi) == 8 and min(zs) < 0 and max(zs) > 0.8:
            bot = [V[i] for i in vi if V[i].z < 0.0]
            cy = sum(V[i].y for i in vi) / len(vi)
            corners = []
            for b in bot:
                g = ground_z(gb, b.x, b.y)
                corners.append({'corner_gltf_xz': gp((b.x, b.y)), 'post_bottom_y': round(b.z, 4), 'terrain_y': round(g, 4), 'gap_m': round(b.z - g, 4)})
            # also sample the terrain along the 4 bottom edges (10 steps) - the post must stay below it everywhere (no visible gap)
            xs = [b.x for b in bot]; ys = [b.y for b in bot]
            edge_g = [ground_z(gb, x, y) for x in np.linspace(min(xs), max(xs), 11) for y in (min(ys), max(ys))] + \
                     [ground_z(gb, x, y) for y in np.linspace(min(ys), max(ys), 11) for x in (min(xs), max(xs))]
            zb = bot[0].z
            posts.append({'centre_gltf_xz': gp((FENCE_X, cy)), 'top_y': round(max(zs), 4), 'corners': corners,
                          'max_gap_along_edges_m': round(max(zb - g for g in edge_g), 4), 'max_embed_along_edges_m': round(max(g - zb for g in edge_g), 4)})
    st['posts'] = sorted(posts, key=lambda p: p['centre_gltf_xz'][1])
    fv = [V[i] for vi, fi in fence for i in vi]
    st['fence_visual_hull_gltf_xz'] = [gp(p) for p in hull2d([(v.x, v.y) for v in fv])]
    st['fence_parts'] = len(fence)
    # interpenetration fence parts vs neighbours
    lo = Vector((-2.4, -3.0, -0.5)); hi = Vector((-0.9, 0.5, 1.5))
    inb = lambda p: all(lo[i] <= p[i] <= hi[i] for i in range(3))
    fset = set(i for vi, fi in fence for i in vi)
    groups = []
    for k, (vi, fi) in enumerate(comps):
        if vi[0] in fset: continue
        if any(inb(V[i]) for i in vi): groups.append(('env_island_props_merged part#%d' % k, [F[j] for j in fi], V))
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or ob is o or ob.name.startswith('col_') or ob.name.startswith('ref_girl'): continue
        VV, FF = world_mesh(ob); sel = [f for f in FF if any(inb(VV[i]) for i in f)]
        if sel: groups.append((ob.name, sel, VV))
    pen = []
    for n, (vi, fi) in enumerate(fence):
        bf = BVHTree.FromPolygons(V, [F[j] for j in fi])
        zs = [V[i].z for i in vi]; ys = [V[i].y for i in vi]
        kind = 'post' if len(vi) == 8 and min(zs) < 0 else ('cap' if len(vi) == 12 else 'rail')
        for gname, gf, gv in groups:
            ovl = bf.overlap(BVHTree.FromPolygons(gv, gf))
            if ovl:
                pen.append({'fence_part': '%s gltf z %.2f..%.2f' % (kind, -max(ys), -min(ys)), 'with': gname, 'tri_pairs': len(ovl),
                            'expected': gname == 'env_island_main' and kind == 'post'})
    st['fence_interpenetration'] = pen
    # z-fighting scan: vertical rays on a 2 cm grid around the fence through every rendered surface
    surf = []
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or ob.name.startswith('col_') or ob.name.startswith('ref_girl') or ob.hide_render: continue
        if ob.name in ('env_sky_dome', 'env_cloud_layer', 'env_night_stars', 'env_night_moon', 'env_sea_surface'): continue
        VV, FF = world_mesh(ob); sel = [f for f in FF if any(-2.6 <= VV[i].x <= -0.7 and -3.0 <= VV[i].y <= 0.5 for i in f)]
        if sel: surf.append((ob.name, BVHTree.FromPolygons(VV, sel)))
    zf = []; nray = 0
    for x in np.arange(-2.5, -0.8, 0.02):
        for y in np.arange(-2.9, 0.4, 0.02):
            hits = []
            for name, b in surf:
                org = Vector((x, y, 3.0))
                for _ in range(12):
                    h = b.ray_cast(org, Vector((0, 0, -1)), 6.0)
                    if h[0] is None: break
                    hits.append((h[0].z, name, h[2], h[1]))
                    org = h[0] + Vector((0, 0, -1e-4))
            nray += 1
            hits.sort(key=lambda t: -t[0])
            for a, b in zip(hits, hits[1:]):
                if (a[1], a[2]) != (b[1], b[2]) and abs(a[0] - b[0]) < 0.002 and abs(a[3].dot(b[3])) > 0.995:
                    zf.append({'gltf_xz': gp((float(x), float(y))), 'y': round(a[0], 4), 'surfaces': sorted([a[1], b[1]]), 'dz_mm': round(abs(a[0] - b[0]) * 1000, 3)})
    st['zfight_scan'] = {'rays': nray, 'grid_m': 0.02, 'area_gltf_x': [-2.5, -0.8], 'area_gltf_z': [-0.4, 2.9],
                         'coplanar_pairs_lt_2mm': len(zf), 'samples': zf[:20],
                         'pairs_by_surface': {}}
    for z in zf:
        k = ' x '.join(z['surfaces']); st['zfight_scan']['pairs_by_surface'][k] = st['zfight_scan']['pairs_by_surface'].get(k, 0) + 1
    # tower rendered verts (body band)
    L = bpy.data.objects['env_lighthouse_ext']; LV, LF = world_mesh(L)
    body = []
    for v in LV:
        if not (0.02 < v.z < 3.25): continue
        r = math.hypot(v.x - TOWER_C[0], v.y - TOWER_C[1])
        if r < 2.47 or r > 3.2: continue
        if COTTAGE_FOOT[0] <= v.x <= COTTAGE_FOOT[1] and COTTAGE_FOOT[2] <= v.y <= COTTAGE_FOOT[3]: continue
        if abs(v.x) < DOORWAY[0] and v.z < DOORWAY[1] and v.y > -0.2: continue
        body.append(tuple(v))
    st['tower_body_verts'] = body
    st['tower_rendered_r'] = {'max': round(max(math.hypot(p[0] - TOWER_C[0], p[1] - TOWER_C[1]) for p in body), 4),
                              'median': round(float(np.median([math.hypot(p[0] - TOWER_C[0], p[1] - TOWER_C[1]) for p in body])), 4)}
    # anchors / door
    st['int_cols'] = {}
    for n in ('col_int_door_frame', 'col_int_walls'):
        VV, FF = world_mesh(bpy.data.objects[n]); st['int_cols'][n] = (VV, FF)
    st['anchors'] = {ob.name: (tuple(ob.matrix_world.translation), node_path(ob)) for ob in bpy.data.objects if ob.type == 'EMPTY'}
    st['blend_objects'] = sorted((ob.name, node_path(ob), ob.type) for ob in bpy.data.objects)
    return st

def col_state(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path); bpy.ops.import_scene.gltf(filepath=V21_COLX)
    c = {}
    for ob in bpy.data.objects:
        if ob.type == 'MESH': c[ob.name] = world_mesh(ob)
    return c

before = scene_state(V22A_BLEND); after = scene_state(CBLEND)
colB = col_state(V21_COL); colA = col_state(CCOL)

# ---------- 1 posts on the ground
POST_MAX_EMBED = 0.035
def posts_ok(st):
    return all(p['max_gap_along_edges_m'] < 0 and p['max_embed_along_edges_m'] <= POST_MAX_EMBED for p in st['posts'])
R['fence_posts_on_ground'] = {'rule': 'post bottom below the terrain at every corner and along every bottom edge (gap < 0 = no floating), '
                              'deepest embed <= %.3f m (no visible sinking). gap_m = post bottom - terrain (negative = embedded)' % POST_MAX_EMBED,
                              'before': before['posts'], 'after': after['posts']}
ok['fence_posts_on_ground'] = posts_ok(after)

# ---------- 2 fence clearance along the full route (dense 2 cm) to the collision hull AND the rendered fence
routes = routes_2d()
def anchors_poly(st, pre):
    pts = sorted(((n, p) for n, (p, path) in st['anchors'].items() if n.startswith(pre + '_') and n[len(pre) + 1:].isdigit()), key=lambda t: t[0])
    return [(p[0], p[1]) for n, p in pts]
routes['v2_2a_anchor_exit_path_00_17'] = anchors_poly(after, 'exit_path')
routes['v2_2a_anchor_return_path_00_15'] = anchors_poly(after, 'return_path')
def fence_hull_from_col(c):
    V, F = c['col_ext_props_misc']
    pts = [(v.x, v.y) for v in V if abs(v.x - FENCE_X) < 0.06 and -2.40 < v.y < -0.2]
    return hull2d(pts)
def clear_table(H):
    t = min_clear(routes, H)
    return {k: {'min_m': round(d, 3), 'at_gltf_xz': gp(p) if p else None} for k, (d, p) in t.items()}
fhB = fence_hull_from_col(colB); fhA = fence_hull_from_col(colA)
vB = [(p[0], -p[1]) for p in before['fence_visual_hull_gltf_xz']]; vA = [(p[0], -p[1]) for p in after['fence_visual_hull_gltf_xz']]
R['fence_route_clearance'] = {
    'requirement_m': 0.5, 'sampling': 'every 2 cm along each route polyline, outdoor part only (glTF z > +0.12)',
    'routes': {k: len(v) for k, v in routes.items()},
    'collision_hull_gltf_xz': {'before': [gp(p) for p in fhB], 'after': [gp(p) for p in fhA]},
    'visual_hull_gltf_xz': {'before': before['fence_visual_hull_gltf_xz'], 'after': after['fence_visual_hull_gltf_xz']},
    'to_collision_hull': {'before': clear_table(fhB), 'after': clear_table(fhA)},
    'to_visual_fence': {'before': clear_table(vB), 'after': clear_table(vA)}}
mins = lambda t: min(v['min_m'] for v in t.values())
R['fence_route_clearance']['summary_min_m'] = {k: {'before': mins(R['fence_route_clearance'][k]['before']), 'after': mins(R['fence_route_clearance'][k]['after'])}
                                               for k in ('to_collision_hull', 'to_visual_fence')}
ok['fence_clearance_ge_0_5'] = all(v['after'] >= 0.5 for v in R['fence_route_clearance']['summary_min_m'].values())
R['fence_interpenetration'] = {'before': before['fence_interpenetration'], 'after': after['fence_interpenetration'],
                               'note': 'post x env_island_main = the 2 cm footing (expected). Anything else is a real intersection.'}
ok['fence_no_interpenetration'] = all(p['expected'] for p in after['fence_interpenetration'])
R['fence_zfight_scan'] = {'before': before['zfight_scan'], 'after': after['zfight_scan']}
ok['fence_area_no_new_coplanar'] = after['zfight_scan']['coplanar_pairs_lt_2mm'] <= before['zfight_scan']['coplanar_pairs_lt_2mm']

# ---------- 3 tower collision >= rendered
def coverage(c, st):
    names = ['col_ext_tower_wall', 'col_ext_cottage']
    T = [tri_array(*c[n]) for n in names] + [tri_array(*st['int_cols'][n]) for n in st['int_cols']]
    bvhs = [BVHTree.FromPolygons(*c[n]) for n in names] + [BVHTree.FromPolygons(*st['int_cols'][n]) for n in st['int_cols']]
    P = st['tower_body_verts']; cov = np.zeros(len(P), bool)
    for t in T: cov |= np.abs(winding(P, t)) > 0.5
    unc = []
    for i in np.where(~cov)[0]:
        p = Vector(P[i]); d = min((b.find_nearest(p)[3] for b in bvhs if b.find_nearest(p)[0] is not None), default=9)
        if d > 0.003: unc.append((d, P[i]))
    unc.sort(reverse=True)
    V, F = c['col_ext_tower_wall']
    rs = [math.hypot(v.x - TOWER_C[0], v.y - TOWER_C[1]) for v in V if v.z < 3.2 or True]
    return {'rendered_verts_checked': len(P), 'not_inside_collision': len(unc), 'worst_outside_by_m': round(unc[0][0], 4) if unc else 0.0,
            'worst_at_gltf': gp(unc[0][1]) if unc else None, 'collider_corner_r_max': round(max(rs), 4)}
R['tower_collision_vs_rendered'] = {
    'rendered_tower_r_m (z 0.02-3.25, cottage footprint + doorway excluded)': after['tower_rendered_r'],
    'tower_axis_gltf_xz': gp(TOWER_C),
    'rule': 'every rendered tower vertex in the body band must be inside col_ext_tower_wall / col_ext_cottage / col_int_door_frame / col_int_walls (3 mm tolerance)',
    'before_v2_1_collision': coverage(colB, before), 'after_candidate_collision': coverage(colA, after)}
ok['tower_collision_ge_rendered'] = R['tower_collision_vs_rendered']['after_candidate_collision']['not_inside_collision'] == 0

# ---------- 4 route / door / anchors vs ALL exterior blockers
BLOCK = ['col_ext_tower_wall', 'col_ext_cottage', 'col_ext_trees', 'col_ext_rocks', 'col_ext_props_misc', 'col_ext_palm_trunks']
def hulls(c):
    H = []
    for n in BLOCK:
        V, F = c[n]
        for vi, fi in components_vf(V, F):
            if max(V[i].z for i in vi) < -0.6: continue
            H.append((n, hull2d([(V[i].x, V[i].y) for i in vi]), [V[i] for i in vi]))
    return H
def route_block(c):
    H = hulls(c); out = {}
    for k, poly in routes.items():
        best = (9e9, None, None)
        for p in densify(poly, 0.02):
            if p[1] >= -0.12: continue
            for n, h, _ in H:
                d = pt_poly_d(p, h)
                if d < best[0]: best = (d, n, p)
        out[k] = {'min_m': round(best[0], 3), 'nearest': best[1], 'at_gltf_xz': gp(best[2])}
    HX, DW = 0.72022, 1.44044
    swing = set()
    for n, h, vs in H:
        for v in vs:
            if v.z > 2.45: continue
            dx, dz = v.x - HX, -v.y
            if math.hypot(dx, dz) > DW + 0.05 or dz < -0.01: continue
            ang = math.degrees(math.atan2(dz, -dx))
            if -1 <= ang <= 106: swing.add(n)
    anc = {}
    for name, (p, path) in after['anchors'].items():
        if p[1] >= -0.12 or abs(p[2]) > 0.2: continue   # outdoor ground anchors only
        d = min(pt_poly_d((p[0], p[1]), h) for n, h, _ in H)
        anc[name] = round(d, 3)
    return {'routes': out, 'door_swing_sector_blockers': sorted(swing), 'outdoor_anchor_min_clearance_m': anc}
R['route_door_anchor_vs_all_blockers'] = {'before': route_block(colB), 'after': route_block(colA),
    'note': '2D hull distance (body radius NOT subtracted), same method as v2.1 check_exterior_collision.py; tower = slabs (door gap open), lintel is above head height'}
a = R['route_door_anchor_vs_all_blockers']['after']
ok['door_swing_free'] = not a['door_swing_sector_blockers']
ok['routes_not_blocked'] = all(v['min_m'] > 0.30 for v in a['routes'].values())
ok['anchors_not_inside_blockers'] = all(v > 0.0 for v in a['outdoor_anchor_min_clearance_m'].values())

# ---------- 5 node / anchor set unchanged (blend + glb)
def glb_json(p):
    b = open(p, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; return json.loads(b[20:20 + n])
def glb_nodes(p):
    j = glb_json(p); par = {}
    for i, nd in enumerate(j['nodes']):
        for ch in nd.get('children', []): par[ch] = i
    def path(i):
        s = [j['nodes'][i].get('name')]
        while i in par: i = par[i]; s.append(j['nodes'][i].get('name'))
        return '/'.join(reversed(s))
    return {path(i): {k: nd.get(k) for k in ('translation', 'rotation', 'scale', 'mesh', 'skin', 'extras')} for i, nd in enumerate(j['nodes'])}, j
nB, jB = glb_nodes(V22A_GLB); nA, jA = glb_nodes(CGLB)
diff_nodes = [k for k in set(nB) | set(nA) if nB.get(k) != nA.get(k)]
acc_diff = [i for i, (x, y) in enumerate(zip(jB['accessors'], jA['accessors'])) if x != y]
mesh_of_acc = {}
for mi, m in enumerate(jA['meshes']):
    for pr in m['primitives']:
        for v in list(pr['attributes'].values()) + [pr.get('indices')]: mesh_of_acc[v] = m['name']
R['node_anchor_set'] = {
    'blend_objects_identical (name, path, type)': before['blend_objects'] == after['blend_objects'],
    'blend_empty_world_positions_identical': all(before['anchors'][k] == after['anchors'][k] for k in before['anchors']),
    'glb_node_paths_identical': sorted(nB) == sorted(nA), 'glb_nodes': len(nA),
    'glb_nodes_with_any_difference (TRS/mesh/skin/extras)': diff_nodes,
    'glb_meshes_materials_images_counts': [(len(jB[k]), len(jA[k])) for k in ('meshes', 'materials', 'images', 'animations')],
    'glb_accessors_changed': [{'accessor': i, 'mesh': mesh_of_acc.get(i), 'min': jA['accessors'][i].get('min'), 'max': jA['accessors'][i].get('max')} for i in acc_diff],
    'glb_materials_identical': jB['materials'] == jA['materials']}
ok['anchor_ids_unchanged'] = (R['node_anchor_set']['blend_objects_identical (name, path, type)'] and R['node_anchor_set']['glb_node_paths_identical']
                              and not diff_nodes and R['node_anchor_set']['blend_empty_world_positions_identical'])

# ---------- 6 glTF validator
def validate(p):
    r = subprocess.run(['node', HERE + '/gltf_validate.js', p], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {'error': r.stderr[-500:]}
R['gltf_validator'] = {'v2_2a': validate(V22A_GLB), 'candidate_scene': validate(CGLB), 'candidate_collision': validate(CCOL), 'v2_1_collision': validate(V21_COL)}
ok['glb_validates'] = all(R['gltf_validator'][k].get('errors', 1) == 0 for k in ('candidate_scene', 'candidate_collision'))

R['files'] = {p: sha(p) for p in (CBLEND, CGLB, CCOL)}
R['checks'] = ok; R['status'] = 'passed' if all(ok.values()) else 'failed'
for st in (before, after):
    for k in ('tower_body_verts', 'int_cols', 'anchors', 'blend_objects'): st.pop(k, None)
json.dump(R, open(REPORT, 'w'), indent=1, ensure_ascii=False, default=str)
print('CHECKS', json.dumps(ok, indent=1)); print('CHECK_STATUS', R['status'])
