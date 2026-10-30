"""Per-frame (60 fps) clearance evidence: distance to nearest solid, height above the first geometry straight below the lens,
lens speed (moving = >0.5 mm/frame), shot, and whether the nearest object is in frame. DIR=return for the return path."""
import json, sys, numpy as np, trimesh, reanchor as R
P = np.array([c[0] for c in R.CAM]); L = np.array([c[1] for c in R.CAM]); n = len(P)
cp, dist, tri = trimesh.proximity.closest_point(R.MESH, P)
below = np.full(n, 99.0); bwho = [''] * n
loc, ri, ti = R.RAY.intersects_location(P, np.tile([0, -1, 0], (n, 1)), multiple_hits=False)
for p, r_, t_ in zip(loc, ri, ti): below[r_] = P[r_][1] - p[1]; bwho[r_] = R.NAMES[t_]
spd = np.r_[np.linalg.norm(np.diff(P, axis=0), axis=1), 0]; spd = np.maximum(spd, np.r_[0, spd[:-1]]); moving = spd > 5e-4
herd = np.linalg.norm(P - (R.SM + [0, 0.8, 0]), axis=1) - 0.35  # to her body (0.8 m centre, 0.35 m radius approx.)
def shot(i): return int(np.searchsorted(R.T, R.TS[i], 'right'))
i_s = int(dist.argmin()); i_g = int(np.where(moving)[0][below[moving].argmin()])
name = R.NAMES[tri[i_s]]; m = [mm for nn, mm in R.parts if nn == name][0] if False else None
inframe = R.project(cp[i_s], P[i_s], L[i_s], R.CAM[i_s][2], 390 / 844)
ev = dict(direction='return' if R.RET else 'out',
  min_solid=dict(m=round(float(dist[i_s]), 3), frame=i_s, t=round(float(R.TS[i_s]), 3), shot=R.SHOTS[shot(i_s) - 1], object=name, nearest_point=cp[i_s].round(3).tolist(),
                 lens=P[i_s].round(3).tolist(), lens_moving=bool(moving[i_s]), lens_speed_m_per_frame=round(float(spd[i_s]), 4),
                 nearest_point_in_frame_390x844=bool(inframe is not None and 0 <= inframe[0] <= 1 and 0 <= inframe[1] <= 1), height_below_at_that_frame=round(float(below[i_s]), 3)),
  min_height_below_moving=dict(m=round(float(below[i_g]), 3), frame=i_g, t=round(float(R.TS[i_g]), 3), shot=R.SHOTS[shot(i_g) - 1], over=bwho[i_g], lens=P[i_g].round(3).tolist()),
  min_height_below_all_frames=round(float(below.min()), 3), moving_frames=int(moving.sum()), moving_frames_below_1_5m=int((below[moving] < 1.5).sum()),
  min_dist_to_her=round(float(herd.min()), 3), min_solid_moving=round(float(dist[moving].min()), 3))
print(json.dumps(ev)); json.dump(ev, open(R.OUT + '/clearance_evidence.json', 'w'), indent=1)
if '--plot' in sys.argv:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    from PIL import Image
    fig, ax = plt.subplots(figsize=(7, 9)); V = R.MESH.vertices; s = V[::7]
    ax.scatter(s[:, 0], s[:, 2], s=0.2, c='#ccc'); ax.plot(P[:, 0], P[:, 2], 'b-', lw=1, label='lens path'); ax.plot(R.SM[:, 0], R.SM[:, 2], 'r-', lw=1, label='her root')
    g = R.MESH.triangles[tri[i_s]]; ax.fill(g[:, 0], g[:, 2], 'orange')
    ax.plot(*cp[i_s][[0, 2]], 'k*', ms=12, label=f'nearest pt on {name}'); ax.plot(*P[i_s][[0, 2]], 'bo', ms=8, label=f'lens f{i_s} t={R.TS[i_s]:.2f}s d={dist[i_s]:.2f} m')
    ax.plot(*P[i_g][[0, 2]], 'gs', ms=8, label=f'min height-below f{i_g} {below[i_g]:.2f} m'); ax.plot(*R.SM[i_s][[0, 2]], 'r^', ms=8, label='her at f%d' % i_s)
    ax.set_xlim(-8, 8); ax.set_ylim(-3, 26); ax.set_aspect('equal'); ax.set_xlabel('x'); ax.set_ylabel('z'); ax.legend(fontsize=7, loc='lower left'); ax.set_title('top-down (y up), world = island scene_root')
    fig.savefig(R.OUT + '/_td.png', dpi=110); plt.close(fig)
    a = R.render(i_s, 390, 844, 700); b = Image.open(R.OUT + '/_td.png'); c = Image.new('RGB', (a.width + b.width + 10, max(a.height, b.height)), 'white'); c.paste(a, (0, 0)); c.paste(b, (a.width + 10, 0))
    c.save(R.OUT + '/evidence_min_solid_clearance.png'); import os; os.remove(R.OUT + '/_td.png')
