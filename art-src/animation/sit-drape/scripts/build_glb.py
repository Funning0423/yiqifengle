# Stage 4 (python3): write the seated drape into the runtime GLB + anim_meta.json.
#   python3 build_glb.py <in.glb> <out.glb> <compose.npz> [--fit t=<fit.npz> ...] [--mid <mid.npz>] [--meta <anim_meta.json>]
# Skirt bones (same 10 joints, same names / hierarchy; only clip channels change):
#   correction C_b = L_b(sit_hold 0)^-1 * L'_b(sit_hold 0)  (local, post-multiplied: L'(t) = L(t) * C(t))
#   sit_hold : C at t = 0 / the loop end, follow fits (fit_follow.py, --follow) in between (the hips rock ~27 deg there)
#   sit_down : identity before DESCENT_T, then the --fit / --follow keys, C at the clip end
#   stand_up : C at t = 0, the follow keys, identity from STAND_OFF_T (no --follow: C(t) = slerp(I, C, w(t)))
# Morph targets (sparse, bind space): LOD0_G2_DRESS and LOD0_G2_APRON, 0 = sit_drape, 1 = sit_drape_mid.
# anim_meta: clip morph curves + morph.meshes target mapping + sit_down.morph.settle_time_s.
import sys, json, argparse
import numpy as np
import sddata as D
from glb_edit import Glb
from fit_bones import FIT, FOLLOW
RG = D.RG

SKIRT = FIT + list(FOLLOW)
DESCENT_T, MID_T, SETTLE_T = 0.2, 0.6, 0.8667
STAND_HOLD_T, STAND_OFF_T = 0.1333, 0.8667
KEY_DT = 1 / 30
CURVES = {
    'sit_down': {'sit_drape': [[0, 0], [DESCENT_T, 0], [SETTLE_T, 1], [1.2, 1]], 'sit_drape_mid': [[0, 0], [DESCENT_T, 0], [MID_T, 1], [SETTLE_T, 0], [1.2, 0]]},
    'sit_hold': {'sit_drape': [[0, 1], [2.0, 1]]},
    'stand_up': {'sit_drape': [[0, 1], [STAND_HOLD_T, 1], [STAND_OFF_T, 0], [1.266667, 0]]},
}


def mat(T, q):
    M = np.eye(4)
    M[:3, :3] = RG.q2m(q)
    M[:3, 3] = T
    return M


def decompose(M):
    return M[:3, 3].copy(), RG.qnorm(RG.m2q(M[:3, :3]))


def corr_of(T0, R0, T1, R1, j):
    return np.linalg.inv(mat(T0[j], R0[j])) @ mat(T1[j], R1[j])


def interp_corr(keys, t):
    """keys: sorted [(t, 4x4)] -> 4x4 (slerp rotation, lerp translation, clamped)."""
    ts = [k[0] for k in keys]
    if t <= ts[0]:
        return keys[0][1]
    if t >= ts[-1]:
        return keys[-1][1]
    i = int(np.searchsorted(ts, t, side='right'))
    (ta, A), (tb, B) = keys[i - 1], keys[i]
    u = (t - ta) / (tb - ta)
    qa, qb = RG.m2q(A[:3, :3]), RG.m2q(B[:3, :3])
    M = np.eye(4)
    M[:3, :3] = RG.q2m(RG.slerp(qa[None], qb[None], np.array([[u]]))[0])
    M[:3, 3] = A[:3, 3] * (1 - u) + B[:3, 3] * u
    return M


def blend_corr(C, w):
    return interp_corr([(0.0, np.eye(4)), (1.0, C)], w)


def curve(c, t):
    c = np.asarray(c, float)
    return float(np.interp(t, c[:, 0], c[:, 1]))


def clip_curves(rig, clip, times, corr_at):
    T, R, S = rig.sample_clip(clip, times)
    rot, tra = {}, {}
    for b in SKIRT:
        j = rig.idx[b]
        qs, ps = [], []
        for i, t in enumerate(times):
            M = mat(T[i, j], R[i, j]) @ corr_at(b, t)
            p, q = decompose(M)
            if qs and np.dot(qs[-1], q) < 0:
                q = -q
            qs.append(q)
            ps.append(p)
        rot[b] = reduce_keys(times, np.array(qs), ROT_TOL, True)
        tra[b] = reduce_keys(times, np.array(ps), POS_TOL, False)
    return rot, tra


ROT_TOL, POS_TOL = np.radians(0.4), 0.001


def _err(times, V, keep, quat):
    """max deviation of the LINEAR (slerp for quats) reconstruction from the dense samples."""
    tk, Vk = times[keep], V[keep]
    i = np.clip(np.searchsorted(tk, times, side='right') - 1, 0, len(tk) - 2)
    u = ((times - tk[i]) / np.maximum(tk[i + 1] - tk[i], 1e-9))[:, None]
    if quat:
        R = RG.slerp(Vk[i], Vk[i + 1], u)
        return 2 * np.arccos(np.clip(np.abs((R * V).sum(1)), 0, 1))
    return np.linalg.norm(Vk[i] + (Vk[i + 1] - Vk[i]) * u - V, axis=1)


def reduce_keys(times, V, tol, quat):
    """greedy: start from the end keys, insert the worst sample until the curve is within tol."""
    keep = np.zeros(len(times), bool)
    keep[[0, -1]] = True
    if len(times) <= 2:
        return times, V
    while True:
        e = _err(times, V, keep, quat)
        e[keep] = 0
        k = int(e.argmax())
        if e[k] <= tol:
            break
        keep[k] = True
    return times[keep], V[keep]


