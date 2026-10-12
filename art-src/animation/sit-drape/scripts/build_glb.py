# Assemble the runtime character: the three sit clips (final_<clip>.npz from fix_hands.py) written into the base GLB
# with the locomotion key reduction, the sparse "sit_drape" morph targets of the dress, apron and bow tie
# (drape_<mesh>.npz from build_drape.py), and the anim_meta.json morph fields (morph.meshes, per-clip
# morph.curves.sit_drape, settle_time_s, compression).
#   python3 build_glb.py <base.glb> <work_dir> <out.glb> <anim_meta.json in> <anim_meta.json out>
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402
import write_clips as WC  # noqa: E402
import write_morph as WM  # noqa: E402
import glb_clips  # noqa: E402
import fit_drape as FD  # noqa: E402
import opt_bones as OB  # noqa: E402

TARGET = 'sit_drape'
# Cocos numbers morph variants wrongly with a single target (docs/walk-driver.md §8.4): every mesh gets an empty second one.
PAD = '_pad'
MESHES = ('DRESS', 'APRON', 'BOW')
CURVE_TOL = 0.01
KEY_LIMIT = 20000
GLB_LIMIT = 1500000
ANIM_LIMIT = 150000
# skirt panel channels of the sit clips (cloth: the sit_drape key covers the seated shape, the panels only carry it)
# + spine / chest / neck 0.35 -> 0.75 deg and hand 0.8 -> 2 deg in the three sit clips (hips / legs / arms unchanged:
# foot sliding, hands on the lap), for the 150 KB animation budget
SKIRT_TOL = dict(other=float(os.environ.get('OTHER_TOL_DEG', 0.75)), skirt=float(os.environ.get('SKIRT_TOL_DEG', 3.5)), trans_skirt=float(os.environ.get('SKIRT_TOL_M', 0.008)),
                 scale=float(os.environ.get('SKIRT_TOL_S', 0.03)), hand=float(os.environ.get('HAND_TOL_DEG', 2.0)))
# sit_down / stand_up skirt panels (1.2 s moves; the keys are re-solved on the decoded clips)
TRANSITION_TOL = dict(skirt=float(os.environ.get('TR_TOL_DEG', 5.0)), trans_skirt=float(os.environ.get('TR_TOL_M', 0.012)),
                      scale=float(os.environ.get('TR_TOL_S', 0.06)))
# per-frame, per panel bone skirt tolerance multiplier from the chair clearance of the dress vertices that bone moves
# most, before the reduction (tight where the hem passes the seat, loose where it is far from it; an upper panel takes
# the tighter of itself and its .low bone), then halved around frames where the reduced clip goes deeper into the chair
# than the solved one by more than CLEAR_SLACK (only where the sit_drape weight is below KEY_W: from there on
# key_pocs.py solves the key on the reduced clip), or lets a covered leg point further out through the dress
# (opt_bones.LegCover, every frame; the bone of the nearest dress vertex).  Saved to work/skirt_mult.npz; the build after decode_clips.py reuses
# it, so the skirt channels come out identical to the ones the keys were solved on.
MULT_MIN, MULT_MAX, MULT_RANGE = (float(os.environ.get(k, v)) for k, v in (('MULT_MIN', 0.3), ('MULT_MAX', 3.0), ('MULT_RANGE', 0.02)))
CLEAR_SLACK = 0.002
KEY_W = 0.85
MULT_ITERS = int(os.environ.get('MULT_ITERS', 8))


def reduce_curve(t, w, tol=CURVE_TOL):
    """piecewise-linear [t, w] keys within tol of the per-frame weights (greedy, ends kept)."""
    keep = [0]
    i = 0
    n = len(t)
    while i < n - 1:
        j = i + 2
        while j < n:
            u = (t[i + 1:j] - t[i]) / (t[j] - t[i])
            if np.abs(w[i] + (w[j] - w[i]) * u - w[i + 1:j]).max() > tol:
                break
            j += 1
        keep.append(j - 1)
        i = j - 1
    return [[round(float(t[k]), 6), round(float(w[k]), 4)] for k in keep]


def chair_clearance(ch, chair, W, key, w, groups):
    """per frame and vertex group: min chair clearance of the dress vertices (max over each convex part's face planes:
    exact inside, a lower bound outside) for joint world matrices W [n,J,4,4], sit_drape weights w [n] -> [n, groups]."""
    out = np.zeros((len(W), len(groups)))
    for k in range(len(W)):
        X = ch.skin('DRESS', W[k], extra=w[k] * key)
        cl = np.min([(X @ p['n'].T + p['b']).max(1) for p in chair.parts], 0)
        out[k] = [cl[g].min() for g in groups]
    return out


