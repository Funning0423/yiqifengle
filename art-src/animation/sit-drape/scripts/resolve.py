# Stage 3b (Blender python, exact triangle oracle): resolve the triangle overlaps compose.py's distance fields miss.
#   blender -b -P resolve.py -- <glb built from comp.npz> <comp.npz> <out.npz> [budget_bytes=20000]
# Poses the runtime GLB at sit_hold t=0 with sit_drape = 1 (the settled frame verify.py checks), then loops:
# BVH overlap per pair; every vertex of an offending triangle gets a small step
#   legs-dress  : dress out along the leg triangle normal          (legs are never moved)
#   legs-apron  : apron out along the leg triangle normal
#   apron-dress : apron out along its own normal (oriented away from the dress at rest), dress the opposite way
#   dress-chair / apron-chair : out along the chair triangle normal
# Steps are averaged per vertex, smoothed over the mesh, welded dress vertices move together, dress vertices outside the
# shape-key set join it while the byte budget allows.  Output (glTF axes, seated root frame): XD, XA final positions,
# movD (dress vertices in the set); finalize.py turns them into bind-space deltas.
import bpy, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import sdlib as S

a = sys.argv[sys.argv.index('--') + 1:]
GLB, COMP, OUT = a[0], a[1], a[2]
BUDGET = int(a[3]) if len(a) > 3 else 20000
STEP = 0.0015
ITERS = 120

bpy.ops.wm.read_factory_settings(use_empty=True)
CV, CF = S.extract_chair()
chairV = S.gl2bl(S.chair_in_seated_root(CV))
ch = S.Character(GLB)
for n in ('LOD0_G2_DRESS', 'LOD0_G2_APRON'):
    sk = ch.mesh[n].data.shape_keys
    for kb in sk.key_blocks[1:]:
        kb.value = 1.0 if kb.name == 'sit_drape' else 0.0
ch.pose('sit_hold', 0.0)
cls = S.body_parts(ch)
BF = ch.faces('LOD0_G2_BODY')
FL = np.array([f for f in BF if cls[f[0]] == 'legs'])
VB = ch.deformed('LOD0_G2_BODY')
XD, XA = ch.deformed('LOD0_G2_DRESS'), ch.deformed('LOD0_G2_APRON')
FD, FA = np.array(ch.faces('LOD0_G2_DRESS')), np.array(ch.faces('LOD0_G2_APRON'))
mwD, mwA = np.array(ch.mesh['LOD0_G2_DRESS'].matrix_world), np.array(ch.mesh['LOD0_G2_APRON'].matrix_world)
D0 = np.array([tuple(v.co) for v in ch.mesh['LOD0_G2_DRESS'].data.vertices]) @ mwD[:3, :3].T + mwD[:3, 3]
A0 = np.array([tuple(v.co) for v in ch.mesh['LOD0_G2_APRON'].data.vertices]) @ mwA[:3, :3].T + mwA[:3, 3]

comp = np.load(COMP)
assert len(comp['dress_delta']) == len(XD) and len(comp['apron_delta']) == len(XA), 'vertex order differs from the GLB'
movD = np.linalg.norm(comp['dress_delta'], axis=1) > 0
room = BUDGET // 14 - int(movD.sum())
_, rep = np.unique(np.round(D0, 5), axis=0, return_inverse=True)
rep = rep.ravel()
nn_ = rep.max() + 1


def bvh(V, F):
    return S.bvh(V, [tuple(map(int, f)) for f in F])


def fnorm(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


nA0 = fnorm(A0, FA)
cA0 = A0[FA].mean(1)
tD0 = bvh(D0, FD)
sgn = np.ones(len(FA))
for i, (cc, nv) in enumerate(zip(cA0, nA0)):
    loc, _, _, _ = tD0.find_nearest(tuple(cc))
    if loc is not None and np.dot(cc - np.array(loc), nv) < 0:
        sgn[i] = -1
TL, TC = bvh(VB, FL), bvh(chairV, CF)
nL, nC = fnorm(VB, FL), fnorm(chairV, CF)
cC = chairV.mean(0)
# chair normals outward from the chair's centre (the extracted mesh's winding is not trusted)
nC *= np.sign(np.einsum('fc,fc->f', chairV[CF].mean(1) - cC, nC))[:, None]
EA = np.unique(np.sort(np.concatenate([FA[:, [0, 1]], FA[:, [1, 2]], FA[:, [2, 0]]]), 1), axis=0)
ED = np.unique(np.sort(np.concatenate([rep[FD[:, [0, 1]]], rep[FD[:, [1, 2]]], rep[FD[:, [2, 0]]]]), 1), axis=0)
ED = ED[ED[:, 0] != ED[:, 1]]
low = A0[:, 2] < D0[:, 2].max()   # Blender z up: the apron bib above the dress top stays put


def smooth(Sv, E, n, it=2):
    for _ in range(it):
        s = np.zeros_like(Sv)
        c = np.zeros(n)
        np.add.at(s, E[:, 0], Sv[E[:, 1]])
        np.add.at(s, E[:, 1], Sv[E[:, 0]])
        np.add.at(c, E[:, 0], 1)
        np.add.at(c, E[:, 1], 1)
        Sv = 0.5 * Sv + 0.5 * s / np.maximum(c, 1)[:, None]
    return Sv


hist = []
for it in range(ITERS):
    TD, TA = bvh(XD, FD), bvh(XA, FA)
    nA = fnorm(XA, FA) * sgn[:, None]
    pairs = dict(ld=TL.overlap(TD), la=TL.overlap(TA), ad=TA.overlap(TD), dc=TD.overlap(TC), ac=TA.overlap(TC))
    cnt = {k: len(v) for k, v in pairs.items()}
    hist.append(cnt)
    print('RESOLVE', it, json.dumps(cnt), 'room', room, flush=True)
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
        dmov = movD[FD[d]].all() or room > 0
        for v in FA[ap]:
            sA[v] += nA[ap] * (1.0 if dmov else 2.0)
            wA[v] += 1
        if dmov:
            for v in rep[FD[d]]:
                sD[v] -= nA[ap]
                wD[v] += 1
    for d, c in pairs['dc']:
        for v in rep[FD[d]]:
            sD[v] += nC[c] * 2
            wD[v] += 1
    for ap, c in pairs['ac']:
        for v in FA[ap]:
            sA[v] += nC[c] * 2
            wA[v] += 1
    sD = np.where(wD[:, None] > 0, sD / np.maximum(wD, 1)[:, None], 0)
    sA = np.where(wA[:, None] > 0, sA / np.maximum(wA, 1)[:, None], 0)
    sD = smooth(sD, ED, nn_, 2)
    sA = smooth(sA, EA, len(XA), 2)
    sA[~low] = 0
    stepV = sD[rep]
    want = (np.linalg.norm(stepV, axis=1) > 1e-3) & ~movD
    if want.any():
        for nd in np.unique(rep[want]):
            vs = np.where(rep == nd)[0]
            if len(vs) <= room:
                movD[vs] = True
                room -= len(vs)
    stepV[~movD] = 0
    XD += STEP * stepV
    XA += STEP * sA
np.savez(OUT, XD=S.bl2gl(XD), XA=S.bl2gl(XA), movD=movD, room=room)
json.dump(hist, open(OUT + '.json', 'w'))
print('RESOLVE done', hist[-1], 'room left', room)
