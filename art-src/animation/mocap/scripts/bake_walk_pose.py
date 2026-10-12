# Patch the shipped character GLB's walk clips with the walk-pose constraint.
#   python3 bake_walk_pose.py [--dry]
# Two sources:
#   * curves that have never had the palm twist: full correct_walk_pose (both forearms + her right knee).
#   * the 2d02e1d bake, which aimed BOTH palms at medial+backward: her left (bone .R) already
#     faces the skirt, her right (bone .L) still opens toward the camera. That case rolls only
#     forearm.L from the legacy aim onto the thigh. It does not twist bone .R again and does
#     not re-solve the knee. A third run is refused.
# Sit clips, turns, idle, door_reach, and wind are copied verbatim. STANCE_MM is not touched.
import hashlib
import json
import os
import shutil
import sys
import numpy as np
import rig as RG
import author_lib as AL
import clipbuild as CB
import glb_clips as GC
import write_glb as WG

FPS = CB.FPS
CLIPS = ('walk_loop', 'walk_start', 'walk_stop_bodyL', 'walk_stop_bodyR')
LOOP = {'walk_loop'}
SIT = ('sit_down', 'sit_hold', 'stand_up')
LIMIT = int(1.5 * 1024 * 1024)
# clips.build_walk_start uses n_hs = 46 and a 10-frame walk blend; build_stop uses fade_out(N, 8).
START_BLEND_FROM = 36


def weight_for(name, n):
    i = np.arange(n, dtype=float)
    if name == 'walk_loop':
        return np.ones(n)
    if name == 'walk_start':
        return AL.smootherstep((i - START_BLEND_FROM) / 10.0)
    if name in ('walk_stop_bodyL', 'walk_stop_bodyR'):
        # 1 at the heel-strike entry, 0 on the last frame (idle). Across the whole clip, not the
        # 8-frame walk blend: her right knee is still swinging out after that blend has ended.
        return 1.0 - AL.smootherstep(i / float(max(n - 1, 1)))
    raise ValueError(name)


def sample(rig, name):
    d = rig.clip_duration(name)
    n = int(round(d * FPS))
    if name in LOOP:
        t = np.arange(n) / FPS
    else:
        n = n + 1
        t = np.minimum(np.arange(n) / FPS, d)
    T, Q, S = rig.sample_clip(name, t)
    return Q, T, t


def rots(W, rig):
    M = W[:, :, :3, :3]
    return M / np.linalg.norm(M, axis=-2, keepdims=True)


def palm_out(rig, ctx, Q, T):
    W = rig.fk(T, Q)
    R = rots(W, rig)
    local = AL._palm_local(ctx)
    o = {}
    for s in 'LR':
        sg = 1.0 if s == 'R' else -1.0
        n = np.einsum('nij,j->ni', R[:, rig.idx['hand.' + s]], local[s])
        o[s] = dict(out=n[:, 0] * sg, fwd=n[:, 2])
    return o


def knee_outward(rig, Q, T, side):
    """cm, outward from the hips' sagittal plane. bone .L is her right (outward = -X)."""
    W = rig.fk(T, Q)
    R = rots(W, rig)
    lat = R[:, rig.idx['hips'], :, 0].copy()
    lat[:, 1] = 0.0
    lat /= np.maximum(np.linalg.norm(lat, axis=1, keepdims=True), 1e-9)
    H = W[:, rig.idx['thigh.' + side], :3, 3]
    K = W[:, rig.idx['shin.' + side], :3, 3]
    sg = 1.0 if side == 'R' else -1.0
    return sg * np.sum((K - H) * lat, 1) * 100.0


def joint_pos(rig, Q, T, name):
    return rig.fk(T, Q)[:, rig.idx[name], :3, 3]


def bone_angle(Ra, Rb):
    R = np.einsum('nji,njk->nik', Ra, Rb)
    c = np.clip((np.trace(R, axis1=1, axis2=2) - 1) / 2, -1, 1)
    return np.degrees(np.arccos(c))


