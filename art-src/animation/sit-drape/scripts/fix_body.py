# Stage 1 (python3): seat contact.  While she is seated the lowest buttock / thigh skin point is held BODY_GAP above the seat
# surface (the dress lies in between); the mocap lifted it up to 31 mm off the seat in sit_hold.  The hips bone is moved
# straight down (world), thigh / shin are re-solved with two-bone IK so the ankles and foot rotations stay where they were.
# The head is kept HEAD_GAP off the backrest top rail with a small forward nod (neck + head).
#   blender -b -P fix_body.py -- <glb> <out_dir>      -> out_dir/body_<clip>.npz (Q, T dense 30 fps local pose), body_fix.json
import json
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402
import author_lib as AL  # noqa: E402

BODY_GAP = 0.0045          # skin above the seat surface where she sits (dress layer pressed in between)
RAMP = 6                   # frames over which the correction fades in / out around the landing / lift-off frame


def dense(ch, clip):
    ts = SL.frame_times(clip, ch.dur[clip])
    T, R, _ = ch.rig.sample_clip(clip, ts)
    return ts, T, R


def seat_gap(ch, chair, clip, ts, T, R):
    """lowest hips / thigh skin point above the seat surface per frame (m), +inf where nothing is over the slab."""
    ids = np.concatenate([ch.ids['hips'], ch.ids['thigh']])
    out = np.full(len(ts), np.inf)
    for i, t in enumerate(ts):
        W = ch.joints(clip, t, (T[i], R[i]))
        P = ch.skin('BODY', W)[ids]
        L = SL.to_chair(P)
        h = chair.seat_height(L)
        ok = np.isfinite(h)
        if ok.any():
            out[i] = (L[ok, 1] - h[ok]).min()
    return out


def seated_weight(clip, g):
    n = len(g)
    if clip == 'sit_hold':
        return np.ones(n)
    on = g < BODY_GAP + 0.012
    w = np.zeros(n)
    if clip == 'sit_down':
        k = int(np.argmax(on)) if on.any() else n
        for i in range(n):
            w[i] = 1.0 if i >= k else AL.smoothstep(1 - (k - i) / RAMP)
    else:
        k = n - 1 - int(np.argmax(on[::-1])) if on.any() else -1
        for i in range(n):
            w[i] = 1.0 if i <= k else AL.smoothstep(1 - (i - k) / RAMP)
    return w


def lower_hips(ch, T, R, dy):
    """hips down by dy[n] (world m, clip root frame) with leg IK keeping ankles + foot rotations."""
    rig = ch.rig
    cx = AL.Ctx(rig)
    Wr, hips = AL.world_from_local(rig, R, T)
    W0 = rig.fk(T, R)
    ank = {s: W0[:, rig.idx['foot.' + s], :3, 3].copy() for s in 'LR'}
    frot = {s: Wr['foot.' + s].copy() for s in 'LR'}
    hips2 = hips.copy()
    hips2[:, 1] -= dy
    Wr2 = dict(Wr)
    for s in 'LR':
        Wr2, clamped = AL.apply_leg_ik(cx, Wr2, hips2, s, ank[s], frot[s])
        assert not clamped.any()
    Q2, _ = AL.local_from_world(rig, Wr2, hips2)
    T2 = T.copy()
    i = rig.idx['hips']
    Rroot = RG_q2m(R[:, rig.idx['root']])
    T2[:, i] = T[:, i] - np.einsum('nji,nj->ni', Rroot, np.stack([np.zeros(len(dy)), dy, np.zeros(len(dy))], 1))
    Q = R.copy()
    for nm in ('thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R'):
        Q[:, rig.idx[nm]] = Q2[:, rig.idx[nm]]
    W1 = rig.fk(T2, Q)
    err = max(np.abs(W1[:, rig.idx['foot.' + s], :3, 3] - ank[s]).max() for s in 'LR')
    return T2, Q, err


def RG_q2m(q):
    return SL.RG.q2m(q)


def rot_x(a):
    c, s = np.cos(a), np.sin(a)
    R = np.zeros((len(a), 3, 3))
    R[:, 0, 0] = 1
    R[:, 1, 1], R[:, 1, 2], R[:, 2, 1], R[:, 2, 2] = c, -s, s, c
    return R


