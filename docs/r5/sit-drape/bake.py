# projection bake of sit_drape (DRESS/APRON/BOW) against reading_chair stool at sit_hold f0. env: OFFD/OFFA/OFFB (m), OUT
import bpy, os, json, math, numpy as np, mathutils
from mathutils.bvhtree import BVHTree
from mathutils import Vector
exec(open('/workspace/u3/tools/u3_scene.py').read())
OUT = os.environ['OUT']; OFF = {'LOD0_G2_DRESS': float(os.environ.get('OFFD', .004)), 'LOD0_G2_APRON': float(os.environ.get('OFFA', .008)), 'LOD0_G2_BOW': float(os.environ.get('OFFB', .010))}
RIM = float(os.environ.get('RIM', .006))
ITER = int(os.environ.get('ITER', 6))
O = {o.name: o for o in CH_MESH}
def ev(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world
    P = np.array([tuple(M @ v.co) for v in me.vertices]); oe.to_mesh_clear(); return P
def tris(o):
    me = o.data; me.calc_loop_triangles(); return [tuple(t.vertices) for t in me.loop_triangles]
# stool seat params
sv = ev(STOOL_MESH[0]); top = sv[sv[:, 2] > sv[:, 2].max() - .004]
C = (top[:, :2].max(0) + top[:, :2].min(0)) / 2; R = np.hypot(*(top[:, :2] - C).T).max(); ZT = sv[:, 2].max()
print('SEAT', C, R, ZT)
stt = tris(STOOL_MESH[0]); bst = BVHTree.FromPolygons([Vector(p) for p in sv], stt)
bo = O['LOD0_G2_BODY']; bp = ev(bo); bbody = BVHTree.FromPolygons([Vector(p) for p in bp], tris(bo))
def body_sd(p):
    loc, n, i, d = bbody.find_nearest(Vector(p), .2)
    if loc is None: return 1.0
    return d if (Vector(p) - loc).dot(n) >= 0 else -d
def stool_inside(p, m):
    loc, n, i, d = bst.find_nearest(Vector(p), .3)
    if loc is None: return False, None
    sd = d if (Vector(p) - loc).dot(n) >= 0 else -d
    return sd < m, (loc, n, sd)
HIP = np.array(tuple(MW_ := (arm.matrix_world @ arm.pose.bones['hips'].head)))[:2] if 'hips' in arm.pose.bones else C
print('HIP', HIP)
RC = .015
def exit_s(o2, u, Rr):  # distance along ray o2 + s u to circle(C, Rr)
    w = o2 - C; b_ = w @ u; c_ = w @ w - Rr * Rr; return -b_ + math.sqrt(max(b_ * b_ - c_, 0))
def target(p, off):
    x, y, z = p; q2 = np.array([x, y]); v = q2 - HIP; nv = np.linalg.norm(v); u = v / nv if nv > 1e-6 else np.array([1., 0.])
    Rt = R + off + RIM; zt = ZT + off; r = np.linalg.norm(q2 - C); d = zt - z
    if d <= -.002 or z < ZT - .09 or r >= Rt: return None
    d = max(d, 0); se = exit_s(q2, u, Rt - RC)   # flat run to the start of the rounded edge
    s = 0.0; left = d
    while s < se:   # skip body footprint (cloth can't be between thigh and seat, 0.5 mm gap)
        if body_sd(np.r_[q2 + u * s, zt]) < off: s += .004; se = max(se, s); continue
        st = min(.004, se - s, left); s += st; left -= st
        if left <= 1e-9: return np.r_[q2 + u * s, zt]
    e2 = q2 + u * se; uo = (e2 - C) / max(1e-9, np.linalg.norm(e2 - C))
    arc = RC * math.pi / 2
    if left < arc:
        t = left / RC; return np.r_[e2 + uo * RC * math.sin(t), zt - RC * (1 - math.cos(t))]
    return np.r_[e2 + uo * RC, zt - RC - (left - arc)]
res = {}
for name in ['LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW']:
    o = O[name]; me = o.data
    if not me.shape_keys or 'sit_drape' not in me.shape_keys.key_blocks:
        if not me.shape_keys: o.shape_key_add(name='Basis', from_mix=False)
        o.shape_key_add(name='sit_drape', from_mix=False)
    kb = me.shape_keys.key_blocks['sit_drape']; kb.value = 1.0
    n = len(me.vertices); K0 = np.array([tuple(k.co) for k in kb.data])
    P0 = ev(o); Jm = np.zeros((n, 3, 3)); h = .01
    for a in range(3):
        K = K0.copy(); K[:, a] += h
        for i, k in enumerate(kb.data): k.co = Vector(K[i])
        Jm[:, :, a] = (ev(o) - P0) / h
    for i, k in enumerate(kb.data): k.co = Vector(K0[i])
    bpy.context.view_layer.update()
    # adjacency
    nb = [[] for _ in range(n)]
    for e in me.edges: a_, b_ = e.vertices; nb[a_].append(b_); nb[b_].append(a_)
    grp = {}
    for i, v in enumerate(me.vertices): grp.setdefault(tuple(np.round(np.array(v.co), 5)), []).append(i)
    G = [g for g in grp.values() if len(g) > 1]
    def weld(D):
        for g in G: D[g] = D[g].mean(0)
        return D
    print('SEAMS', name, n, len(G))
    off = OFF[name]; D = np.zeros((n, 3)); fixed = np.zeros(n, bool)
    for i in range(n):
        t = target(P0[i], off)
        if t is not None: D[i] = t - P0[i]; fixed[i] = True
    moved0 = fixed.sum()
    for it in range(ITER):
        Dn = D.copy()
        for i in range(n):
            if nb[i]: Dn[i] = .5 * D[i] + .5 * np.mean(D[nb[i]], 0)
        D = weld(Dn)
        for i in range(n):  # re-enforce: anything still in the seat column goes back to its projection
            t = target(P0[i] + D[i], off)
            if t is not None: D[i] = t - P0[i]
    # final push-out from any stool surface (rim/legs) along the surface normal
    pushed = 0
    for rep in range(3):
        for i in range(n):
            ins, info = stool_inside(P0[i] + D[i], off * .5)
            if ins and info[2] > -.15:
                loc, nrm, sd = info; D[i] += np.array(nrm) * (off * .5 - sd); pushed += 1
    # edge-level clearance vs stool + body push-out for moved verts (alternate)
    mv = np.linalg.norm(D, axis=1) > 1e-6; ehit = 0; bpush = 0
    EDG = [tuple(e.vertices) for e in me.edges]
    for rep in range(int(os.environ.get('EREP', 6))):
        hitn = 0
        for a_, b_ in EDG:
            if not (mv[a_] or mv[b_]): continue
            pa = Vector(P0[a_] + D[a_]); pb = Vector(P0[b_] + D[b_]); dv = pb - pa; L = dv.length
            if L < 1e-7: continue
            for s0, s1 in ((pa, dv), (pb, -dv)):
                loc, nrm, idx, dist = bst.ray_cast(s0, s1.normalized(), L)
                if loc is not None:
                    nn = np.array(nrm)
                    D[a_] += nn * .002; D[b_] += nn * .002; mv[a_] = mv[b_] = True; hitn += 1; break
        for i in np.where(mv)[0]:
            sd = body_sd(P0[i] + D[i])
            if sd < .001 and body_sd(P0[i]) >= .001:
                loc, nrm, _, _ = bbody.find_nearest(Vector(P0[i] + D[i]), .2); D[i] += np.array(nrm) * (.002 - sd); bpush += 1
        D = weld(D); ehit += hitn
        if hitn == 0: break
    print('EDGE', name, 'edge hits', ehit, 'body pushes', bpush)
    D = weld(D)
    dk = np.linalg.solve(Jm + np.eye(3) * 1e-9, D[:, :, None])[:, :, 0]
    K1 = K0 + dk
    for i, k in enumerate(kb.data): k.co = Vector(K1[i])
    basis = np.array([tuple(v.co) for v in me.vertices])
    res[name] = dict(key=K1.tolist(), basis=basis.tolist(), moved=int(moved0), pushed=pushed, maxdisp_mm=round(float(np.linalg.norm(D, axis=1).max()) * 1000, 1))
    print('BAKE', name, 'proj', moved0, 'pushed', pushed, 'maxdisp mm', res[name]['maxdisp_mm'])
bpy.context.view_layer.update()
json.dump(res, open(OUT, 'w'))
