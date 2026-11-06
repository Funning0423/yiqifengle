# Very light head sample mesh: rounder cheeks; light fringe tip soften; clean hair near collar.
# NO head scale, NO blanket smoothing / normal rewrite, NO nose wedge.
import sys, math, numpy as np
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gltfio import G

SRC, DST = sys.argv[1], sys.argv[2]
g = G(SRC); j = g.j
body = [m for m in j['meshes'] if m['name'] == 'LOD0_G2_BODY'][0]

def prim(mat):
    for p in body['primitives']:
        if j['materials'][p['material']]['name'] == mat: return p
    raise KeyError(mat)

fp = prim('M_G2_FACE')
P = g.get(fp['attributes']['POSITION']).copy()
# rounder cheeks: slight outward at mid-cheek only (keeps jaw/chin of original)
n_cheek = 0
for i, p in enumerate(P):
    x, y, z = float(p[0]), float(p[1]), float(p[2])
    if y < 1.46 or y > 1.55 or z < 0.01: continue
    if z < 0.02 or abs(x) < 0.02: continue  # front cheeks only, skip centerline
    ch = math.exp(-(((y - 1.500) / 0.040) ** 2)) * math.exp(-(((abs(x) - 0.050) / 0.040) ** 2))
    if ch < 0.15: continue
    r = math.hypot(x, z) + 1e-8
    # subtle: up to ~3mm outward at cheek peak
    P[i, 0] += (x / r) * 0.0030 * ch
    P[i, 2] += (z / r) * 0.0020 * ch
    n_cheek += 1
g.put(fp['attributes']['POSITION'], P)

# Hair: soften front fringe tips + lift strands that collide with collar (y~1.46, front)
hp = prim('M_G2_HAIR')
HP = g.get(hp['attributes']['POSITION']).copy()
# fringe band
m = (HP[:, 1] > 1.47) & (HP[:, 1] < 1.57) & (HP[:, 2] > 0.00) & (np.abs(HP[:, 0]) < 0.11)
idx = np.where(m)[0]
if len(idx):
    Q = HP[idx].copy()
    for _ in range(3):
        new = Q.copy()
        for ii in range(len(idx)):
            d = np.linalg.norm(Q - Q[ii], axis=1)
            nb = d < 0.022
            if nb.sum() >= 2:
                new[ii] = 0.6 * Q[ii] + 0.4 * Q[nb].mean(0)
        Q = new
    # mild side-part sweep (+X) and slight tip lift (less spike)
    Q[:, 0] += 0.0025 * np.clip((Q[:, 0] + 0.04) / 0.10, 0, 1)
    Q[:, 1] += 0.002
    HP[idx] = Q

# hair-to-collar join: any hair verts dipping into collar band (front, y<1.475, r large) nudge up/out
collar_y = 1.455
m2 = (HP[:, 1] < 1.478) & (HP[:, 1] > 1.430) & (HP[:, 2] > -0.02)
for i in np.where(m2)[0]:
    # push slightly up so tips clear yellow collar rim
    if HP[i, 1] < collar_y + 0.018:
        HP[i, 1] += 0.004
g.put(hp['attributes']['POSITION'], HP)

g.save(DST)
print('sample mesh', DST, 'cheeks', n_cheek, 'fringe', len(idx), 'collar-clear', int(m2.sum()))