def max_bone_deg(rig, Qa, Ta, Qb, Tb, names):
    Wa, Wb = rig.fk(Ta, Qa), rig.fk(Tb, Qb)
    Ra, Rb = rots(Wa, rig), rots(Wb, rig)
    e = np.zeros(len(Qa))
    for n in names:
        e = np.maximum(e, bone_angle(Ra[:, rig.idx[n]], Rb[:, rig.idx[n]]))
    return float(e.max())


def _seg_dist(P, A, B):
    ab = B - A
    t = np.sum((P - A) * ab, -1) / np.maximum(np.sum(ab * ab, -1), 1e-18)
    t = np.clip(t, 0.0, 1.0)
    return np.linalg.norm(P - (A + t[..., None] * ab), axis=-1)


def _tri_dist(P, A, B, C):
    """P [N,K,3] against triangles A,B,C [N,K,3] -> distance [N,K]."""
    d_edge = np.minimum(_seg_dist(P, A, B), np.minimum(_seg_dist(P, B, C), _seg_dist(P, C, A)))
    nrm = np.cross(B - A, C - A)
    nrm = nrm / np.maximum(np.linalg.norm(nrm, axis=-1, keepdims=True), 1e-12)
    dist = np.sum((P - A) * nrm, -1)
    proj = P - dist[..., None] * nrm
    v0, v1, v2 = B - A, C - A, proj - A
    d00 = np.sum(v0 * v0, -1)
    d01 = np.sum(v0 * v1, -1)
    d11 = np.sum(v1 * v1, -1)
    d20 = np.sum(v2 * v0, -1)
    d21 = np.sum(v2 * v1, -1)
    den = d00 * d11 - d01 * d01
    vv = (d11 * d20 - d01 * d21) / np.maximum(den, 1e-18)
    ww = (d00 * d21 - d01 * d20) / np.maximum(den, 1e-18)
    inside = (vv >= -1e-5) & (ww >= -1e-5) & (vv + ww <= 1.0 + 1e-5)
    return np.where(inside, np.abs(dist), d_edge)


def min_mesh_dist(P, V, F, k=12):
    """Min distance (m) from points P to triangles. Candidates are the triangles of the k nearest vertices."""
    if len(P) == 0 or len(F) == 0:
        return 1.0
    k = min(k, len(V))
    nn = np.empty((len(P), k), np.int32)
    for i in range(0, len(P), 64):
        d = np.linalg.norm(V[None] - P[i:i + 64, None, :], axis=-1)
        nn[i:i + 64] = np.argpartition(d, k - 1, axis=1)[:, :k]
    inc = [[] for _ in range(len(V))]
    for ti, f in enumerate(F):
        for v in f:
            inc[int(v)].append(ti)
    A, B, C = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    best = np.full(len(P), np.inf)
    for i in range(0, len(P), 32):
        sl = slice(i, i + 32)
        cand = []
        width = 0
        for row in nn[sl]:
            tis = np.unique(np.concatenate([inc[int(v)] for v in row]))
            cand.append(tis)
            width = max(width, len(tis))
        if width == 0:
            continue
        n = len(cand)
        idx = np.zeros((n, width), np.int32)
        mask = np.zeros((n, width), bool)
        for r, tis in enumerate(cand):
            idx[r, :len(tis)] = tis
            mask[r, :len(tis)] = True
        p = np.repeat(P[sl, None, :], width, 1)
        dist = _tri_dist(p, A[idx], B[idx], C[idx])
        dist = np.where(mask, dist, np.inf)
        best[sl] = dist.min(1)
    return float(best.min())


def leg_ids(md, rig, side):
    dom = md['J'][np.arange(len(md['J'])), md['W'].argmax(1)]
    names = [rig.names[j] for j in dom]
    want = ('thigh.' + side, 'shin.' + side)
    return np.array([i for i, n in enumerate(names) if n in want], int)


