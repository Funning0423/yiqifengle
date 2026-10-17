"""Blender-side helpers (bpy) for the M5 A5.1 candidate. Import inside Blender 4.5 only."""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def world_mesh(o, dg=None):
    dg = dg or bpy.context.evaluated_depsgraph_get()
    oe = o.evaluated_get(dg); me = oe.to_mesh(); mw = o.matrix_world
    V = [mw @ v.co for v in me.vertices]; F = [tuple(p.vertices) for p in me.polygons]
    oe.to_mesh_clear(); return V, F

def bvh_of(o, dg=None):
    V, F = world_mesh(o, dg); return BVHTree.FromPolygons(V, F)

def components_vf(V, F, merge=1e-5):
    """connected components (after welding coincident verts) -> list of (vert index list, face index list)"""
    key = {}; rep = []
    for i, v in enumerate(V):
        k = (round(v.x / merge), round(v.y / merge), round(v.z / merge))
        rep.append(key.setdefault(k, i))
    par = list(range(len(V)))
    def f(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for poly in F:
        r0 = f(rep[poly[0]])
        for vi in poly[1:]:
            r = f(rep[vi])
            if r != r0: par[r] = r0
    groups = {}
    for i in range(len(V)): groups.setdefault(f(rep[i]), [[], []])[0].append(i)
    for fi, poly in enumerate(F): groups[f(rep[poly[0]])][1].append(fi)
    return list(groups.values())

def convex_planes(V, F, fidx):
    """outward planes (n, d) for a closed convex component given by its faces"""
    cen = sum((V[i] for fi in fidx for i in F[fi]), Vector()) / sum(len(F[fi]) for fi in fidx)
    planes = []
    for fi in fidx:
        p = [V[i] for i in F[fi]]
        n = (p[1] - p[0]).cross(p[2] - p[0])
        if n.length < 1e-12: continue
        n.normalize()
        if n.dot(cen - p[0]) > 0: n = -n
        planes.append((n, n.dot(p[0])))
    return planes

def inside_convex(p, planes, tol=1e-3):
    return all(n.dot(p) - d <= tol for n, d in planes)

def ground_bvh():
    return bvh_of(bpy.data.objects['env_island_main'])

def ground_z(bvh, x, y):
    h = bvh.ray_cast(Vector((x, y, 6.0)), Vector((0, 0, -1)), 30.0)
    return h[0].z if h[0] is not None else None

def node_path(o):
    p = [o.name]; q = o.parent
    while q is not None: p.append(q.name); q = q.parent
    return '/'.join(reversed(p))

import numpy as np

def tri_array(V, F):
    T = []
    for poly in F:
        for k in range(1, len(poly) - 1):
            T.append((V[poly[0]][:], V[poly[k]][:], V[poly[k + 1]][:]))
    return np.array(T, dtype=np.float64)  # (n,3,3)

def winding(points, T):
    """generalized winding number of each point w.r.t. triangle soup T (closed meshes -> ~0 outside, ~+-1 inside).
    Robust to coincident internal faces of touching boxes (they cancel)."""
    P = np.asarray(points, dtype=np.float64)
    out = np.zeros(len(P))
    for s in range(0, len(P), 256):
        p = P[s:s + 256][:, None, None, :]
        A = T[None, :, 0, :] - p[:, :, 0, :]; B = T[None, :, 1, :] - p[:, :, 0, :]; C = T[None, :, 2, :] - p[:, :, 0, :]
        a = np.linalg.norm(A, axis=2); b = np.linalg.norm(B, axis=2); c = np.linalg.norm(C, axis=2)
        num = np.einsum('ijk,ijk->ij', A, np.cross(B, C))
        den = a * b * c + np.einsum('ijk,ijk->ij', A, B) * c + np.einsum('ijk,ijk->ij', B, C) * a + np.einsum('ijk,ijk->ij', C, A) * b
        out[s:s + 256] = (2 * np.arctan2(num, den)).sum(1) / (4 * np.pi)
    return out
