"""Generic region exporter for 《咦 起风了》 (run inside headless Blender).

  blender -b REGION.blend --python art/tools/export_region.py -- \
      --models ../models --out ../scene_X_transforms.json [options]

Writes ONLY the instances that actually render in the final image:
  * object type MESH, not hide_render, not hide_viewport, visible_camera on,
    not hidden in the active view layer (hide_get);
  * at least one of its collection paths is fully enabled: no LayerCollection on the path is
    excluded / hide_viewport, no Collection on the path has hide_render / hide_viewport;
  * not inside a template collection (default: ASSETS) and not a template by name
    (object name == GLB basename exactly; real placements are always suffixed, e.g. _i, _i.001);
  * GLB not in the excluded list (default: *_board_frame.glb) and not present in models/_deprecated
    or models/_excluded.
Template meshes stay separate GLB assets (models/*.glb, referenced by `glb`). With --export-glb-dir the
template objects of the ASSETS collection are (re)exported one GLB each with identity transform.
Paths are relative to the .blend directory unless absolute. Prints EXPORT_OK and a JSON summary.
"""
import bpy, json, struct, os, re, sys, math, argparse
from collections import Counter
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--models', required=True, help='dir with the template GLBs')
ap.add_argument('--out', required=True, help='transforms json path')
ap.add_argument('--meta', default=None, help='optional meta json (glb table, tris, camera, lights, dropped objects)')
ap.add_argument('--template-collections', default='ASSETS')
ap.add_argument('--board-collections', default='WATER_BOARD,FX_WATER')
ap.add_argument('--skip-name-prefix', default='FX_fog', help='comma list; volumes / helpers that are not meshes in game')
ap.add_argument('--exclude-glb', default='LK_board_frame.glb', help='comma list of GLB basenames never placed')
ap.add_argument('--camera', default='CAM_board')
ap.add_argument('--source-label', default=None)
ap.add_argument('--note', default='')
ap.add_argument('--export-glb-dir', default=None, help='also export each template object as its own GLB here')
A = ap.parse_args(argv)
P = lambda p: p if os.path.isabs(p) else os.path.normpath(os.path.join(bpy.path.abspath('//'), p))
MOD = P(A.models); sc = bpy.context.scene; vl = bpy.context.view_layer
TPL = set(filter(None, A.template_collections.split(',')))
BOARD = set(filter(None, A.board_collections.split(',')))
SKIPP = tuple(filter(None, A.skip_name_prefix.split(',')))
EXCL = set(filter(None, A.exclude_glb.split(',')))
for sub in ('_deprecated', '_excluded'):
    d = os.path.join(MOD, sub)
    if os.path.isdir(d): EXCL |= {f for f in os.listdir(d) if f.endswith('.glb')}

def glbinfo(p):
    b = open(p, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); t = 0
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            if pr.get('mode', 4) == 4:
                a = j['accessors'][pr['indices']] if 'indices' in pr else j['accessors'][pr['attributes']['POSITION']]
                t += a['count'] // 3
    return t, len(b), sum(len(m['primitives']) for m in j.get('meshes', []))

G = {f[:-4]: glbinfo(os.path.join(MOD, f)) for f in sorted(os.listdir(MOD)) if f.endswith('.glb')}
def key(o):
    for nm in (o.data.name, re.sub(r'\.\d+$', '', o.data.name), re.sub(r'\.\d+$', '', o.name)):
        if nm in G: return nm
    c = [g for g in G if o.data.name.startswith(g) or o.name.startswith(g)]
    return max(c, key=len) if c else None

# ---- collection visibility -----------------------------------------------------------------
def lc_paths(lc, path=()):
    path = path + (lc,); yield path
    for ch in lc.children: yield from lc_paths(ch, path)
coll_paths = {}
for path in lc_paths(vl.layer_collection):
    coll_paths.setdefault(path[-1].collection.name, []).append(path)
def path_ok(path):
    for lc in path[1:]:  # [0] = scene master collection
        if lc.exclude or lc.hide_viewport or lc.collection.hide_render or lc.collection.hide_viewport: return False
    return True
def in_template(o):
    return any(o.name in bpy.data.collections[c].all_objects for c in TPL if c in bpy.data.collections)
def coll_visible(o):
    for c in o.users_collection:
        if c == sc.collection: return True
        if any(path_ok(p) for p in coll_paths.get(c.name, [])): return True
    return False

yup = lambda v: [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]
qy = lambda q: [round(q.x, 5), round(q.z, 5), round(-q.y, 5), round(q.w, 5)]
exported = []
inst = []; cnt = Counter(); tri = Counter(); dropped = Counter(); dropped_names = {}; warn = []
def drop(o, why):
    dropped[why] += 1; dropped_names.setdefault(why, []).append(o.name)
