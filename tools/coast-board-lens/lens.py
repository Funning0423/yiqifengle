#!/usr/bin/env python3
"""Coast board lens (option B, board in the 3D scene). Pure vertical fov (CameraPose.ts CAMERA_FIXED fovAxis 'vertical',
no portrait widening). Fit set = real r5d board_rim + 49 piece meshes (scene/b19-coast-scene @bb238126), coast root
(-0.6,-0.845,21.5) yaw 180. Per aspect only the distance changes; pitch/yaw/target/fov fixed.
Band: BoardLayout.boardLayout() portrait band trayTopMin..trayBottomMax (plate/hint above, tool bar below) and x margin 0.08."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../coast-transition-draft')); os.environ.setdefault('FIT', 'r5d')
import trimesh
from realmesh import load, coast_to_world, COAST_T
SCREENS = [(390, 844), (414, 896), (360, 780), (375, 667), (320, 568), (390, 520), (768, 1024)]
MARGIN = 0.08
_parts = None
def parts():
    global _parts
    if _parts is None: _parts = load()[0]
    return _parts
def fitset():
    P = []
    for n, m in parts():
        b = n.split(':')[1].split('@')[0]
        if b == 'board_rim' or b.startswith('piece_'): P.append(np.asarray(m.convex_hull.vertices))
    return np.vstack(P)
def layout_band(w, h):  # BoardLayout.boardLayout portrait with boardSafeInsets defaults (top 47, bottom 34, capsule top+4..top+36)
    top, bottom = 47, 34; cap = (w - 93, top + 4, w - 6, top + 36); pauseY = (cap[1] + cap[3]) / 2
    plateBottom = pauseY + 29 + 60; toolsY = h - max(bottom, 12) - 80
    return plateBottom + max(24, 32 + 12), toolsY - 52, cap
def pose(P, d, aspect=None):
    if 'quat' in P:  # D2 (场景设计部 r5d game view): fixed look line LOOK - F*d, F = quat * (0,0,-1)
        x, y, z, w = P['quat']; v = np.array([0, 0, -1.0]); u = np.array([x, y, z]); F = v + 2 * np.cross(u, np.cross(u, v) + w * v); F /= np.linalg.norm(F)
        lk = np.array(P['look_world']); return lk - F * d, lk
    """P: dict pitch, yaw (coast-local, 0 = lens on local +z looking -z), target_local, fov. -> world pos, look."""
    tg = coast_to_world(np.array(P['target_local'])); pr = math.radians(P['pitch']); yl = math.radians(P['yaw'] + 180)  # +180: coast yaw 180
    off = np.array([math.sin(yl) * math.cos(pr), math.sin(pr), math.cos(yl) * math.cos(pr)]) * d
    return tg + off, tg
def basis(p, l):
    f = (l - p) / np.linalg.norm(l - p); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); return f, r, np.cross(r, f)
def project(pts, p, l, fov, asp):
    f, r, u = basis(p, l); v = np.atleast_2d(pts) - p; z = v @ f; th = math.tan(math.radians(fov) / 2)
    return np.c_[0.5 + (v @ r) / z / (th * asp) / 2, 0.5 - (v @ u) / z / th / 2, z]
def frame(P, d, w, h, pts):
    p, l = pose(P, d); q = project(pts, p, l, P['fov'], w / h); return q
HER_PTS = None  # her body at the stop (head top, feet, face +-0.28 m): frame margin only, not the HUD band
def her_pts():
    global HER_PTS
    if HER_PTS is None:
        import trimesh; m = trimesh.util.concatenate([m for n, m in parts() if n.startswith('coast:')]); r = trimesh.ray.ray_pyembree.RayMeshIntersector(m)
        e = coast_to_world(np.array([0, 0, 5.15])); loc, _, _ = r.intersects_location([[e[0], 5, e[2]]], [[0, -1, 0]], multiple_hits=False); e[1] = loc[0][1]
        HER_PTS = np.array([e + [0, 1.62, 0], e + [0, 0.02, 0], e + [0.28, 1.42, 0], e + [-0.28, 1.42, 0]])
    return HER_PTS
def fits(P, d, w, h, pts):
    hq = frame(P, d, w, h, her_pts())
    if min(hq[:, 0].min(), 1 - hq[:, 0].max(), hq[:, 1].min(), 1 - hq[:, 1].max()) < MARGIN: return False, 0, None
    q = frame(P, d, w, h, pts); lo, hi, _ = layout_band(w, h)
    xm = min(q[:, 0].min(), 1 - q[:, 0].max()); ok = xm >= MARGIN and q[:, 1].min() * h >= lo and q[:, 1].max() * h <= hi and q[:, 1].min() >= MARGIN and q[:, 1].max() <= 1 - MARGIN and (q[:, 2] > 0).all()
    return ok, xm, q
def solve_d(P, w, h, pts, lo=5, hi=80):
    if not fits(P, hi, w, h, pts)[0]: return None
    for _ in range(50):
        m = (lo + hi) / 2
        if fits(P, m, w, h, pts)[0]: hi = m
        else: lo = m
    return math.ceil(hi * 100) / 100  # round up to 1 cm, still fits
def cells_pt(P, d, w, h):  # projected cell width/height (pt) of far row (local z -3) / near row (+3), slab top y 0.16
    out = {}
    for name, z in (('far', -3), ('near', 3)):
        c = [coast_to_world(np.array([x, 0.16, zz])) for x, zz in ((-0.5, z - 0.5), (0.5, z - 0.5), (-0.5, z + 0.5), (0.5, z + 0.5))]
        q = frame(P, d, w, h, np.array(c)); out[name] = (round(abs(q[1, 0] - q[0, 0] + q[3, 0] - q[2, 0]) / 2 * w, 1), round(abs((q[2, 1] + q[3, 1]) / 2 - (q[0, 1] + q[1, 1]) / 2) * h, 1))
    return out
# ---- official pose (proposal v1) ----
LENS_V1 = dict(pitch=64.0, yaw=0.0, target_local=[0.0, 0.16, -0.5], fov=50.0)  # my v1 (HUD-band fit), superseded by D2
LENS = dict(quat=[0, 0.851965, 0.523599, 0], look_world=[-0.6, -0.845, 21.55], fov=50.0, pitch=63.148)  # D2 default
DIST = {}  # filled by distance_for (cached); table frozen in lens_table.json
def distance_for(w, h):
    k = (w, h)
    if k not in DIST:
        f = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scene_d2_table.json')
        if os.path.exists(f):
            for r in json.load(open(f))['screens']: DIST[tuple(map(int, r['screen'].split('x')))] = r['distance_m']
        if k not in DIST: DIST[k] = solve_d(LENS, w, h, fitset())
    return DIST[k]
