# walk_loop from CMU 91_29 (female, "NormalWalk"): one gait cycle, time-stretched, stride fitted to 0.7 m/s, feet planted.
import numpy as np
import clipbuild as CB
import author_lib as AL
import retarget as RT

TRIAL = '91_29'
WINDOW = (4.3, 8.0)        # steady straight walking (s, source)
TIME_STRETCH = 1.15        # same for every 91_29 locomotion clip -> cadence ~79 steps/min
SPEED = 0.7
CONTACT = dict(h_tol=0.03, v_tol=0.45, ref=(0.3, 2.4))     # standing heights of the performer at the start of 91_29


def strikes(tk, t0, t1, side):
    t = np.arange(int(t0 * tk.fps), int(t1 * tk.fps)) / tk.fps
    C = tk.contacts(t, **CONTACT)[side]
    return [t[i] for i in CB.heel_strikes(C)]


def pick_cycle(tk):
    """foot.R (her left) heel strike -> next one, best start/end match."""
    hs = strikes(tk, *WINDOW, 'R')
    best = None
    for a, b in zip(hs[:-1], hs[1:]):
        if not 0.9 < b - a < 1.8:
            continue
        h = tk.hip(np.array([a, b]))
        d = h[1] - h[0]
        yaw = -np.arctan2(d[0], d[2])
        tra = tk.track(np.array([a]), yaw, (h[0, 0], h[0, 2]))
        trb = tk.track(np.array([b]), yaw, (h[1, 0], h[1, 2]))
        e = CB.pose_err(tra, trb)[0]
        if best is None or e < best[0]:
            best = (e, a, b)
    return best


def build(n_cycles_plant=3, verbose=True):
    tk = CB.Take(TRIAL)
    err, ta, tb = pick_cycle(tk)
    Ts = tb - ta
    n = int(round(Ts * TIME_STRETCH * CB.FPS))
    T = n / CB.FPS
    ts = ta + np.arange(n + 1) / n * Ts              # n+1 samples: last == first of next cycle
    h = tk.hip(np.array([ta, tb]))
    d = h[1] - h[0]
    yaw = -np.arctan2(d[0], d[2])
    Wr, hips = tk.track(ts, yaw, (h[0, 0], h[0, 2]))
    D = hips[-1] - hips[0]
    u = np.arange(n + 1) / n
    dist = SPEED * T
    c = dist / D[2]
    rel = hips.copy()
    rel[:, 0] = hips[:, 0] - D[0] * u
    rel[:, 2] = c * (hips[:, 2] - D[2] * u)
    rel[:, 1] = hips[:, 1] - D[1] * u
    tr = CB.close_loop(CB.tr_slice((Wr, rel), 0, n), CB.tr_frame((Wr, rel), n))
    dy = CB.floor_offset(*tr)
    tr = CB.tr_translate(tr, [0, dy, 0])
    C = tk.contacts(ts[:n], **CONTACT)
    tr = (AL.limit_swing_knee(CB.ctx(), tr[0], tr[1], C), tr[1])
    info = dict(trial=TRIAL, src_window_s=[round(ta, 4), round(tb, 4)], src_cycle_s=round(Ts, 4), time_stretch=round(T / Ts, 4),
                frames=n, duration_s=round(T, 6), stride_natural_m=round(float(D[2]), 4), stride_m=round(dist, 4),
                stride_scale=round(float(c), 4), start_end_err_deg=round(float(err), 2), hips_dy_m=round(float(dy), 4))
    # unroll cycles in the world (root moves at SPEED), plant without slip, keep the middle cycle
    K = n_cycles_plant
    big = CB.tr_concat(*([tr] * K))
    tt = np.arange(K * n) / CB.FPS
    big[1][:, 2] += SPEED * tt                        # root-relative -> world
    Cb = {s: np.tile(C[s], K) for s in 'LR'}
    cx = CB.ctx()
    knee_ref = {s: AL.knee_angle(cx, big[0], big[1], s) for s in 'LR'}
    h2 = big[1]
    for it in range(4):
        Wp, hp, pinfo = AL.plant_feet(cx, big[0], h2, CB.FPS, contacts=dict(Cb), flat_lock=True, iters=2)
        if verbose:
            print('  fit', it, {s: pinfo[s]['clamped'] for s in 'LR'})
        if it == 3:
            break
        Wf = CB.fk(Wp, hp)
        A = {s: Wf[:, CB.rig().idx['foot.' + s], :3, 3] for s in 'LR'}
        h2 = AL.fit_hips_height(cx, big[0], h2, A, Cb, knee_ref)
    info['hips_height_change_mm'] = [round(float((h2[:, 1] - big[1][:, 1]).min() * 1000), 1), round(float((h2[:, 1] - big[1][:, 1]).max() * 1000), 1)]
    hp = hp.copy()
    hp[:, 2] -= SPEED * tt
    m = K // 2
    mid = CB.tr_slice((Wp, hp), m * n, (m + 1) * n)
    nxt = CB.tr_frame((Wp, hp), (m + 1) * n)
    resid = CB.pose_err(CB.tr_slice(mid, 0, 1), (({k: v[None] for k, v in nxt[0].items()}), nxt[1][None]))[0]
    mid = CB.close_loop(mid, nxt)
    info['plant'] = {s: {k: v for k, v in pinfo[s].items() if k != 'contacts'} for s in 'LR'}
    info['loop_residual_after_plant_deg'] = round(float(resid), 3)
    contacts = {s: C[s] for s in 'LR'}
    if verbose:
        print('walk_loop', info)
    return mid, contacts, info


if __name__ == '__main__':
    import sys
    import stick
    tr, C, info = build()
    W = CB.fk(*tr)
    W2 = W.copy()
    stick.sheet(CB.rig(), W, list(range(0, len(W), 3)), sys.argv[1] if len(sys.argv) > 1 else '/tmp/mc/walk_stick.png')
