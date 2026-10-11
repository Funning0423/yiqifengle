# Shared clip-authoring steps on top of retarget.py (numpy, glTF space: Y up, +Z her forward, +X her left).
# A "pose track" is: Wr = {bone: [n,3,3] world rotation} for the mapped body bones + hips [n,3] world position.
import numpy as np
import rig as RG
import retarget as RT

LEGS = {'L': ('thigh.L', 'shin.L', 'foot.L'), 'R': ('thigh.R', 'shin.R', 'foot.R')}
NONLEG = ['hips', 'spine', 'chest', 'neck', 'head', 'upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R']


class Ctx:
    """rig + cached sole-vertex data."""

    def __init__(self, rig):
        self.rig = rig
        md = rig.mesh_data('LOD0_G2_BODY')
        fi = {s: rig.idx['foot.' + s] for s in 'LR'}
        self.foot = {}
        for s in 'LR':
            w = (md['W'] * (md['J'] == fi[s])).sum(1)
            sel = np.where(w > 0.5)[0]
            self.foot[s] = dict(P=md['P'][sel], J=md['J'][sel], W=md['W'][sel], ids=sel)
        rw = rig.rest_world
        self.L1 = np.linalg.norm(rig.rest_t[rig.idx['shin.L']])
        self.L2 = np.linalg.norm(rig.rest_t[rig.idx['foot.L']])
        self.rest_rot = {n: rw[rig.idx[n], :3, :3] for n in rig.names}
        # rest sole: lowest foot vertex height at rest
        self.rest_sole = {s: self.foot[s]['P'][:, 1].min() for s in 'LR'}

    # ---------- FK from a pose track ----------
    def fk(self, Wr, hips):
        rig = self.rig
        n = len(hips)
        Q, T = local_from_world(rig, Wr, hips)
        return rig.fk(T, Q)

    def foot_verts(self, W, s):
        """W [n,J,4,4] -> sole vertex positions [n,V,3] (full LBS of the foot-dominant vertices)."""
        fd = self.foot[s]
        Sk = W @ self.rig.ibm[None]
        out = np.zeros((len(W),) + fd['P'].shape)
        for k in range(4):
            Mk = Sk[:, fd['J'][:, k]]
            out += fd['W'][None, :, k:k + 1] * (np.einsum('tnij,nj->tni', Mk[..., :3, :3], fd['P']) + Mk[..., :3, 3])
        return out


def local_from_world(rig, Wr, hips):
    n = len(hips)
    Q = np.repeat(rig.rest_r[None], n, 0).copy()
    T = np.repeat(rig.rest_t[None], n, 0).copy()
    Wc = {}
    for name in [rig.names[i] for i in rig.order]:
        i = rig.idx[name]
        p = rig.parent[i]
        pr = np.repeat(np.eye(3)[None], n, 0) if p is None else Wc[rig.names[p]]
        if name in Wr:
            Wc[name] = Wr[name]
            Q[:, i] = RG.m2q(np.transpose(pr, (0, 2, 1)) @ Wr[name])
        else:
            Wc[name] = pr @ RG.q2m(rig.rest_r[i])[None]
    T[:, rig.idx['hips']] = hips - rig.rest_t[rig.idx['root']][None]
    return Q, T


def world_from_local(rig, Q, T):
    W = rig.fk(T, Q)
    Wr = {n: W[:, rig.idx[n], :3, :3] / np.linalg.norm(W[:, rig.idx[n], :3, :3], axis=-2, keepdims=True) for n in rig.names}
    return Wr, W[:, rig.idx['hips'], :3, 3].copy()


# ---------- smoothing helpers ----------
def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def smootherstep(x):
    x = np.clip(x, 0, 1)
    return x * x * x * (x * (6 * x - 15) + 10)


def gauss(x, sigma, periodic=False):
    if sigma <= 0:
        return x.copy()
    r = int(3 * sigma) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    if periodic:
        pad = np.concatenate([x[-r:], x, x[:r]])
    else:
        pad = np.concatenate([np.repeat(x[:1], r, 0), x, np.repeat(x[-1:], r, 0)])
    out = np.zeros_like(x, dtype=float)
    for i, w in enumerate(k):
        out = out + w * pad[i:i + len(x)]
    return out


def rot_smooth(R, sigma, periodic=False):
    q = RG.m2q(R)
    for i in range(1, len(q)):
        if np.dot(q[i], q[i - 1]) < 0:
            q[i] = -q[i]
    return RG.q2m(RG.qnorm(gauss(q, sigma, periodic)))


