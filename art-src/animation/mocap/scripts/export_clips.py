# Stage 1 (plain python3 + numpy): build every clip and write it as local joint arrays for the skirt solver / GLB writer.
#   python3 export_clips.py [out_dir] [clip ...]
# out_dir/<clip>.npz: Q [n,J,4], T [n,J,3] (rig joint order, skirt joints at rest), contacts_L/R, lock_w_<k>, lock_phase_<k>
# out_dir/<clip>.json: name, loop, fps, frames, events, root, extra, info, lock clip names
import json
import os
import sys
import time
import numpy as np
import clipbuild as CB
import clips as K

ORDER = ['walk_loop', 'idle_breathing_loop', 'sit_hold', 'walk_start', 'walk_stop_bodyL', 'walk_stop_bodyR',
         'walk_turn_90_bodyL', 'walk_turn_90_bodyR', 'walk_turn_180', 'walk_turn_180_bodyR', 'sit_down', 'stand_up',
         'door_reach']


def jsonable(o):
    if isinstance(o, (np.floating, np.integer, np.bool_)):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))


def export(name, out):
    t0 = time.time()
    c = K.build(name)
    Q, T = CB.to_clip(c['track'])
    arrs = dict(Q=Q.astype(np.float64), T=T.astype(np.float64))
    for s in 'LR':
        arrs['contacts_' + s] = np.asarray(c['contacts'][s], bool)
    for k, (w, clip, ph) in enumerate(c['lock']):
        arrs['lock_w_%d' % k] = np.asarray(w, float)
        arrs['lock_phase_%d' % k] = np.asarray(ph, float)
    np.savez(os.path.join(out, name + '.npz'), **arrs)
    meta = dict(name=name, loop=bool(c['loop']), fps=CB.FPS, frames=int(len(Q)),
                duration_s=round((len(Q) if c['loop'] else len(Q) - 1) / CB.FPS, 6),
                events=c['events'], root=c['root'], extra=c['extra'], info=c['info'],
                lock=[clip for _, clip, _ in c['lock']])
    with open(os.path.join(out, name + '.json'), 'w') as f:
        json.dump(meta, f, indent=1, default=jsonable)
    print('%-22s %3d frames  %.1fs' % (name, len(Q), time.time() - t0), flush=True)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/mc/out'
    names = sys.argv[2:] or ORDER
    os.makedirs(out, exist_ok=True)
    for n in names:
        export(n, out)


if __name__ == '__main__':
    main()
