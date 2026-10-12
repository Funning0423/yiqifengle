# Every clip except walk_loop (clip_walk.py), built from CMU takes:
#   world-space pose track -> hand-off blending to the hub poses (idle_breathing_loop frame 0, walk_loop at the matching heel
#   strike, sit_hold frame 0) -> no-slip foot planting with footprint targets -> hips height fit -> root curve (anim_meta
#   root_motion, the same driver-local frame as locomotion-v1) -> track relative to that root.
# A clip result is a dict: track (root-relative pose track), world (world track), contacts, events, root (curves), loop,
# lock (skirt-curve hand-offs for the solver: [(weights [n], clip, phase_s [n])]), extra anim_meta fields, info.
import os
import pickle
import numpy as np
import clipbuild as CB
import author_lib as AL
import clip_walk as CW
import retarget as RT

FPS = CB.FPS
CACHE = os.environ.get('MOCAP_CACHE', '/tmp/mc/cache')
STRETCH = CW.TIME_STRETCH
SEATED_BACK = 0.494          # seated controller root is 0.494 m behind the standing one (CharacterReference.ts, seat frame)
SEAT_TOP = 0.38              # seat_anchor seat_top_y_m
SEAT_CLOTH = 0.008
SEAT_HIPS_Z = -0.02          # hips bone over the seat centre (seat top centre is +0.014 m in the seated root frame)
HANDLE = np.array([-0.115, 1.13, 0.34])     # door handle (palm centre) in the door_reach root frame; her right = -X
PALM = 0.075                                 # wrist -> palm centre along the hand bone
IDLE_KNEE = 7.0
STOP_LATERAL_KEEP = 0.25


def cached(name, fn, refresh=False):
    p = os.path.join(CACHE, name + '.pkl')
    if os.path.exists(p) and not refresh:
        with open(p, 'rb') as f:
            return pickle.load(f)
    v = fn()
    os.makedirs(CACHE, exist_ok=True)
    with open(p, 'wb') as f:
        pickle.dump(v, f)
    return v


# ---------------------------------------------------------------- small helpers
def fade_out(n, k, start=0):
    """1 up to frame start, smootherstep down to 0 at start + k."""
    return 1 - AL.smootherstep((np.arange(n) - start) / float(k))


def fade_in_end(n, k):
    """0 until frame n-1-k, smootherstep up to 1 at the last frame."""
    return AL.smootherstep((np.arange(n) - (n - 1 - k)) / float(k))


def rot_about_hips(tr, yaw):
    Wr, h = tr
    yaw = np.broadcast_to(np.asarray(yaw, float), (len(h),))
    R = np.stack([RT.roty(a) for a in yaw])
    return {k: R @ v for k, v in Wr.items()}, h.copy()


def place(tr, x=0.0, z=0.0, yaw=0.0):
    """rotate a track about the origin by yaw, then move it by (x, z)."""
    return CB.tr_translate(CB.tr_rotate(tr, yaw), [x, 0, z])


def feet_world(tr):
    W = CB.fk(*tr)
    r = CB.rig()
    return {s: W[:, r.idx['foot.' + s]] for s in 'LR'}


def ankles(tr):
    return {s: M[:, :3, 3] for s, M in feet_world(tr).items()}


def targets_from(ref_tr, mask):
    F = feet_world(ref_tr)
    return {s: (np.asarray(mask[s], bool), F[s]) for s in 'LR' if np.any(mask[s])}


def plant_fit(tr, C, targets=None, rounds=3, periodic=False, hips_lock=None, arcs=None, fit=True, anchored=False,
              ease_yaw=False):
    """plant feet / refit hips height a few times. hips_lock: (w [n], ref hips [n,3]) re-imposed after every fit.
    Contacts that end inside the clip may be trimmed (toe-off release); clips with both feet planted throughout never are."""
    cx = CB.ctx()
    r = CB.rig()
    Wr0, h = tr
    knee_ref = {s: AL.knee_angle(cx, Wr0, h, s) for s in 'LR'}
    keep = {s: targets[s][0] if targets and s in targets else None for s in 'LR'}
    trim = not all(np.all(C[s]) for s in 'LR')
    info = {}
    trimmed = 0
    for it in range(rounds):
        for _ in range(3 if trim else 0):
            Wp, hp, info = AL.plant_feet(cx, Wr0, h, FPS, C, periodic=periodic, targets=targets, iters=2, arcs=arcs,
                                         anchored=anchored, ease_yaw=ease_yaw)
            C2, ch = AL.trim_contacts(cx, Wp, hp, C, knee_ref, periodic=periodic, keep=keep,
                                      clamp={s: info[s]['clamp_mask'] for s in info})
            if not ch:
                break
            trimmed += ch
            C.update(C2)
        else:
            Wp, hp, info = AL.plant_feet(cx, Wr0, h, FPS, C, periodic=periodic, targets=targets, iters=2, arcs=arcs,
                                         anchored=anchored, ease_yaw=ease_yaw)
        if it == rounds - 1 or not fit:
            break
        Wf = CB.fk(Wp, hp)
        A = {s: Wf[:, r.idx['foot.' + s], :3, 3] for s in 'LR'}
        h = AL.fit_hips_height(cx, Wr0, h, A, C, knee_ref, periodic=periodic)
        if hips_lock is not None:
            w, ref = hips_lock
            h = h * (1 - w)[:, None] + ref * w[:, None]
    Wp, kr = AL.limit_knee_rate(cx, Wp, hp, C, periodic=periodic)
    Wp, sep = AL.separate_feet(cx, Wp, hp, C)
    out = {s: {k: v for k, v in info[s].items() if k != 'clamp_mask'} for s in info}
    out['released_contact_frames'] = int(trimmed)
    out['knee_rate_change_deg'] = kr
    out['swing_lift_mm'] = sep
    return (Wp, hp), out


def to_root(tr, rx, rz, ryaw=None):
    out = CB.tr_translate(tr, -np.stack([rx, np.zeros_like(rx), rz], 1))
    if ryaw is not None:
        out = CB.tr_rotate(out, -np.asarray(ryaw))
    return out


