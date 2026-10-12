# Stage 3c (python3): resolved settled-frame positions (resolve.py) -> bind-space shape-key deltas.
#   python3 finalize.py <comp.npz> <resolved.npz> <out comp.npz>
import sys
import numpy as np
import sddata as D
from compose import to_bind


def main():
    comp, res = dict(np.load(sys.argv[1])), np.load(sys.argv[2])
    c = D.Char()
    _, _, S0 = c.local('sit_hold', 0.0)
    W = c.world(comp['T'], comp['Rq'], S0)
    P1 = c.skin('DRESS', W)
    PA = c.skin('APRON', W)
    movD = res['movD'].astype(bool)
    dD = to_bind(c, W, 'DRESS', res['XD'] - P1)
    dD[~movD] = 0
    dA = to_bind(c, W, 'APRON', res['XA'] - PA)
    dA[np.linalg.norm(dA, axis=1) < 1e-6] = 0
    print('dress verts', int(movD.sum()), 'bytes', int(movD.sum()) * 14, '| apron verts', int((np.abs(dA).sum(1) > 0).sum()))
    print('max change vs compose mm: dress %.2f apron %.2f' % (np.linalg.norm(res['XD'] - comp['dress_world'], axis=1).max() * 1e3,
                                                             np.linalg.norm(res['XA'] - comp['apron_world'], axis=1).max() * 1e3))
    comp.update(dress_delta=dD, apron_delta=dA, dress_world=res['XD'], apron_world=res['XA'])
    np.savez(sys.argv[3], **comp)


if __name__ == '__main__':
    main()
