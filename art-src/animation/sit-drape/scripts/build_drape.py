# Sit drape solve for one cloth mesh, on what the runtime actually plays (LBS with corrected skirt bones + the weighted
# sparse "sit_drape" shape key):
#   1. skirt panel bones from the clip's own skirt pose, rotated until each panel clears the seat column / legs / body
#      (Kabsch to the collision-fixed shape, repeated, a small pull toward the cloth sim), constant over sit_hold
#   2. the key = smoothed collision fix (drape_fix.fix: chair / seat column, body, floor, layer) of the sit_hold frames
#   3. panel bones of every clip refitted per frame to the fixed shapes (key weight = hips height ramp), last key round
#   blender -b -P build_drape.py -- <body.glb> <work_dir> <sim.npz | none> DRESS|APRON|BOW [rounds]
# APRON / BOW: run after DRESS; they stay outside the solved dress and use its weight curve.
# work_dir holds body_<clip>.npz (fix_body.py); writes drape_<mesh>.npz (Q per clip, key, curves) and drape_<mesh>.json.
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402
import drape_fix as DF  # noqa: E402
import fit_drape as FD  # noqa: E402
import author_lib as SL_AL  # noqa: E402

BONES = dict(DRESS=FD.DRESS_BONES, APRON=FD.APRON_BONES, BOW=())
SIGMA = 1.0                # bone smoothing (frames)
PULL = 0.15                # constraint rounds: share of the way back toward the cloth reference
BONE_ITERS = int(os.environ.get('BONE_ITERS', 12))
BONE_PULL = float(os.environ.get('BONE_PULL', 0.05))     # share of the way toward the cloth sim per bone iteration
# front panels have nothing under them to push them down (they stood up as a sheet in front of her chest): they follow
# the cloth sim (gravity) much more, the side / back panels are mostly pushed out of the seat column and the legs
PULL_BONE = {'skirt.front': 0.5, 'skirt.front.low': 0.5, 'skirt.front.mid': 0.5, 'skirt.front.low.mid': 0.5}
BONES_INIT = os.environ.get('BONES_INIT', 'orig')          # orig: start from the clip's skirt pose | sim: fit to the sim first


