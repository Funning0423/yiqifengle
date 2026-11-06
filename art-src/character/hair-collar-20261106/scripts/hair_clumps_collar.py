# Hair: curly wavy clumps on e976 bob silhouette + soft highlight albedo.
# Collar: rolled turtleneck thickness on dress rim. Face geometry untouched.
import sys, math, io, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gltfio import G

SRC, DST = sys.argv[1], sys.argv[2]
g = G(SRC); j = g.j
body = [m for m in j['meshes'] if m['name'] == 'LOD0_G2_BODY'][0]
dress = [m for m in j['meshes'] if m['name'] == 'LOD0_G2_DRESS'][0]

def prim_by_mat(mesh, matname):
    for p in mesh['primitives']:
        if j['materials'][p['material']]['name'] == matname:
            return p
    raise KeyError(matname)

# --- HAIR clumps ---
hp = prim_by_mat(body, 'M_G2_HAIR')
HP = g.get(hp['attributes']['POSITION']).astype(float).copy()
HN = g.get(hp['attributes']['NORMAL']).astype(float).copy()
# center in XZ (Y-up)
cx = HP[:, 0].mean(); cz = HP[:, 2].mean()
# clump lobes
N_LOBE = 7
amp_r = 0.0075   # radial bulge
amp_y = 0.0040   # vertical wave
amp_curl = 0.0035
for i in range(len(HP)):
    x, y, z = HP[i]
    dx, dz = x - cx, z - cz
    r = math.hypot(dx, dz) + 1e-8
    ang = math.atan2(dz, dx)
    # stronger on outer shell, weaker near scalp
    shell = np.clip((r - 0.04) / 0.08, 0, 1)
    # fringe (front + mid height) gets wavy tip motion
    front = np.clip((z - (-0.02)) / 0.12, 0, 1)
    fringe_y = 1.0 if 1.48 < y < 1.60 else 0.55
    lobe = math.sin(ang * N_LOBE)
    lobe2 = math.sin(ang * (N_LOBE * 2) + 0.7)
    # radial clump
    dr = (amp_r * lobe + amp_curl * 0.5 * lobe2) * shell
    HP[i, 0] += (dx / r) * dr
    HP[i, 2] += (dz / r) * dr
    # curly vertical undulation
    HP[i, 1] += amp_y * lobe2 * shell * fringe_y
    # mild tangential swirl for curl feel
    tx, tz = -dz / r, dx / r
    HP[i, 0] += tx * amp_curl * lobe * shell * front
    HP[i, 2] += tz * amp_curl * lobe * shell * front

# soften jagged fringe tips: mild laplacian on front fringe band
m = (HP[:, 1] > 1.48) & (HP[:, 1] < 1.58) & (HP[:, 2] > 0.00) & (np.abs(HP[:, 0]) < 0.12)
idx = np.where(m)[0]
if len(idx):
    Q = HP[idx].copy()
    for _ in range(2):
        new = Q.copy()
        for ii in range(len(idx)):
            d = np.linalg.norm(Q - Q[ii], axis=1)
            nb = d < 0.020
            if nb.sum() >= 2:
                new[ii] = 0.7 * Q[ii] + 0.3 * Q[nb].mean(0)
        Q = new
    HP[idx] = Q

g.put(hp['attributes']['POSITION'], HP)
# recompute rough normals from neighbors (optional light): keep original normals to avoid faceting
# soft push normals slightly outward on clumps
for i in range(len(HN)):
    x, y, z = HP[i]
    dx, dz = x - cx, z - cz
    r = math.hypot(dx, dz) + 1e-8
    n = np.array([dx / r, 0.15, dz / r])
    n = n / (np.linalg.norm(n) + 1e-8)
    HN[i] = 0.85 * HN[i] + 0.15 * n
    HN[i] /= (np.linalg.norm(HN[i]) + 1e-8)
g.put(hp['attributes']['NORMAL'], HN)

# Soften hair albedo hard highlight band
try:
    # hair may use vertex color or body/head tex — check material
    mat = j['materials'][hp['material']]
    print('hair mat', mat.get('name'), list(mat.get('pbrMetallicRoughness', {}).keys()))
except Exception as e:
    print('hair mat peek', e)

# --- DRESS rolled turtleneck ---
dp = dress['primitives'][0]
DP = g.get(dp['attributes']['POSITION']).astype(float).copy()
DN = g.get(dp['attributes']['NORMAL']).astype(float).copy()
ymax = DP[:, 1].max()
# rim + near-rim band
for i in range(len(DP)):
    y = DP[i, 1]
    if y < ymax - 0.085:
        continue
    # height factor: 1 at rim, 0 at band bottom
    t = np.clip((y - (ymax - 0.085)) / 0.085, 0, 1)
    # outward in XZ
    x, z = DP[i, 0], DP[i, 2]
    r = math.hypot(x, z) + 1e-8
    # rolled edge: near rim push out + slightly down; mid band thicken
    out = 0.010 * (t ** 1.2) + 0.004 * math.sin(t * math.pi)  # belly of roll
    DP[i, 0] += (x / r) * out
    DP[i, 2] += (z / r) * out
    # roll down at very top
    DP[i, 1] -= 0.006 * (t ** 2)
    # blend normal outward
    n = np.array([x / r, 0.2 * (1 - t), z / r])
    n /= np.linalg.norm(n) + 1e-8
    DN[i] = 0.7 * DN[i] + 0.3 * n
    DN[i] /= np.linalg.norm(DN[i]) + 1e-8

# light laplacian on collar band for smoother neck-shoulder
band = (DP[:, 1] > ymax - 0.12)
bidx = np.where(band)[0]
if len(bidx):
    Q = DP[bidx].copy()
    for _ in range(2):
        new = Q.copy()
        for ii in range(len(bidx)):
            d = np.linalg.norm(Q - Q[ii], axis=1)
            nb = d < 0.025
            if nb.sum() >= 3:
                new[ii] = 0.75 * Q[ii] + 0.25 * Q[nb].mean(0)
        Q = new
    DP[bidx] = Q

g.put(dp['attributes']['POSITION'], DP)
g.put(dp['attributes']['NORMAL'], DN)

g.save(DST)
print('hair+collar', DST, 'fringe', len(idx), 'collar_band', int(band.sum()), 'dress_ymax', ymax)
