# 穿模检测：角色网格（评估后：sit_hold f0 + morph）vs 圆凳 + 房间里离座位 1.2 m 内的网格。BVH overlap + 角色顶点到对方网格的有符号距离。
import bpy, os, sys, json, math, mathutils
from mathutils.bvhtree import BVHTree
exec(open('/workspace/u3/tools/u3_scene.py').read())
dg = bpy.context.evaluated_depsgraph_get()
def world_mesh(o):
    oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world.copy()
    vs = [M @ v.co for v in me.vertices]; me.calc_loop_triangles()
    tris = [tuple(t.vertices) for t in me.loop_triangles]; oe.to_mesh_clear(); return vs, tris
seat_bl = bl(SEAT_ANCHOR)
others = []
for o in bpy.data.objects:
    if o.type != 'MESH' or o in CH_MESH or o.hide_render or o.name.startswith('col_'): continue
    vs, tris = world_mesh(o)
    if not vs or not tris: continue
    d = min((v - seat_bl).length for v in vs)
    if d < 1.2 or o in STOOL_MESH: others.append((o.name, vs, tris, o in STOOL_MESH))
out = dict(info=INFO, pairs=[], nearby=[x[0] for x in others])
chars = {o.name: world_mesh(o) for o in CH_MESH}
for cn, (cv, ct) in chars.items():
    bc = BVHTree.FromPolygons(cv, ct, epsilon=0.0)
    for on, ov, ot, is_stool in others:
        bo = BVHTree.FromPolygons(ov, ot, epsilon=0.0)
        pairs = bc.overlap(bo)
        mind = 1e9; maxpen = 0.0; npen = 0; worst = None
        for i, v in enumerate(cv):
            loc, nrm, idx, dist = bo.find_nearest(v, 0.3)
            if loc is None: continue
            sd = dist if (v - loc).dot(nrm) >= 0 else -dist
            if sd < mind: mind = sd; worst = (i, [round(x, 4) for x in v])
            if sd < -1e-4: npen += 1; maxpen = max(maxpen, -sd)
        out['pairs'].append(dict(char=cn, other=on, stool=is_stool, tri_overlaps=len(pairs), min_signed_dist_m=round(mind, 5) if mind < 1e8 else None,
                                 verts_inside=npen, max_penetration_m=round(maxpen, 5), worst_vertex_blender=worst,
                                 overlap_tris_sample=[list(p) for p in pairs[:20]]))
json.dump(out, open(os.environ.get('U3_OUT', '/workspace/u3/work/probe.json'), 'w'), indent=1, ensure_ascii=False)
print('NEARBY', out['nearby'])
for p in out['pairs']:
    if p['tri_overlaps'] or (p['min_signed_dist_m'] is not None and p['min_signed_dist_m'] < 0.03):
        q = dict(p); q.pop('overlap_tris_sample'); print('PAIR', json.dumps(q, ensure_ascii=False))
print('PROBE_DONE', len(out['pairs']))
