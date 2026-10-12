# Stage 3b (Blender python, exact triangle oracle): resolve the triangle overlaps compose.py's distance fields miss.
#   blender -b -P resolve.py -- <in.npz> <out.npz>
# in.npz (glTF axes, seated root frame, sit_hold t=0): XD [Vd,3] dress, FD, XA [Va,3] apron, FA, A0 apron rest, D0 dress
#   rest, VB body, FL leg faces, FH hand faces, CV / CF chair, movD [Vd] bool (dress vertex may move: in the shape-key set),
#   room (how many more dress vertices may join the set), rep (dress weld map).
# Loop: BVH overlap per pair; every vertex of an offending triangle gets a small step:
#   legs-dress  : dress out along the leg triangle normal          (legs win: never moved)
#   legs-apron  : apron out along the leg triangle normal
#   apron-dress : apron out along its own normal (oriented away from the dress at rest), dress the opposite way
#   dress-chair : dress out along the chair triangle normal
# Steps are averaged per vertex, smoothed over the mesh, applied to welded dress nodes together; repeated until no overlap.
import bpy, sys, json
import numpy as np
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index('--') + 1:]
z = dict(np.load(a[0]))
XD, FD, XA, FA = z['XD'].copy(), z['FD'], z['XA'].copy(), z['FA']
VB, FL, CV, CF = z['VB'], z['FL'], z['CV'], z['CF']
movD = z['movD'].astype(bool).copy()
room = int(z['room'])
rep = z['rep']
STEP = 0.0015


def bvh(V, F):
    return BVHTree.FromPolygons([tuple(map(float, v)) for v in V], [tuple(map(int, f)) for f in F])


def fnorm(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


# apron outward = away from the dress at rest: sign per apron face from the rest pose
A0, D0 = z['A0'], z['D0']
nA0 = fnorm(A0, FA)
cA0 = A0[FA].mean(1)
tD0 = bvh(D0, FD)
sgn = np.ones(len(FA))
for i, (cc, nn) in enumerate(zip(cA0, nA0)):
    loc, nrm, fi, d = tD0.find_nearest(tuple(cc))
    if loc is not None and np.dot(cc - np.array(loc), nn) < 0:
        sgn[i] = -1
TL, TC = bvh(VB, FL), bvh(CV, CF)
nL, nC = fnorm(VB, FL), fnorm(CV, CF)
EA = np.unique(np.sort(np.concatenate([FA[:, [0, 1]], FA[:, [1, 2]], FA[:, [2, 0]]]), 1), axis=0)
ED = np.unique(np.sort(np.concatenate([rep[FD[:, [0, 1]]], rep[FD[:, [1, 2]]], rep[FD[:, [2, 0]]]]), 1), axis=0)
ED = ED[ED[:, 0] != ED[:, 1]]
nn_ = rep.max() + 1


def smooth(S, E, n, it=2):
    for _ in range(it):
        s = np.zeros_like(S)
        c = np.zeros(n)
        np.add.at(s, E[:, 0], S[E[:, 1]])
        np.add.at(s, E[:, 1], S[E[:, 0]])
        np.add.at(c, E[:, 0], 1)
        np.add.at(c, E[:, 1], 1)
        S = 0.5 * S + 0.5 * s / np.maximum(c, 1)[:, None]
    return S


hist = []
for it in range(80):
    TD, TA = bvh(XD, FD), bvh(XA, FA)
    nA = fnorm(XA, FA) * sgn[:, None]
    pairs = dict(ld=TL.overlap(TD), la=TL.overlap(TA), ad=TA.overlap(TD), dc=TD.overlap(TC))
    cnt = {k: len(v) for k, v in pairs.items()}
    hist.append(cnt)
    print('RESOLVE', it, json.dumps(cnt), flush=True)
    if sum(cnt.values()) == 0:
        break
    sD = np.zeros((nn_, 3))
    wD = np.zeros(nn_)
    sA = np.zeros_like(XA)
    wA = np.zeros(len(XA))
    for l, d in pairs['ld']:
        for v in rep[FD[d]]:
            sD[v] += nL[l] * 2
            wD[v] += 1
    for l, ap in pairs['la']:
        for v in FA[ap]:
            sA[v] += nL[l] * 2
            wA[v] += 1
    for ap, d in pairs['ad']:
        nd = rep[FD[d]]
        dmov = movD[FD[d]].all() or room > 0
        for v in FA[ap]:
            sA[v] += nA[ap] * (1.0 if dmov else 2.0)
            wA[v] += 1
        if dmov:
            for v in nd:
                sD[v] -= nA[ap]
                wD[v] += 1
    for d, ch in pairs['dc']:
        for v in rep[FD[d]]:
            sD[v] += nC[ch] * 2
            wD[v] += 1
    sD = np.where(wD[:, None] > 0, sD / np.maximum(wD, 1)[:, None], 0)
    sA = np.where(wA[:, None] > 0, sA / np.maximum(wA, 1)[:, None], 0)
    sD = smooth(sD, ED, nn_, 2)
    sA = smooth(sA, EA, len(XA), 2)
    # dress nodes outside the set join it while there is room
    stepV = sD[rep]
    want = (np.linalg.norm(stepV, axis=1) > 1e-7) & ~movD
    if want.any():
        nodes = np.unique(rep[want])
        for nd in nodes:
            vs = np.where(rep == nd)[0]
            if len(vs) <= room:
                movD[vs] = True
                room -= len(vs)
    stepV[~movD] = 0
    XD += STEP * stepV
    XA += STEP * sA
np.savez(a[1], XD=XD, XA=XA, movD=movD, room=room)
json.dump(hist, open(a[1] + '.json', 'w'))
print('RESOLVE done', hist[-1], 'room left', room)