def rotate_world(rig, T, Q, name, Rd):
    """rotate joint `name` by Rd [n,3,3] about its own pivot in the clip root frame (children follow)."""
    W = rig.fk(T, Q)
    i = rig.idx[name]
    P = W[:, rig.parent[i], :3, :3]
    P = P / np.linalg.norm(P, axis=-2, keepdims=True)
    L = SL.RG.q2m(Q[:, i])
    Q = Q.copy()
    Q[:, i] = SL.RG.m2q(np.transpose(P, (0, 2, 1)) @ Rd @ P @ L)
    return Q


def head_clear(ch, chair, clip, ts, T, Q):
    out = np.zeros(len(ts))
    for k, t in enumerate(ts):
        W = ch.joints(clip, t, (T[k], Q[k]))
        out[k] = chair.signed(ch.skin('BODY', W)[ch.ids['head']]).min()
    return out


def nod(ch, T, Q, a):
    """forward nod by a [n] rad, split over neck and head (keeps the arms / hands where they are)."""
    Q = rotate_world(ch.rig, T, Q, 'neck', rot_x(a * 0.5))
    return rotate_world(ch.rig, T, Q, 'head', rot_x(a * 0.5))


def fix_head(ch, chair, clip, ts, T, Q):
    """the back of the head touched the backrest top rail while she leans back (sit_down 28-29 in the mocap, sit_hold
    20-27 once the hips sit lower): nod forward just enough to keep HEAD_GAP, smoothed in time."""
    c0 = head_clear(ch, chair, clip, ts, T, Q)
    a = np.zeros(len(ts))
    per = clip == 'sit_hold'
    c = c0
    for _ in range(6):
        need = HEAD_GAP - c
        if need.max() <= 0.0005:
            break
        a = a + np.clip(need, 0, None) / 0.14
        a = envelope(a, per)
        c = head_clear(ch, chair, clip, ts, T, nod(ch, T, Q, a))
    return nod(ch, T, Q, a), a, c0, c


def envelope(a, periodic):
    return AL.gauss(AL.maxfilt(a, 3, periodic), 1.5, periodic)


HEAD_GAP = 0.010


def main():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    glb, out = a[0], a[1]
    os.makedirs(out, exist_ok=True)
    ch = SL.Character(glb)
    chair = SL.Chair()
    rep = {}
    for clip in SL.CLIPS:
        ts, T, R = dense(ch, clip)
        g = seat_gap(ch, chair, clip, ts, T, R)
        w = seated_weight(clip, g)
        dy = (np.where(np.isfinite(g), g, BODY_GAP) - BODY_GAP) * w
        T2, Q2, err = lower_hips(ch, T, R, dy)
        Q2, nod_a, hc0, hc = fix_head(ch, chair, clip, ts, T2, Q2)
        g2 = seat_gap(ch, chair, clip, ts, T2, Q2)
        np.savez(os.path.join(out, 'body_%s.npz' % clip), Q=Q2, T=T2, t=ts, loop=clip == 'sit_hold')
        fin = np.isfinite(g)
        rep[clip] = dict(frames=len(ts), lowered_max_mm=round(float(dy.max()) * 1000, 1), raised_max_mm=round(float(-dy.min()) * 1000, 1),
                         ankle_err_mm=round(err * 1000, 3),
                         gap_before_mm=[None if not np.isfinite(x) else round(x * 1000, 1) for x in g],
                         gap_after_mm=[None if not np.isfinite(x) else round(x * 1000, 1) for x in g2],
                         weight=[round(float(x), 3) for x in w],
                         head_nod_deg=[round(float(np.degrees(x)), 2) for x in nod_a],
                         head_clear_before_mm=[round(float(x) * 1000, 1) for x in hc0],
                         head_clear_after_mm=[round(float(x) * 1000, 1) for x in hc])
        print(clip, 'head clear %.1f -> %.1f mm nod max %.1f deg' % (hc0.min() * 1000, hc.min() * 1000, np.degrees(nod_a.max())), 'dy max %.1f mm min %.1f mm ankle err %.3f mm' % (dy.max() * 1000, dy.min() * 1000, err * 1000),
              'gap after (seated) %.1f..%.1f' % (np.nanmin(np.where(w > 0.99, g2, np.nan)) * 1000, np.nanmax(np.where(w > 0.99, g2, np.nan)) * 1000)
              if (w > 0.99).any() and fin.any() else '')
    with open(os.path.join(out, 'body_fix.json'), 'w') as f:
        json.dump(dict(body_gap_mm=BODY_GAP * 1000, clips=rep), f, indent=1)


if __name__ == '__main__':
    main()
