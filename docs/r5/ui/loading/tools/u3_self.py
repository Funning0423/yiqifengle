# 角色自身：手 / 前臂 / 上臂的身体三角形 vs 裙子、围裙、蝴蝶结 的三角相交（看手放在腿上有没有穿进裙子）
import bpy, os, json, math, mathutils
from mathutils.bvhtree import BVHTree
exec(open('/workspace/u3/tools/u3_scene.py').read())
dg = bpy.context.evaluated_depsgraph_get()
def wm(o):
    oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world.copy(); vs = [M @ v.co for v in me.vertices]; me.calc_loop_triangles()
    t = [tuple(x.vertices) for x in me.loop_triangles]; oe.to_mesh_clear(); return vs, t
body = [o for o in CH_MESH if o.name == 'LOD0_G2_BODY'][0]; bv, btri = wm(body)
vg = {g.index: g.name for g in body.vertex_groups}; print('GROUPS', sorted(set(vg.values()))[:80])
def main_bone(i):
    gs = body.data.vertices[i].groups
    return vg[max(gs, key=lambda g: g.weight).group] if len(gs) else ''
key = lambda n: any(k in n.lower() for k in ('hand', 'finger', 'thumb', 'index', 'middle', 'ring', 'pinky', 'forearm', 'lowerarm', 'upperarm', 'upper_arm', 'arm'))
sel = [t for t in btri if all(key(main_bone(i)) for i in t)]
print('arm/hand tris', len(sel))
ba = BVHTree.FromPolygons(bv, sel)
res = {}
for o in CH_MESH:
    if o is body: continue
    cv, ct = wm(o); b = BVHTree.FromPolygons(cv, ct); pairs = ba.overlap(b)
    bones = {}
    for p in pairs:
        n = main_bone(sel[p[0]][0]); bones[n] = bones.get(n, 0) + 1
    mind = 9
    for v in cv:
        loc, nn, i, d = ba.find_nearest(v, 0.05)
        if loc is not None: mind = min(mind, d)
    res[o.name] = dict(tri_intersections=len(pairs), by_bone=bones, min_dist_m=round(mind, 4))
print('SELF', json.dumps(res, ensure_ascii=False))
json.dump(res, open(os.environ.get('U3_OUT', '/workspace/u3/work/self.json'), 'w'), indent=1, ensure_ascii=False)
