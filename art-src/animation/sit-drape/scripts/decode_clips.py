# Sample the sit clips back out of a written GLB (after the key reduction) into work/drape_<mesh>.npz (Q_ / T_ / S_ per
# clip, every joint), so key_pocs.py solves the keys on exactly what the runtime plays.  The solved curves are kept as
# Qs_ / Ts_ / Ss_ (first decode only): fix_hands.py / build_glb.py reduce those again, not the already reduced ones.
#   python3 decode_clips.py <glb> <work_dir>
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402


def main():
    glb, work = sys.argv[1:3]
    rig = SL.RG.Rig(glb)
    for mesh in ('DRESS', 'APRON', 'BOW'):
        p = os.path.join(work, 'drape_%s.npz' % mesh)
        if not os.path.exists(p):
            continue
        d = dict(np.load(p))
        for c in SL.CLIPS:
            n = len(d['Q_' + c])
            T, R, S = rig.sample_clip(c, np.arange(n) / SL.FPS)
            err = np.abs(np.abs(np.sum(R * d['Q_' + c], -1)) - 1).max()
            for a in 'QTS':
                d.setdefault(a + 's_' + c, d[a + '_' + c])
            d['Q_' + c], d['T_' + c], d['S_' + c] = R, T, S
            print(mesh, c, 'max |1-|q.q0|| %.2e' % err)
        np.savez(p, **d)


if __name__ == '__main__':
    main()
