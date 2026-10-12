# Nearest-neighbour index without scipy (Blender's bundled Python has numpy only).
import numpy as np


def nearest(A, B, chunk=512):
    """for every row of B, the index of the nearest row of A."""
    A = np.asarray(A, float)
    B = np.asarray(B, float)
    out = np.empty(len(B), int)
    a2 = (A * A).sum(1)
    for i in range(0, len(B), chunk):
        b = B[i:i + chunk]
        d = a2[None, :] - 2 * b @ A.T
        out[i:i + chunk] = np.argmin(d, 1)
    return out