def leg_pokes(ch, lc, W, key, w, gidx):
    """per frame and panel bone: deepest visible covered leg point outside the dress (-1 if none) -> [n, bones]."""
    out = -np.ones((len(W), max(gidx) + 1))
    for k in range(len(W)):
        X = ch.skin('DRESS', W[k], extra=w[k] * key)[lc.rep]
        s, ok, j = lc.dist(lc.visible(ch.skin('BODY', W[k])), X)
        g = gidx[j]
        m = ok & (g >= 0)
        np.maximum.at(out[k], g[m], s[m])
    return out


def write_reduced(base, tmp, clips, work):
    """WC.write with per-frame, per panel skirt tolerances (see MULT_*) -> rep, {clip: (solved, reduced) clearance [n]}."""
    ch, chair = SL.Character(base), SL.Chair()
    d = np.load(os.path.join(work, 'drape_DRESS.npz'))
    key = d['key']
    md = ch.md['DRESS']
    dom = md['J'][np.arange(len(md['J'])), md['W'].argmax(1)]
    bones = FD.DRESS_BONES
    groups = [np.where(dom == ch.rig.idx[b])[0] for b in bones]
    up = {bones[i]: bones[i + 4] for i in range(4)}
    saved = os.path.join(work, 'skirt_mult.npz')
    reuse = 'Qs_sit_hold' in d and os.path.exists(saved)
    sv = np.load(saved) if reuse else None
    lc = OB.LegCover(ch)
    jg = {ch.rig.idx[b]: i for i, b in enumerate(bones)}
    gidx = np.array([jg.get(int(j), -1) for j in dom[lc.rep]] + [-1])
    pre, pre_leg, m0, fix = {}, {}, {}, {}
    for c, cl in clips.items():
        n = len(cl['Q'])
        roots = np.array([SL.root_matrix(c, k / SL.FPS, ch.dur[c]) for k in range(n)])
        W = roots[:, None] @ ch.rig.fk(cl['T'], cl['Q'], cl['S'])
        pre[c] = chair_clearance(ch, chair, W, key, d['w_' + c], groups)
        pre_leg[c] = leg_pokes(ch, lc, W, key, d['w_' + c], gidx)
        free = (d['w_' + c] < KEY_W)[:, None]
        m0[c] = np.where(free, np.clip((pre[c] - CLEAR_SLACK) / MULT_RANGE, MULT_MIN, MULT_MAX), 1.0)
        fix[c] = np.ones_like(m0[c])
        if reuse:
            m0[c], fix[c] = sv['m_' + c], np.ones_like(m0[c])
    for it in range(MULT_ITERS + 1):
        for c, cl in clips.items():
            m = m0[c] * fix[c]
            mb = {b: m[:, i] for i, b in enumerate(bones)}
            cl['skirt_tol_mult'] = {b: np.minimum(mb[b], mb[up[b]]) if b in up else mb[b] for b in bones}
        rep = WC.write(base, tmp, clips, dict(WC.TOL, **SKIRT_TOL))
        g = SL.Character(tmp)
        res, bad_any = {}, False
        for c, cl in clips.items():
            n = len(cl['Q'])
            W = np.array([g.joints(c, k / SL.FPS) for k in range(n)])
            post = chair_clearance(g, chair, W, key, d['w_' + c], groups)
            post_leg = leg_pokes(g, lc, W, key, d['w_' + c], gidx)
            res[c] = (pre[c].min(1), post.min(1), pre_leg[c].max(1), post_leg.max(1))
            bad = ((post < np.minimum(pre[c], 0.0) - CLEAR_SLACK) & (d['w_' + c] < KEY_W)[:, None]) | \
                (post_leg > np.maximum(pre_leg[c], 0.0) + CLEAR_SLACK)
            for k, i in zip(*np.where(bad)):
                bad_any = True
                fix[c][max(k - 1, 0):k + 2, i] *= 0.5
        total = glb_clips.anim_bytes(tmp)['total']
        print('reduce', it, 'anim', total, {c: dict(chair=round(float((np.minimum(a, 0) - b).max()) * 1000, 1),
                                                     legs=round(float((e - np.maximum(l, 0)).max()) * 1000, 1))
                                             for c, (a, b, l, e) in res.items()}, file=sys.stderr, flush=True)
        if not bad_any or reuse:
            break
    if not reuse:
        np.savez(saved, **{'m_' + c: m0[c] * fix[c] for c in clips})
    return rep, res


