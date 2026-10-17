"""Shared data + geometry helpers for the M5 A5.1 island candidate (Voice Bot).
Pure python + numpy (works inside Blender's bundled python and plain python3 with numpy).
Coordinates: everything here is Blender world (Z-up, metres). glTF/Cocos (x, y, z) = Blender (x, z, -y).
"""
import os, json, math
WG = '/workspace/wechat-game'
V22A = WG + '/art/island/v2.2a'
V22A_BLEND = V22A + '/scene/env_scene_island_v2_2a.blend'
V22A_GLB = V22A + '/glb/env_scene_island_v2_2a.glb'
V21 = WG + '/art/x/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0'
V21_COL = V21 + '/assets/glb/env_exterior_collision.glb'
V21_COLX = V21 + '/assets/glb/env_exterior_collision_island_extras.glb'
V21_BLEND = V21 + '/scene/env_scene_assembled.blend'
OUT = WG + '/team/voice-bot/m5-island'
TOWER_C = (0.0, 2.646)            # Blender XY of the tower axis (glTF z = -3.75*K = -2.6497 -> Blender y = +2.6497)
TOWER_C = (0.0, 3.75 / 1.415282392026578)

def g2b(p):           # glTF (x,y,z) -> Blender (x,y,z)
    return (p[0], -p[2], p[1])

def b2g(p):
    return (p[0], p[2], -p[1])

def _load(p):
    return json.load(open(p))

def routes_2d():
    """All girl routes as Blender-XY polylines (outdoor part = glTF z > +0.12 i.e. Blender y < -0.12)."""
    IA = _load(V21 + '/evidence/interaction_anchors_source.json')
    CAM = _load(V21 + '/evidence/camera_world_samples_v2_1.json')
    R = {}
    R['ia_outbound'] = [(s['p'][0], -s['p'][2]) for s in IA['outbound']]
    R['ia_returnPath'] = [(s['p'][0], -s['p'][2]) for s in IA['returnPath']]
    for line in ('fixed', 'motion'):
        R['camworld_%s_exit_girl' % line] = [(s['girl'][0], -s['girl'][2]) for s in CAM[line]['exit']]
        R['camworld_%s_ret_girl' % line] = [(s['girl'][0], -s['girl'][2]) for s in CAM[line]['ret']]
    return R

def outdoor(poly):
    return [p for p in poly if p[1] < -0.12]

def densify(poly, step=0.02):
    out = []
    for i in range(len(poly)):
        out.append(poly[i])
        if i + 1 < len(poly):
            a, b = poly[i], poly[i + 1]; L = math.hypot(b[0] - a[0], b[1] - a[1]); n = int(L / step)
            for k in range(1, n):
                t = k / n; out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return out

def seg_d(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (L + 1e-12)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)

def hull2d(P):
    P = sorted(set((round(x, 5), round(y, 5)) for x, y in P))
    if len(P) < 3: return P
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

def pt_poly_d(p, H):
    n = len(H)
    inside = all(((H[(i + 1) % n][0] - H[i][0]) * (p[1] - H[i][1]) - (H[(i + 1) % n][1] - H[i][1]) * (p[0] - H[i][0])) >= 0 for i in range(n))
    if inside: return 0.0
    return min(seg_d(p, H[i], H[(i + 1) % n]) for i in range(n))

def min_clear(routes, H, step=0.02):
    """min 2D distance from every densified outdoor route to convex polygon H -> {route: (d, at_blender_xy)}"""
    res = {}
    for k, poly in routes.items():
        best = (9e9, None)
        for p in densify(poly, step):
            if p[1] >= -0.12: continue
            d = pt_poly_d(p, H)
            if d < best[0]: best = (d, p)
        res[k] = best
    return res

def game_cameras():
    """Gameplay / end / exit-cutscene cameras in glTF coords: list of (name, pos, look, vfov, W, H)."""
    CAM = _load(V21 + '/evidence/camera_world_samples_v2_1.json')
    cams = []
    # island gameplay cameras from RegionCameraData.ts (0007, Cocos world metres == glTF metric here), portrait 402x874, vFOV 45
    cams.append(('island_temporary6m', [-5.796, 3.323, 9.352], [-2.114, 0.9, 5.281], 45, 402, 874))
    cams.append(('island_legacy_capsule', [-3.4, 2.3, 6.6], [-1.5, 1.05, 4.5], 45, 402, 874))
    e = CAM['fixed']['endCamera']
    cams.append(('end_camera', e['position'], e['lookat'], e['verticalFov'], 390, 844))
    return cams

def cine_samples(every=1):
    CAM = _load(V21 + '/evidence/camera_world_samples_v2_1.json')
    out = []
    for line in ('fixed', 'motion'):
        for seg in ('exit', 'ret'):
            for i, s in enumerate(CAM[line][seg]):
                if i % every == 0:
                    out.append(('%s_%s_t%05.2f' % (line, seg, s['t']), s['pos'], s['look'], s['fov'], 390, 844))
    return out
