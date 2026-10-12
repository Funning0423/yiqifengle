# Final pose per sit clip = body fix (fix_body.py) + solved skirt bones (build_drape.py: dress panels, apron chain) + hands
# lifted off the cloth: where her hands rest on the lap they sank into the apron / dress (mocap wrists were IK-placed on
# the bare thighs).  Per frame and side the deepest hand skin point under the dress / apron surface (with their
# sit_drape key; perpendicular foot as in sit_qa) is measured, the wrist is moved out along that cloth normal (never down) by that much + HAND_GAP with
# two-bone arm IK (hand world rotation kept), the lift is smoothed in time, and the check repeated.
#   blender -b -P fix_hands.py -- <body.glb> <work_dir>     -> work_dir/final_<clip>.npz (Q, T, S), fix_hands.json
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402
import author_lib as AL  # noqa: E402
import fit_drape as FD  # noqa: E402

HAND_GAP = 0.004          # + the arm channels' key reduction error
ITERS = int(os.environ.get('HANDS_ITERS', 4))
RG = SL.RG


def combine(work, clip):
    """body_<clip> pose with the panel bones of drape_DRESS / drape_APRON; per-mesh keys and the shared weight; and the
    decoded clip (decode_clips.py: what the runtime plays, every joint) to measure on, or None."""
    b = np.load(os.path.join(work, 'body_%s.npz' % clip))
    Q, T = b['Q'].copy(), b['T']
    S = np.repeat(CH.rig.rest_s[None], len(Q), 0)
    keys, w = {}, None
    for mesh, bones in (('DRESS', FD.DRESS_BONES), ('APRON', FD.APRON_BONES), ('BOW', ())):
        p = os.path.join(work, 'drape_%s.npz' % mesh)
        if not os.path.exists(p):
            continue
        d = np.load(p)
        keys[mesh] = d['key']
        sv = 's' if 'Qs_' + clip in d else ''       # the solved panel curves, not the decoded ones (decode_clips.py)
        if mesh == 'DRESS':
            w = d['w_' + clip]
            if 'S_' + clip in d:           # panel translation / scale (opt_bones.py)
                T, S = d['T%s_' % sv + clip], d['S%s_' % sv + clip]
        if bones:
            idx = [CH.rig.idx[bn] for bn in bones]
            Q[:, idx] = d['Q%s_' % sv + clip][:, idx]
        if mesh == 'DRESS':
            dec = (d['Q_' + clip], d['T_' + clip], d['S_' + clip]) if sv else None
    return Q, T, S, keys, w, dec


def cloth(W, keys, w):
    out = []
    for mesh in ('DRESS', 'APRON'):
        if mesh in keys:
            X = CH.skin(mesh, W, extra=w * keys[mesh])
            out.append((SL.bvh(X, CH.md[mesh]['F']), X, CH.md[mesh]['F']))
    return out


def hand_depth(W, layers, side):
    """deepest hand skin point under a cloth surface (perpendicular foot, as sit_qa) + HAND_GAP, clamped >= 0, and the
    cloth normal there (world; on the lap ~up, beside the skirt ~sideways)."""
    from mathutils import Vector
    H = CH.skin('BODY', W)[HAND_IDS[side]]
    best, nrm = 0.0, np.array([0.0, 1.0, 0.0])
    for tree, X, F in layers:
        s = SL.signed_to_surface(H, tree, X, F, maxd=0.03, cos_min=0.9)
        if np.isfinite(s).any():
            i = int(np.nanargmin(s))
            if HAND_GAP - s[i] > best:
                best = HAND_GAP - float(s[i])
                n = np.array(tree.find_nearest(Vector(H[i]), 0.03)[1])
                n[1] = max(n[1], 0.0)          # never down into the seat / thighs
                nrm = n / max(np.linalg.norm(n), 1e-9)
    return best, nrm