def main():
    base, work, out, meta_in, meta_out = sys.argv[1:6]
    clips = {}
    for c in SL.CLIPS:
        z = np.load(os.path.join(work, 'final_%s.npz' % c))
        clips[c] = dict(fps=SL.FPS, Q=z['Q'], T=z['T'], loop=bool(z['loop']))
        if 'S' in z:              # skirt panel translation / scale channels (+ rest channels in the other clips)
            clips[c].update(S=z['S'], t_joints=FD.DRESS_BONES[4:], s_joints=FD.DRESS_BONES)
            if c != 'sit_hold':
                clips[c]['tol'] = TRANSITION_TOL
    tmp = out + '.clips.glb'
    rep, clear = write_reduced(base, tmp, clips, work)
    keys = {}
    for mesh in MESHES:
        p = os.path.join(work, 'drape_%s.npz' % mesh)
        if not os.path.exists(p):
            print('no', p)
            continue
        d = np.load(p)
        pad = np.zeros_like(d['key'])
        pad[0, 1] = 1e-6
        keys['LOD0_G2_' + mesh] = {TARGET: d['key'], PAD: pad}
    info = WM.add_morph(tmp, out, keys)
    os.remove(tmp)
    anim = glb_clips.anim_bytes(out)
    size = os.path.getsize(out)

    d = np.load(os.path.join(work, 'drape_DRESS.npz'))
    meta = json.load(open(meta_in))
    top = meta.setdefault('morph', {})
    top['mesh'] = 'LOD0_G2_APRON'
    top['meshes'] = {'LOD0_G2_' + m: {TARGET: 0, PAD: 1} for m in ('DRESS', 'BOW') if 'LOD0_G2_' + m in keys}
    top['note'] = ('sit_drape (cloud/sit-drape): one sparse POSITION target per cloth mesh, the same weight on all three '
                   '(curves below, driver: morphWeights / MorphDriver per mesh); target names from glTF '
                   'mesh.extras.targetNames, morph.meshes indices are the fallback. _pad = empty second target '
                   '(Cocos needs >= 2). art-src/animation/sit-drape')
    curves = {}
    for c in SL.CLIPS:
        w = d['w_' + c]
        t = np.arange(len(w)) / SL.FPS
        cv = reduce_curve(t, w)
        curves[c] = cv
        meta['clips'][c]['morph'] = {'mesh': 'LOD0_G2_DRESS', 'curves': {TARGET: cv}}
    wd = d['w_sit_down']
    k1 = int(np.argmax(wd >= 0.999))
    settle = max(float(meta['clips']['sit_down'].get('settle_time_s', 0)), k1 / SL.FPS)
    meta['clips']['sit_down']['settle_time_s'] = round(settle, 4)
    comp = meta.setdefault('compression', {})
    comp['anim_bytes_total'] = anim['total']
    comp['anim_bytes_per_clip'] = anim['clips']
    for c in SL.CLIPS:
        meta['clips'][c]['keys'] = '%d keys, reduced per channel (see top-level compression), LINEAR' % rep['clips'][c]['keys'] \
            if isinstance(rep['clips'].get(c), dict) and 'keys' in rep['clips'][c] else meta['clips'][c].get('keys')
    meta['sit_drape'] = dict(
        version='sit-drape-v1',
        targets={k: v for k, v in info.items() if k != 'size'},
        glb_bytes=size,
        doc='cloud-tasks/RESULT-sit-drape.md',
        pipeline='art-src/animation/sit-drape/scripts (fix_body -> drape_sim -> build_drape -> fix_hands -> build_glb)')
    with open(meta_out, 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')
    res = dict(size=size, anim_total=anim['total'], sit_anim={c: anim['clips'][c] for c in SL.CLIPS}, targets=meta['sit_drape']['targets'],
               curves=curves, settle_time_s=meta['clips']['sit_down']['settle_time_s'],
               chair_clearance_mm={c: dict(solved=round(float(a.min()) * 1000, 1), reduced=round(float(b.min()) * 1000, 1),
                                           worst_loss=round(float((np.minimum(a, 0) - b).max()) * 1000, 1))
                                   for c, (a, b, _, _) in clear.items()},
               leg_out_mm={c: dict(solved=round(float(l.max()) * 1000, 1), reduced=round(float(e.max()) * 1000, 1))
                           for c, (_, _, l, e) in clear.items()})
    print(json.dumps(res))
    assert size <= GLB_LIMIT, size
    assert anim['total'] <= ANIM_LIMIT, anim['total']
    for k, v in meta['sit_drape']['targets'].items():
        assert v['bytes'] <= KEY_LIMIT, (k, v)


if __name__ == '__main__':
    main()
