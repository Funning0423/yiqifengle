#!/usr/bin/env python3
"""Item 3 (b): 320x568 / 390x520 only. Look point and fov 50 fixed (D2), pitch = 63.148 + delta (delta <= 8, 0.25 deg steps).
For each delta: shortest distance (1 mm) with board in the HUD band (plate above, tool bar below) + frame margin 0.08 (board, her);
then tap gate (far-row short side >= 28 pt, 0 wrong of 98000 +-8 pt taps). Smallest passing delta wins."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lens as L, tap_check as TC
LOOK = [-0.6, -0.845, 21.55]
def lensp(pitch): a = math.radians(pitch) / 2; return dict(quat=[0, math.cos(a), math.sin(a), 0], look_world=LOOK, fov=50.0, pitch=pitch)
pts = L.fitset(); her = L.her_pts()
def ev(P, d, w, h):
    p, l = L.pose(P, d); q = L.project(pts, p, l, 50, w / h); hq = L.project(her, p, l, 50, w / h); lo, hi, _ = L.layout_band(w, h)
    m = lambda a: float(min(a[:, 0].min(), 1 - a[:, 0].max(), a[:, 1].min(), 1 - a[:, 1].max()))
    return dict(board_margin=round(m(q), 4), her_margin=round(m(hq), 4), board_y_pt=[round(float(q[:, 1].min() * h), 1), round(float(q[:, 1].max() * h), 1)], band_pt=[lo, hi],
                ok=bool(m(q) >= .08 and m(hq) >= .08 and q[:, 1].min() * h >= lo and q[:, 1].max() * h <= hi))
def solve(P, w, h):
    lo, hi = 8.0, 90.0
    if not ev(P, hi, w, h)['ok']: return None
    for _ in range(50):
        mid = (lo + hi) / 2
        if ev(P, mid, w, h)['ok']: hi = mid
        else: lo = mid
    return math.ceil(hi * 1000) / 1000
TC.L.LENS = None
res = {}
for w, h in [(320, 568), (390, 520)]:
    rows = []
    for k in range(0, 33):
        dl = k * 0.25; P = lensp(63.148 + dl); d = solve(P, w, h)
        if d is None: rows.append(dict(delta=dl, fit=False)); continue
        L.LENS = P; t = TC.check(d, w, h); e = ev(P, d, w, h); p, _ = L.pose(P, d)
        r = dict(delta=dl, pitch=round(63.148 + dl, 3), distance_m=d, pos=[round(float(x), 4) for x in p], quat_xyzw=[round(x, 6) for x in P['quat']], fov=50, **t, **e)
        r['pass'] = bool(e['ok'] and t['far_short_pt'] >= 28 and t['wrong_taps'] == 0); rows.append(r)
        if r['pass']: break
    res[f'{w}x{h}'] = rows
    best = rows[-1]; print(w, h, 'PASS' if best.get('pass') else 'NO PASS within +8', json.dumps(best))
json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'short_pitch_search.json'), 'w'), indent=1)
