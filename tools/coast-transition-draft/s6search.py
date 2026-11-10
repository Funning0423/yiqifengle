import os, sys, numpy as np, itertools, json
import reanchor as R
i = len(R.TS) - 1; t6 = R.T[6]; i6 = int(round(t6 * R.FPS)); hp = R.SM[i6]
best = []
for az, r, h, ll, ls, fov in itertools.product(range(-40, 41, 5), [3.0, 3.6, 4.2, 5.0, 6.0], [0.9, 1.2, 1.5, 1.9, 2.4], [0.9, 1.1, 1.4, 1.8], [-0.6, -0.3, 0, 0.3, 0.6], [46, 50]):
    p, l, f = R.rel_pose((t6, az, r, h, ll, ls, fov), i6)
    _, dist, _ = R.trimesh.proximity.closest_point(R.MESH, [p]) if False else (None, None, None)
    worst = 9; ok = True
    for (w, hh) in R.SCREENS:
        asp = w / hh; cap = R.capsule(w, hh); rg = R.basis(p, l)[1]
        pts = [hp + [0, R.HEAD_TOP, 0], hp + [0, .02, 0], hp + [0, R.FACE, 0] + rg * R.HALF_W, hp + [0, R.FACE, 0] - rg * R.HALF_W]
        pr = [R.project(q, p, l, f, asp) for q in pts]
        if any(x is None for x in pr): ok = False; break
        m = min(min(x[0] for x in pr), 1 - max(x[0] for x in pr), min(x[1] for x in pr), 1 - max(x[1] for x in pr))
        q = [R.project(x, p, l, f, asp) for x in R.LH_LANTERN]
        if any(x is None for x in q): ok = False; break
        lm = min(min(x[0] for x in q) - 0.55, 0.95 - max(x[0] for x in q), min(x[1] for x in q) - 0.04, 0.5 - max(x[1] for x in q))
        if cap[0] - .03 <= q[0][0] <= cap[2] + .03 and cap[1] - .03 <= q[0][1] <= cap[3] + .03: lm = -1
        worst = min(worst, m - 0.08, lm)
    if ok and worst > 0: best.append((worst, (az, r, h, ll, ls, fov), p))
best.sort(key=lambda x: -x[0]); print(len(best))
res = []
for w_, k, p in best[:400]:
    _, d, ti = R.trimesh.proximity.closest_point(R.MESH, [p]); gy = R.RAY.intersects_location([p], [[0, -1, 0]], multiple_hits=False)[0]
    g = p[1] - gy[0][1] if len(gy) else 9
    if d[0] >= 1.1 and g >= 1.1: res.append((round(w_, 3), k, round(float(d[0]), 2), round(float(g), 2)))
for x in res[:12]: print(x)
