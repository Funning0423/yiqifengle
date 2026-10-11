# loco_qa.py's foot-slide measure in numpy: a stance is every run of samples where any sole vertex of that foot is below
# 2 mm; inside it each vertex's travel is measured over all its samples below 1 mm (not only consecutive ones), so a
# shuffle step that never clears 2 mm counts as slide.  Same 4 samples per frame as loco_qa.
import numpy as np
import clipbuild as CB
import author_lib as AL

TOL1, TOL2 = 0.001, 0.002


def loco_slide(tr, sub=4):
    n = len(tr[1])
    t2 = CB.tr_resample(tr, np.arange((n - 1) * sub + 1) / sub)
    cx = CB.ctx()
    W = CB.fk(*t2)
    out = {}
    for s in 'LR':
        V = cx.foot_verts(W, s)
        low = V[..., 1].min(1)
        segs = []
        for a, b in AL.intervals(low < TOL2):
            P = V[a:b + 1]
            below = P[..., 1] < TOL1
            worst = 0.0
            for v in np.nonzero(below.any(0))[0]:
                q = P[below[:, v], v]
                worst = max(worst, float(np.linalg.norm(q - q[0], axis=1).max()))
            segs.append(dict(frames='%.2f..%.2f' % (a / sub, b / sub), planted_mm=round(worst * 1000, 2)))
        out[s] = dict(max_mm=max([x['planted_mm'] for x in segs] + [0]), stances=segs)
    return out
