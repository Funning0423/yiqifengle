# Stage 3 (python3): write the solved clips into the character GLB (replaced in place, same animation indices), update the
# Cocos .meta (durations / splits) and anim_meta.json (durations, events, root_motion, hand-offs, sources).
#   python3 write_glb.py [out_dir]
# Key reduction tolerances are searched from tight to loose until all animation data (incl. the untouched wind_sway_loop)
# fits ANIM_BUDGET bytes.
import json
import os
import shutil
import sys
import numpy as np
import clipbuild as CB
import glb_clips as GC
from export_clips import ORDER

ANIM_BUDGET = 150 * 1000
TOLS = [dict(leg=0.03, other=0.2, distal=0.2, skirt=0.3, trans_m=0.0001),     # = 角色动画bot compression (legs+hips 0.03 deg)
        dict(leg=0.05, other=0.25, distal=0.4, skirt=0.4, trans_m=0.0002),
        dict(leg=0.08, other=0.3, distal=0.6, skirt=0.6, trans_m=0.0003),
        dict(leg=0.1, other=0.35, distal=0.8, skirt=0.8, trans_m=0.0004),
        dict(leg=0.12, other=0.4, distal=1.0, skirt=1.0, trans_m=0.0005),
        dict(leg=0.15, other=0.5, distal=1.2, skirt=1.2, trans_m=0.0006)]
META = CB.GLB + '.meta'
ANIM_META = os.path.join(os.path.dirname(CB.GLB), 'anim_meta.json')
LICENSE = ('CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), funded by NSF EIA-0196217: free to use, '
           'including commercial products; the raw data may not be resold')


def load(out):
    clips, metas = {}, {}
    for n in ORDER:
        d = np.load(os.path.join(out, n + '.npz'))
        sk = os.path.join(out, n + '.skirt.npz')
        Q = np.load(sk)['Q'] if os.path.exists(sk) else d['Q']
        with open(os.path.join(out, n + '.json')) as f:
            m = json.load(f)
        clips[n] = dict(fps=CB.FPS, Q=Q, T=d['T'], loop=m['loop'])
        hf = m['info'].get('hold_from_frame')
        if hf is not None:       # still tail: exactly the hold-start pose (the skirt solve may jitter it), key pinned there
            Q, T = Q.copy(), d['T'].copy()
            Q[hf:], T[hf:] = Q[hf], T[hf]
            clips[n].update(Q=Q, T=T, pin=[hf])
        m['contacts'] = {s: d['contacts_' + s].astype(bool) for s in 'LR'}
        m['skirt'] = json.load(open(os.path.join(out, n + '.skirt.json')))['result'] if os.path.exists(sk) else None
        metas[n] = m
    return clips, metas


def write(clips, out):
    tmp = os.path.join(out, 'candidate.glb')
    for tol in TOLS:
        rep = GC.write(CB.GLB, tmp, clips, tol=tol, extras_note='mocap-animation (CMU retarget), see art-src/animation/mocap')
        ab = GC.anim_bytes(tmp)
        print('tol', tol, 'anim bytes', ab['total'], 'glb', rep['size'], flush=True)
        if ab['total'] <= ANIM_BUDGET:
            shutil.copyfile(tmp, CB.GLB)
            return tol, rep, ab
    raise SystemExit('animation data over budget at the loosest tolerance')


def update_meta(metas):
    with open(META) as f:
        m = json.load(f)
    dur = {n: metas[n]['duration_s'] for n in metas}
    for s in m['userData']['animationImportSettings']:
        if s['name'] in dur:
            s['duration'] = dur[s['name']]
            for sp in s['splits']:
                sp['from'], sp['to'] = 0, dur[s['name']]
    for sub in m['subMetas'].values():
        nm = sub.get('name', '')
        if nm.endswith('.animation') and nm[:-10] in dur:
            sub['userData']['span'] = {'from': 0, 'to': dur[nm[:-10]]}
    assert m['userData'].get('tangents') == 1
    with open(META, 'w') as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
        f.write('\n')


def walk_phases(C, n):
    out = {}
    for s in 'RL':
        c = C[s]
        hs = [i for i in range(n) if c[i] and not c[i - 1]][0]
        to = [i for i in range(n) if not c[i] and c[i - 1]][0]
        out['foot.' + s] = dict(body='L' if s == 'R' else 'R', heel_strike=round(hs / n, 3), toe_off=round(to / n, 3))
    both = np.asarray(C['L']) & np.asarray(C['R'])
    segs = []
    for i in range(n):
        if both[i] and not both[i - 1]:
            j = i
            while both[(j + 1) % n] and (j + 1) % n != i:
                j += 1
            segs.append([round(i / n, 3), round(((j + 1) % n) / n if (j + 1) % n else 1.0, 3)])
    out['double_support'] = segs
    out['double_support_pct'] = round(100 * both.mean(), 1)
    return out


