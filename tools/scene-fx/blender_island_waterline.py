# QA/bake helper (not shipped, 场景特效bot r5 S2): for each ShoreBreakCore SHORE.lip sample [deg, wx, wz, sx, sz, sy], along water -> sand
# in combined_visual_m.glb find
#   k     = fraction (0 = baked water point, 1 = sand point) where the island ground first rises above the sea (the real waterline);
#   clear = metres of open beach up from that waterline before a rock (env_island_props_merged, or a facet steeper than NZ_ROCK);
#           0 when the waterline itself is rock (most of the island: a rock ring, then a near-vertical bank up to the grass);
#   h1..h4 = ground height at 1/4 .. 4/4 of min(clear, INLAND) up the beach (the ribbon's inland rows). Output [[deg, k, clear, h1, h2, h3, h4], ...].
#   blender -b --factory-startup -P blender_island_waterline.py -- <combined_visual_m.glb> <lip.json> <out.json>
import bpy, sys, json, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.import_scene.gltf(filepath=a[0]); L = json.load(open(a[1])); seaY = L['seaY']
GROUND = ('env_island_main', 'env_beach_', 'env_island_props_merged')
ROCK = 'env_island_props_merged'; NZ_ROCK = 0.72; INLAND = 2.3; STEP = 0.05
dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene
def ground(x, z):
    o = Vector((x, -z, 30))
    for _ in range(12):
        r = sc.ray_cast(dg, o, Vector((0, 0, -1)))
        if not r[0]: return None
        if r[4].name.startswith(GROUND): return (r[1].z, r[4].name, r[2].z)
        o = r[1] + Vector((0, 0, -0.001))
    return None
out = []
for s in L['lip']:
    k = None; N = 200; wg = None
    for i in range(N + 1):
        t = i / N; g = ground(s[1] + (s[3] - s[1]) * t, s[2] + (s[4] - s[2]) * t)
        if g is not None and g[0] >= seaY + 0.005: k = t; wg = g; break
    h = None; clear = 0.0
    if k is not None and not wg[1].startswith(ROCK):
        sl = math.hypot(s[3] - s[1], s[4] - s[2]); dx, dz = (s[3] - s[1]) / sl, (s[4] - s[2]) / sl
        wx, wz = s[1] + (s[3] - s[1]) * k, s[2] + (s[4] - s[2]) * k; d = 0.0; last = None
        while d <= INLAND + 1e-6:
            g = ground(wx + dx * d, wz + dz * d)
            if g is None or g[1].startswith(ROCK) or g[2] < NZ_ROCK: break
            last = g; clear = d; d += STEP
    hs = [None] * 4
    if k is not None and clear > 0:
        inl = min(clear, INLAND)
        for q in range(4):
            g = ground(wx + dx * inl * (q + 1) / 4, wz + dz * inl * (q + 1) / 4); hs[q] = None if g is None else round(g[0], 3)
    out.append([s[0], k if k is not None else 0, round(clear, 2)] + hs)
json.dump(out, open(a[2], 'w')); print('WL', json.dumps(out))
