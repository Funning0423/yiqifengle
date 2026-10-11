# QA of the exported character GLB with the 角色动画bot tool chain (copied here unchanged except loco_qa's walk length):
#   loco_qa.py        feet slide (planted sole vertices, world space via root_motion), knees, hand-off residuals
#   walk_clipcheck.py leg-vs-dress/apron and arm-vs-cloth/torso ray test (CLIP_MARGIN = 6 mm), clearances
#   walk_qa_arms.py   elbow / arm pose numbers
#   r2_check.py       part-pair triangle overlaps and min gaps (body-r2 check)
# python3 run_qa.py <glb> <anim_meta.json> <raw_out_dir> <summary.json> [clip ...]
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.environ.get('BLENDER', 'blender')
CLIPS = ['walk_loop', 'walk_start', 'walk_stop_bodyL', 'walk_stop_bodyR', 'walk_turn_90_bodyL', 'walk_turn_90_bodyR',
         'walk_turn_180', 'walk_turn_180_bodyR', 'idle_breathing_loop', 'sit_hold', 'sit_down', 'stand_up', 'door_reach']


def author_json(name, c, path):
    n = int(round((c.get('duration_s') or c['cycle_duration_s']) * 30))
    rm = c.get('root_motion') if isinstance(c.get('root_motion'), dict) else {}
    if name == 'walk_loop':
        rm = dict(forward_m=[[i / 30, 0.7 * i / 30] for i in range(n + 1)])
    if name == 'stand_up':
        rm = dict(forward_m=[[t, v - 0.494] for t, v in rm.get('forward_m', [])])
    a = dict(frames=n, root_motion={k: v for k, v in rm.items() if k in ('forward_m', 'lateral_m', 'yaw_deg')})
    if name == 'walk_start':
        h = c['handoff']
        a['t2'] = h['at_s'] - h['next_time_s']
    if name.startswith('walk_stop'):
        a['te'] = c['entry']['walk_time_s']
    with open(path, 'w') as f:
        json.dump(a, f)
    return n


def run(args, log):
    with open(log, 'w') as f:
        subprocess.run(args, stdout=f, stderr=subprocess.STDOUT, env=dict(os.environ, CLIP_MARGIN='0.006'))


def main():
    glb, meta, raw, summ = sys.argv[1:5]
    names = sys.argv[5:] or CLIPS
    os.makedirs(raw, exist_ok=True)
    am = json.load(open(meta))['clips']
    sys.path.insert(0, os.path.join(HERE, '..', 'scripts'))
    import rig as RG
    J, _ = RG.glb_load(glb)
    for an in J['animations']:            # clips anim_meta does not describe (old GLB): duration from the GLB, no root motion
        if an['name'] not in am:
            d = max(J['accessors'][s['input']]['max'][0] for s in an['samplers'])
            am[an['name']] = dict(duration_s=d, loop=an['name'].endswith('_loop') or an['name'] == 'sit_hold')
    jobs = []
    for nm in names:
        aj = os.path.join(raw, nm + '.author.json')
        n = author_json(nm, am[nm], aj)
        nf = n if am[nm].get('loop') else n + 1
        b = [BLENDER, '-b', '--python']
        jobs += [(b + [os.path.join(HERE, 'loco_qa.py'), '--', glb, nm, aj, os.path.join(raw, nm + '.feet.json'), '4'],
                  os.path.join(raw, nm + '.feet.log')),
                 (b + [os.path.join(HERE, 'walk_clipcheck.py'), '--', glb, nm, str(nf), '30', os.path.join(raw, nm + '.clip.json'), '2'],
                  os.path.join(raw, nm + '.clip.log')),
                 (b + [os.path.join(HERE, 'walk_qa_arms.py'), '--', glb, nm, str(nf), '30', os.path.join(raw, nm + '.arms.json'), '1'],
                  os.path.join(raw, nm + '.arms.log')),
                 (b + [os.path.join(HERE, 'r2_check.py'), '--', glb, nm, os.path.join(raw, nm + '.r2.json'), '1'],
                  os.path.join(raw, nm + '.r2.log'))]
    with ThreadPoolExecutor(int(os.environ.get('QA_JOBS', '3'))) as ex:
        list(ex.map(lambda j: run(*j), jobs))
    out = {}
    for nm in names:
        r = {}
        try:
            f = json.load(open(os.path.join(raw, nm + '.feet.json')))
            r['slide_planted_mm'] = {s: f['slide_planted_max_mm_' + s] for s in 'LR'}
            r['min_mesh_z_mm'] = f['min_mesh_z_mm']
            r['foot_foot_overlap_tris'] = f['foot_foot_overlap_tris']
            r['double_support_pct'] = f['double_support_pct']
            r['knee'] = {s: {k: v for k, v in f['knee_' + s].items() if k != 'per_frame'} for s in 'LR'}
            r['handoff'] = f['handoff']
        except Exception as e:      # noqa: BLE001
            r['feet_error'] = repr(e)
        try:
            c = json.load(open(os.path.join(raw, nm + '.clip.json')))
            r['clip_vertex_hits'] = c['total_vertex_hits']
            r['clip_max_depth_mm'] = c['max_depth_mm']
            r['min_clearance_mm'] = {k: v['min'] for k, v in c['min_clearance'].items()}
            r['tri_overlap_total'] = c['tri_overlap_total']
        except Exception as e:      # noqa: BLE001
            r['clip_error'] = repr(e)
        try:
            g = json.load(open(os.path.join(raw, nm + '.r2.json')))
            r['r2_overlap_max'] = {k: v[0] for k, v in g['overlap_max'].items() if v[0]}
            r['r2_min_gap_mm'] = {k: v[0] for k, v in g['min_gap_mm'].items()}
        except Exception as e:      # noqa: BLE001
            r['r2_error'] = repr(e)
        out[nm] = r
    with open(summ, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    for nm, r in out.items():
        print(nm, json.dumps({k: r.get(k) for k in ('slide_planted_mm', 'clip_vertex_hits', 'min_clearance_mm')})[:400])


if __name__ == '__main__':
    main()