def heel_strike_events(C, n, skip_first=True, t_max=None):
    ev = []
    for s in 'LR':
        c = C[s]
        for i in range(1, n):
            if c[i] and not c[i - 1]:
                ev.append(dict(name='foot:' + s, time_s=round(i / FPS, 6), bone='foot.' + s, body='R' if s == 'L' else 'L',
                               type='heel_strike'))
    ev = [e for e in ev if t_max is None or e['time_s'] < t_max - 1e-9]
    return sorted(ev, key=lambda e: e['time_s'])


def curve(t, v, nd=6):
    return [[round(float(a), 6), round(float(b), nd)] for a, b in zip(t, v)]


def smooth_root(raw, sigma, pre=None, post=None):
    """gauss low-pass of a root estimate with explicit padding (arrays) so the clip ends keep their slopes."""
    pre = np.zeros(0) if pre is None else pre
    post = np.zeros(0) if post is None else post
    x = np.concatenate([pre, raw, post])
    y = AL.gauss(x, sigma)
    return y[len(pre):len(pre) + len(raw)]


def skin_min_y(tr, region, meshes=('LOD0_G2_BODY',)):
    """lowest skinned vertex height inside an xz box (seat contact) per frame."""
    r = CB.rig()
    W = CB.fk(*tr)
    out = np.full(len(W), np.inf)
    for mesh in meshes:
        md = r.mesh_data(mesh)
        for i in range(len(W)):
            P = r.skin(md, W[i])
            m = (P[:, 0] > region[0]) & (P[:, 0] < region[1]) & (P[:, 2] > region[2]) & (P[:, 2] < region[3])
            if m.any():
                out[i] = min(out[i], P[m, 1].min())
    return out


# ---------------------------------------------------------------- arm IK
def arm_ik(tr, s, target, weight, hand_rot=None):
    """move the wrist (hand.s head) of arm s toward target [n,3] with weight [n] (two-bone, elbow plane from FK)."""
    r = CB.rig()
    cx = CB.ctx()
    ua, fa, hd = 'upper_arm.' + s, 'forearm.' + s, 'hand.' + s
    Wr, h = tr
    W = CB.fk(Wr, h)
    S = W[:, r.idx[ua], :3, 3]
    E0 = W[:, r.idx[fa], :3, 3]
    H0 = W[:, r.idx[hd], :3, 3]
    L1 = np.linalg.norm(r.rest_t[r.idx[fa]])
    L2 = np.linalg.norm(r.rest_t[r.idx[hd]])
    w = np.asarray(weight, float)[:, None]
    T = H0 * (1 - w) + target * w
    E, H2, _ = AL.two_bone(S, T, E0 - 0.03 * Wr['chest'][:, :, 2], L1, L2, max_ext=0.995)
    import rig as RG
    R1 = RG.align(E0 - S, E - S)
    out = dict(Wr)
    out[ua] = R1 @ Wr[ua]
    Rf = R1 @ Wr[fa]
    d = np.einsum('nij,nj->ni', R1, H0 - E0)
    R2 = RG.align(d, H2 - E)
    out[fa] = R2 @ Rf
    hr = out[fa] @ np.transpose(Wr[fa], (0, 2, 1)) @ Wr[hd]          # hand keeps its forearm-relative rotation
    if hand_rot is not None:
        hr = AL.rot_blend(hr, hand_rot, weight)
    out[hd] = hr
    _ = cx
    return out, h


# ---------------------------------------------------------------- hub clips
def build_idle():
    tk = CB.Take('91_29')
    best = None
    for a in np.arange(0.30, 0.80, 1 / 30):
        for L in np.arange(1.80, 2.20, 1 / 30):
            b = a + L
            if b > 2.45:
                continue
            ta = tk.track(np.array([a, b]), 0.0, (0, 0))
            e = CB.pose_err(CB.tr_slice(ta, 0, 1), CB.tr_slice(ta, 1, 2))[0] + 400 * np.linalg.norm(ta[1][1] - ta[1][0])
            if best is None or e < best[0]:
                best = (e, a, b)
    _, a, b = best
    n = int(round((b - a) * FPS))
    ts = a + np.arange(n + 1) / FPS
    yaw = -float(np.mean(tk.heading(ts)))
    hp = tk.hip(ts)
    tr = tk.track(ts, yaw, (hp[:, 0].mean(), hp[:, 2].mean()))
    tr = CB.close_loop(CB.tr_slice(tr, 0, n), CB.tr_frame(tr, n))
    tr = CB.tr_translate(tr, [0, CB.floor_offset(*tr), 0])
    A = ankles(tr)
    mid = 0.5 * (A['L'] + A['R']).mean(0)
    tr = CB.tr_translate(tr, [-mid[0], 0, -0.02 - mid[2]])
    C = {s: np.ones(n, bool) for s in 'LR'}
    tr, pinfo = plant_fit(tr, C, periodic=True)
    # the performer waits with ~27 deg knees (CMU standing posture); the hub pose stands up to ~IDLE_KNEE on the straighter leg
    cx = CB.ctx()
    r = CB.rig()
    Wf = CB.fk(*tr)
    A = {s: Wf[:, r.idx['foot.' + s], :3, 3] for s in 'LR'}
    k0 = {s: AL.knee_angle(cx, *tr, s) for s in 'LR'}
    kmin = np.minimum(k0['L'], k0['R'])
    kref = {s: np.maximum(k0[s] - (kmin - IDLE_KNEE), IDLE_KNEE) for s in 'LR'}
    h2 = AL.fit_hips_height(cx, tr[0], tr[1], A, C, kref, periodic=True, min_knee=0.0)
    lift = float((h2[:, 1] - tr[1][:, 1]).mean())
    tr, pinfo = plant_fit((tr[0], h2), C, periodic=True, fit=False)
    info = dict(trial='91_29', src_window_s=[round(a, 4), round(b, 4)], frames=n, duration_s=round(n / FPS, 6),
                loop_match_score=round(float(best[0]), 3), plant=pinfo, hips_lift_mm=round(lift * 1000, 1),
                knee_deg={s: [round(float(x), 1) for x in (AL.knee_angle(cx, *tr, s).min(), AL.knee_angle(cx, *tr, s).max())]
                          for s in 'LR'})
    return dict(name='idle_breathing_loop', track=tr, world=tr, contacts=C, events=[], loop=True, lock=[],
                root=None, extra=dict(in_place=True, root_motion='none (root static)'), info=info)


