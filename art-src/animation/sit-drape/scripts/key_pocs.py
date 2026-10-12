# The sparse "sit_drape" key of one cloth mesh as the per vertex projection onto the constraints of every frame it plays
# in (cyclic projection onto half-spaces, linearised once per visit): a key delta d moves the vertex by w * M d (M = its
# blended skin matrix, w = the sit_drape weight of that frame), and for each frame with w >= W_MIN
#   chair parts / seat column      n . x + b >= M_CHAIR  (deepest plane of the part)
#   poke                           thighs / shins covered at rest (dress) or the dress (apron / bow) stay M_POKE under the
#                                  nearest cloth face (its 3 vertices move out along the face normal)
#   floor                          y >= M_FLOOR
#   body (torso / legs)            (x - q) . n >= M_BODY  (nearest body face; cloth on the seat under the thighs /
#                                  buttocks: laid on the seat instead, within SEAT_BAND)
#   layer (apron / bow)            outside the solved dress by M_LAYER
# are projected in turn (transitions first, the settled sit_hold frames last, chair last within a frame), CYCLES times;
# then smoothed over the welded edges and projected again, sparse cut (budget).  Replaces drape_fix.fix + max-over-frames
# (that oscillated: a push that was right for one frame broke another).  Bones / weights from work/drape_<mesh>.npz.
#   blender -b -P key_pocs.py -- <body.glb> <work_dir> DRESS|APRON|BOW     -> updates work/drape_<mesh>.npz key, key_<mesh>.json
import json
import os
import sys
import time

import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402
import drape_fix as DF  # noqa: E402
import fit_drape as FD  # noqa: E402
import build_drape as BD  # noqa: E402

W_MIN = float(os.environ.get('POCS_W_MIN', 0.85))
CYCLES = int(os.environ.get('POCS_CYCLES', 16))
POST_CYCLES = int(os.environ.get('POCS_POST', 6))
M_CHAIR, M_FLOOR, M_BODY, M_LAYER, M_POKE = 0.004, 0.003, 0.002, 0.0015, 0.003
POKE_MAXD = 0.025          # = sit_qa COVER_MAX
POKE_OUT = 0.015           # only points this far outside the face at most (a local poke-through, not an uncovered leg)
STEP_MAX = 0.006           # per visit
POKE_COS = 0.5
POKE = int(os.environ.get('POCS_POKE', 0))  # pushing the faces only moved the inner-thigh fold on the seat into the chair / legs
A_MIN = 0.35               # |key delta -> world| gain below which a direction is not pushed
KEY_STEP = 0.012           # key space, per step
KEY_MAX = 0.09             # key space, total
SETTLE_F = 26              # sit_down settle frame (anim_meta settle_time_s): visited last with sit_hold 0 / stand_up 0..3
SEAT_ZONE = 0.045
SEAT_BAND = 0.020          # under the thighs / buttocks the cloth lies within this of the seat (hidden, hips sway over the loop)
BODY_MAXD = 0.04


