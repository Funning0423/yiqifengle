"""M5 A5.1 island candidate v2.2b (Voice Bot). Blender 4.5.14 headless:
    blender-4.5 -b --factory-startup -P scripts/build_island_v2_2b_candidate.py
Starts from a FRESH COPY of art/island/v2.2a/scene/env_scene_island_v2_2a.blend (v2.2a is never written).
Changes (everything else untouched, no node added / renamed / reparented):
  1. fence_segment_01 at glTF (-1.66, 1.30) inside env_island_props_merged: shortened at BOTH ends
     (far post glTF z 2.30 -> 1.95 to clear the girl route >= 0.5 m; near post glTF z 0.30 -> 0.58 so it no longer
     cuts into the hydrangea planter). Rails follow the posts; each post bottom is re-seated 2 cm below the lowest
     terrain point under its footprint (same rule as v2.0).
  2. Candidate exterior collision (separate file, same node names as v2.1 env_exterior_collision.glb):
     - col_ext_props_misc: fence hull moved with the posts.
     - col_ext_tower_wall: every slab's outer face pushed out to cover the rendered masonry (+2 cm margin, chord-corrected),
       plus one lintel slab over the door opening above the door-frame collider (z 2.712..3.25 m, above head height).
The v2.2a glb is re-exported unmodified first as a control (same exporter / kwargs) so byte differences can be attributed.
"""
import sys, os, json, math, shutil, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy, bmesh
from mathutils import Vector
from m5_common import *
from m5_bl import *

WORK = OUT + '/work'; os.makedirs(WORK, exist_ok=True)
CBLEND = OUT + '/candidate/scene/env_scene_island_v2_2b_candidate.blend'
CGLB = OUT + '/candidate/glb/env_scene_island_v2_2b_candidate.glb'
CCOL = OUT + '/candidate/collision/env_exterior_collision_v2_2b_candidate.glb'
CONTROL = WORK + '/control_v2_2a_reexport.glb'
REPORT = OUT + '/docs/build_report.json'
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()

# ---- parameters (Blender XY; glTF z = -Blender y)
FENCE_X = -1.66
FAR_OLD, FAR_NEW = -2.30, -1.95      # route side
NEAR_OLD, NEAR_NEW = -0.30, -0.58    # planter side
POST_EMBED = 0.02                    # post bottom = lowest terrain under the footprint - 2 cm (v2.0 rule)
TOWER_MARGIN = 0.02
LINTEL = dict(x=(-0.90, 0.90), y=(-0.12, 0.30), z=(2.712, 3.25))
COTTAGE_FOOT = (1.419, 4.763, -0.989, 2.997)   # x0,x1,y0,y1 (v2.1 COT footprint) - col_ext_cottage domain
DOORWAY = (-0.735, 0.735, 2.42)                 # walk-through opening |x|, top z (door leaf collider lives there)

KW = dict(export_format='GLB', use_selection=False, export_yup=True, export_apply=False,
          export_texcoords=True, export_normals=True, export_materials='EXPORT',
          export_vertex_color='MATERIAL', export_image_format='AUTO', export_extras=True,
          export_cameras=False, export_lights=False, export_animations=True,
          export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_skins=True,
          export_morph=True, export_morph_animation=True, export_optimize_animation_size=True,
          export_frame_step=1)
rep = {'tool': 'Blender %s' % bpy.app.version_string, 'baseline_blend': V22A_BLEND, 'baseline_blend_sha256': sha(V22A_BLEND),
       'baseline_glb_sha256': sha(V22A_GLB)}

# ---- 0. fresh copy + control re-export
shutil.copyfile(V22A_BLEND, CBLEND)
bpy.ops.wm.open_mainfile(filepath=CBLEND)
bpy.ops.export_scene.gltf(filepath=CONTROL, **KW)
rep['control_reexport'] = {'sha256': sha(CONTROL), 'byte_identical_to_v2_2a_glb': sha(CONTROL) == rep['baseline_glb_sha256'],
                           'size': os.path.getsize(CONTROL), 'v2_2a_size': os.path.getsize(V22A_GLB)}
bpy.ops.wm.open_mainfile(filepath=CBLEND)

# ---- 1. fence in env_island_props_merged
o = bpy.data.objects['env_island_props_merged']
assert o.matrix_world.is_identity if hasattr(o.matrix_world, 'is_identity') else True
me = o.data
V = [v.co.copy() for v in me.vertices]; F = [tuple(p.vertices) for p in me.polygons]
comps = components_vf(V, F)
fence = []
for vi, fi in comps:
    xs = [V[i].x for i in vi]; ys = [V[i].y for i in vi]
    if min(xs) > FENCE_X - 0.06 and max(xs) < FENCE_X + 0.06 and min(ys) > -2.40 and max(ys) < -0.20:
        fence.append(vi)