class Walk:
    """walk_loop (root-relative, root moving +Z at 0.7 m/s) sampled at any phase."""

    def __init__(self):
        tr, C, info = cached('walk_loop', lambda: CW.build(verbose=False))
        self.tr, self.C, self.info = tr, C, info
        self.n = len(tr[1])
        self.T = self.n / FPS
        self.ext = CB.tr_concat(tr, CB.tr_slice(tr, 0, 1))
        self.hs = {s: [i for i in range(self.n) if C[s][i] and not C[s][i - 1]] for s in 'LR'}

    def phase_of(self, s):
        return self.hs[s][0] / FPS

    def at(self, phase_s, root_z, root_x=0.0):
        f = (np.asarray(phase_s, float) * FPS) % self.n
        Wr, h = CB.tr_resample(self.ext, f)
        h = h.copy()
        h[:, 2] += root_z
        h[:, 0] += root_x
        return Wr, h

    def rel_hips(self, phase_s):
        f = (np.asarray(phase_s, float) * FPS) % self.n
        return CB.tr_resample(self.ext, f)[1]

    def contact(self, phase_s):
        f = np.round(np.asarray(phase_s, float) * FPS).astype(int) % self.n
        return {s: self.C[s][f] for s in 'LR'}


_idle = None
_walk = None


def idle():
    global _idle
    if _idle is None:
        _idle = cached('idle_breathing_loop', build_idle)
    return _idle


def walk():
    global _walk
    if _walk is None:
        _walk = Walk()
    return _walk


def idle_pose(n, x=0.0, z=0.0, yaw=0.0):
    return place(CB.tr_const(CB.tr_frame(idle()['track'], 0), n), x, z, yaw)


def strike(tk, t0, t1, side, contact=CW.CONTACT):
    t = np.arange(int(t0 * tk.fps), int(t1 * tk.fps)) / tk.fps
    Cc = tk.contacts(t, **contact)[side]
    hs = [t[i] for i in CB.heel_strikes(Cc)]
    if not hs:
        raise RuntimeError('no %s heel strike in %s %.2f-%.2f' % (side, tk.trial, t0, t1))
    return hs[0]


def travel_yaw(tk, a, b):
    d = tk.hip(np.array([b]))[0] - tk.hip(np.array([a]))[0]
    return -float(np.arctan2(d[0], d[2]))


# ---------------------------------------------------------------- walk_start
def build_walk_start():
    W = walk()
    tk = CB.Take('91_29')
    t_hs = strike(tk, 3.9, 4.3, 'R')                 # her left foot (bone foot.R) heel strike = walk_loop phase 0
    n_hs = 46                                         # 1.533 s from the idle pose to that strike
    t0 = t_hs - n_hs / FPS / STRETCH
    N = n_hs + 13
    ts = t0 + np.arange(N) / FPS / STRETCH
    yaw = travel_yaw(tk, t_hs, t_hs + W.info['src_cycle_s'])
    h0 = tk.hip(np.array([t0]))[0]
    src = tk.track(ts, yaw, (h0[0], h0[2]), hscale=W.info['stride_scale'])
    src = CB.tr_translate(src, [0, CB.floor_offset(*CB.tr_slice(src, 0, 20)), 0])
    ida = ankles(idle_pose(1))
    sa = ankles(CB.tr_slice(src, 0, 1))
    m_id = 0.5 * (ida['L'][0] + ida['R'][0])
    m_s = 0.5 * (sa['L'][0] + sa['R'][0])
    src = CB.tr_translate(src, [m_id[0] - m_s[0], 0, m_id[2] - m_s[2]])
    i = np.arange(N)
    phase = (i - n_hs) / FPS
    # walk reference: root at 0.7 m/s, placed so its foot.R strike lands where the source foot.R lands
    A_src = ankles(CB.tr_slice(src, n_hs, n_hs + 1))['R'][0]
    A_w = ankles(W.at(np.array([0.0]), np.array([0.0])))['R'][0]
    Zw = A_src[2] - A_w[2]
    root_walk = Zw + CW.SPEED * phase
    ref_w = W.at(phase, root_walk)
    w_walk = AL.smootherstep((i - (n_hs - 10)) / 10.0)
    w_idle = fade_out(N, 9)
    tr = CB.tr_blend(src, ref_w, w_walk)
    tr = CB.tr_blend(tr, idle_pose(N), w_idle)
    Cs = tk.contacts(ts, **CW.CONTACT)
    Cw = W.contact(phase)
    C = {s: np.where(w_walk >= 0.5, Cw[s], np.where(w_idle >= 0.5, True, Cs[s])) for s in 'LR'}
    ref_t = CB.tr_blend(ref_w, idle_pose(N), (w_idle > 0.5).astype(float))
    mask = {s: ((w_idle >= 0.98) | ((w_walk >= 0.98) & Cw[s])) for s in 'LR'}
    lockw = np.maximum(w_idle, w_walk)
    ref_h = ref_w[1] * (w_walk >= w_idle)[:, None] + idle_pose(N)[1] * (w_walk < w_idle)[:, None]
    tr, pinfo = plant_fit(tr, C, targets_from(ref_t, mask), hips_lock=(lockw, ref_h), ease_yaw=True)
    # root: smoothed hips minus the hub poses' hips offset, exact walk root once the clip is walk_loop
    off = w_walk * W.rel_hips(phase)[:, 2] + (1 - w_walk) * idle_pose(1)[1][0, 2]
    raw = tr[1][:, 2] - off
    rz = smooth_root(raw, 5.0, pre=np.full(15, raw[0]), post=root_walk[-1] + CW.SPEED * np.arange(1, 16) / FPS)
    rz = rz - rz[0] * (1 - w_walk)
    rz = (1 - w_walk) * rz + w_walk * root_walk
    rz = np.maximum.accumulate(rz)
    rz[0] = 0.0
    rx = np.zeros(N)
    track = to_root(tr, rx, rz)
    dur = (N - 1) / FPS
    at_s = round(dur - 0.2, 6)
    ev = heel_strike_events(C, N, t_max=at_s)
    info = dict(trial='91_29', src_window_s=[round(t0, 4), round(ts[-1], 4)], time_stretch=STRETCH, hs_frame=n_hs,
                walk_anchor_dz_m=round(float(Zw), 4), plant=pinfo)
    lock = [(w_idle, 'idle_breathing_loop', np.zeros(N)), (w_walk, 'walk_loop', phase % W.T)]
    extra = dict(in_place=True, clock='time', start_pose='idle_breathing_loop frame 0',
                 handoff=dict(next='walk_loop', at_s=at_s, next_time_s=round(at_s - n_hs / FPS, 6), crossfade_s=0.2,
                              note='from %.3f s the clip IS walk_loop (time t - %.3f); the driver cross-fades 0.2 s from at_s'
                                   % (n_hs / FPS, n_hs / FPS)),
                 root_speed_end_mps=CW.SPEED)
    t = np.arange(N) / FPS
    root = dict(forward_m=curve(t, rz))
    return dict(name='walk_start', track=track, world=tr, contacts=C, events=ev, loop=False, lock=lock, root=root,
                extra=extra, info=info)