for o in sc.objects:
    if o.type != 'MESH': continue
    if o.name.startswith(SKIPP): drop(o, 'helper_prefix'); continue
    if in_template(o): drop(o, 'template_collection'); continue
    if o.hide_render: drop(o, 'hide_render'); continue
    if not coll_visible(o): drop(o, 'collection_hidden_or_excluded'); continue
    try: eye = o.hide_get(view_layer=vl)
    except RuntimeError: eye = True
    if o.hide_viewport or eye:
        drop(o, 'hide_viewport'); warn.append(o.name); continue
    if not o.visible_camera: drop(o, 'not_visible_camera'); continue
    k = key(o)
    if k is None: drop(o, 'no_glb'); continue
    if k + '.glb' in EXCL: drop(o, 'excluded_glb:' + k); continue
    if o.name == k: drop(o, 'template_name'); continue
    board = any(c.name in BOARD for c in o.users_collection)
    l, r, s = o.matrix_world.decompose()
    inst.append(dict(name=o.name, glb=k + '.glb', group='board' if board else 'bg', pos=yup(l), rot_quat_xyzw=qy(r),
                     scale=[round(s[0], 4), round(s[2], 4), round(s[1], 4)],
                     animated=bool(o.animation_data and o.animation_data.action)))
    cnt[k] += 1; tri['board' if board else 'bg'] += G[k][0]

c = bpy.data.objects.get(A.camera); cam = None; boardCamera = None
if c:
    l, r, _ = c.matrix_world.decompose(); fy = c.data.sensor_width / 2 / c.data.lens
    cam = dict(pos=yup(l), rot_quat_xyzw=qy(r), forward_yup=yup(r @ Vector((0, 0, -1))), lens_mm=c.data.lens,
               sensor_w=c.data.sensor_width, sensor_fit=c.data.sensor_fit, fov_vertical_deg=round(math.degrees(2 * math.atan(fy)), 3),
               clip=[c.data.clip_start, c.data.clip_end], res=[sc.render.resolution_x, sc.render.resolution_y])
    boardCamera = dict(position=cam['pos'], rotationXYZW=cam['rot_quat_xyzw'], fovVerticalDeg=cam['fov_vertical_deg'],
                       near=round(c.data.clip_start, 4), far=round(c.data.clip_end, 4))
src = A.source_label or ('blend/' + os.path.basename(bpy.data.filepath))
doc = dict(units='meters, glTF Y-up (Blender x,z,-y)', source=src,
           exporter='art/tools/export_region.py (render-visible instances only; ASSETS templates / hidden / excluded GLBs dropped)',
           note=A.note, instance_count=len(inst), boardCamera=boardCamera, instances=inst)
os.makedirs(os.path.dirname(P(A.out)), exist_ok=True)
json.dump(doc, open(P(A.out), 'w'), ensure_ascii=False, separators=(',', ':'))  # compact: ships in the subpackage
# ---- template export (optional) -------------------------------------------------------------
if A.export_glb_dir:
    out = P(A.export_glb_dir); os.makedirs(out, exist_ok=True)
    for cn in TPL:
        c = bpy.data.collections.get(cn)
        if not c: continue
        for nm, me in [(o.name, o.data) for o in c.all_objects if o.type == 'MESH']:
            if re.sub(r'\.\d+$', '', nm) + '.glb' in EXCL: continue  # board frame / deprecated: not a package asset
            tmp = bpy.data.objects.new('__exp_' + nm, me); sc.collection.objects.link(tmp)
            for x in vl.objects: x.select_set(False)
            tmp.select_set(True); vl.objects.active = tmp
            bpy.ops.export_scene.gltf(filepath=os.path.join(out, re.sub(r'\.\d+$', '', nm) + '.glb'), use_selection=True,
                                      export_format='GLB', export_apply=True, export_yup=True)
            bpy.data.objects.remove(tmp, do_unlink=True); exported.append(nm)

meta = dict(glb={k: dict(tris=v[0], bytes=v[1], prims=v[2], instances=cnt.get(k, 0)) for k, v in G.items()},
            group_tris=dict(tri), dropped=dict(dropped), dropped_names=dropped_names, viewport_hidden_warn=warn,
            excluded_glb=sorted(EXCL), exported_templates=exported, camera=cam)
if A.meta: json.dump(meta, open(P(A.meta), 'w'), ensure_ascii=False, indent=1)
print('EXPORT_OK', json.dumps(dict(instances=len(inst), groups=Counter(i['group'] for i in inst), tris=dict(tri),
                                    dropped=dict(dropped), viewport_hidden_warn=warn[:20]), ensure_ascii=False))