class Solve:
    def __init__(self, glb, work, sim, mesh, layer=None):
        self.ch = SL.Character(glb)
        self.chair = SL.Chair()
        self.mesh = mesh
        self.work = work
        self.pr = DF.Projector(self.ch, self.chair, mesh)
        self.fit = FD.Fitter(self.ch, mesh, BONES[mesh])
        self.sim = np.load(sim) if sim != 'none' else None
        self.layer = layer            # {clip: [frames] world dress positions} for the apron / bow
        self.free = self.ch.md[mesh]['P'][:, 1] < DF.FIXED_Y
        dom = np.array(self.ch.rig.names)[self.ch.md[mesh]['J'][np.arange(len(self.free)), self.ch.md[mesh]['W'].argmax(1)]]
        self.pull_scale = np.array([PULL_BONE.get(b, 0.0) for b in dom])
        self.clips = {}
        for c in SL.CLIPS:
            d = np.load(os.path.join(work, 'body_%s.npz' % c))
            n = len(d['Q'])
            roots = np.array([SL.root_matrix(c, k / SL.FPS, self.ch.dur[c]) for k in range(n)])
            self.clips[c] = dict(Q0=d['Q'], T=d['T'], Q=d['Q'].copy(), roots=roots, n=n, loop=c == 'sit_hold',
                                 S=np.repeat(self.ch.rig.rest_s[None], n, 0))
        if mesh != 'DRESS':           # the apron chain hangs off the solved dress panels (skirt.front / .front.low)
            d = np.load(os.path.join(work, 'drape_DRESS.npz'))
            for c, cl in self.clips.items():
                cl['Q'], cl['T'], cl['S'] = d['Q_' + c].copy(), d['T_' + c].copy(), d['S_' + c].copy()
        self.key = np.zeros_like(self.ch.md[mesh]['P'])
        self.w = {c: np.zeros(self.clips[c]['n']) for c in SL.CLIPS}

    # ---------------------------------------------------------------- helpers
    def body(self, c, k, Q=None):
        cl = self.clips[c]
        W = cl['roots'][k] @ self.ch.rig.fk(cl['T'][k][None], cl['Q0'][k][None])[0]
        return self.ch.skin('BODY', W)

    def recon(self, c, k, key=None, w=None):
        """model-space reconstruction (LBS with the current bones + w * key)."""
        cl = self.clips[c]
        Wm = self.ch.rig.fk(cl['T'][k][None], cl['Q'][k][None], cl['S'][k][None])[0]
        key = self.key if key is None else key
        w = self.w[c][k] if w is None else w
        return Wm, self.ch.skin(self.mesh, Wm, extra=w * key)

    def to_world(self, c, k, X):
        R = self.clips[c]['roots'][k]
        return X @ R[:3, :3].T + R[:3, 3]

    def to_model(self, c, k, X):
        R = np.linalg.inv(self.clips[c]['roots'][k])
        return X @ R[:3, :3].T + R[:3, 3]

    def layer_of(self, c, k):
        if self.layer is None:
            return None
        return self.layer[c][k], self.ch.md['DRESS']['F']

    # ---------------------------------------------------------------- stages
    def targets(self):
        t0 = time.time()
        self.C = {}
        for c, cl in self.clips.items():
            C = np.zeros((cl['n'],) + self.key.shape)
            for k in range(cl['n']):
                if self.sim is None:          # no cloth reference: the original skinned shape, made collision-free
                    Wm = self.ch.rig.fk(cl['T'][k][None], cl['Q0'][k][None])[0]
                    X = self.to_world(c, k, self.ch.skin(self.mesh, Wm))
                else:
                    X = self.sim[self.mesh][self.sim['index_' + c][k]].astype(float)
                Y = self.pr.project(X, self.body(c, k), layer=self.layer_of(c, k))
                C[k] = self.to_model(c, k, Y)
            self.C[c] = C
        print('targets %.0fs' % (time.time() - t0), flush=True)

    def onset(self):
        """per clip frame 0..1: where the original skinned cloth clips (collision push > 2 mm), widened by 3
        frames and smoothed; the cloth targets (and so bones / key weight) are blended in with it so the standing frames
        keep the original skirt."""
        self.beta = {}
        for c, cl in self.clips.items():
            v = np.zeros(cl['n'])
            for k in range(cl['n']):
                Wm = self.ch.rig.fk(cl['T'][k][None], cl['Q0'][k][None])[0]
                Xw = self.to_world(c, k, self.ch.skin(self.mesh, Wm))
                v[k] = self.pr.violation(Xw, self.body(c, k), layer=self.layer_of(c, k))
            self.viol = getattr(self, 'viol', {})
            self.viol[c] = v
            b = SL_AL.maxfilt((v > 0.002).astype(float), 3, cl['loop'])
            self.beta[c] = np.clip(SL_AL.gauss(b, 1.5, cl['loop']) * 1.5, 0, 1) if not cl['loop'] else np.ones(cl['n'])
        print('violation mm', {c: [round(float(x) * 1000, 1) for x in v] for c, v in self.viol.items() if c != 'sit_hold'}, flush=True)
        for c, cl in self.clips.items():
            for k in range(cl['n']):
                Wm = self.ch.rig.fk(cl['T'][k][None], cl['Q0'][k][None])[0]
                X0 = self.ch.skin(self.mesh, Wm)
                self.C[c][k] = X0 + self.beta[c][k] * (self.C[c][k] - X0)
        print('onset', {c: [round(float(x), 2) for x in b] for c, b in self.beta.items() if c != 'sit_hold'}, flush=True)

    def fit_bones(self, targets, sweeps=4, sigma=SIGMA, clips=SL.CLIPS):
        if not self.fit.bones:
            return
        for c, cl in self.clips.items():
            if c not in clips:
                continue
            Q = cl['Q'].copy()
            for k in range(cl['n']):
                Q[k] = self.fit.fit_frame(cl['T'][k], Q[k], targets[c][k], self.free, sweeps=sweeps,
                                          extra=self.w[c][k] * self.key, S=cl['S'][k])
                for j in self.fit.bi:
                    Q[k, j] = SL.slerp_rows(cl['Q0'][k, j][None], Q[k, j][None], self.beta[c][k])[0]
            cl['Q'] = self.fit.smooth(Q, sigma, cl['loop'])

    def hold_bones(self):
        """sit_hold: the panel bones keep one local rotation (mean of the fitted frames), so the cloth moves rigidly with
        the hips over the loop and one key fits every frame."""
        cl = self.clips['sit_hold']
        for j in self.fit.bi:
            q = cl['Q'][:, j].copy()
            q *= np.sign(q @ q[0])[:, None]
            m = q.mean(0)
            cl['Q'][:, j] = m / np.linalg.norm(m)

    def hold_fit(self, frames, pull=0.0):
        """sit_hold: one panel-bone pose for the whole loop, one Kabsch sweep (parents first) to the collision-fixed
        shapes of a few frames (stacked), pulled toward the cloth reference by `pull`."""
        cl = self.clips['sit_hold']
        T = {}
        for k in frames:
            _, X = self.recon('sit_hold', k)
            Y = self.to_model('sit_hold', k, self.pr.fix(self.to_world('sit_hold', k, X), self.body('sit_hold', k),
                                                        layer=self.layer_of('sit_hold', k)))
            T[k] = Y + (self.C['sit_hold'][k] - Y) * self.pull_v(pull)[:, None]
        Q = cl['Q'][frames[0]].copy()
        for b in self.fit.bones:
            j = self.ch.rig.idx[b]
            A, Bt, Wt = [], [], []
            for k in frames:
                Qk = cl['Q'][k].copy()
                Qk[self.fit.bi] = Q[self.fit.bi]
                W = self.ch.rig.fk(cl['T'][k][None], Qk[None], cl['S'][k][None])[0]
                X = self.ch.skin(self.mesh, W, extra=self.w['sit_hold'][k] * self.key)
                w = self.fit.wb[b]
                sel = (w > 0.3) & self.free
                h = W[j, :3, 3]
                A.append(X[sel] - h)
                Bt.append(T[k][sel] - h)
                Wt.append(w[sel] ** 2)
            R = FD.clamp_rot(FD.kabsch(np.concatenate(A), np.concatenate(Bt), np.concatenate(Wt)), FD.MAX_STEP_DEG)
            W = self.ch.rig.fk(cl['T'][frames[0]][None], Q[None], cl['S'][frames[0]][None])[0]
            P = W[self.ch.rig.parent[j], :3, :3]
            P = P / np.linalg.norm(P, axis=0, keepdims=True)
            Q[j] = SL.RG.m2q((P.T @ R @ P @ SL.RG.q2m(Q[j][None])[0])[None])[0]
        for k in range(cl['n']):
            cl['Q'][k, self.fit.bi] = Q[self.fit.bi]

    def pull_v(self, pull):
        """per vertex share of the way toward the cloth reference (PULL_BONE by dominant bone, else pull)."""
        return np.where(self.pull_scale > 0, self.pull_scale, pull)

    def bone_constraints(self, iters, pull=0.0):
        """panel bones only, from the original skirt pose: rotate each panel until it clears the seat column / legs /
        body (Kabsch to the collision-fixed shape, repeated), so the bones carry the drape over the thighs and the seat
        edge and the sparse key only the remainder."""
        hold_frames = list(range(0, self.clips['sit_hold']['n'], 6))
        tr = ('sit_down', 'stand_up')
        for i in range(iters):
            self.hold_fit(hold_frames, pull=pull)
            Y = self.fix_targets(tr)
            self.fit_bones({c: Y[c] + (self.C[c] - Y[c]) * self.pull_v(pull)[None, :, None] for c in tr}, sweeps=1, clips=tr)
            print('  bone constraints %d' % i, flush=True)

    def fix_key(self):
        """key += per vertex the largest bind-space collision fix (drape_fix.fix: smooth, no stretch limit) over the sit_hold
        frames (an average would leave the frames where the hips sway lower inside the seat), sparse."""
        cl = self.clips['sit_hold']
        acc = np.zeros_like(self.key)
        mag = np.zeros(len(self.key))
        for k in range(cl['n']):
            Wm, X = self.recon('sit_hold', k)
            Y = self.to_model('sit_hold', k, self.pr.fix(self.to_world('sit_hold', k, X), self.body('sit_hold', k),
                                                        layer=self.layer_of('sit_hold', k)))
            M = self.ch.skin_matrices(self.mesh, Wm)
            d = np.einsum('nij,nj->ni', np.linalg.inv(M[:, :3, :3]), Y - X)
            m = np.linalg.norm(d, axis=1)
            up = m > mag
            acc[up], mag[up] = d[up], m[up]
        acc[~self.free] = 0
        D, info = FD.sparse_key(self.key + acc, self.pr.inv, budget=FD.KEY_BYTES if self.mesh == 'DRESS' else 10 ** 9)
        info['fix_max_mm'] = round(float(mag.max()) * 1000, 1)
        info['fix_verts_1mm'] = int((mag > 0.001).sum())
        self.key = D
        return info

    def fix_targets(self, clips):
        """per frame: the reconstruction made collision-free by drape_fix.fix (model space)."""
        Y = {}
        for c in clips:
            cl = self.clips[c]
            y = np.zeros((cl['n'],) + self.key.shape)
            for k in range(cl['n']):
                _, X = self.recon(c, k)
                y[k] = self.to_model(c, k, self.pr.fix(self.to_world(c, k, X), self.body(c, k), layer=self.layer_of(c, k)))
            Y[c] = y
        return Y

    def residuals(self, targets):
        R = {}
        for c, cl in self.clips.items():
            r = np.zeros((cl['n'],) + self.key.shape)
            for k in range(cl['n']):
                Wm = self.ch.rig.fk(cl['T'][k][None], cl['Q'][k][None], cl['S'][k][None])[0]
                M = self.ch.skin_matrices(self.mesh, Wm)
                x = self.ch.skin(self.mesh, Wm)
                r[k] = np.einsum('nij,nj->ni', np.linalg.inv(M[:, :3, :3]), targets[c][k] - x)
            r[:, ~self.free] = 0
            R[c] = r
        return R

    def ls_key(self, R):
        num = np.zeros_like(self.key)
        den = 0.0
        for c in SL.CLIPS:
            w = self.w[c]
            num += np.einsum('k,kvi->vi', w, R[c])
            den += float(w @ w)
        return num / max(den, 1e-9)

    def fit_key(self, Rfix):
        """Rfix: residuals to the projected reconstruction (bind space).  The key carries only the constraint fix (the cloth
        reference pull goes into the bones), so its sparse budget is spent on the vertices that collide."""
        D, info = FD.sparse_key(self.ls_key(Rfix), self.pr.inv, budget=FD.KEY_BYTES if self.mesh == 'DRESS' else 10 ** 9)
        self.key = D
        return info

    def fit_weights(self, R=None):
        """sit_drape weight = how far down she is: hips height between the standing (first / last frame) and the seated
        pose, smoothstep, monotone (0 -> 1 over sit_down, 1 -> 0 over stand_up); sit_hold = 1.  The panel bones are
        refitted per frame afterwards, so the key does not have to be right in mid-air."""
        hi = self.ch.rig.idx['hips']
        for c in SL.CLIPS:
            cl = self.clips[c]
            n = cl['n']
            if c == 'sit_hold':
                self.w[c] = np.ones(n)
                continue
            h = np.array([(cl['roots'][k] @ self.ch.rig.fk(cl['T'][k][None], cl['Q0'][k][None])[0, hi])[1, 3] for k in range(n)])
            stand, seat = (h[0], h[-1]) if c == 'sit_down' else (h[-1], h[0])
            w = SL_AL.smoothstep((stand - h) / (stand - seat))
            w = np.maximum.accumulate(w) if c == 'sit_down' else np.maximum.accumulate(w[::-1])[::-1]
            if c == 'sit_down':
                w[0], w[-1] = 0.0, 1.0
            else:
                w[0], w[-1] = 1.0, 0.0
            self.w[c] = w

    def project_recon(self, only=SL.CLIPS):
        Y = {}
        for c, cl in self.clips.items():
            if c not in only:
                continue
            y = np.zeros((cl['n'],) + self.key.shape)
            for k in range(cl['n']):
                _, X = self.recon(c, k)
                Xw = self.to_world(c, k, X)
                y[k] = self.to_model(c, k, self.pr.project(Xw, self.body(c, k), layer=self.layer_of(c, k)))
            Y[c] = y
        return Y

    def stats(self, tag):
        out = {}
        for c, cl in self.clips.items():
            ch_min, mv = [], []
            for k in range(cl['n']):
                _, X = self.recon(c, k)
                Xw = self.to_world(c, k, X)
                ch_min.append(float(self.chair.signed(Xw).min()) * 1000)
                Y = self.pr.fix(Xw, self.body(c, k), layer=self.layer_of(c, k), rounds=1)
                mv.append(float(np.linalg.norm(Y - Xw, axis=1).max()) * 1000)
            out[c] = dict(chair_min=round(min(ch_min), 1), proj_move_max=round(max(mv), 1), proj_move_mean=round(float(np.mean(mv)), 1))
        print(tag, json.dumps(out), flush=True)
        return out

    def save(self, info):
        res = dict(key=self.key.astype(np.float32))
        for c, cl in self.clips.items():
            res['Q_' + c], res['T_' + c], res['S_' + c] = cl['Q'], cl['T'], cl['S']
            res['w_' + c] = self.w[c]
        np.savez(os.path.join(self.work, 'drape_%s.npz' % self.mesh), **res)
        with open(os.path.join(self.work, 'drape_%s.json' % self.mesh), 'w') as f:
            json.dump(info, f, indent=1)


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    glb, work, sim, mesh = a[:4]
    rounds = int(a[4]) if len(a) > 4 else 4
    layer = None
    if mesh != 'DRESS':
        layer = dress_world(glb, work)
    s = Solve(glb, work, sim, mesh, layer)
    t0 = time.time()
    s.targets()
    s.onset()
    info = dict(mesh=mesh, rounds=[], onset={c: [round(float(x), 3) for x in b] for c, b in s.beta.items()})
    # 1. bones toward the cloth reference (blended in by the onset), held constant over the sit_hold loop
    cache = os.path.join(work, 'bones_%s.npz' % mesh)
    if os.environ.get('REUSE_BONES') and os.path.exists(cache):
        z = np.load(cache)
        for c in SL.CLIPS:
            s.clips[c]['Q'] = z['Q_' + c]
            if 'S_' + c in z:          # opt_bones.py: panel translation / scale as well
                s.clips[c]['T'], s.clips[c]['S'] = z['T_' + c], z['S_' + c]
    elif BONES_INIT == 'sim':
        s.fit_bones(s.C)
        s.hold_bones()
    else:
        s.hold_bones()
    s.fit_weights()
    if mesh != 'DRESS':               # one sit_drape weight curve for every mesh: the dress's
        d = np.load(os.path.join(work, 'drape_DRESS.npz'))
        s.w = {c: d['w_' + c].copy() for c in SL.CLIPS}
    print('bones %.0fs' % (time.time() - t0), flush=True)
    info['rounds'].append(dict(stage='bones', stats=s.stats('bones')))
    if not (os.environ.get('REUSE_BONES') and os.path.exists(cache)):
        s.bone_constraints(BONE_ITERS, pull=BONE_PULL)
        np.savez(cache, **{'Q_' + c: s.clips[c]['Q'] for c in SL.CLIPS})
    info['rounds'].append(dict(stage='bone constraints', stats=s.stats('bone constraints')))
    if os.environ.get('STOP_AFTER_BONES'):
        s.save(info)
        return
    # 2. the key = constraint fix of the sit_hold frames, raised until the worst frame is clear
    for r in range(rounds):
        ki = s.fix_key()
        st = s.stats('key %d' % r)
        print('  key', ki, '%.0fs' % (time.time() - t0), flush=True)
        info['rounds'].append(dict(stage='key %d' % r, key=ki, stats=st))
    # 3. the panel bones of every clip refitted per frame to the fixed shape (the
    #    legs move against the hips over the sit_hold loop, a constant pose + one key cannot follow them), last key round
    for r in range(0 if 'S_sit_hold' in np.load(cache) else 2):     # rotation-only refit: not for opt_bones.py bones
        s.fit_bones(s.fix_targets(SL.CLIPS), sweeps=2)
        info['rounds'].append(dict(stage='per-frame bones %d' % r, stats=s.stats('per-frame bones %d' % r)))
    ki = s.fix_key()
    print('  key', ki, '%.0fs' % (time.time() - t0), flush=True)
    info['rounds'].append(dict(stage='final key', key=ki, stats=s.stats('final key')))
    info['weights'] = {c: [round(float(x), 4) for x in s.w[c]] for c in SL.CLIPS}
    s.save(info)
    print('done %.0fs' % (time.time() - t0), flush=True)


def dress_world(glb, work):
    """the solved dress (drape_DRESS.npz) in world space per clip frame, for the apron / bow layer constraint."""
    ch = SL.Character(glb)
    d = np.load(os.path.join(work, 'drape_DRESS.npz'))
    out = {}
    for c in SL.CLIPS:
        b = np.load(os.path.join(work, 'body_%s.npz' % c))
        n = len(b['Q'])
        T = d['T_' + c] if 'T_' + c in d else b['T']
        S = d['S_' + c] if 'S_' + c in d else np.repeat(ch.rig.rest_s[None], n, 0)
        P = []
        for k in range(n):
            W = SL.root_matrix(c, k / SL.FPS, ch.dur[c])[None] @ ch.rig.fk(T[k][None], d['Q_' + c][k][None], S[k][None])[0]
            P.append(ch.skin('DRESS', W, extra=d['w_' + c][k] * d['key']))
        out[c] = np.array(P)
    return out


if __name__ == '__main__':
    main()