def rot_blend(Ra, Rb, w):
    """per-frame slerp between rotation matrices, w [n] (0 -> Ra)."""
    qa = RG.m2q(Ra)
    qb = RG.m2q(Rb if Rb.ndim == 3 else np.repeat(Rb[None], len(Ra), 0))
    return RG.q2m(RG.slerp(qa, qb, np.asarray(w)[:, None]))


# ---------- contacts ----------
def intervals(mask, min_len=1):
    out = []
    i = 0
    n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            if j - i + 1 >= min_len:
                out.append((i, j))
            i = j + 1
        else:
            i += 1
    return out


def detect_contacts(V, fps, h_tol=0.025, v_tol=0.30, min_len=3, close_gap=2):
    """V [n,Vn,3] sole vertices (world). contact if the lowest vertex is near the floor AND slow."""
    low = V[..., 1].min(1)
    floor = np.percentile(low, 5)
    k = np.argmin(V[..., 1], 1)
    p = V[np.arange(len(V)), k]
    sp = np.zeros(len(V))
    sp[1:-1] = np.linalg.norm((V[2:, :, [0, 2]] - V[:-2, :, [0, 2]]).mean(1), axis=1) * fps / 2
    sp[0], sp[-1] = sp[1], sp[-2]
    m = (low - floor < h_tol) & (sp < v_tol)
    # close tiny gaps, remove blips
    for a, b in intervals(~m):
        if b - a + 1 <= close_gap and a > 0 and b < len(m) - 1:
            m[a:b + 1] = True
    out = np.zeros_like(m)
    for a, b in intervals(m, min_len):
        out[a:b + 1] = True
    return out


# ---------- two-bone IK ----------
def two_bone(H, A, Kpole, L1, L2, max_ext=0.9995):
    d = A - H
    dl = np.linalg.norm(d, axis=-1, keepdims=True)
    u = d / dl
    dl2 = np.minimum(dl, (L1 + L2) * max_ext)
    ca = (L1 ** 2 + dl2 ** 2 - L2 ** 2) / (2 * L1 * dl2)
    al = np.arccos(np.clip(ca, -1, 1))
    pv = Kpole - H
    v = pv - u * np.sum(pv * u, -1, keepdims=True)
    v = v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)
    K = H + L1 * (np.cos(al) * u + np.sin(al) * v)
    A2 = H + u * dl2
    return K, A2, (dl[..., 0] > (L1 + L2) * max_ext)


def apply_leg_ik(ctx, Wr, hips, s, A_target, foot_rot):
    """re-solve thigh/shin of side s so the ankle reaches A_target [n,3]; foot world rotation = foot_rot."""
    rig = ctx.rig
    th, sh, ft = LEGS[s]
    W = ctx.fk(Wr, hips)
    H = W[:, rig.idx[th], :3, 3]
    K0 = W[:, rig.idx[sh], :3, 3]
    A0 = W[:, rig.idx[ft], :3, 3]
    # pole: FK knee pushed forward a little so a straight FK leg still has a defined bend plane
    fwd = Wr['hips'][:, :, 2]
    pole = K0 + 0.05 * fwd
    K, A2, clamped = two_bone(H, A_target, pole, ctx.L1, ctx.L2)
    R1 = RG.align(K0 - H, K - H)
    Rt = R1 @ Wr[th]
    Rs_tmp = R1 @ Wr[sh]
    d_tmp = np.einsum('nij,nj->ni', R1, A0 - K0)
    R2 = RG.align(d_tmp, A2 - K)
    Rs = R2 @ Rs_tmp
    out = dict(Wr)
    out[th], out[sh], out[ft] = Rt, Rs, foot_rot
    return out, clamped


def knee_angle(ctx, Wr, hips, s):
    rig = ctx.rig
    th, sh, ft = LEGS[s]
    W = ctx.fk(Wr, hips)
    H, K, A = (W[:, rig.idx[b], :3, 3] for b in (th, sh, ft))
    a, b = K - H, A - K
    c = np.sum(a * b, -1) / (np.linalg.norm(a, axis=-1) * np.linalg.norm(b, axis=-1))
    return np.degrees(np.arccos(np.clip(c, -1, 1)))