def arm_ik(T, Q, side, lift_model):
    """move the wrist (hand joint) by lift_model [n,3] (model space) with upper_arm / forearm, hand world rotation kept."""
    rig = CH.rig
    ua, fa, hd = 'upper_arm.' + side, 'forearm.' + side, 'hand.' + side
    Wr, hips = AL.world_from_local(rig, Q, T)
    W = rig.fk(T, Q)
    H, K0, A0 = (W[:, rig.idx[n], :3, 3] for n in (ua, fa, hd))
    L1 = np.linalg.norm(K0 - H, axis=1).mean()
    L2 = np.linalg.norm(A0 - K0, axis=1).mean()
    mid = (H + A0) / 2
    out = K0 - mid
    out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)
    K, A2, _ = AL.two_bone(H, A0 + lift_model, K0 + 0.2 * out, L1, L2)
    R1 = RG.align(K0 - H, K - H)
    hand_rot = Wr[hd].copy()
    Wr2 = dict(Wr)
    Wr2[ua] = R1 @ Wr[ua]
    f_tmp = R1 @ Wr[fa]
    d_tmp = np.einsum('nij,nj->ni', R1, A0 - K0)
    R2 = RG.align(d_tmp, A2 - K)
    Wr2[fa] = R2 @ f_tmp
    Wr2[hd] = hand_rot
    Q2, _ = AL.local_from_world(rig, Wr2, hips)
    Qo = Q.copy()
    for n in (ua, fa, hd):
        Qo[:, rig.idx[n]] = Q2[:, rig.idx[n]]
    return Qo


def solve_clip(clip, work):
    Q0, T, S, keys, w, dec = combine(work, clip)
    arms = [CH.rig.idx[b + s] for b in ('upper_arm.', 'forearm.', 'hand.') for s in 'LR']
    n = len(Q0)
    roots = np.array([SL.root_matrix(clip, k / SL.FPS, CH.dur[clip]) for k in range(n)])
    per = clip == 'sit_hold'
    lift = {s: np.zeros((n, 3)) for s in 'LR'}
    Q = Q0
    hist = []
    for it in range(ITERS + 1):
        depth = {s: np.zeros(n) for s in 'LR'}
        push = {s: np.zeros((n, 3)) for s in 'LR'}
        if dec is not None:          # the runtime cloth (reduced clip) with this iteration's arms
            Qm, Tm, Sm = dec[0].copy(), dec[1], dec[2]
            Qm[:, arms] = Q[:, arms]
        else:
            Qm, Tm, Sm = Q, T, S
        for k in range(n):
            W = roots[k][None] @ CH.rig.fk(Tm[k][None], Qm[k][None], Sm[k][None])[0]
            layers = cloth(W, keys, w[k])
            for s in 'LR':
                depth[s][k], nk = hand_depth(W, layers, s)
                push[s][k] = depth[s][k] * nk
        hist.append({s: round(float(depth[s].max() - HAND_GAP) * 1000, 1) for s in 'LR'})
        if it == ITERS or max(depth[s].max() for s in 'LR') < 0.0005:
            break
        Q = Q0
        for s in 'LR':
            dm = np.einsum('nji,nj->ni', roots[:, :3, :3], push[s])   # world -> model
            add = np.stack([AL.gauss(AL.maxfilt(dm[:, i], 2, per), 1.5, per) for i in range(3)], 1)
            lift[s] = lift[s] + add * 1.1
            Q = arm_ik(T, Q, s, lift[s])
    final_in = {s: hist[-1][s] for s in 'LR'}
    np.savez(os.path.join(work, 'final_%s.npz' % clip), Q=Q, T=T, S=S, loop=per)
    return dict(hand_in_cloth_mm_before=hist[0], hand_in_cloth_mm_after=final_in, iterations=hist,
                lift_max_mm={s: round(float(np.linalg.norm(lift[s], axis=1).max()) * 1000, 1) for s in 'LR'},
                lift_mm={s: np.round(np.linalg.norm(lift[s], axis=1) * 1000, 1).tolist() for s in 'LR'},
                depth_mm={s: np.round((depth[s] - HAND_GAP) * 1000, 1).tolist() for s in 'LR'})


def main():
    global CH, HAND_IDS
    a = sys.argv[sys.argv.index('--') + 1:]
    glb, work = a[:2]
    CH = SL.Character(glb)
    HAND_IDS = {s: np.array([i for i in CH.ids['hand'] if CH.body_bone[i].endswith('.' + s)]) for s in 'LR'}
    rep = {c: solve_clip(c, work) for c in SL.CLIPS}
    print(json.dumps(rep))
    with open(os.path.join(work, 'fix_hands.json'), 'w') as f:
        json.dump(dict(hand_gap_mm=HAND_GAP * 1000, clips=rep), f, indent=1)


if __name__ == '__main__':
    main()
