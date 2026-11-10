#!/usr/bin/env python3
"""场景设计部 D2 proposal (r5d game view) as the default end pose: pos (-0.6,15.3333,13.3593), quat (0,0.851965,0.523599,0), vfov 50.
Same look line for every aspect; only the distance along it changes, and only where a required check fails.
Required: board rim+49 pieces and her body margin >= 0.08, menu capsule not over her face / cells, ground >=1.5, solids >=0.5.
Advisory: BoardLayout HUD band (plate/hint above, tool bar below)."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lens as L
POS0 = np.array([-0.6, 15.3333, 13.3593]); Q0 = np.array([0, 0.851965, 0.523599, 0])
def fwd(q):  # rotate -Z by q (x,y,z,w)
    x, y, z, w = q; v = np.array([0, 0, -1.0]); u = np.array([x, y, z]); return v + 2 * np.cross(u, np.cross(u, v) + w * v)
F = fwd(Q0); F /= np.linalg.norm(F)
LOOK = POS0 + F * ((-0.845 - POS0[1]) / F[1])  # look point on the coast root plane y -0.845
D0 = float(np.linalg.norm(LOOK - POS0))
def at(d): return LOOK - F * d, LOOK
pts = L.fitset(); her = L.her_pts()
def check(d, w, h):
    p, l = at(d); asp = w / h; q = L.project(pts, p, l, 50, asp); hq = L.project(her, p, l, 50, asp)
    lo, hi, cap = L.layout_band(w, h); capn = (cap[0] / w - .02, cap[1] / h - .02, cap[2] / w + .02, cap[3] / h + .02)
    inside = lambda x: capn[0] <= x[0] <= capn[2] and capn[1] <= x[1] <= capn[3]
    bm = float(min(q[:, 0].min(), 1 - q[:, 0].max(), q[:, 1].min(), 1 - q[:, 1].max())); hm = float(min(hq[:, 0].min(), 1 - hq[:, 0].max(), hq[:, 1].min(), 1 - hq[:, 1].max()))
    face = hq[2]; cq = L.project(np.array([L.coast_to_world(np.array([c - 3, 0.35, r - 3])) for r in range(7) for c in range(7)]), p, l, 50, asp)
    return dict(board_margin=round(bm, 4), her_margin=round(hm, 4), menu_over_face=bool(inside(face) or inside(hq[3])), menu_over_cells=int(sum(inside(x) for x in cq)),
                hud_band_ok=bool(q[:, 1].min() * h >= lo and q[:, 1].max() * h <= hi), board_y_pt=[round(float(q[:, 1].min() * h), 1), round(float(q[:, 1].max() * h), 1)], hud_band_pt=[lo, hi])
def ok(c): return c['board_margin'] >= 0.08 and c['her_margin'] >= 0.08 and not c['menu_over_face'] and c['menu_over_cells'] == 0
rows = []
for w, h in L.SCREENS:
    c0 = check(D0, w, h); d = D0
    if not ok(c0):
        lo_, hi_ = D0, 80.0
        for _ in range(50):
            m = (lo_ + hi_) / 2
            if ok(check(m, w, h)): hi_ = m
            else: lo_ = m
        d = math.ceil(hi_ * 1000) / 1000
    p, _ = at(d); c = check(d, w, h)
    rows.append(dict(screen=f'{w}x{h}', as_proposed=c0, as_proposed_pass=ok(c0), distance_m=round(d, 4), pos=[round(float(x), 4) for x in p], quat_xyzw=Q0.tolist(), fov=50, final=c, final_pass=ok(c)))
out = dict(proposal=dict(pos=POS0.tolist(), quat=Q0.tolist(), fov=50, look_point=[round(float(x), 4) for x in LOOK], distance=round(D0, 4), pitch_deg=round(math.degrees(math.asin(-F[1])), 3)), screens=rows)
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scene_d2_table.json'), 'w'), indent=1)
print(json.dumps(out['proposal']))
for r in rows: print(r['screen'], 'proposed', r['as_proposed_pass'], r['as_proposed']['board_margin'], r['as_proposed']['her_margin'], '| d', r['distance_m'], r['pos'], r['final']['board_margin'], r['final']['her_margin'], r['final']['menu_over_face'], r['final']['menu_over_cells'], 'band', r['final']['hud_band_ok'], r['final']['board_y_pt'], r['final']['hud_band_pt'])
