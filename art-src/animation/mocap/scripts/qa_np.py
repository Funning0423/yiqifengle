# Quick numpy QA of a world-space pose track (same measures as the old loco_qa.py, without Blender):
# foot slide = largest travel of any sole vertex while it stays below 1 mm (per stance), signed knee angle (negative =
# hyperextension), knee velocity / acceleration spikes, lowest sole vertex.
import numpy as np
import clipbuild as CB
import author_lib as AL


def resample(tr, sub):
    n = len(tr[1])
    return CB.tr_resample(tr, np.arange((n - 1) * sub + 1) / sub)


def foot_slide(tr, sub=2, tol=0.001):
    t2 = resample(tr, sub)
    cx = CB.ctx()
    W = CB.fk(*t2)
    out = {}
    low = np.inf
    for s in 'LR':
        V = cx.foot_verts(W, s)
        low = min(low, V[..., 1].min())
        below = V[..., 1] < tol
        worst, wf = 0.0, None
        for v in range(V.shape[1]):
            for a, b in AL.intervals(below[:, v]):
                if b > a:
                    d = np.linalg.norm(V[a:b + 1, v] - V[a, v], axis=1).max()
                    if d > worst:
                        worst, wf = d, a / sub
        out[s] = dict(slide_mm=round(worst * 1000, 2), at_frame=wf)
    out['min_sole_mm'] = round(low * 1000, 2)
    return out


def knees(tr):
    r = CB.rig()
    W = CB.fk(*tr)
    out = {}
    for s in 'LR':
        H, K, A = (W[:, r.idx[b + '.' + s], :3, 3] for b in ('thigh', 'shin', 'foot'))
        a, b = K - H, A - K
        ang = np.degrees(np.arccos(np.clip(np.sum(a * b, 1) / np.linalg.norm(a, axis=1) / np.linalg.norm(b, axis=1), -1, 1)))
        # flexion sign: the knee bends toward the thigh's -Z (shin swings back); hyperextension = opposite side
        ax = np.cross(a, b)
        lat = W[:, r.idx['thigh.' + s], :3, 0]
        sg = np.sign(np.sum(ax * lat, 1))
        ref = np.sign(np.median(sg[ang > 10])) if (ang > 10).any() else 1.0
        signed = np.where(sg * ref >= 0, ang, -ang)
        v = np.diff(signed) * CB.FPS
        acc = np.diff(v) * CB.FPS
        out[s] = dict(min_deg=round(float(signed.min()), 2), max_deg=round(float(signed.max()), 1),
                      max_vel_dps=round(float(np.abs(v).max()), 0), max_acc_dps2=round(float(np.abs(acc).max()), 0),
                      max_step_deg=round(float(np.abs(np.diff(signed)).max()), 2))
    return out


def report(clip):
    tr = clip['world'] if clip.get('world') is not None else clip['track']
    return dict(feet=foot_slide(tr), knees=knees(tr), plant={s: v for s, v in clip['info'].get('plant', {}).items()})
