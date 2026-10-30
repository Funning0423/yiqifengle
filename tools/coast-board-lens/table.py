#!/usr/bin/env python3
"""Freeze the per-aspect distance table + checks for the official coast board lens -> lens_table.json."""
import sys, os, json, math, numpy as np, trimesh
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lens import *
LENS = LENS_V1  # v1 table (superseded by scene_d2.py)
FACE = 1.42; ESTOP = coast_to_world(np.array([0, 0, 5.15]))
pts = fitset(); ms = [m for n, m in parts()]; MESH = trimesh.util.concatenate(ms); NAMES = [n for n, m in parts() for _ in range(len(m.faces))]; RAY = trimesh.ray.ray_pyembree.RayMeshIntersector(MESH)
AAB = json.load(open('/workspace/coast-r5d/coast_aabbs.json'))
SOLID_BOXES = {k: AAB[k] for k in ('coast_beacon_post', 'coast_headland')}
# reuse_* meshes (island palms/bushes) are not in the coast bundle and the palms are skinned (layout positions only):
# conservative per-instance proxies, palm xz +-1.8 m (lean +-2.5 m), y ground..5.3 (coast_palms box top 5.23); bush xz +-0.8, 1.2 m tall
for i, e in enumerate(json.load(open('/workspace/coast-r5d/coast_layout.json'))['layout']):
    if e['mesh'].startswith(('reuse_palm', 'reuse_bush')):
        c = coast_to_world(np.array(e['p'])); r = 2.5 if 'lean' in e['mesh'] else 1.8 if 'palm' in e['mesh'] else 0.8 * e['s']; top = 5.3 if 'palm' in e['mesh'] else 1.2 * e['s']
        SOLID_BOXES[f"{e['mesh']}#{i}"] = dict(min=[c[0] - r, c[1], c[2] - r], max=[c[0] + r, c[1] + top, c[2] + r])
def ground_below(p):
    loc, _, _ = RAY.intersects_location([p], [[0, -1, 0]], multiple_hits=False); return float(p[1] - loc[0][1]) if len(loc) else 99.0
def box_dist(p, b): lo, hi = np.array(b['min']), np.array(b['max']); return float(np.linalg.norm(np.maximum(0, np.maximum(lo - p, p - hi))))
def seg_hits_box(a, b, bx):
    lo, hi = np.array(bx['min']), np.array(bx['max']); d = b - a; t0, t1 = 0.0, 1.0
    for i in range(3):
        if abs(d[i]) < 1e-12:
            if a[i] < lo[i] or a[i] > hi[i]: return False
        else:
            u, v = sorted(((lo[i] - a[i]) / d[i], (hi[i] - a[i]) / d[i])); t0, t1 = max(t0, u), min(t1, v)
            if t0 > t1: return False
    return True
CELLS = [coast_to_world(np.array([c - 3, 0.35, r - 3])) for r in range(7) for c in range(7)]  # piece mid-height
def ground_y_at(x, z):
    loc, _, _ = RAY.intersects_location([[x, 5, z]], [[0, -1, 0]], multiple_hits=False); return float(loc[0][1])
HER = ESTOP.copy(); HER[1] = ground_y_at(HER[0], HER[2]); FACEP = HER + [0, FACE, 0]
rows = []
for (w, h) in SCREENS:
    d = solve_d(LENS, w, h, pts); p, l = pose(LENS, d); asp = w / h; q = project(pts, p, l, LENS['fov'], asp)
    lo, hi, cap = layout_band(w, h); cq = project(np.array(CELLS), p, l, LENS['fov'], asp); fq = project(FACEP, p, l, LENS['fov'], asp)[0]
    capn = (cap[0] / w - .02, cap[1] / h - .02, cap[2] / w + .02, cap[3] / h + .02)
    inside = lambda x: capn[0] <= x[0] <= capn[2] and capn[1] <= x[1] <= capn[3]
    occl = 0; occl_box = 0
    for c in CELLS:
        v = c - p; L = np.linalg.norm(v); loc, _, ti = RAY.intersects_location([p], [v / L], multiple_hits=False)
        if len(loc) and np.linalg.norm(loc[0] - p) < L - 0.3 and not NAMES[ti[0]].startswith('coast:piece_'): occl += 1  # own piece top is not an occluder
        occl_box += any(seg_hits_box(p, c, b) for b in SOLID_BOXES.values())
    _, sd, _ = trimesh.proximity.closest_point(MESH, [p])
    c = cells_pt(LENS, d, w, h)
    rows.append(dict(screen=f'{w}x{h}', aspect=round(asp, 4), distance_m=d, position=[round(float(x), 4) for x in p],
        margin_x=round(float(min(q[:, 0].min(), 1 - q[:, 0].max())), 4), margin_top=round(float(q[:, 1].min()), 4), margin_bottom=round(float(1 - q[:, 1].max()), 4),
        board_y_pt=[round(float(q[:, 1].min() * h), 1), round(float(q[:, 1].max() * h), 1)], hud_band_pt=[lo, hi],
        menu_over_board_pts=int(sum(inside(x) for x in q)), menu_over_cells=int(sum(inside(x) for x in cq)),
        her_face=dict(x=round(float(fq[0]), 3), y=round(float(fq[1]), 3), in_frame=bool(0 <= fq[0] <= 1 and 0 <= fq[1] <= 1), under_menu=bool(inside(fq))),
        her_margin=round(float(min(min(x[0], 1 - x[0], x[1], 1 - x[1]) for x in project(her_pts(), p, l, LENS['fov'], asp))), 4),
        cell_far_pt=c['far'], cell_near_pt=c['near'], ground_below_m=round(ground_below(p), 2), solid_mesh_m=round(float(sd[0]), 2),
        solid_box_m=round(min(box_dist(p, b) for b in SOLID_BOXES.values()), 2), cells_occluded_mesh=occl, cells_occluded_box=occl_box))
    r = rows[-1]; r['pass'] = r['margin_x'] >= MARGIN and r['margin_top'] >= MARGIN and r['margin_bottom'] >= MARGIN and lo <= r['board_y_pt'][0] and r['board_y_pt'][1] <= hi and r['menu_over_board_pts'] == 0 and r['menu_over_cells'] == 0 and r['her_margin'] >= MARGIN and not r['her_face']['under_menu'] and r['ground_below_m'] >= 1.5 and r['solid_mesh_m'] >= 0.5 and r['solid_box_m'] >= 0.5 and occl == 0 and occl_box == 0
tg = coast_to_world(np.array(LENS['target_local']))
out = dict(lens=LENS, target_world=[round(float(x), 4) for x in tg], world_view_heading_deg=0.0, note='yaw is coast-local (0 = lens on the board local +z / arrival side); coast root yaw 180 so the lens sits on the world -z side looking +z (heading 0). fovAxis vertical. Fit set = r5d board_rim + 49 pieces (real mesh, bb238126); band = BoardLayout portrait trayTopMin..trayBottomMax with default insets; margin 0.08.',
           her_stop_world=[round(float(x), 3) for x in HER], screens=rows, all_pass=all(r['pass'] for r in rows))
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lens_table_v1.json'), 'w'), indent=1, default=float)
for r in rows: print(r['screen'], r['distance_m'], r['margin_x'], r['margin_top'], r['margin_bottom'], r['board_y_pt'], r['hud_band_pt'], r['her_face'], r['cell_far_pt'], r['cell_near_pt'], r['ground_below_m'], r['solid_mesh_m'], r['solid_box_m'], r['cells_occluded_mesh'], r['cells_occluded_box'], r['pass'])
print('target', out['target_world'], 'all_pass', out['all_pass'])
