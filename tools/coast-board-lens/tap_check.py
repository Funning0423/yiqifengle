#!/usr/bin/env python3
"""Pilot tap gate on the coast board lens (D2 angle/fov, distance per screen). Valid tap area of a cell = points of its 44x44 pt box
(centred on the projected slab centre) whose nearest projected centre is that cell (PLAN 2.3 nearest-centre rule). Far row = row 0.
Short side = min(width, height) of that area through the centre. Random taps: 2000 per cell, uniform in +-8 pt; wrong = nearest != cell."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lens as L
def centres(d, w, h):
    p, l = L.pose(L.LENS, d); C = np.array([L.coast_to_world(np.array([c - 3, 0.12, r - 3])) for r in range(7) for c in range(7)])
    q = L.project(C, p, l, 50, w / h); return np.c_[q[:, 0] * w, q[:, 1] * h]
def short_side(C, i, step=0.05):
    c = C[i]; out = []
    for ax in (np.array([1, 0]), np.array([0, 1])):
        ext = 0
        for s in (1, -1):
            t = 0
            while t < 22:
                x = c + ax * s * (t + step)
                if np.argmin(np.linalg.norm(C - x, axis=1)) != i: break
                t += step
            ext += t
        out.append(ext)
    return min(out)
def tap(C, rng):
    bad = 0
    for i in range(49):
        x = C[i] + rng.uniform(-8, 8, (2000, 2)); n = np.argmin(np.linalg.norm(x[:, None, :] - C[None], axis=2), axis=1); bad += int((n != i).sum())
    return bad
def check(d, w, h, seed=7):
    C = centres(d, w, h); ss = min(short_side(C, i) for i in range(7)); return dict(far_short_pt=round(ss, 1), wrong_taps=tap(C, np.random.default_rng(seed)), taps=49 * 2000)
if __name__ == '__main__':
    sets = json.load(open(sys.argv[1]))
    for s, d in sets.items():
        w, h = map(int, s.split('x')); r = check(d, w, h); r['pass'] = r['far_short_pt'] >= 28 and r['wrong_taps'] == 0; print(s, d, r)
