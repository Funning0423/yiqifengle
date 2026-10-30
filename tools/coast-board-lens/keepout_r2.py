#!/usr/bin/env python3
"""Item 3 r2 (Grok Bot margin ruling + UI设计部 c2d10462 keep-out bands). Pitch 63.148 / fov 50 / quat fixed; distance + optional
look translate along z. Fit rule: outer edge of the PLAYABLE 7x7 cells (+-3.5 m, slab top y 0.12) >= 8 pt from screen left/right and
from the top keep-out bottom / tool hot-zone top; stone frame may leave the screen (x symmetric: look x = board centre, yaw 0).
Her face (stop, 1.42 m) >= 8 pt from the tool hot zone and the top keep-out (labels). Tap: far-row short side >= 28 pt, 0 wrong taps.
Bands (pt): current HUD = SPEC.md section 1 topNoGo bottom / tool hot-zone top; compact = [0,131] / SPEC 3.5."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lens as L, tap_check as TC
Q = [0, 0.851965, 0.523599, 0]
BANDS = {'320x568': dict(current=(194, 422), compact=(131, 474)), '390x520': dict(current=(171.7, 374), compact=(131, 426))}
EDGE = np.array([L.coast_to_world(np.array([x, 0.12, z])) for x, z in ((-3.5, -3.5), (3.5, -3.5), (-3.5, 3.5), (3.5, 3.5))])
FACE = L.her_pts()[2:4].mean(0)
def P(dz): return dict(quat=Q, look_world=[-0.6, -0.845, 21.55 + dz], fov=50.0)
def ev(Pp, d, w, h, band):
    p, l = L.pose(Pp, d); q = L.project(EDGE, p, l, 50, w / h); f = L.project(FACE, p, l, 50, w / h)[0]
    x = q[:, 0] * w; y = q[:, 1] * h; fy = f[1] * h; fx = f[0] * w; top, bot = band
    r = dict(cells_x_pt=[round(float(x.min()), 1), round(float(x.max()), 1)], cells_y_pt=[round(float(y.min()), 1), round(float(y.max()), 1)], band_pt=list(band),
             face_pt=[round(float(fx), 1), round(float(fy), 1)], gap_left=round(float(x.min()), 1), gap_right=round(float(w - x.max()), 1), gap_top=round(float(y.min() - top), 1), gap_bottom=round(float(bot - y.max()), 1),
             face_gap_tool=round(float(bot - fy), 1), face_gap_top=round(float(fy - top), 1))
    # r2 final: compare UNROUNDED gaps (the 1 dp report values let 7.95 pt pass)
    r['ok'] = bool(min(x.min(), w - x.max(), y.min() - top, bot - y.max()) >= 8 and bot - fy >= 8 and fy - top >= 8 and 8 <= fx <= w - 8 and all(q[:, 2] > 0)); return r
def solve(Pp, w, h, band):
    a, b = 6.0, 60.0
    if not ev(Pp, b, w, h, band)['ok']: return None
    for _ in range(40):
        m = (a + b) / 2
        if ev(Pp, m, w, h, band)['ok']: b = m
        else: a = m
    return math.ceil(b * 1000) / 1000
def full(dz, w, h, band, d_min=None):
    Pp = P(dz); d = solve(Pp, w, h, band)
    if d is None: return None
    if d_min is not None: d = max(d, d_min)  # corner pull-back (distance only)
    L.LENS = Pp; t = TC.check(d, w, h); p, l = L.pose(Pp, d)
    C = TC.centres(d, w, h).reshape(7, 7, 2); far_h = float(np.mean(C[1, :, 1] - C[0, :, 1]))  # row pitch (for UI comparison)
    pr = L.project(np.array([L.coast_to_world(np.array([0, 0.12, z])) for z in (-3.5, -2.5)]), p, l, 50, w / h); cell_h = float((pr[1, 1] - pr[0, 1]) * h)
    r = dict(dz=dz, distance_m=d, pos=[round(float(x), 4) for x in p], look=[round(float(x), 4) for x in l], quat_xyzw=Q, fov=50, **t, far_cell_height_pt=round(cell_h, 1), **ev(Pp, d, w, h, band))
    r['pass'] = bool(r['ok'] and r['far_short_pt'] >= 28 and r['wrong_taps'] == 0); return r
def best(w, h, band):
    c = [(solve(P(dz), w, h, band) or 99, float(dz)) for dz in np.round(np.arange(-4, 4.01, 0.1), 2)]; return min(c)[1]
def _main():
  out = {}
  for s, B in BANDS.items():
      w, h = map(int, s.split('x'))
      out[s] = {'ii_shift_current_hud': full(best(w, h, B['current']), w, h, B['current']), 'i_compact_hud': full(0.0, w, h, B['compact']), 'i_plus_ii': full(best(w, h, B['compact']), w, h, B['compact'])}
      for k, r in out[s].items(): print(s, k, json.dumps({x: r[x] for x in ('dz', 'distance_m', 'far_short_pt', 'far_cell_height_pt', 'wrong_taps', 'gap_left', 'gap_right', 'gap_top', 'gap_bottom', 'face_gap_tool', 'pass')}))
  json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keepout_r2.json'), 'w'), indent=1)
if __name__ == '__main__': _main()