# ---------- foot planting ----------
def plant_feet(ctx, Wr, hips, fps, contacts, periodic=False, targets=None, flat_lock=True, iters=2, floor_y=0.0):
    """No-slip foot planting on the actual sole vertices.
    contacts: s -> bool[n].  targets: s -> (mask bool[n], M [n,4,4]) world foot-bone transforms the foot must follow on the
    masked frames (idle stance at clip ends, walk_loop footprints at hand-offs); a contact interval that touches masked
    frames is anchored to them (rolling shape still from the no-slip integration).  Returns new (Wr, hips, info)."""
    rig = ctx.rig
    n = len(hips)
    info = {}
    Wr = dict(Wr)
    targets = targets or {}
    for it in range(iters):
        W = ctx.fk(Wr, hips)
        for s in 'LR':
            fi = rig.idx[LEGS[s][2]]
            V = ctx.foot_verts(W, s)
            C = contacts[s]
            tm, TM = targets.get(s, (np.zeros(n, bool), None))
            Ff = W[:, fi].copy()
            Rf = Ff[:, :3, :3].copy()
            segs = intervals(C)
            if periodic and C[0] and C[-1] and len(segs) > 1:
                a1, b1 = segs[-1]
                segs = segs[1:-1] + [(a1, b1 + segs[0][1] + 1)]
            corr = np.zeros((n, 3))
            have = np.zeros(n, bool)
            A0 = Ff[:, :3, 3]
            for (a, b) in segs:
                idx = np.arange(a, b + 1) % n
                lk = tm[idx]
                if flat_lock:
                    fwd = Rf[idx][:, :, 1]
                    hd_u = np.unwrap(np.arctan2(fwd[:, 0], fwd[:, 2]))
                    if lk.any():
                        tf = TM[idx[lk]][:, :3, 1]
                        target = np.mean(np.unwrap(np.arctan2(tf[:, 0], tf[:, 2])))
                        target = hd_u.mean() + (target - hd_u.mean() + np.pi) % (2 * np.pi) - np.pi
                    else:
                        target = np.mean(hd_u)
                    dy = target - hd_u
                    for k, fr in enumerate(idx):
                        Rf[fr] = RT.roty(dy[k]) @ Rf[fr]
                if lk.any():
                    Rf[idx[lk]] = TM[idx[lk]][:, :3, :3]
            Vloc = np.einsum('nji,nvj->nvi', Ff[:, :3, :3], V - A0[:, None])
            V2 = np.einsum('nij,nvj->nvi', Rf, Vloc) + A0[:, None]
            for (a, b) in segs:
                idx = np.arange(a, b + 1) % n
                lk = tm[idx]
                c = np.zeros((len(idx), 3))
                for k in range(1, len(idx)):
                    f0, f1 = idx[k - 1], idx[k]
                    vv = V2[f0]
                    low = vv[:, 1].min()
                    w = np.exp(-np.maximum(vv[:, 1] - low, 0) / 0.002)
                    w /= w.sum()
                    dp = (w[:, None] * (V2[f1] - V2[f0])).sum(0)
                    c[k, [0, 2]] = c[k - 1, [0, 2]] - dp[[0, 2]]
                if lk.any():
                    tgt = TM[idx[lk]][:, :3, 3]
                    c[:, [0, 2]] += (tgt[:, [0, 2]] - (A0[idx[lk]][:, [0, 2]] + c[lk][:, [0, 2]])).mean(0)
                else:
                    c[:, [0, 2]] -= c[:, [0, 2]].mean(0)
                c[:, 1] = floor_y - V2[idx][:, :, 1].min(1)
                if lk.any():
                    c[lk] = TM[idx[lk]][:, :3, 3] - A0[idx[lk]]
                corr[idx] = c
                have[idx] = True
            # masked frames outside contacts (rare) follow the target too
            extra = tm & ~have
            if extra.any():
                corr[extra] = TM[extra][:, :3, 3] - A0[extra]
                Rf[extra] = TM[extra][:, :3, :3]
                have = have | extra
            corr = fill_gaps(corr, have, periodic)
            Anew = A0 + corr
            Vn = V2 + corr[:, None]
            lift = np.maximum(0, floor_y - Vn[..., 1].min(1))
            lift[have] = 0
            Anew[:, 1] += gauss(lift, 1.0)
            Wr, clamped = apply_leg_ik(ctx, Wr, hips, s, Anew, Rf)
            info[s] = dict(clamped=int(clamped.sum()), corr_max_mm=float(np.abs(corr).max() * 1000))
    return Wr, hips, info