def clearance(rig, body, cloths, Q, T, side):
    ids = leg_ids(body, rig, side)
    W = rig.fk(T, Q)
    worst = {k: 1e9 for k in cloths}
    at = {k: 0 for k in cloths}
    for fi in range(len(Q)):
        skin = rig.skin(body, W[fi])
        P = skin[ids]
        for k, md in cloths.items():
            V = rig.skin(md, W[fi])
            d = min_mesh_dist(P, V, md['F'])
            if d < worst[k]:
                worst[k] = d
                at[k] = fi
    return {k: dict(mm=round(worst[k] * 1000, 2), frame=at[k]) for k in cloths}


def mesh_bytes(path):
    J, B = RG.glb_load(path)
    h = hashlib.sha256()
    for m in J['meshes']:
        for p in m['primitives']:
            for k in sorted(p['attributes']):
                h.update(RG.acc(J, B, p['attributes'][k]).tobytes())
            if 'indices' in p:
                h.update(RG.acc(J, B, p['indices']).tobytes())
    h.update(RG.acc(J, B, J['skins'][0]['inverseBindMatrices']).tobytes())
    nodes = []
    for n in J['nodes']:
        nodes.append(tuple(sorted((k, json.dumps(n[k], sort_keys=True)) for k in n if k != 'extras')))
    return h.hexdigest(), nodes, [a['name'] for a in J['animations']], J['skins'][0]['joints']


def sit_max_deg(rig_a, rig_b):
    worst = 0.0
    where = None
    for name in SIT:
        d = rig_a.clip_duration(name)
        t = np.linspace(0, d, 12)
        Ta, Qa, Sa = rig_a.sample_clip(name, t)
        Tb, Qb, Sb = rig_b.sample_clip(name, t)
        e = max_bone_deg(rig_a, Qa, Ta, Qb, Tb, rig_a.names)
        if e > worst:
            worst, where = e, name
    return worst, where


def update_anim_meta(rep, ab, tol):
    with open(WG.ANIM_META) as f:
        am = json.load(f)
    comp = am['compression']
    comp['anim_bytes_total'] = ab['total']
    comp['anim_bytes_per_clip'] = ab['clips']
    comp['clips'] = (
        'keys reduced per channel (greedy; slerp / lerp error <= %.2f deg hips+legs, %.2f deg spine/chest/neck, %.2f deg '
        'head/arms/hands, %.2f deg skirt, root/hips translation %.1f mm), rest translations / scales omitted, float32, '
        'LINEAR; source mocap low-passed (gauss sigma %.0f frames at 120 fps) before retargeting. '
        'walk_loop / walk_start / walk_stop_bodyL / walk_stop_bodyR: her left palm (bone .R) keeps the medial+backward '
        'forearm twist; her right palm (bone .L) is rolled off that backward aim onto the thigh. Forward pole on her '
        'right knee (bone .L). Ankles, foot world rotation, and the other clips are unchanged'
        % (tol['leg'], tol['other'], tol['distal'], tol['skirt'], tol['trans_m'] * 1000, CB.SOURCE_SMOOTH))
    for n in CLIPS:
        if n in am.get('clips', {}) and 'keys' in am['clips'][n]:
            am['clips'][n]['keys'] = '%d keys, reduced per channel (see top-level compression), LINEAR' % rep['clips'][n]['keys']
    with open(WG.ANIM_META, 'w') as f:
        json.dump(am, f, indent=1, ensure_ascii=False)
        f.write('\n')


