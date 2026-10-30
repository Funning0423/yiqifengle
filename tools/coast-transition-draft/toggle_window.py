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
TOGGLE_FWD = 220  # Grok Bot approved 6c11b019: island->coast toggle at frame 220 (t 3.667 s)
def is_map_lens(c):
    L = R.ISLAND_LIVE; return bool(np.allclose(c[0], L['pos']) and np.allclose(c[1], L['look']) and abs(c[2] - L['fov']) < 1e-6)
def activation_gate(vs, cams, toggle, ret):
    """coast active = frames >= toggle (outbound) or < toggle (return); sail+bridge active on the complement.
    FAIL if coast is active on any frame showing the island map lens, or if the toggle frame shows any of the three groups."""
    n = len(cams); coast_on = np.arange(n) < toggle if ret else np.arange(n) >= toggle
    map_frames = [i for i in range(n) if is_map_lens(cams[i])]
    bad_map = [i for i in map_frames if coast_on[i]]
    vis_at = {k: bool(vs[k][toggle]) for k in vs}
    # pop-in also forbidden on the frame before/after the swap (the swap is between toggle-1 and toggle)
    vis_prev = {k: bool(vs[k][toggle - 1]) for k in vs}
    ok = not bad_map and not any(vis_at.values()) and not any(vis_prev.values())
    return dict(toggle_frame=toggle, toggle_t=round(toggle / R.FPS, 3), map_lens_frames=map_frames, coast_active_on_map_frames=bad_map,
                visible_at_toggle=vis_at, visible_at_toggle_minus_1=vis_prev, island_map_lens_sees=dict(coast=True, sail=True, bridge=True), pass_=ok)
def main():
    vs = vis_series(R.CAM); win = windows(vs)
    res = dict(direction='coast_to_island' if R.RET else 'island_to_coast', windows_frames=win,
               windows_t=[(round(a / R.FPS, 3), round(b / R.FPS, 3)) for a, b in win], frames=len(R.CAM),
               visible_frames={k: int(v.sum()) for k, v in vs.items()})
    L = R.ISLAND_LIVE; vm = vis_series([(L['pos'], L['look'], L['fov'])]); res['island_map_lens_sees'] = {k: bool(v[0]) for k, v in vm.items()}
    if R.RET:
        a, b = max(win, key=lambda w: w[1] - w[0]) if win else (None, None); tog = (a + b) // 2 if win else None
    else: tog = TOGGLE_FWD
    res['activation_gate'] = activation_gate(vs, R.CAM, tog, R.RET) if tog is not None else dict(pass_=False, reason='no window')
    print(json.dumps(res, default=str)); json.dump(res, open(R.OUT + '/toggle_window.json', 'w'), indent=1, default=str)
    g = json.load(open(R.OUT + '/gates.json')); g['activation_gate'] = res['activation_gate']; g['toggle_windows_frames'] = win
    json.dump(g, open(R.OUT + '/gates.json', 'w'), indent=1, default=str)
    return res
if __name__ == '__main__':
    r = main(); sys.exit(0 if r['activation_gate']['pass_'] else 1)
