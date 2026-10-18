import bpy, bmesh, numpy as np, json
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb')
r = json.load(open('sim2.json'))
for n in ['LOD0_G2_DRESS','LOD0_G2_APRON','LOD0_G2_BOW']:
    o = bpy.data.objects[n]; me = o.data; hg = o.vertex_groups['hips'].index
    pin = np.array([max([g.weight for g in v.groups if g.group == hg] or [0]) > .35 for v in me.vertices])
    par = list(range(len(me.vertices)))
    def f(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for e in me.edges: a, b = map(f, e.vertices); par[a] = b
    isl = {}
    for i in range(len(me.vertices)): isl.setdefault(f(i), []).append(i)
    S = np.array(r[n]['sim']); z = S[:, 2]
    bad = [(len(v), bool(pin[v].any()), round(float(z[v].min()), 2)) for v in isl.values()]
    print('ISL', n, 'islands', len(isl), 'unpinned islands', sum(1 for b in bad if not b[1]), 'verts in unpinned', sum(b[0] for b in bad if not b[1]), 'lowest z of pinned-island verts', min(b[2] for b in bad if b[1]), 'sim z<-0.1 verts', int((z < -.1).sum()))