def key_times(dur, extra=()):
    ts = list(np.round(np.arange(0, dur + 1e-6, KEY_DT), 6))
    if abs(ts[-1] - dur) > 1e-6:
        ts.append(dur)
    ts = sorted(set([round(x, 6) for x in ts] + [round(x, 6) for x in extra if 0 <= x <= dur]))
    return np.array(ts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('out')
    ap.add_argument('comp')
    ap.add_argument('--fit', action='append', default=[])
    ap.add_argument('--follow', nargs='*', default=[])
    ap.add_argument('--mid')
    ap.add_argument('--meta')
    a = ap.parse_args()
    comp = np.load(a.comp)
    c = D.Char(a.inp)
    rig = c.rig
    T0, R0, _ = c.local('sit_hold', 0.0)
    Cs = {b: corr_of(T0, R0, comp['T'], comp['Rq'], rig.idx[b]) for b in SKIRT}
    down = {b: [(0.0, np.eye(4)), (DESCENT_T, np.eye(4))] for b in SKIRT}
    hold = {b: [(0.0, Cs[b]), (rig.clip_duration('sit_hold'), Cs[b])] for b in SKIRT}
    stand = {b: [(0.0, Cs[b]), (STAND_OFF_T, np.eye(4)), (rig.clip_duration('stand_up'), np.eye(4))] for b in SKIRT}
    keysets = {'sit_down': down, 'sit_hold': hold, 'stand_up': stand}
    fits = [('sit_down',) + tuple(f.split('=')) for f in a.fit] + [(None, None, f) for f in a.follow]
    for clip, tt, path in fits:
        fz = np.load(path)
        clip = clip or str(fz['clip'])
        tt = float(tt) if tt is not None else float(fz['time'])
        Tt, Rt, _ = c.local(clip, tt)
        for b in SKIRT:
            ks = keysets[clip][b]
            ks[:] = [k for k in ks if abs(k[0] - tt) > 1e-4] + [(tt, corr_of(Tt, Rt, fz['T'], fz['Rq'], rig.idx[b]))]
    for b in SKIRT:
        if not any(abs(k[0] - SETTLE_T) < 1e-4 for k in down[b]):
            down[b].append((SETTLE_T, Cs[b]))
        if not any(abs(k[0] - 1.2) < 1e-4 for k in down[b]):
            down[b].append((1.2, Cs[b]))
        for ks in keysets.values():
            ks[b].sort(key=lambda k: k[0])
    for clip, ks in keysets.items():
        print('KEYS', clip, [round(k[0], 4) for k in ks['skirt.front']])
    g = Glb(a.inp)
    dur = {n: rig.clip_duration(n) for n in ('sit_down', 'sit_hold', 'stand_up')}
    plans = {
        'sit_hold': (key_times(dur['sit_hold'], [k[0] for k in hold['skirt.front']]), lambda b, t: interp_corr(hold[b], t)),
        'sit_down': (key_times(dur['sit_down'], [k[0] for k in down['skirt.front']]), lambda b, t: interp_corr(down[b], t)),
        'stand_up': (key_times(dur['stand_up'], [STAND_HOLD_T, STAND_OFF_T]),
                     (lambda b, t: interp_corr(stand[b], t)) if len(stand['skirt.front']) > 3 else
                     (lambda b, t: blend_corr(Cs[b], curve(CURVES['stand_up']['sit_drape'], t)))),
    }
    for clip, (times, fn) in plans.items():
        rot, tra = clip_curves(rig, clip, times, fn)
        g.replace_channels(clip, rot, 'rotation')
        g.replace_channels(clip, tra, 'translation')
    zeroD = np.zeros_like(comp['dress_delta'])
    zeroA = np.zeros_like(comp['apron_delta'])
    mid = np.load(a.mid) if a.mid else None
    rep = {}
    rep['LOD0_G2_DRESS'] = g.set_morph('LOD0_G2_DRESS', [('sit_drape', comp['dress_delta']), ('sit_drape_mid', mid['dress_delta'] if mid is not None else zeroD)], eps=1e-5)
    rep['LOD0_G2_APRON'] = g.set_morph('LOD0_G2_APRON', [('sit_drape', comp['apron_delta']), ('sit_drape_mid', mid['apron_delta'] if mid is not None else zeroA)], eps=1e-5)
    size = g.save(a.out)
    print(json.dumps(rep))
    print('GLB bytes', size)
    if a.meta:
        m = json.load(open(a.meta))
        for clip, cv in CURVES.items():
            cl = m['clips'][clip]
            mm = cl.setdefault('morph', {})
            mm['curves'] = {k: [[round(x, 4), y] for x, y in v] for k, v in cv.items() if k != 'sit_drape_mid' or mid is not None}
        m['clips']['sit_down']['morph']['settle_time_s'] = SETTLE_T
        m['clips']['stand_up']['morph']['release_time_s'] = STAND_OFF_T
        m['morph'] = {
            'mesh': 'LOD0_G2_APRON',
            'meshes': {'LOD0_G2_APRON': {'targets': {'sit_drape': 0, 'sit_drape_mid': 1}},
                       'LOD0_G2_DRESS': {'targets': {'sit_drape': 0, 'sit_drape_mid': 1}}},
            'note': 'seated drape (cloud-tasks/03-sit-drape.md): sparse POSITION targets, weights driven by CharacterMotion.morphWeights; '
                    'skirt bones of sit_down / sit_hold / stand_up re-posed with the same weight curve (art-src/animation/sit-drape)',
        }
        with open(a.meta, 'w') as f:
            json.dump(m, f, indent=1, ensure_ascii=False)
            f.write('\n')
        print('anim_meta updated')


if __name__ == '__main__':
    main()