def limit_swing_knee(ctx, Wr, hips, contacts, k0=35.0, f=0.6, sigma=1.5):
    """soften the heel kick: knee flexion above k0 is scaled by f (only off the floor), by rotating the shin about the knee
    hinge axis; the foot keeps its world orientation. Smooth weight so nothing pops at the contact boundaries."""
    out = dict(Wr)
    W = ctx.fk(Wr, hips)
    rig = ctx.rig
    for s in 'LR':
        th, sh, ft = LEGS[s]
        H, K, A = (W[:, rig.idx[b], :3, 3] for b in (th, sh, ft))
        k = knee_angle(ctx, Wr, hips, s)
        kn = np.where(k > k0, k0 + (k - k0) * f, k)
        dk = np.radians(k - kn)
        dk = gauss(dk * (~contacts[s]), sigma)
        a, b = K - H, A - K
        ax = np.cross(a, b)
        ax /= np.maximum(np.linalg.norm(ax, axis=1, keepdims=True), 1e-9)
        R = RG.rotvec2m(-ax * dk[:, None])
        out[sh] = R @ Wr[sh]
    return out


def leg_dist_for_knee(ctx, knee_deg):
    """hip-ankle distance for a knee flexion angle (deg, 0 = straight)."""
    k = np.radians(knee_deg)
    return np.sqrt(ctx.L1 ** 2 + ctx.L2 ** 2 + 2 * ctx.L1 * ctx.L2 * np.cos(k))


def fit_hips_height(ctx, Wr, hips, A, contacts, knee_ref, periodic=False, min_knee=6.0, sigma=1.5, only_lower=False, swing_min_knee=8.0):
    """vertical hips position such that each planted leg bends at least like the reference (mocap) knee curve, i.e. the
    stride-fitted footprints keep the performer's knee profile instead of bending the knee at heel strike.
    A: s -> [n,3] planted ankle positions; contacts: s -> bool[n]; knee_ref: s -> [n] deg. returns new hips."""
    rig = ctx.rig
    W = ctx.fk(Wr, hips)
    n = len(hips)
    need = np.full(n, np.inf)
    for s in 'LR':
        H = W[:, rig.idx[LEGS[s][0]], :3, 3]
        off = H - hips                                          # hip joint offset from the hips bone (rotation only)
        m = contacts[s]
        kr = np.where(m, np.maximum(knee_ref[s], min_knee), swing_min_knee)
        d = leg_dist_for_knee(ctx, kr)
        dxz2 = np.sum((A[s][:, [0, 2]] - H[:, [0, 2]]) ** 2, 1)
        hy = A[s][:, 1] + np.sqrt(np.maximum(d ** 2 - dxz2, 1e-6))
        y = hy - off[:, 1]
        # swing frames only constrain when the planted-foot target would over-extend the leg
        use = m | (y < hips[:, 1])
        need[use] = np.minimum(need[use], y[use])
    have = np.isfinite(need)
    target = hips[:, 1].copy()
    if only_lower:
        need = np.where(have, np.minimum(need, hips[:, 1]), np.inf)
    target[have] = need[have]
    # swing-only frames: interpolate; then smooth while never exceeding the requirement (lower envelope)
    idx = np.arange(n)
    if not have.all():
        if periodic:
            xs = np.concatenate([idx[have] - n, idx[have], idx[have] + n])
            ys = np.tile(target[have], 3)
        else:
            xs, ys = idx[have], target[have]
        target = np.interp(idx, xs, ys)
    y = target.copy()
    for _ in range(30):
        y = gauss(y, sigma, periodic)
        y = np.where(have, np.minimum(y, need), y)
    y = gauss(y, sigma * 0.5, periodic)
    y = np.where(have, np.minimum(y, need), y)
    out = hips.copy()
    out[:, 1] = y
    return out


def fill_gaps(corr, have, periodic):
    n = len(corr)
    out = corr.copy()
    if have.all():
        return out
    if not have.any():
        return out
    idx = np.where(have)[0]
    vel = np.gradient(corr, axis=0)
    gaps = intervals(~have)
    for a, b in gaps:
        pa, pb = a - 1, b + 1
        if pa < 0 and not periodic:
            out[a:b + 1] = corr[pb]
            continue
        if pb >= n and not periodic:
            out[a:b + 1] = corr[pa]
            continue
        pa %= n
        pb %= n
        L = (b - a + 2)
        c0, c1 = corr[pa], corr[pb]
        m0 = vel[pa] if have[(pa - 1) % n] else np.zeros(3)
        m1 = vel[pb] if have[(pb + 1) % n] else np.zeros(3)
        for k in range(a, b + 1):
            u = (k - a + 1) / L
            h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
            out[k % n] = h00 * c0 + h10 * m0 * L + h01 * c1 + h11 * m1 * L
    return out
