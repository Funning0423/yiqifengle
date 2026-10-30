#!/usr/bin/env python3
"""Stone frame (board_rim) overhang + rounded-corner check per screen. Corner = rim vertices whose coast-local |x| and |z| are both
beyond the start of the straight edge (corner arc); corners must project fully on screen (0..w, 0..h). Overhang = how far the rim
extends past the left/right screen edge (pt, >0 = off-screen). 320x568 keeps its accepted plain sandstone corner exception."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lens as L, keepout_r2 as K
EXEMPT = {'320x568'}
GAP = 2.0  # pt safety (= CoastBoardLens.ts COAST_CORNER_GAP_PT)
def rim():
    for n, m in L.parts():
        if n.split(':')[1].split('@')[0] == 'board_rim':
            V = np.asarray(m.vertices); W = np.array(L.COAST_T if False else [-0.6, -0.845, 21.5]); loc = np.c_[-(V[:, 0] - W[0]), V[:, 1] - W[1], -(V[:, 2] - W[2])]
            hx = np.abs(loc[:, 0]).max(); hz = np.abs(loc[:, 2]).max()
            sx = np.abs(loc[np.abs(np.abs(loc[:, 2]) - hz) < 1e-3, 0]).max(); sz = np.abs(loc[np.abs(np.abs(loc[:, 0]) - hx) < 1e-3, 2]).max()
            return V, (np.abs(loc[:, 0]) > sx + 1e-4) & (np.abs(loc[:, 2]) > sz + 1e-4), dict(half_x=round(hx, 4), half_z=round(hz, 4), straight_x=round(sx, 4), straight_z=round(sz, 4))
V_ALL, C_ALL, GEOM = rim()
def _hulls():  # per-corner convex hull, 1 mm (identical to CoastBoardLens.ts RIM_CORNERS)
    import trimesh; V = V_ALL[C_ALL]; P = []
    for sx in (-1, 1):
        for sz in (-1, 1):
            sel = V[(np.sign(V[:, 0] + 0.6) == sx) & (np.sign(V[:, 2] - 21.5) == sz)]; P += [[round(float(x), 3) for x in v] for v in trimesh.convex.convex_hull(sel).vertices]
    return np.array(P)
V = _hulls(); CORNER = np.ones(len(V), bool)
def ev(d, w, h):
    p, l = L.pose(K.P(0.0), d); q = L.project(V, p, l, 50, w / h); x = q[:, 0] * w; y = q[:, 1] * h; c = CORNER
    return dict(overhang_left_pt=round(float(-x.min()), 1), overhang_right_pt=round(float(x.max() - w), 1), corners_in_frame=bool(x[c].min() >= GAP and x[c].max() <= w - GAP and y[c].min() >= GAP and y[c].max() <= h - GAP),
                corner_min_gap_pt=round(float(min(x[c].min(), w - x[c].max(), y[c].min(), h - y[c].max())), 2))
if __name__ == '__main__':
    F = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'final_poses.json')))
    print(GEOM, int(CORNER.sum()))
    for s, r in F.items(): w, h = map(int, s.split('x')); print(s, r['distance_m'], ev(r['distance_m'], w, h))
