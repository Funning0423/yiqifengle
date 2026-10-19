# QA/bake helper (not shipped, 场景特效bot r5 S2): for each ShoreBreakCore SHORE.lip sample [deg, wx, wz, sx, sz, sy] find where the
# island terrain actually meets the sea along water -> sand (fraction k, 0 = baked water point, 1 = sand point) in combined_visual_m.glb,
# and the ground height h at INLAND m further up that line (the ribbon's inland edge). Output [[deg, k, h], ...].
#   blender -b --factory-startup -P blender_island_waterline.py -- <combined_visual_m.glb> <lip.json> <out.json>
import bpy, sys, json
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.import_scene.gltf(filepath=a[0]); L = json.load(open(a[1])); seaY = L['seaY']
GROUND = ('env_island_main', 'env_beach_', 'env_rock', 'env_cliff', 'env_island_')
dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene
def ground(x, z):
    o = Vector((x, -z, 30))
    for _ in range(12):
        r = sc.ray_cast(dg, o, Vector((0, 0, -1)))
        if not r[0]: return None
        if r[4].name.startswith(GROUND):
            LAST[0] = r[4].name; LAST[1] = r[2].z
            try:
                me = r[4].data; poly = me.polygons[r[3]]; mat = me.materials[poly.material_index] if me.materials else None
                uvl = me.uv_layers.active; LAST[2] = (mat.name if mat else '') + '@' + ('%.3f,%.3f' % tuple(uvl.data[poly.loop_indices[0]].uv) if uvl else '')
            except Exception: LAST[2] = ''
            return r[1].z
        o = r[1] + Vector((0, 0, -0.001))
    return None
INLAND = 2.3
LAST = ['', 0, '']
out = []
for s in L['lip']:
    k = None; N = 200
    for i in range(N + 1):
        t = i / N; x = s[1] + (s[3] - s[1]) * t; z = s[2] + (s[4] - s[2]) * t; g = ground(x, z)
        if g is not None and g >= seaY + 0.005: k = t; break
    h = None
    if k is not None:
        import math
        sl = math.hypot(s[3] - s[1], s[4] - s[2]); t = min(1.0, k + INLAND / sl); h = ground(s[1] + (s[3] - s[1]) * t, s[2] + (s[4] - s[2]) * t)
    print('INFO', s[0], k, h, LAST)
    out.append([s[0], k, None if h is None else round(h, 3)])
json.dump(out, open(a[2], 'w')); print('WL', json.dumps(out))
