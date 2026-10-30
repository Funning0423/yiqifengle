"""Pop-in check for on-demand coast activation (Grok Bot condition): coast root, sail route and bridge may only be
toggled on a frame where all three groups' world AABBs are fully outside the view frustum on all 7 screens.
Conservative AABBs (world = island scene_root). Coast: scene r2 report sec.8 extent x -14.6..13.4, z 4.5..37.5 is already
WORLD (placed under root (-0.6,-0.845,21.5) yaw 180), y -0.92 (sea) .. 5.3 (tall palm top). Sail: SAIL_I6 pier (-1.9,-0.6,10.1)
-> +Z route to M0 near z 62 (TransportLeg.ts), hull/mast padded. Bridge: islandApproach end exit_path_17+(0.8,0,3.2) -> +Z ~24 m,
width 2.1, arch 2 (RegionJourneyLayout.ts), padded. Replace with round-3 node bounds when the scene team sends them."""
import sys, math, json, numpy as np
import reanchor as R
BOX = {'coast': ([-14.6, -0.92, 4.5], [13.4, 5.3, 37.5]), 'sail': ([-5.0, -1.4, 8.7], [2.5, 7.0, 63.0]),
       'bridge': ([-2.6, -0.6, 8.0], [1.5, 3.3, 33.0])}
COAST_PTS = np.vstack([R.COAST.convex_hull.vertices] + [corners_ for corners_ in [np.array([[x + dx, y, z + dz] for dx in (-1.5, 1.5) for dz in (-1.5, 1.5) for y in (-0.845, -0.845 + hgt)]) for x, z, hgt in [(5.8, 25.3, 6.06), (-7.2, 25.9, 3.97), (7.9, 18.0, 5.15)]]])  # real r2 coast mesh hull + the 3 reuse_palm instances (not shipped in the bundle) as 3x3 m columns
def corners(b):
    if b == 'coast': return COAST_PTS
    lo, hi = b; return np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
def outside(c, p, l, fov, asp):  # True only if all corners lie beyond one frustum plane
    f, r, u = R.basis(p, l); th = R.tanh_(fov, asp); tw = th * asp
    V = c - p; z = V @ f; x = V @ r; y = V @ u
    return bool((z < 0.05).all() or (x > z * tw).all() or (x < -z * tw).all() or (y > z * th).all() or (y < -z * th).all())
def vis_series(cams):
    out = {k: [] for k in BOX}
    for p, l, fov in cams:
        for k, b in BOX.items():
            out[k].append(not all(outside(corners(k if k == 'coast' else b), np.array(p), np.array(l), fov, w / h) for (w, h) in R.SCREENS))
    return {k: np.array(v) for k, v in out.items()}
def windows(vs):
    ok = ~(vs['coast'] | vs['sail'] | vs['bridge']); segs = []; s = None
    for i, o in enumerate(ok):
        if o and s is None: s = i
        if (not o or i == len(ok) - 1) and s is not None: segs.append((s, i - 1 if not o else i)); s = None
    return segs
if __name__ == '__main__':
    res = {}
    vs = vis_series(R.CAM); res['a_island_to_coast'] = dict(windows_frames=windows(vs),
        first_visible_frame={k: int(np.argmax(v)) if v.any() else None for k, v in vs.items()}, frames=len(R.CAM))
    L = R.ISLAND_LIVE; vm = vis_series([(L['pos'], L['look'], L['fov'])])
    res['b_island_map_lens'] = {k: bool(v[0]) for k, v in vm.items()}
    vr = vis_series(R.CAM[::-1]); res['c_coast_to_island_reversed_path'] = dict(windows_frames=windows(vr))
    for k in ('coast', 'sail', 'bridge'):
        res['a_island_to_coast'][k + '_visible_frames'] = int(vs[k].sum())
    print(json.dumps(res, default=str)); json.dump(res, open(R.OUT + '/toggle_window.json', 'w'), indent=1, default=str)
