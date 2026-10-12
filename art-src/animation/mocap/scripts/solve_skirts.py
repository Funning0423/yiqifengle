# Stage 2 (inside Blender for mathutils.bvhtree): skirt / arm clearance curves for every exported clip.
#   blender -b -P solve_skirts.py -- [out_dir] [clip ...]
# Hub clips first (walk_loop, idle_breathing_loop, sit_hold); every other clip blends to the hub curves where it hands off
# (lock weights from export_clips.py), so cloth poses match at the transitions.
# out_dir/<clip>.skirt.npz: Q (solved), curve_<var> (radians);  out_dir/<clip>.skirt.json: solver report
import json
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clipbuild as CB          # noqa: E402
import skirt_solve as SS        # noqa: E402
from export_clips import ORDER  # noqa: E402

FPS = CB.FPS
NO_ARMS = {'sit_hold', 'sit_down', 'stand_up'}     # hands IK-placed on the lap: arms stay as built
SEATED = {'sit_hold', 'sit_down', 'stand_up'}     # seated drape is task 03: no closest-approach term (cannot clear the lap)


def hub_curves(out, name):
    d = np.load(os.path.join(out, name + '.skirt.npz'))
    with open(os.path.join(out, name + '.json')) as f:
        loop = json.load(f)['loop']
    return {v: d['curve_' + v] for v in SS.VARS}, loop


def sample(curve, loop, phase_s):
    n = len(curve)
    f = np.asarray(phase_s, float) * FPS
    if loop:
        return np.interp(f % n, np.arange(n + 1), np.append(curve, curve[0]))
    return np.interp(np.clip(f, 0, n - 1), np.arange(n), curve)


def lock_for(out, meta, d):
    if not meta['lock']:
        return None
    n = meta['frames']
    wsum = np.zeros(n)
    acc = {v: np.zeros(n) for v in SS.VARS}
    lw = np.zeros(n)
    for k, hub in enumerate(meta['lock']):
        w = d['lock_w_%d' % k]
        ph = d['lock_phase_%d' % k]
        cv, loop = hub_curves(out, hub)
        for v in SS.VARS:
            acc[v] += w * sample(cv[v], loop, ph)
        wsum += w
        lw = np.maximum(lw, w)
    lv = {v: acc[v] / np.maximum(wsum, 1e-9) for v in SS.VARS}
    return lw, lv


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else '/tmp/mc/out'
    names = argv[1:] or ORDER
    solver = SS.Solver(CB.rig())
    summary = {}
    for name in names:
        t0 = time.time()
        d = np.load(os.path.join(out, name + '.npz'))
        with open(os.path.join(out, name + '.json')) as f:
            meta = json.load(f)
        lock = lock_for(out, meta, d)
        solver.near = 0.0 if name in SEATED else SS.MARG_NEAR
        solver.arm_sides = 'LR'
        hold = {s: d['arm_hold_' + s] for s in 'LR' if 'arm_hold_' + s in d.files}   # door_reach: hand on the handle
        log = []
        Qo, rep = SS.solve_clip(solver, d['Q'], d['T'], periodic=meta['loop'], lock=lock, arms=name not in NO_ARMS,
                                log=lambda *a: log.append(' '.join(str(x) for x in a)), arm_hold=hold)
        curves = {v: np.radians(np.asarray(rep['curves_deg'].get(v, np.zeros(len(Qo))), float)) for v in SS.VARS}
        np.savez(os.path.join(out, name + '.skirt.npz'), Q=Qo, **{'curve_' + v: c for v, c in curves.items()})
        last = rep['iterations'][-1]
        best = min(rep['iterations'], key=lambda r: (r['bad'], sum(r['hits'].values())))
        res = dict(seconds=round(time.time() - t0, 1), arms=name not in NO_ARMS, outer_passes=len(rep['iterations']),
                   bad_frames=best['bad'], hits=best['hits'], bad_frame_list=best['bad_frames'], max_deg=rep['max_deg'],
                   last_pass=dict(bad=last['bad'], hits=last['hits']))
        with open(os.path.join(out, name + '.skirt.json'), 'w') as f:
            json.dump(dict(result=res, log=log, curves_deg=rep['curves_deg']), f, indent=1)
        summary[name] = res
        print('SKIRT %-22s %5.1fs bad %d hits %s max %s' % (name, res['seconds'], res['bad_frames'], res['hits'],
              {k: v for k, v in res['max_deg'].items() if v > 0}), flush=True)
    with open(os.path.join(out, 'skirt_summary.json'), 'w') as f:
        json.dump(summary, f, indent=1)


if __name__ == '__main__':
    main()