assert len(fence) == 6, 'expected 6 fence parts (2 posts, 2 caps, 2 rails), got %d' % len(fence)
gb = ground_bvh()
def post_info(vs):
    ys = [me.vertices[i].co.y for i in vs]; zs = [me.vertices[i].co.z for i in vs]
    return (min(ys) + max(ys)) / 2, min(zs), max(zs)
before_posts = []
for vs in fence:
    cy, z0, z1 = post_info(vs)
    if len(vs) == 8 and z0 < 0 and z1 > 0.8:   # post body
        before_posts.append({'centre_blender_xy': [FENCE_X, round(cy, 4)],
                             'bottom_corners': [[round(me.vertices[i].co.x, 4), round(me.vertices[i].co.y, 4), round(me.vertices[i].co.z, 4),
                                                 round(ground_z(gb, me.vertices[i].co.x, me.vertices[i].co.y), 4)] for i in vs if me.vertices[i].co.z < 0]})
moved = 0
for vs in fence:
    for i in vs:
        v = me.vertices[i]
        if v.co.y < -1.3: v.co.y += FAR_NEW - FAR_OLD
        else: v.co.y += NEAR_NEW - NEAR_OLD
        moved += 1
after_posts = []
for vs in fence:
    cy, z0, z1 = post_info(vs)
    if len(vs) == 8 and z0 < 0 and z1 > 0.8:
        bot = [i for i in vs if me.vertices[i].co.z < 0]
        gmin = min(ground_z(gb, me.vertices[i].co.x, me.vertices[i].co.y) for i in bot)
        for i in bot: me.vertices[i].co.z = gmin - POST_EMBED
        after_posts.append({'centre_blender_xy': [FENCE_X, round(cy, 4)], 'bottom_z': round(gmin - POST_EMBED, 4)})
me.update()
rep['fence'] = {'object': 'env_island_props_merged (static batch; fence is 6 loose parts inside it)', 'parts': [len(v) for v in fence],
                'vertices_moved': moved, 'far_post_y': [FAR_OLD, FAR_NEW], 'near_post_y': [NEAR_OLD, NEAR_NEW],
                'length_between_post_centres_m': [round(FAR_OLD * -1 - NEAR_OLD * -1, 3), round(-FAR_NEW + NEAR_NEW, 3)],
                'posts_before': before_posts, 'posts_after': after_posts}
bpy.ops.wm.save_as_mainfile(filepath=CBLEND)
bpy.ops.export_scene.gltf(filepath=CGLB, **KW)
rep['candidate_glb_sha256'] = sha(CGLB); rep['candidate_blend_sha256'] = sha(CBLEND)

# rendered tower verts for the collider fit (same blend; env_lighthouse_ext untouched)
L = bpy.data.objects['env_lighthouse_ext']; LV, LF = world_mesh(L)
TC = TOWER_C
body = []
for v in LV:
    if not (0.02 < v.z < 3.25): continue
    r = math.hypot(v.x - TC[0], v.y - TC[1])
    if r < 2.47 or r > 3.2: continue
    if COTTAGE_FOOT[0] <= v.x <= COTTAGE_FOOT[1] and COTTAGE_FOOT[2] <= v.y <= COTTAGE_FOOT[3]: continue
    if abs(v.x) < DOORWAY[1] and v.z < DOORWAY[2] and v.y > -0.2: continue
    body.append((r, math.atan2(v.y - TC[1], v.x - TC[0]), v.copy()))

# ---- 2. collision candidate (new empty file; v2.1 collision is only read)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=V21_COL)
names_before = sorted(o.name for o in bpy.data.objects)
# 2a fence hull
pm = bpy.data.objects['col_ext_props_misc']; n_f = 0
for v in pm.data.vertices:
    w = pm.matrix_world @ v.co
    if abs(w.x - FENCE_X) < 0.06 and -2.36 < w.y < -0.24:
        v.co.y += (FAR_NEW - FAR_OLD) if w.y < -1.3 else (NEAR_NEW - NEAR_OLD); n_f += 1
