#!/usr/bin/env python3
"""S7 walk clearance (运镜bot own check of 场景设计部's P2 route): her straight walk pause (0,0,10.25) -> stop (0,0,5.15), coast-local.
For every layout instance (coast_meshes/coast_layout of the scene build, default 9e861a31) the part of each triangle that lies
0.30..1.8 m above her walk height (场景设计部 walk.py rule: geometry > ground + 0.3 m is a solid; her walk ground is 0 +-0.003) is projected to the ground plane; clearance = min 2D distance from the walk line (5 cm steps).
Ground-only meshes are skipped; soft vegetation (grass/flowers) is listed separately, not a solid. Writes s7_walk_clearance.json."""
import json, math, os, sys, numpy as np
B = os.environ.get('ARR_B', '/workspace/tmp-exp/arrival-build-9e86')
M = json.load(open(B + '/coast_meshes.json')); L = json.load(open(B + '/coast_layout.json'))['layout']
A, Z = np.array([0, 10.25]), np.array([0, 5.15])
SKIP = ('terrain', 'foam', 'foam_inner', 'tide_sheet', 'footprints', 'blob', 'contact', 'reef_base', 'arrival_steps_top', 'reuse_cloud', 'gull', 'shells_scatter', 'seaglass', 'grasspatch')
SOFT = ('reuse_grass', 'reuse_flowers', 'grasscap', 'grass')
def tris(e):
    P = np.array(M[e['mesh']]['positions'], float).reshape(-1, 3) * e['s']; a = e['rz']; c, s = math.cos(a), math.sin(a)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]); return (P @ R.T + np.array(e['p'])).reshape(-1, 3, 3)
def seg_d(P, a, b):  # 2D distance of points P (n,2) to segment ab
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
def tri_pts(T, n=6):  # dense samples of each triangle (barycentric grid) in 3D
    out = []
    for i in range(n + 1):
        for j in range(n + 1 - i):
            u, v = i / n, j / n; out.append(T[:, 0] * (1 - u - v) + T[:, 1] * u + T[:, 2] * v)
    return np.concatenate(out)
H_MIN = float(os.environ.get('H_MIN', 0.3)); res = []
for e in L:
    m = e['mesh']
    if m not in M or m.startswith(SKIP) or m in SKIP: continue
    T = tris(e); P = tri_pts(T); P = P[(P[:, 1] >= H_MIN) & (P[:, 1] <= 1.8)]
    if not len(P): continue
    d = float(seg_d(P[:, [0, 2]], A, Z).min()); res.append(dict(mesh=m, p=[round(x, 2) for x in e['p']], d=round(d, 3), soft=m.startswith(SOFT)))
res.sort(key=lambda r: r['d']); solid = [r for r in res if not r['soft']]; soft = [r for r in res if r['soft']]
out = dict(route=dict(start=[0, 0, 10.25], end=[0, 0, 5.15], length_m=round(float(np.linalg.norm(A - Z)), 3), speed_ms=1.2, seconds=round(float(np.linalg.norm(A - Z)) / 1.2, 3)),
           solid_min=solid[0], solid_nearest=solid[:8], soft_nearest=soft[:4], rim_outer_z=3.95, end_to_rim_m=round(5.15 - 3.95, 3))
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 's7_walk_clearance.json'), 'w'), indent=1); print(json.dumps(out, indent=1))
