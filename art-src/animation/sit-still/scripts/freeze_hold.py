# Hold sit_hold at its frame 0 (the settled drape) for the whole 2 s loop.
#   python3 freeze_hold.py <in.glb> <out.glb> [--lift 0.015]
# Every joint channel in sit_hold becomes two identical LINEAR keys (t=0 and t=duration) of the
# frame-0 local pose. Other clips, shape keys, bones and materials are not rewritten.
# --lift raises both wrists by that many metres in world +Y (glTF up) with a two-bone IK, and keeps
# the hand world rotation, so the palm moves up without tilting. Skirt bones stay on the settled frame.
import argparse, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'sit-drape', 'scripts'))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'mocap', 'scripts'))
import rig as RG
from glb_edit import Glb

ARMS = ('upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R')


def two_bone(H, A, pole, L1, L2, max_ext=0.999):
    """H shoulder, A wrist target, pole elbow hint. Each (3,). Returns elbow, wrist, clamped."""
    d = A - H
    dl = np.linalg.norm(d)
    u = d / max(dl, 1e-9)
    dl2 = min(dl, (L1 + L2) * max_ext)
    ca = (L1 * L1 + dl2 * dl2 - L2 * L2) / (2 * L1 * dl2)
    al = np.arccos(np.clip(ca, -1, 1))
    pv = pole - H
    v = pv - u * np.dot(pv, u)
    vn = np.linalg.norm(v)
    v = v / max(vn, 1e-9)
    K = H + L1 * (np.cos(al) * u + np.sin(al) * v)
    return K, H + u * dl2, dl > (L1 + L2) * max_ext


def qang(a, b):
    d = np.clip(np.abs(np.sum(a * b, -1)), 0, 1)
    return np.degrees(2 * np.arccos(d))


def lift_hands(rig, T, R, lift):
    """New local rotations. Wrists move to world +Y by `lift`; palm world rotation stays."""
    R = np.array(R, float, copy=True)
    W = rig.fk(T[None], R[None])[0]
    report = {}
    for side in 'LR':
        iu, ifo, ih = (rig.idx['upper_arm.' + side], rig.idx['forearm.' + side], rig.idx['hand.' + side])
        S, E0, H0 = W[iu, :3, 3], W[ifo, :3, 3], W[ih, :3, 3]
        Rw = {iu: W[iu, :3, :3], ifo: W[ifo, :3, :3], ih: W[ih, :3, :3]}
        L1, L2 = np.linalg.norm(E0 - S), np.linalg.norm(H0 - E0)
        target = H0 + np.array([0.0, lift, 0.0])
        K, H2, clamped = two_bone(S, target, E0, L1, L2)
        R1 = RG.align((E0 - S)[None], (K - S)[None])[0]
        R2 = RG.align((R1 @ (H0 - E0))[None], (H2 - K)[None])[0]
        new_u = R1 @ Rw[iu]
        new_f = R2 @ (R1 @ Rw[ifo])
        new_h = Rw[ih]
        Rp = W[rig.parent[iu], :3, :3]
        R[iu] = RG.m2q(Rp.T @ new_u)
        R[ifo] = RG.m2q(new_u.T @ new_f)
        R[ih] = RG.m2q(new_f.T @ new_h)
        W2 = rig.fk(T[None], R[None])[0]
        got = W2[ih, :3, 3] - H0
        twist = qang(RG.m2q(W2[ih, :3, :3]), RG.m2q(Rw[ih]))
        report[side] = dict(clamped=bool(clamped), wrist_mm=[round(float(x) * 1000, 2) for x in got],
                            palm_twist_deg=round(float(twist), 3),
                            elbow_mm=round(float(np.linalg.norm(W2[ifo, :3, 3] - E0)) * 1000, 2))
        if abs(got[1] - lift) > 2e-4 or abs(got[0]) > 2e-4 or abs(got[2]) > 2e-4:
            raise SystemExit('wrist did not land on the lift target: ' + str(report[side]))
        if twist > 0.05:
            raise SystemExit('palm orientation changed: ' + str(report[side]))
    return R, report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('out')
    ap.add_argument('--lift', type=float, default=0.0, help='metres, world up, both hands')
    a = ap.parse_args()
    rig = RG.Rig(a.inp)
    dur = float(rig.clip_duration('sit_hold'))
    T, R, S = rig.sample_clip('sit_hold', [0.0])
    T0, R0 = T[0].copy(), R[0].copy()
    lifted = None
    if a.lift:
        R0, lifted = lift_hands(rig, T0, R0, a.lift)
        # the dress / apron are not weighted to the arms; prove the settled cloth does not move
        # R[0] is the original sample; R0 is the lifted pose. Cloth is not weighted to the arms.
        Wb = rig.fk(T0[None], R[0][None])[0]
        Wa = rig.fk(T0[None], R0[None])[0]
        for mesh in ('LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW'):
            md = rig.mesh_data(mesh)
            d = np.linalg.norm(rig.skin(md, Wa) - rig.skin(md, Wb), axis=1).max()
            if d > 1e-6:
                raise SystemExit('%s moved %.4f mm when only the hands were lifted' % (mesh, d * 1000))
    an = rig.clips['sit_hold']
    rots, tras = {}, {}
    for ch in an['channels']:
        nm = rig.J['nodes'][ch['target']['node']]['name']
        j = rig.idx[nm]
        if ch['target']['path'] == 'rotation':
            rots[nm] = (np.array([0.0, dur]), np.repeat(R0[j][None], 2, 0))
        elif ch['target']['path'] == 'translation':
            tras[nm] = (np.array([0.0, dur]), np.repeat(T0[j][None], 2, 0))
    g = Glb(a.inp)
    g.replace_channels('sit_hold', rots, 'rotation')
    g.replace_channels('sit_hold', tras, 'translation')
    size = g.save(a.out)
    # the held pose matches frame 0 (arms included only when they were not lifted)
    out = RG.Rig(a.out)
    times = np.linspace(0, dur, 9)
    Tt, Rt, St = out.sample_clip('sit_hold', times)
    base = RG.Rig(a.inp)
    Tb, Rb, Sb = base.sample_clip('sit_hold', [0.0])
    worst = 0.0
    for i, n in enumerate(out.names):
        refR = R0[i] if a.lift and n in ARMS else Rb[0, i]
        refT = T0[i]
        ang = float(qang(Rt[:, i], refR).max())
        dist = float(np.linalg.norm(Tt[:, i] - refT, axis=1).max())
        worst = max(worst, ang, dist * 1000)
        if ang > 0.05 or dist > 1e-5:
            raise SystemExit('sit_hold %s still moves: %.3f deg %.3f mm' % (n, ang, dist * 1000))
    # every other clip is the same pose it was
    clip_err = {}
    for name in base.clips:
        if name == 'sit_hold':
            continue
        d = base.clip_duration(name)
        ts = np.linspace(0, d, 5)
        A = base.sample_clip(name, ts)
        B = out.sample_clip(name, ts)
        ang = float(qang(A[1], B[1]).max())
        dist = float(np.linalg.norm(A[0] - B[0], axis=-1).max())
        clip_err[name] = round(max(ang, dist * 1000), 5)
        if ang > 0.02 or dist > 1e-5:
            raise SystemExit('%s changed: %.4f deg %.4f mm' % (name, ang, dist * 1000))
    print(dict(bytes=size, duration=dur, lift_m=a.lift, held_worst=round(worst, 4), hands=lifted, other_clips=clip_err))


if __name__ == '__main__':
    main()