# ---------------------------------------------------------------- stops
def build_stop(body):
    """body = her planted foot at the entry ('R' -> walk_stop_bodyR, entry at the bone foot.L strike)."""
    W = walk()
    tk = CB.Take('91_29')
    t_e = strike(tk, 15.3, 15.6, 'L')               # source entry: bone foot.L strike (her right)
    t_prev = strike(tk, 13.9, 14.4, 'L')
    N = 45
    t_src_end = 16.45
    i = np.arange(N)
    ts = np.minimum(t_e + i / FPS / STRETCH, t_src_end)
    yaw = travel_yaw(tk, t_prev, t_e)
    he = tk.hip(np.array([t_e]))[0]
    src = tk.track(ts, yaw, (he[0], he[2]), hscale=W.info['stride_scale'])
    # the performer starts a right turn at ~16.0 s: keep the pelvis facing the walk direction
    f120 = np.arange(int(15.0 * 120), int(17.0 * 120))
    hd = AL.gauss(np.unwrap(tk.rt.heading(f120)), 18.0)
    dev = np.interp(ts * 120, f120, hd) + yaw
    ramp = AL.smoothstep((ts - 15.9) / 0.3)
    src = rot_about_hips(src, -dev * ramp)
    src = CB.tr_translate(src, [0, CB.floor_offset(*src), 0])
    E_src, O_src = 'L', 'R'
    if body == 'L':
        src = CB.mirror(src)
        E_src, O_src = 'R', 'L'
    E, O = E_src, O_src                              # bone sides after mirroring
    p_e = W.phase_of(E)
    phase = p_e + i / FPS
    root_walk = CW.SPEED * i / FPS
    ref_w = W.at(phase, root_walk)
    a_src = ankles(CB.tr_slice(src, 0, 1))[E][0]
    a_w = ankles(CB.tr_slice(ref_w, 0, 1))[E][0]
    src = CB.tr_translate(src, [a_w[0] - a_src[0], 0, a_w[2] - a_src[2]])
    Cs = tk.contacts(ts, **CW.CONTACT)
    if body == 'L':
        Cs = {'L': Cs['R'], 'R': Cs['L']}
    Cw = W.contact(phase)
    w_walk = fade_out(N, 8)
    # other foot: source swing -> strike; it stays planted to the end
    o_hs = next(k for k in range(5, N) if Cs[O][k] and not Cs[O][k - 1])
    f_to, f_land = o_hs + 2, min(o_hs + 14, N - 4)   # settle step of the entry foot
    k_out = N - 1 - f_to
    w_idle = fade_in_end(N, k_out)
    trb = CB.tr_blend(src, ref_w, w_walk)
    CO = np.where(w_walk >= 0.5, Cw[O], i >= o_hs)
    CE = (i <= f_to) | (i >= f_land)
    C = {E: CE, O: CO}
    # where does the other foot land? -> the root end (idle stance relative to it)
    pre, _ = plant_fit(trb, C, targets_from(ref_w, {E: (w_walk >= 0.98) & Cw[E], O: (w_walk >= 0.98) & Cw[O]}), rounds=1)
    AO = ankles(pre)[O][o_hs:].mean(0)
    idO = ankles(idle_pose(1))[O][0]
    xe_raw, ze = AO[0] - idO[0], AO[2] - idO[2]
    # the pelvis de-rotation swings the other leg sideways (performer turning): keep a quarter of that sideways drift
    xe = STOP_LATERAL_KEEP * xe_raw
    ws = AL.smootherstep((i - 6) / float(max(1, o_hs - 6)))
    trb = CB.tr_translate(trb, np.stack([(xe - xe_raw) * ws, np.zeros(N), np.zeros(N)], 1))
    ref_i = idle_pose(N, xe, ze)
    tr = CB.tr_blend(trb, ref_i, w_idle)
    ref_t = CB.tr_blend(ref_w, ref_i, (i > N // 2).astype(float))
    mask = {E: ((w_walk >= 0.98) & Cw[E]) | (i >= f_land), O: ((w_walk >= 0.98) & Cw[O]) | (w_idle >= 0.98)}
    lockw = np.maximum(w_walk, w_idle)
    ref_h = np.where((i > N // 2)[:, None], ref_i[1], ref_w[1])
    dist = np.linalg.norm(ankles(ref_i)[E][-1][[0, 2]] - ankles(pre)[E][f_to][[0, 2]])
    arcs = {E: [(f_to, f_land, float(np.clip(0.25 * dist, 0.012, 0.035)))]}
    tr, pinfo = plant_fit(tr, C, targets_from(ref_t, mask), hips_lock=(lockw, ref_h), arcs=arcs, ease_yaw=True)
    # root
    hz_i = idle_pose(1)[1][0]
    rel = W.rel_hips(phase)
    rawz = tr[1][:, 2] - (w_walk * rel[:, 2] + (1 - w_walk) * hz_i[2])
    rawx = tr[1][:, 0] - (w_walk * rel[:, 0] + (1 - w_walk) * hz_i[0])
    rz = smooth_root(rawz, 5.0, pre=-CW.SPEED * np.arange(15, 0, -1) / FPS, post=np.full(15, ze))
    rx = smooth_root(rawx, 6.0, pre=np.zeros(15), post=np.full(15, xe))
    u = i / (N - 1.0)
    rz = rz + (0 - rz[0]) * (1 - u) + (ze - rz[-1]) * u
    rx = rx + (0 - rx[0]) * (1 - u) + (xe - rx[-1]) * u
    rz = np.maximum.accumulate(rz)
    track = to_root(tr, rx, rz)
    ev = [dict(name='foot:' + E, time_s=0.0, bone='foot.' + E, body='R' if E == 'L' else 'L', type='heel_strike',
               entry_contact=True, note='same heel strike walk_loop fires at the entry; driver should not play it twice')]
    ev.append(dict(name='foot:' + O, time_s=round(o_hs / FPS, 6), bone='foot.' + O, body='R' if O == 'L' else 'L',
                   type='heel_strike'))
    ev.append(dict(name='settle:' + E, time_s=round(f_land / FPS, 6), bone='foot.' + E, body='R' if E == 'L' else 'L',
                   type='settle', note='small settling step (feet end side by side): named settle:* so onFoot (foot:* only) '
                                       'does not emit it; softer footstep sound if wanted'))
    t = i / FPS
    root = dict(forward_m=curve(t, rz), lateral_m=curve(t, rx))
    name = 'walk_stop_body' + body
    extra = dict(in_place=True, clock='time',
                 entry=dict(**{'from': 'walk_loop'}, at_event='foot:' + E, body=body, walk_time_s=round(p_e, 6), crossfade_s=0.0,
                            note='start at the walk_loop heel strike of her %s foot (bone foot.%s); clip frame 0 == walk_loop '
                                 'at that time' % ('right' if body == 'R' else 'left', E)),
                 handoff=dict(next='idle_breathing_loop', at_s=round((N - 1) / FPS, 6), next_time_s=0.0, crossfade_s=0.0,
                              note='end pose == idle_breathing_loop frame 0 relative to the root (after root_motion)'),
                 driver_note='root decelerates 0.7 -> 0 m/s (total %.3f m forward, %.3f m sideways); drive the root by '
                             'root_motion.' % (ze, xe))
    info = dict(trial='91_29', mirrored=(body == 'L'), src_window_s=[round(t_e, 4), t_src_end], time_stretch=STRETCH,
                other_strike_frame=int(o_hs), settle=[int(f_to), int(f_land)], root_end=[round(float(xe), 4), round(float(ze), 4)],
                src_lateral_drift_m=round(float(xe_raw), 4),
                plant=pinfo)
    lock = [(w_walk, 'walk_loop', phase % W.T), (w_idle, 'idle_breathing_loop', np.zeros(N))]
    return dict(name=name, track=track, world=tr, contacts=C, events=ev, loop=False, lock=lock, root=root, extra=extra,
                info=info)


# ---------------------------------------------------------------- turns in place
TURNS = {
    'walk_turn_180': dict(trial='91_29', t=(8.25, 9.75), deg=180.0, ref=(0.3, 2.4)),
    'walk_turn_180_bodyR': dict(trial='91_29', t=(16.0, 17.5), deg=-180.0, ref=(0.3, 2.4)),
    'walk_turn_90_bodyL': dict(trial='69_16', t=(1.70, 3.20), deg=90.0, ref=(3.3, 3.9)),
    'walk_turn_90_bodyR': dict(trial='69_18', t=(1.10, 2.70), deg=-90.0, ref=(0.4, 1.0)),
}
TURN_STEP_MIN = 7
TURN_STEP_ARC = 0.02


def build_turn(name):
    sp = TURNS[name]
    tk = CB.Take(sp['trial'])
    N = 45
    i = np.arange(N)
    ts = np.linspace(sp['t'][0], sp['t'][1], N)
    h0 = tk.hip(ts[:1])[0]
    src = tk.track(ts, 0.0, (h0[0], h0[2]))
    f120 = np.arange(int((ts[0] - 0.5) * 120), int((ts[-1] + 0.5) * 120))
    hd = AL.gauss(np.unwrap(tk.rt.heading(f120)), 12.0)
    hds = np.interp(ts * 120, f120, hd)
    th = np.radians(sp['deg'])
    dlt = hds[-1] - hds[0]
    yaw = -hds[0] + (th / dlt - 1.0) * (hds - hds[0])
    src = CB.tr_rotate(src, yaw)
    Wr, h = src
    u = i / (N - 1.0)
    h = h.copy()
    h[:, [0, 2]] -= h[:1, [0, 2]] * (1 - u)[:, None] + h[-1:, [0, 2]] * u[:, None]
    src = (Wr, h)
    src = CB.tr_translate(src, [0, CB.floor_offset(*src), 0])
    idp = idle_pose(1)
    src = CB.tr_translate(src, [idp[1][0, 0], 0, idp[1][0, 2]])
    w_in = fade_out(N, 8)
    w_out = fade_in_end(N, 10)
    ref_a = idle_pose(N)
    ref_b = idle_pose(N, yaw=th)
    tr = CB.tr_blend(CB.tr_blend(src, ref_a, w_in), ref_b, w_out)
    Cs = tk.contacts(ts, h_tol=0.03, v_tol=0.45, ref=sp['ref'])
    C = {s: np.where((w_in >= 0.5) | (w_out >= 0.5), True, Cs[s]) for s in 'LR'}
    ref_t = CB.tr_blend(ref_a, ref_b, (i > N // 2).astype(float))
    mask = {s: (w_in >= 0.98) | (w_out >= 0.98) for s in 'LR'}
    # a foot the performer pivots on the ball (one contact from start to end) has to step to its turned footprint: lift it
    # while the other foot is planted, before (or after) the other foot's swing
    arcs = {}
    Aa, Ab = ankles(ref_a), ankles(ref_b)
    for s in 'LR':
        o = 'R' if s == 'L' else 'L'
        seg = next(((a, b) for a, b in AL.intervals(C[s]) if mask[s][a:b + 1][0] and mask[s][a:b + 1][-1]), None)
        if seg is None:
            continue
        gaps = AL.intervals(~C[o])
        if gaps and gaps[0][0] >= 10:
            a, b = 2, gaps[0][0] - 1
        elif gaps and gaps[-1][1] <= N - 12:
            a, b = gaps[-1][1] + 1, N - 3
        else:
            a, b = 2, 12
        C[s][a + 1:b] = False
        dist = float(np.linalg.norm((Ab[s][0] - Aa[s][0])[[0, 2]]))
        arcs[s] = [(a, b, float(np.clip(0.25 * dist, 0.012, 0.035)))]
    # a 1-2 frame lift in the source contacts (pivot shuffle) would be a one-frame hop: widen it to a real step taken
    # while the other foot is planted, with an arc so the whole sole clears the floor
    for s in 'LR':
        o = 'R' if s == 'L' else 'L'
        for a, b in AL.intervals(~C[s]):
            if a == 0 or b == N - 1 or b - a + 1 >= TURN_STEP_MIN:
                continue
            a2 = max(2, (a + b) // 2 - TURN_STEP_MIN // 2)
            b2 = min(N - 3, a2 + TURN_STEP_MIN - 1)
            if not C[o][a2:b2 + 1].all():
                continue
            C[s][a2:b2 + 1] = False
            arcs.setdefault(s, []).append((a2 - 1, b2 + 1, TURN_STEP_ARC))
    lockw = np.maximum(w_in, w_out)
    ref_h = np.where((i > N // 2)[:, None], ref_b[1], ref_a[1])
    tr, pinfo = plant_fit(tr, C, targets_from(ref_t, mask), hips_lock=(lockw, ref_h), arcs=arcs, anchored=True,
                          ease_yaw=True)
    ryaw = th * u
    track = to_root(tr, np.zeros(N), np.zeros(N), ryaw)
    ev = heel_strike_events(C, N)
    t = i / FPS
    root = dict(yaw_deg=curve(t, np.degrees(ryaw), 4), mode='linear over 1.5 s (= current driver turn action)')
    body = 'L' if sp['deg'] > 0 else 'R'
    extra = dict(in_place=True, clock='time', start_pose='idle_breathing_loop frame 0',
                 handoff=dict(next='idle_breathing_loop', at_s=1.5, next_time_s=0.0, crossfade_s=0.0),
                 turn_deg=sp['deg'], body=body,
                 driver_note='root yaw: linear 0..turn over 1.5 s = current driver turn action, so feet stay planted with '
                             'the driver as is.')
    if name == 'walk_turn_180':
        extra['note'] = ('turns to her LEFT (+180 yaw). Name kept without suffix because CharacterMotion.ts CLIP_ROLES.turn180 = '
                         'walk_turn_180; walk_turn_180_bodyR is the right turn (-180).')
    info = dict(trial=sp['trial'], src_window_s=list(sp['t']), src_turn_deg=round(float(np.degrees(dlt)), 1),
                yaw_scale=round(float(th / dlt), 4), plant=pinfo)
    # skirt curves hand off to idle faster than the pose blend: an early step (frames 2-8) must be able to lift the panels
    lock = [(fade_out(N, 4), 'idle_breathing_loop', np.zeros(N)), (fade_in_end(N, 5), 'idle_breathing_loop', np.zeros(N))]
    return dict(name=name, track=track, world=tr, contacts=C, events=ev, loop=False, lock=lock, root=root, extra=extra,
                info=info)


# ---------------------------------------------------------------- sitting (CMU 113_15)
SIT = dict(trial='113_15', down=(1.40, 2.60), hold=(2.60, 4.60), up=(4.70, 5.95), seated=(2.6, 4.6), standing=(1.30, 1.45))


def _sit_frames(tk, ts, which):
    """source track aligned for the standing pose ('stand': standing root frame) or the seated pose ('seat': seated root)."""
    a, b = SIT['standing'] if which == 'stand' else SIT['seated']
    tt = np.linspace(a, b, 20)
    yaw = -float(np.mean(tk.heading(tt)))
    hp = tk.hip(tt).mean(0)
    return tk.track(ts, yaw, (hp[0], hp[2])), yaw


def _seat_height_shift(tr_seat):
    """vertical shift so the buttocks / thighs rest on the seat top.  Body mesh only: the skirt bones are still at rest
    here (hanging to the hem); the dress + apron layers under the buttocks are SEAT_CLOTH thick."""
    region = (-0.25, 0.25, -0.18, 0.20)
    y = skin_min_y(CB.tr_slice(tr_seat, 0, 1), region)[0]
    return SEAT_TOP + SEAT_CLOTH - y


def _lap_targets(tr):
    """wrist targets resting on the thighs (mid thigh, on top), per arm side (bone .L hand -> bone .L thigh)."""
    r = CB.rig()
    W = CB.fk(*tr)
    out = {}
    for s in 'LR':
        H = W[:, r.idx['thigh.' + s], :3, 3]
        K = W[:, r.idx['shin.' + s], :3, 3]
        P = H * 0.42 + K * 0.58
        P[:, 1] += 0.085
        P[:, 0] += 0.03 * (1 if s == 'L' else -1)
        out[s] = P
    return out


def seated_feet():
    """idle footprints seen from the seated root (feet do not move between standing and sitting)."""
    return idle_pose(1, 0.0, SEATED_BACK)


def build_sit_hold():
    tk = CB.Take(SIT['trial'])
    a, b = SIT['hold']
    n = int(round((b - a) * FPS))
    ts = a + np.arange(n + 1) / FPS
    src, _ = _sit_frames(tk, ts, 'seat')
    src = CB.close_loop(CB.tr_slice(src, 0, n), CB.tr_frame(src, n))
    Wr, h = src
    h = h.copy()
    h[:, 0] -= h[:, 0].mean()
    h[:, 2] += SEAT_HIPS_Z - h[:, 2].mean()
    src = (Wr, h)
    src = CB.tr_translate(src, [0, _seat_height_shift(src), 0])
    ref = CB.tr_const(CB.tr_frame(seated_feet(), 0), n)
    C = {s: np.ones(n, bool) for s in 'LR'}
    tr, pinfo = plant_fit(src, C, targets_from(ref, {s: np.ones(n, bool) for s in 'LR'}), periodic=True, fit=False)
    lap = _lap_targets(tr)
    for s in 'LR':
        tr = arm_ik(tr, s, lap[s], np.ones(n))
    info = dict(trial=SIT['trial'], src_window_s=[a, b], frames=n, seat_hips_y=round(float(tr[1][:, 1].mean()), 4),
                plant=pinfo, hands='wrists IK-placed on the thighs (CMU chair had armrests; ours has none)')
    return dict(name='sit_hold', track=tr, world=tr, contacts=C, events=[], loop=True, lock=[], root=None,
                extra=dict(in_place=True, root_motion='none (root static at the seated controller root)'), info=info)


_sit_hold = None


def sit_hold():
    global _sit_hold
    if _sit_hold is None:
        _sit_hold = cached('sit_hold', build_sit_hold)
    return _sit_hold


def _sit_transition(name, window, down):
    tk = CB.Take(SIT['trial'])
    a, b = window
    N = int(round((b - a) * FPS)) + 1
    i = np.arange(N)
    ts = np.linspace(a, b, N)
    A, _ = _sit_frames(tk, ts, 'stand')                    # standing-root frame
    B, _ = _sit_frames(tk, ts, 'seat')                     # seated-root frame
    hy = tk.hip(ts)[:, 1]
    y_st = tk.hip(np.linspace(*SIT['standing'], 10))[:, 1].mean()
    y_se = tk.hip(np.linspace(*SIT['seated'], 10))[:, 1].mean()
    uu = np.clip((y_st - hy) / (y_st - y_se), 0, 1)
    uu = AL.gauss(uu, 1.5)
    # standing side: idle hips; seated side: sit_hold frame 0 hips (both in the standing root frame here)
    sh = sit_hold()['track']
    seat0 = place(CB.tr_slice(sh, 0, 1), 0, -SEATED_BACK)
    idp = idle_pose(1)
    A = CB.tr_translate(A, idp[1][0] - A[1][0 if down else -1])
    B = CB.tr_translate(B, seat0[1][0] - B[1][-1 if down else 0])
    tr = CB.tr_blend(A, B, uu)
    ref_idle = idle_pose(N)
    ref_seat = CB.tr_const(CB.tr_frame(seat0, 0), N)
    if down:
        w_a, w_b = fade_out(N, 8), fade_in_end(N, 10)
        tr = CB.tr_blend(CB.tr_blend(tr, ref_idle, w_a), ref_seat, w_b)
    else:
        w_b, w_a = fade_out(N, 8), fade_in_end(N, 10)
        tr = CB.tr_blend(CB.tr_blend(tr, ref_seat, w_b), ref_idle, w_a)
    # hands: on the thighs while seated
    lap = _lap_targets(tr)
    wl = AL.smootherstep((uu - 0.55) / 0.45) if down else AL.smootherstep((uu - 0.75) / 0.25)
    wl = np.maximum(wl, w_b)
    for s in 'LR':
        tr = arm_ik(tr, s, lap[s], wl)
    C = {s: np.ones(N, bool) for s in 'LR'}
    feet = CB.tr_const(CB.tr_frame(idle_pose(1), 0), N)
    lockw = np.maximum(w_a, w_b)
    ref_h = np.where((w_a >= w_b)[:, None], ref_idle[1], ref_seat[1])
    tr, pinfo = plant_fit(tr, C, targets_from(feet, {s: np.ones(N, bool) for s in 'LR'}), hips_lock=(lockw, ref_h), fit=False)
    # root: linear between the standing (0) and seated (-0.494 forward) controller roots = current driver sit/stand action
    u = i / (N - 1.0)
    if down:
        rz = -SEATED_BACK * u
        world = tr
    else:
        rz = -SEATED_BACK * (1 - u)
        world = tr
    track = to_root(tr, np.zeros(N), rz)
    if not down:
        rz = rz + SEATED_BACK               # stand_up root curve starts at its own (seated) root
    t = i / FPS
    root = dict(forward_m=curve(t, rz), mode='linear between the standing and seated controller roots over the clip '
                                             '(= current driver sit/stand action)')
    info = dict(trial=SIT['trial'], src_window_s=list(window), frames=N, plant=pinfo,
                hands='wrists blended onto the thighs while seated (CMU chair had armrests)')
    extra = dict(in_place=True, clock='time')
    if down:
        settle = float(t[np.argmax(uu > 0.98)]) if (uu > 0.98).any() else float(t[-1])
        extra.update(start_pose='idle_breathing_loop frame 0', settle_time_s=round(settle, 4),
                     handoff=dict(next='sit_hold', at_s=round(t[-1], 6), next_time_s=0.0, crossfade_s=0.2))
        lock = [(w_a, 'idle_breathing_loop', np.zeros(N)), (w_b, 'sit_hold', np.zeros(N))]
    else:
        extra.update(start_pose='sit_hold frame 0',
                     handoff=dict(next='idle_breathing_loop', at_s=round(t[-1], 6), next_time_s=0.0, crossfade_s=0.2))
        lock = [(w_b, 'sit_hold', np.zeros(N)), (w_a, 'idle_breathing_loop', np.zeros(N))]
    return dict(name=name, track=track, world=world, contacts=C, events=[], loop=False, lock=lock, root=root, extra=extra,
                info=info)


def build_sit_down():
    return _sit_transition('sit_down', SIT['down'], True)


def build_stand_up():
    return _sit_transition('stand_up', SIT['up'], False)


# ---------------------------------------------------------------- door_reach (CMU 15_06 lean-forward reach)
DOOR = dict(trial='15_06', t=(15.05, 17.05), stand=(14.9, 15.1))


def build_door_reach():
    tk = CB.Take(DOOR['trial'])
    a, b = DOOR['t']
    N = int(round((b - a) * FPS)) + 1
    i = np.arange(N)
    ts = np.linspace(a, b, N)
    tt = np.linspace(*DOOR['stand'], 10)
    yaw = -float(np.mean(tk.heading(tt)))
    h0 = tk.hip(tt).mean(0)
    src = tk.track(ts, yaw, (h0[0], h0[2]))
    # a door handle is lower and closer than the performer's target: half the lean (hips travel), idle-like left arm
    Wr, h = src
    h = h.copy()
    h[:, [0, 2]] = h[:1, [0, 2]] + 0.5 * (h[:, [0, 2]] - h[:1, [0, 2]])
    src = (Wr, h)
    src = CB.tr_translate(src, [0, CB.floor_offset(*src), 0])
    idp = idle_pose(N)
    src = CB.tr_translate(src, idp[1][0] - src[1][0])
    r = CB.rig()
    Wr = dict(src[0])
    for k in ('spine', 'chest', 'neck', 'head'):
        par = 'hips' if k == 'spine' else {'chest': 'spine', 'neck': 'chest', 'head': 'neck'}[k]
        Ls = np.transpose(src[0][par], (0, 2, 1)) @ src[0][k]
        Li = np.transpose(idp[0][par], (0, 2, 1)) @ idp[0][k]
        Wr[k] = Wr[par] @ AL.rot_blend(Li, Ls, np.full(N, 0.6))
    for k in ('upper_arm.R', 'forearm.R', 'hand.R'):
        par = {'upper_arm.R': 'chest', 'forearm.R': 'upper_arm.R', 'hand.R': 'forearm.R'}[k]
        Ls = np.transpose(src[0][par], (0, 2, 1)) @ src[0][k]
        Li = np.transpose(idp[0][par], (0, 2, 1)) @ idp[0][k]
        Wr[k] = Wr[par] @ AL.rot_blend(Li, Ls, np.full(N, 0.15))
    for k in ('upper_arm.L', 'forearm.L', 'hand.L'):
        par = {'upper_arm.L': 'chest', 'forearm.L': 'upper_arm.L', 'hand.L': 'forearm.L'}[k]
        Ls = np.transpose(src[0][par], (0, 2, 1)) @ src[0][k]
        Wr[k] = Wr[par] @ Ls
    src = (Wr, src[1])
    # reach progress from the performer's right wrist (CMU rhand -> our hand.L)
    E = tk.src.E['rhand'][np.clip(np.round(ts * 120).astype(int), 0, tk.src.n - 1)]
    d = np.linalg.norm(E - E[:1], axis=1)
    prog = AL.gauss(np.clip(d / d.max(), 0, 1), 1.0)
    hand_len = PALM
    w_in, w_out = fade_out(N, 8), fade_in_end(N, 10)
    tr = CB.tr_blend(CB.tr_blend(src, idp, w_in), idp, w_out)
    C = {s: np.ones(N, bool) for s in 'LR'}
    lockw = np.maximum(w_in, w_out)
    tr, pinfo = plant_fit(tr, C, targets_from(idp, {s: np.ones(N, bool) for s in 'LR'}), hips_lock=(lockw, idp[1]))
    # the arm last (the hips fit moves the shoulder); the palm offset follows the solved hand: correct the wrist target by
    # the remaining palm error a few times
    w_reach = AL.smootherstep(prog / 0.85) * (1 - w_in) * (1 - w_out)
    base = tr
    Wf = CB.fk(*tr)
    target = HANDLE[None] - Wf[:, r.idx['hand.L'], :3, 1] * hand_len
    for _ in range(12):
        tr = arm_ik(base, 'L', target, w_reach)
        Wf = CB.fk(*tr)
        palm_c = Wf[:, r.idx['hand.L'], :3, 3] + Wf[:, r.idx['hand.L'], :3, 1] * hand_len
        target = target + 0.5 * (HANDLE[None] - palm_c)
    Wt = CB.fk(*tr)
    pk = int(np.argmax(w_reach))
    reach_err = float(np.linalg.norm(Wt[pk, r.idx['hand.L'], :3, 3] + Wt[pk, r.idx['hand.L'], :3, 1] * hand_len - HANDLE))
    t = i / FPS
    contact_t = float(t[np.argmax(w_reach > 0.98)]) if (w_reach > 0.98).any() else float(t[pk])
    extra = dict(in_place=True, clock='time', start_pose='idle_breathing_loop frame 0', root_motion='none (root static)',
                 handle_contact_s=round(contact_t, 4), handle_local_m=[float(x) for x in HANDLE],
                 handoff=dict(next='idle_breathing_loop', at_s=round(t[-1], 6), next_time_s=0.0, crossfade_s=0.2))
    info = dict(trial=DOOR['trial'], src_window_s=[a, b], frames=N, reach_err_mm=round(reach_err * 1000, 1), plant=pinfo,
                edits='hips travel x0.5, spine/neck 60% of the performer lean, her left arm 15% of the performer (idle-like), '
                      'right wrist IK onto the handle with the performer\'s reach timing')
    lock = [(w_in, 'idle_breathing_loop', np.zeros(N)), (w_out, 'idle_breathing_loop', np.zeros(N))]
    return dict(name='door_reach', track=tr, world=tr, contacts=C, events=[], loop=False, lock=lock, root=None, extra=extra,
                info=info)


BUILDERS = {
    'idle_breathing_loop': lambda: idle(),
    'walk_start': build_walk_start,
    'walk_stop_bodyL': lambda: build_stop('L'),
    'walk_stop_bodyR': lambda: build_stop('R'),
    'walk_turn_90_bodyL': lambda: build_turn('walk_turn_90_bodyL'),
    'walk_turn_90_bodyR': lambda: build_turn('walk_turn_90_bodyR'),
    'walk_turn_180': lambda: build_turn('walk_turn_180'),
    'walk_turn_180_bodyR': lambda: build_turn('walk_turn_180_bodyR'),
    'sit_hold': lambda: sit_hold(),
    'sit_down': build_sit_down,
    'stand_up': build_stand_up,
    'door_reach': build_door_reach,
}


def walk_clip():
    W = walk()
    n = W.n
    t = np.arange(n) / FPS
    ev = heel_strike_events(W.C, n, skip_first=False)
    ev = [dict(name='foot:R', time_s=0.0, bone='foot.R', body='L', type='heel_strike')] + ev
    # QA track: three cycles with the root moving at the native speed (the in-place track cannot show foot slide)
    reps = 3
    Wr = {k: np.concatenate([v] * reps) for k, v in W.tr[0].items()}
    h = np.concatenate([W.tr[1]] * reps).copy()
    h[:, 2] += CW.SPEED * np.arange(n * reps) / FPS
    return dict(name='walk_loop', track=W.tr, world=(Wr, h), contacts=W.C, events=ev, loop=True, lock=[], root=None,
                extra=dict(in_place=True, native_speed_mps=CW.SPEED, cycle_duration_s=round(n / FPS, 6), frames=n),
                info=W.info)


def build(name):
    if name == 'walk_loop':
        return walk_clip()
    return BUILDERS[name]()