def main():
    dry = '--dry' in sys.argv
    rig = CB.rig()
    ctx = CB.ctx()
    assert rig.names == [
        'root', 'hips', 'spine', 'chest', 'neck', 'head', 'upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R',
        'forearm.R', 'hand.R', 'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R', 'skirt.front',
        'skirt.front.low', 'skirt.front.low.mid', 'skirt.front.mid', 'skirt.left', 'skirt.left.low', 'skirt.back',
        'skirt.back.low', 'skirt.right', 'skirt.right.low']
    assert len(rig.names) == 28
    dense = {}
    mode_legacy = False
    for name in CLIPS:
        Q, T, t = sample(rig, name)
        w = weight_for(name, len(Q))
        palms = palm_out(rig, ctx, Q, T)
        print(name, 'frames', len(Q), 'weight', [round(float(w[0]), 3), round(float(w[min(36, len(w) - 1)]), 3), round(float(w[-1]), 3)],
              'palmL', [round(float(palms['L']['out'].min()), 3), round(float(palms['L']['out'].max()), 3)],
              'fwdL', [round(float(palms['L']['fwd'].min()), 3), round(float(palms['L']['fwd'].max()), 3)],
              'palmR', [round(float(palms['R']['out'].min()), 3), round(float(palms['R']['out'].max()), 3)],
              'fwdR', [round(float(palms['R']['fwd'].min()), 3), round(float(palms['R']['fwd'].max()), 3)],
              'kneeL', round(float(knee_outward(rig, Q, T, 'L').max()), 2),
              'kneeR', round(float(knee_outward(rig, Q, T, 'R').max()), 2), flush=True)
        # out < -0.90: that palm's normal already points at the thigh (medial), not outward.
        medial = float(np.median(palms['L']['out'])) < -0.90 and float(np.median(palms['R']['out'])) < -0.90
        if name == 'walk_loop':
            # Her right palm still carries the legacy backward aim when its normal's Z is negative.
            legacy_right = medial and float(np.median(palms['L']['fwd'])) < -0.10
            if medial and not legacy_right:
                raise SystemExit('right palm already faces the thigh; bake would roll bone .L twice')
            mode_legacy = legacy_right
        if mode_legacy:
            # Already-baked clip: roll only forearm.L. Bone .R and the right knee stay.
            Q2 = AL.migrate_right_palm(ctx, Q, T, w)
        else:
            Q2 = AL.locals_with_walk_pose(rig, ctx, Q, T, w, arms=True, leg=True)
        palms2 = palm_out(rig, ctx, Q2, T)
        ank = np.linalg.norm(joint_pos(rig, Q, T, 'foot.L') - joint_pos(rig, Q2, T, 'foot.L'), axis=1).max() * 1000
        wrist = max(np.linalg.norm(joint_pos(rig, Q, T, 'hand.' + s) - joint_pos(rig, Q2, T, 'hand.' + s), axis=1).max()
                    for s in 'LR') * 1000
        if mode_legacy:
            # World pose of everything except the right arm. hand.L's local quat stays; its world
            # pose follows forearm.L, so it is not in this list.
            frozen = ['forearm.R', 'hand.R', 'upper_arm.L', 'upper_arm.R',
                      'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R',
                      'hips', 'spine', 'chest', 'neck', 'head']
            foot_deg = max_bone_deg(rig, Q, T, Q2, T, frozen)
            hand_local = bone_angle(
                RG.q2m(Q[:, rig.idx['hand.L']]), RG.q2m(Q2[:, rig.idx['hand.L']])).max()
            if foot_deg > 0.05 or hand_local > 0.05:
                raise SystemExit('%s moved a bone other than forearm.L (world %s deg, hand.L local %s)'
                                 % (name, round(foot_deg, 4), round(float(hand_local), 4)))
        else:
            foot_deg = max_bone_deg(rig, Q, T, Q2, T, ['foot.L', 'foot.R', 'thigh.R', 'shin.R', 'upper_arm.L', 'upper_arm.R'])
        print('  after palmL', [round(float(palms2['L']['out'].min()), 3), round(float(palms2['L']['out'].max()), 3)],
              'fwd', [round(float(palms2['L']['fwd'].min()), 3), round(float(palms2['L']['fwd'].max()), 3)],
              'palmR', [round(float(palms2['R']['out'].min()), 3), round(float(palms2['R']['out'].max()), 3)],
              'fwd', [round(float(palms2['R']['fwd'].min()), 3), round(float(palms2['R']['fwd'].max()), 3)],
              'kneeL', round(float(knee_outward(rig, Q2, T, 'L').max()), 2),
              'kneeR', round(float(knee_outward(rig, Q2, T, 'R').max()), 2),
              'ankle_mm', round(float(ank), 4), 'wrist_mm', round(float(wrist), 4),
              'untouched_deg', round(foot_deg, 4), flush=True)
        dense[name] = dict(fps=FPS, Q=Q2, T=T, loop=name in LOOP, Q0=Q, w=w)
    # cloth margin on the cycle, where the right knee actually moves
    body = rig.mesh_data('LOD0_G2_BODY')
    cloths = {k: rig.mesh_data(k) for k in ('LOD0_G2_DRESS', 'LOD0_G2_APRON')}
    Q0, T0 = dense['walk_loop']['Q0'], dense['walk_loop']['T']
    Q1 = dense['walk_loop']['Q']
    gap0 = clearance(rig, body, cloths, Q0, T0, 'L')
    gap1 = clearance(rig, body, cloths, Q1, T0, 'L')
    print('clearance before', gap0, flush=True)
    print('clearance after ', gap1, flush=True)
    for k in gap1:
        if gap1[k]['mm'] < 6.0 and gap1[k]['mm'] + 0.5 < gap0[k]['mm']:
            raise SystemExit('right leg enters %s (%s mm, was %s)' % (k, gap1[k]['mm'], gap0[k]['mm']))
    if dry:
        return
    tmp = '/tmp/mc/walk_pose.glb'
    os.makedirs('/tmp/mc', exist_ok=True)
    clips = {n: {k: dense[n][k] for k in ('fps', 'Q', 'T', 'loop')} for n in CLIPS}
    chosen = None
    for tol in WG.TOLS:
        rep = GC.write(CB.GLB, tmp, clips, tol=tol, extras_note='walk pose: forearm twist toward the thigh, right knee (bone.L) forward pole')
        ab = GC.anim_bytes(tmp)
        print('tol', tol, 'anim', ab['total'], 'glb', rep['size'], flush=True)
        if ab['total'] <= WG.ANIM_BUDGET and rep['size'] <= LIMIT:
            chosen = (tol, rep, ab)
            break
    if chosen is None:
        raise SystemExit('walk pose correction does not fit the animation budget or the 1.5 MB GLB cap')
    tol, rep, ab = chosen
    rig2 = RG.Rig(tmp)
    hb0, nodes0, anims0, joints0 = mesh_bytes(CB.GLB)
    hb1, nodes1, anims1, joints1 = mesh_bytes(tmp)
    if hb0 != hb1 or nodes0 != nodes1 or anims0 != anims1 or joints0 != joints1:
        raise SystemExit('mesh, IBM, node rest, or animation list changed')
    sit_e, sit_w = sit_max_deg(rig, rig2)
    print('sit max deg', sit_e, sit_w, flush=True)
    if sit_e > 0.05:
        raise SystemExit('sit clip changed')
    # hand-off: corrected cycle vs corrected start/stops, on the written (key-reduced) curves
    def grab(r, name):
        Q, T, t = sample(r, name)
        return Q, T, t
    Qw, Tw, tw = grab(rig2, 'walk_loop')
    palms = palm_out(rig2, ctx, Qw, Tw)
    kL = float(knee_outward(rig2, Qw, Tw, 'L').max())
    kR = float(knee_outward(rig2, Qw, Tw, 'R').max())
    print('written walk_loop palmL', [round(float(palms['L']['out'].min()), 3), round(float(palms['L']['out'].max()), 3)],
          'palmR', [round(float(palms['R']['out'].min()), 3), round(float(palms['R']['out'].max()), 3)],
          'kneeL', round(kL, 2), 'kneeR', round(kR, 2), flush=True)
    def vs_thigh(side):
        """Degrees, same definition as walk_qa_arms: 0 = palm normal along ±X (the thigh), 90 = front/back."""
        return np.degrees(np.arccos(np.clip(np.abs(palms[side]['out']), 0, 1)))
    print('walk_loop palm_vs_thigh deg L', [round(float(vs_thigh('L').min()), 1), round(float(np.median(vs_thigh('L'))), 1), round(float(vs_thigh('L').max()), 1)],
          'R', [round(float(vs_thigh('R').min()), 1), round(float(np.median(vs_thigh('R'))), 1), round(float(vs_thigh('R').max()), 1)],
          'signed_out L', round(float(np.median(palms['L']['out'])), 3),
          'R', round(float(np.median(palms['R']['out'])), 3), flush=True)
    if palms['L']['out'].max() > -0.85 or palms['R']['out'].max() > -0.85:
        raise SystemExit('palms still face outward after key reduction')
    if float(np.median(palms['L']['fwd'])) < -0.08:
        raise SystemExit('right palm still aims backward after key reduction')
    if kL > kR + 2.0:
        raise SystemExit('right knee still swings wider than the left')
    Qs, Ts, ts = grab(rig2, 'walk_start')
    # t = 0 idle, t = 1.533333 is walk_loop phase 0, t = 1.733333 is phase 0.2
    i0 = 0
    i_hs = int(round(1.533333 * FPS))
    i_ho = int(round(1.733333 * FPS))
    body_names = [n for n in rig2.names if not n.startswith('skirt')]

    def frame_deg(Qa, Ta, Qb, Tb):
        return max_bone_deg(rig2, Qa, Ta, Qb, Tb, body_names)
    e_idle = frame_deg(Qs[i0:i0 + 1], Ts[i0:i0 + 1], * [x[0:1] for x in grab(rig2, 'idle_breathing_loop')[:2]])
    e_hs = frame_deg(Qs[i_hs:i_hs + 1], Ts[i_hs:i_hs + 1], Qw[0:1], Tw[0:1])
    ph = 0.2
    ip = int(round(ph * FPS)) % len(Qw)
    e_ho = frame_deg(Qs[i_ho:i_ho + 1], Ts[i_ho:i_ho + 1], Qw[ip:ip + 1], Tw[ip:ip + 1])
    print('walk_start vs idle/cycle/handoff deg', round(e_idle, 3), round(e_hs, 3), round(e_ho, 3), flush=True)
    for stop, phase in (('walk_stop_bodyL', 0.0), ('walk_stop_bodyR', 0.733333)):
        Qz, Tz, tz = grab(rig2, stop)
        ip = int(round(phase * FPS)) % len(Qw)
        e0 = frame_deg(Qz[0:1], Tz[0:1], Qw[ip:ip + 1], Tw[ip:ip + 1])
        Qi, Ti, ti = grab(rig2, 'idle_breathing_loop')
        e1 = frame_deg(Qz[-1:], Tz[-1:], Qi[0:1], Ti[0:1])
        print(stop, 'entry', round(e0, 3), 'end_vs_idle', round(e1, 3), flush=True)
        if e0 > 3.0 or e1 > 1.5:
            raise SystemExit(stop + ' hand-off broke')
    if e_idle > 1.5 or e_hs > 3.0 or e_ho > 3.0:
        raise SystemExit('walk_start hand-off broke')
    shutil.copyfile(tmp, CB.GLB)
    update_anim_meta(rep, ab, tol)
    print('wrote', CB.GLB, os.path.getsize(CB.GLB), 'tol', tol)


if __name__ == '__main__':
    main()