class Pocs:
    def __init__(self, glb, work, mesh):
        layer = BD.dress_world(glb, work) if mesh != 'DRESS' else None
        self.s = s = BD.Solve(glb, work, 'none', mesh, layer)
        d = np.load(os.path.join(work, 'drape_%s.npz' % mesh))
        for c, cl in s.clips.items():
            cl['Q'], cl['T'], cl['S'] = d['Q_' + c], d['T_' + c], d['S_' + c]
        s.w = {c: d['w_' + c] for c in SL.CLIPS}
        self.d = d
        self.mesh, self.work = mesh, work
        pr = s.pr
        self.rep, self.inv = pr.rep, pr.inv
        P = s.ch.md[mesh]['P']
        self.free = P[self.rep, 1] < DF.FIXED_Y
        self.bfree = self.free & (P[self.rep, 1] < DF.BODY_FREE_Y)
        self.Fw = pr.Fw
        if mesh == 'DRESS':          # = sit_qa cov_legs (the bodice overlaps the hips in the bind pose)
            ch = s.ch
            ids = ch.ids['leg']
            dd = SL.signed_to_surface(ch.md['BODY']['P'][ids], SL.bvh(ch.md['DRESS']['P'], ch.md['DRESS']['F']),
                                      ch.md['DRESS']['P'], ch.md['DRESS']['F'], maxd=0.08, cos_min=0.9)
            self.covered = ids[np.isfinite(dd) & (dd < 0)]
        self.frames = []
        for c in ('sit_down', 'stand_up', 'sit_hold'):
            for k in range(s.clips[c]['n']):
                if s.w[c][k] >= W_MIN:
                    self.frames.append(self.prep(c, k))
        # priority: transitions, the sit_hold loop, then the settled frames (the last projection wins)
        settled = lambda f: (f['c'] == 'sit_down' and f['k'] >= SETTLE_F) or (f['c'] == 'stand_up' and f['k'] <= 3) or \
            (f['c'] == 'sit_hold' and f['k'] == 0)  # noqa: E731
        self.frames.sort(key=lambda f: 2 if settled(f) else (1 if f['c'] == 'sit_hold' else 0))
        print('frames', len(self.frames), flush=True)

    def prep(self, c, k):
        s = self.s
        Wm, X0 = s.recon(c, k, key=np.zeros_like(s.key), w=0.0)
        M = s.ch.skin_matrices(self.mesh, Wm)[self.rep, :3, :3]
        R = s.clips[c]['roots'][k][:3, :3]
        w = float(s.w[c][k])
        A = w * np.einsum('ij,njk->nik', R, M)              # key delta -> world displacement
        Bw = s.body(c, k)
        lay = None
        if s.layer is not None:
            lw, lf = s.layer_of(c, k)
            lay = SL.bvh(lw, lf)
            pts = lw                                         # the dress must stay under the apron / bow faces
        else:                                                # thighs / shins must stay under the dress faces
            F = s.ch.md['BODY']['F']
            fn = np.cross(Bw[F[:, 1]] - Bw[F[:, 0]], Bw[F[:, 2]] - Bw[F[:, 0]])
            vn = np.zeros_like(Bw)
            for j in range(3):
                np.add.at(vn, F[:, j], fn)
            vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
            pts, pn = Bw[self.covered], vn[self.covered]
            L = SL.to_chair(pts)
            keep = ~((np.abs(L[:, 0]) < 0.26) & (np.abs(L[:, 2]) < 0.2) & (pts[:, 1] < SL.SEAT_TOP + 0.02))
            pts, pn = pts[keep], pn[keep]
        return dict(c=c, k=k, w=w, A=A, X0=s.to_world(c, k, X0)[self.rep], tree=s.pr.body_tree(Bw), lay=lay, pts=pts,
                    pn=pn if s.layer is None else None)

    def poke(self, D, fr, X, measure):
        """points that are outside (or closer than M_POKE under) the nearest cloth face (perpendicular foot, cloth normals
        face out): that face's vertices move out along its normal."""
        tree = SL.bvh(X, self.Fw)
        idx, nrm, need = [], [], []
        worst = -M_POKE
        for pi, p in enumerate(fr['pts']):
            r = tree.find_nearest(Vector(p), POKE_MAXD)
            if r[0] is None:
                continue
            q, n = np.array(r[0]), np.array(r[1])
            d = p - q
            L = np.linalg.norm(d)
            sd = float(d @ n)
            if L > 1e-7 and abs(sd) / L < 0.9:
                continue
            if -M_POKE < sd < POKE_OUT:
                worst = max(worst, sd)
                if fr['pn'] is not None and float(fr['pn'][pi] @ n) < POKE_COS:
                    continue          # a fold face over the leg: pushing it out would push it into the leg
                for v in self.Fw[r[2]]:
                    if self.free[v]:
                        idx.append(v)
                        nrm.append(n)
                        need.append(sd + M_POKE)
        if idx and POKE and not measure:
            idx, nrm, need = np.array(idx), np.array(nrm), np.array(need)
            u, inv = np.unique(idx, return_inverse=True)       # one move per vertex: the largest need
            best = np.zeros(len(u))
            bn = np.zeros((len(u), 3))
            for i, (j, nn, ne) in enumerate(zip(inv, nrm, need)):
                if ne > best[j]:
                    best[j], bn[j] = ne, nn
            self.step(D, fr['A'], u, bn, np.minimum(best, STEP_MAX))
        return worst

    @staticmethod
    def step(D, A, idx, n, need):
        """move key D[idx] so that n . (A D) grows by need (minimal norm in key space)."""
        a = np.einsum('nij,ni->nj', A[idx], n)
        aa = np.einsum('ij,ij->i', a, a)
        ok = aa > A_MIN ** 2          # squashed by the panel scale: the key would explode in the other frames
        dD = (need[ok] / aa[ok])[:, None] * a[ok]
        L = np.linalg.norm(dD, axis=1, keepdims=True)
        dD *= np.minimum(1.0, KEY_STEP / np.maximum(L, 1e-12))
        D[idx[ok]] += dD
        L = np.linalg.norm(D[idx[ok]], axis=1, keepdims=True)
        D[idx[ok]] *= np.minimum(1.0, KEY_MAX / np.maximum(L, 1e-12))

    def visit(self, D, fr, measure=False):
        A = fr['A']
        X = fr['X0'] + np.einsum('nij,nj->ni', A, D)
        out = {}
        # body / seat sandwich
        L = SL.to_chair(X)
        zone = (np.abs(L[:, 0]) < 0.26) & (np.abs(L[:, 2]) < 0.2) & (X[:, 1] < SL.SEAT_TOP + SEAT_ZONE)
        bi, bn, bneed, zi = [], [], [], []
        worst = 0.0
        for i in np.where(self.bfree)[0]:
            r = fr['tree'].find_nearest(Vector(X[i]), BODY_MAXD)
            if r[0] is None:
                continue
            q, nn = np.array(r[0]), np.array(r[1])
            sd = float((X[i] - q) @ nn)
            if sd < M_BODY:
                if zone[i]:
                    zi.append(i)
                else:
                    worst = max(worst, M_BODY - sd)
                    bi.append(i)
                    bn.append(nn)
                    bneed.append(M_BODY - sd)
        out['body'] = worst - M_BODY
        if zi:
            zi = np.array(zi)
            hs = self.s.chair.seat_height(L[zi])
            need = X[zi, 1] - (np.where(np.isfinite(hs), hs, SL.SEAT_TOP) + M_CHAIR + SEAT_BAND)
            m = need > 0
            out['seat_zone_n'] = int(m.sum())
            if not measure and m.any():
                self.step(D, A, zi[m], np.tile([0.0, -1.0, 0.0], (int(m.sum()), 1)), need[m])
        if bi and not measure:
            self.step(D, A, np.array(bi), np.array(bn), np.array(bneed))
        X = fr['X0'] + np.einsum('nij,nj->ni', A, D)
        out['poke'] = self.poke(D, fr, X, measure)
        # layer
        if fr['lay'] is not None:
            X = fr['X0'] + np.einsum('nij,nj->ni', A, D)
            li, ln, lneed = [], [], []
            for i in np.where(self.free)[0]:
                r = fr['lay'].find_nearest(Vector(X[i]), 0.02)
                if r[0] is None:
                    continue
                q, nn = np.array(r[0]), np.array(r[1])
                sd = float((X[i] - q) @ nn)
                if sd < M_LAYER:
                    li.append(i)
                    ln.append(nn)
                    lneed.append(M_LAYER - sd)
            out['layer'] = (max(lneed) - M_LAYER) if lneed else -M_LAYER
            if li and not measure:
                self.step(D, A, np.array(li), np.array(ln), np.array(lneed))
        # floor
        X = fr['X0'] + np.einsum('nij,nj->ni', A, D)
        need = M_FLOOR - X[:, 1]
        m = (need > 0) & self.free
        out['floor'] = float(need[self.free].max()) - M_FLOOR
        if m.any() and not measure:
            self.step(D, A, np.where(m)[0], np.tile([0.0, 1.0, 0.0], (int(m.sum()), 1)), need[m])
        # chair (last: it wins)
        X = fr['X0'] + np.einsum('nij,nj->ni', A, D)
        worst = -1.0
        for p in self.s.pr.cparts:
            dd = X @ p['n'].T + p['b']
            j = dd.argmax(1)
            v = dd[np.arange(len(X)), j]
            m = (v < M_CHAIR) & self.free
            if m.any():
                worst = max(worst, float((M_CHAIR - v[m]).max()))
                if not measure:
                    self.step(D, A, np.where(m)[0], p['n'][j[m]], M_CHAIR - v[m])
        out['chair'] = (worst - M_CHAIR) if worst > -1 else -M_CHAIR
        return out

    def cycles(self, D, n):
        for it in range(n):
            for fr in self.frames:
                self.visit(D, fr)
            D[~self.free] = 0
        return D

    def measure(self, D):
        res = {}
        for fr in self.frames:
            m = self.visit(D, fr, measure=True)
            res.setdefault(fr['c'], []).append(dict(k=fr['k'], w=round(fr['w'], 3), **{a: round(b * 1000, 1) if isinstance(b, float) else b for a, b in m.items()}))
        return res


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    glb, work, mesh = a[:3]
    t0 = time.time()
    p = Pocs(glb, work, mesh)
    D = np.zeros((len(p.rep), 3))
    D = p.cycles(D, CYCLES)
    print('pocs %.0fs' % (time.time() - t0), flush=True)
    for _ in range(2):
        D = p.s.pr.smooth_delta(D, p.free, iters=1)
        D = p.cycles(D, POST_CYCLES)
    print('smooth %.0fs' % (time.time() - t0), flush=True)
    key = D[p.inv]
    key, info = FD.sparse_key(key, p.inv, budget=FD.KEY_BYTES if mesh == 'DRESS' else 10 ** 9)
    info['max_mm'] = round(float(np.linalg.norm(key, axis=1).max()) * 1000, 1)
    st = p.measure(key[p.rep])
    worst = {c: {m: max(r.get(m, -99) for r in v) for m in ('chair', 'floor', 'body', 'poke', 'layer', 'seat_zone_n')} for c, v in st.items()}
    print('key', info, json.dumps(worst), '%.0fs' % (time.time() - t0), flush=True)
    res = dict(p.d)
    res['key'] = key.astype(np.float32)
    np.savez(os.path.join(work, 'drape_%s.npz' % mesh), **res)
    with open(os.path.join(work, 'key_%s.json' % mesh), 'w') as f:
        json.dump(dict(key=info, worst=worst, frames=st), f)


if __name__ == '__main__':
    main()
