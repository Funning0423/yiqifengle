#!/usr/bin/env python3
"""Item 3 r2 (Grok Bot): pitch 63.148 / fov 50 / quat fixed on all screens. 320x568 and 390x520 only.
(ii) look point translated along the ground (z, board rows axis; x stays centred) + distance; (i) band top 'lo' (today 200 pt =
plate bottom + hint gap) as a parameter; (i)+(ii). Rule: board in [lo, tool-bar top], margins >= 0.08 (board, her);
tap: far-row short side >= 28 pt, 0 wrong of 98000 +-8 pt taps. Distance = shortest that fits (1 mm)."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lens as L, tap_check as TC
Q = [0, 0.851965, 0.523599, 0]; pts = L.fitset(); her = L.her_pts()
def P(dz): return dict(quat=Q, look_world=[-0.6, -0.845, 21.55 + dz], fov=50.0)
def ev(Pp, d, w, h, lo):
    p, l = L.pose(Pp, d); q = L.project(pts, p, l, 50, w / h); hq = L.project(her, p, l, 50, w / h); _, hi, _ = L.layout_band(w, h)
    m = lambda a: float(min(a[:, 0].min(), 1 - a[:, 0].max(), a[:, 1].min(), 1 - a[:, 1].max()))
    return dict(board_margin=round(m(q), 4), her_margin=round(m(hq), 4), board_y_pt=[round(float(q[:, 1].min() * h), 1), round(float(q[:, 1].max() * h), 1)], band_pt=[lo, hi],
                ok=bool(m(q) >= .08 and m(hq) >= .08 and q[:, 1].min() * h >= lo and q[:, 1].max() * h <= hi))
def solve(Pp, w, h, lo):
    a, b = 8.0, 60.0
    if not ev(Pp, b, w, h, lo)['ok']: return None
    for _ in range(40):
        m = (a + b) / 2
        if ev(Pp, m, w, h, lo)['ok']: b = m
        else: a = m
    return math.ceil(b * 1000) / 1000
def full(dz, w, h, lo):
    Pp = P(dz); d = solve(Pp, w, h, lo)
    if d is None: return None
    L.LENS = Pp; t = TC.check(d, w, h); p, l = L.pose(Pp, d)
    r = dict(dz=dz, lo=lo, distance_m=d, pos=[round(float(x), 4) for x in p], look=[round(float(x), 4) for x in l], quat_xyzw=Q, **t, **ev(Pp, d, w, h, lo))
    r['pass'] = bool(r['ok'] and r['far_short_pt'] >= 28 and r['wrong_taps'] == 0); return r
def best_dz(w, h, lo):  # dz maximising far-row size (= minimal distance) on a 0.1 m grid
    c = [(solve(P(dz), w, h, lo) or 99, dz) for dz in np.round(np.arange(-4, 4.01, 0.1), 2)]; return min(c)[1]
out = {}
for w, h in [(320, 568), (390, 520)]:
    s = f'{w}x{h}'; R = {}
    dz = best_dz(w, h, 200); R['ii_translate'] = full(float(dz), w, h, 200)
    def max_lo(dzf):
        best = None
        for lo in range(200, 120, -2):
            dzz = dzf(lo); r = full(dzz, w, h, lo)
            if r and r['pass']: return r
        return best
    R['i_plate'] = max_lo(lambda lo: 0.0)
    R['i_plus_ii'] = max_lo(lambda lo: float(best_dz(w, h, lo)))
    out[s] = R
    for k, r in R.items(): print(s, k, None if r is None else {x: r[x] for x in ('dz', 'lo', 'distance_m', 'far_short_pt', 'wrong_taps', 'board_margin', 'her_margin', 'board_y_pt', 'pass')})
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'translate_plate.json'), 'w'), indent=1)
