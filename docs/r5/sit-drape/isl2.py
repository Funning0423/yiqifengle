import bpy, numpy as np, collections
from mathutils.kdtree import KDTree
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb')
o = bpy.data.objects['LOD0_G2_DRESS']; me = o.data; hg = o.vertex_groups['hips'].index
par = list(range(len(me.vertices)))
def f(x):
    while par[x] != x: par[x] = par[par[x]]; x = par[x]
    return x
for e in me.edges: a, b = map(f, e.vertices); par[a] = b
isl = collections.defaultdict(list)
for i in range(len(me.vertices)): isl[f(i)].append(i)
L = sorted(isl.values(), key=len, reverse=True)
P = np.array([tuple(v.co) for v in me.vertices])
for k, v in enumerate(L):
    others = [i for j, w in enumerate(L) if j != k and any(me.vertices[x].groups and max([g.weight for g in me.vertices[x].groups if g.group == hg] or [0]) > .35 for x in w[:50]) for i in w]
    kd = KDTree(len(others)); [kd.insert(P[i], i) for i in others]; kd.balance()
    dmin = min(kd.find(P[i])[2] for i in v) if others else -1
    bones = collections.Counter(o.vertex_groups[max(me.vertices[i].groups, key=lambda g: g.weight).group].name for i in v)
    hw = max(max([g.weight for g in me.vertices[i].groups if g.group == hg] or [0]) for i in v)
    print('I', k, len(v), 'z', P[v, 2].min().round(3), P[v, 2].max().round(3), 'x', P[v, 0].min().round(3), P[v, 0].max().round(3), 'y', P[v, 1].min().round(3), P[v, 1].max().round(3), 'maxhips', round(hw, 2), 'gap_to_pinned_mm', round(dmin * 1000, 1), dict(bones.most_common(3)))