pm.data.update()
# 2b tower slabs
tw = bpy.data.objects['col_ext_tower_wall']; tme = tw.data
TV = [tw.matrix_world @ v.co for v in tme.vertices]; TF = [tuple(p.vertices) for p in tme.polygons]
slabs = []
for vi, fi in components_vf(TV, TF):
    rs = {i: math.hypot(TV[i].x - TC[0], TV[i].y - TC[1]) for i in vi}
    an = {i: math.atan2(TV[i].y - TC[1], TV[i].x - TC[0]) for i in vi}
    rmid = (min(rs.values()) + max(rs.values())) / 2
    outer = [i for i in vi if rs[i] > rmid]
    a0, a1 = min(an.values()), max(an.values())
    if a1 - a0 > math.pi:  # wraps +-180
        an = {i: (a if a > 0 else a + 2 * math.pi) for i, a in an.items()}; a0, a1 = min(an.values()), max(an.values())
    amid = (a0 + a1) / 2; half = (a1 - a0) / 2
    need = 0.0; worst = None
    for r, a, p in body:
        aa = a if not (a1 > math.pi and a < 0) else a + 2 * math.pi
        if a0 - 1e-4 <= aa <= a1 + 1e-4:
            proj = r * math.cos(aa - amid)
            if proj > need: need, worst = proj, (r, p)
    r_old = max(rs[i] for i in outer)
    chord_old = r_old * math.cos(half)
    chord_new = max(chord_old, need + TOWER_MARGIN)
    r_new = chord_new / math.cos(half)
    for i in outer:
        d = Vector((TV[i].x - TC[0], TV[i].y - TC[1], 0)).normalized()
        w = Vector((TC[0] + d.x * r_new, TC[1] + d.y * r_new, TV[i].z))
        tme.vertices[i].co = tw.matrix_world.inverted() @ w
    slabs.append({'angle_deg': [round(math.degrees(a0), 2), round(math.degrees(a1), 2)],
                  'outer_corner_r_m': [round(r_old, 4), round(r_new, 4)], 'outer_face_min_r_m': [round(chord_old, 4), round(chord_new, 4)],
                  'rendered_max_r_in_span_m': round(worst[0], 4) if worst else None,
                  'rendered_max_at_blender': [round(c, 3) for c in worst[1]] if worst else None})
# 2c lintel over the door opening (same object, one more closed box)
bm = bmesh.new(); bm.from_mesh(tme)
x0, x1 = LINTEL['x']; y0, y1 = LINTEL['y']; z0, z1 = LINTEL['z']
inv = tw.matrix_world.inverted()
corners = [bm.verts.new(inv @ Vector((x, y, z))) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
c = lambda i, j, k: corners[i * 4 + j * 2 + k]
for q in [(c(0,0,0), c(0,0,1), c(0,1,1), c(0,1,0)), (c(1,0,0), c(1,1,0), c(1,1,1), c(1,0,1)),
          (c(0,0,0), c(1,0,0), c(1,0,1), c(0,0,1)), (c(0,1,0), c(0,1,1), c(1,1,1), c(1,1,0)),
          (c(0,0,0), c(0,1,0), c(1,1,0), c(1,0,0)), (c(0,0,1), c(1,0,1), c(1,1,1), c(0,1,1))]:
    bm.faces.new(q)
bmesh.ops.triangulate(bm, faces=bm.faces[:]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.to_mesh(tme); bm.free(); tme.update()
tw['notes'] = (str(tw.get('notes', '')) + ' | v2.2b candidate (Voice Bot, M5 A5.1): each slab outer face pushed out to cover the rendered '
               'masonry of env_lighthouse_ext v2.2a (+%.2f m, chord-corrected); + 1 lintel box over the door opening z %.3f-%.2f m.' % (TOWER_MARGIN, z0, z1))
pm['notes'] = (str(pm.get('notes', '')) + ' | v2.2b candidate: fence_segment_01 (-1.66, z 0.58..1.95 glTF) shortened with the visual fence.')
assert sorted(o.name for o in bpy.data.objects) == names_before
bpy.ops.export_scene.gltf(filepath=CCOL, export_format='GLB', use_selection=False, export_yup=True, export_apply=False,
                          export_materials='NONE', export_extras=True, export_normals=True, export_texcoords=False,
                          export_animations=False, export_cameras=False, export_lights=False)
rep['collision'] = {'source': V21_COL, 'source_sha256': sha(V21_COL), 'candidate': CCOL, 'candidate_sha256': sha(CCOL),
                    'fence_hull_vertices_moved': n_f, 'tower_slabs': slabs, 'lintel_box': LINTEL, 'tower_margin_m': TOWER_MARGIN,
                    'node_names': names_before}
json.dump(rep, open(REPORT, 'w'), indent=1, ensure_ascii=False)
print('BUILD_V2_2B_CANDIDATE_OK', json.dumps({k: rep[k] for k in ('control_reexport', 'candidate_glb_sha256')}, indent=1))