def source_of(m):
    i = m['info']
    src = dict(database='CMU', trial=i.get('trial'), window_s=i.get('src_window_s'), license=LICENSE,
               doc='art-src/animation/mocap/SOURCES.md')
    for k in ('time_stretch', 'stride_scale', 'yaw_scale', 'mirrored', 'edits', 'hands'):
        if k in i:
            src[k] = i[k]
    return src


def clip_entry(n, m, keys, old):
    e = dict(version='mocap-v1', loop=m['loop'], duration_s=m['duration_s'], frames=int(round(m['duration_s'] * CB.FPS)),
             fps=CB.FPS, keys='%d keys, reduced per channel (see top-level compression), LINEAR' % keys,
             cocos_meta_split=dict(from_s=0.0, to_s=m['duration_s'],
                                   note='split 0..clip length in the GLB .meta (%s)' % ('loop' if m['loop'] else 'one-shot')))
    ex = dict(m['extra'])
    if not m['loop']:
        e['clock'] = ex.pop('clock', 'time')
    e['in_place'] = ex.pop('in_place', True)
    e['events'] = m['events']
    if m['root']:
        e['root_motion'] = m['root']
    elif 'root_motion' in ex:
        e['root_motion'] = ex.pop('root_motion')
    ex.pop('root_motion', None)
    e.update(ex)
    e['source'] = source_of(m)
    for k in ('forward_axis', 'mirror'):
        if old and k in old:
            e[k] = old[k]
    return e


def update_anim_meta(metas, rep, tol, ab):
    with open(ANIM_META) as f:
        am = json.load(f)
    old = am.get('clips', {})
    clips = {}
    for n in ORDER:
        m = metas[n]
        e = clip_entry(n, m, rep['clips'][n]['keys'], old.get(n))
        if n == 'walk_loop':
            T = m['duration_s']
            e['cycle_duration_s'] = T
            e['frames'] = m['frames']
            e['distance_per_cycle_m'] = round(0.7 * T, 6)
            e['step_length_m'] = round(0.35 * T, 6)
            e['playback_rate_formula'] = 'rate = actual_speed / 0.7'
            e['root_motion'] = 'none (root bone static); driver translates the character forward at native_speed_mps'
            for ev in e['events']:
                ev['frame'] = int(round(ev['time_s'] * CB.FPS))
            e['phases_fraction_of_cycle'] = walk_phases(m['contacts'], m['frames'])
        clips[n] = e
    for n, e in old.items():
        if n not in clips:
            clips[n] = e
    am['clips'] = clips
    am['status'] = ('mocap-v1: all 13 character clips replaced by retargeted CMU motion capture (walk_loop, walk_start, '
                    'walk_stop_bodyL/R, walk_turn_90_bodyL/R, walk_turn_180(_bodyR), idle_breathing_loop, sit_hold, sit_down, '
                    'stand_up, door_reach); wind_sway_loop unchanged')
    am['compression'] = dict(
        clips=('keys reduced per channel (greedy; slerp / lerp error <= %.2f deg hips+legs, %.2f deg spine/chest/neck, %.2f deg '
               'head/arms/hands, %.2f deg skirt, root/hips translation %.1f mm), rest translations / scales omitted, float32, '
               'LINEAR; source mocap low-passed (gauss sigma %.0f frames at 120 fps) before retargeting'
               % (tol['leg'], tol['other'], tol['distal'], tol['skirt'], tol['trans_m'] * 1000, CB.SOURCE_SMOOTH)),
        anim_bytes_total=ab['total'], anim_bytes_per_clip=ab['clips'], budget_bytes=ANIM_BUDGET)
    am['mocap'] = dict(sources='art-src/animation/mocap/SOURCES.md', license=LICENSE,
                       pipeline='art-src/animation/mocap/scripts (export_clips.py -> solve_skirts.py in Blender -> write_glb.py)')
    with open(ANIM_META, 'w') as f:
        json.dump(am, f, indent=1, ensure_ascii=False)
        f.write('\n')


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/mc/out'
    clips, metas = load(out)
    tol, rep, ab = write(clips, out)
    update_meta(metas)
    update_anim_meta(metas, rep, tol, ab)
    summary = dict(glb_size=os.path.getsize(CB.GLB), tol=tol, anim_bytes=ab, keys={n: rep['clips'][n]['keys'] for n in ORDER})
    with open(os.path.join(out, 'write_summary.json'), 'w') as f:
        json.dump(summary, f, indent=1)
    print(json.dumps(summary)[:1500])


if __name__ == '__main__':
    main()
