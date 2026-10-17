#!/usr/bin/env python3
"""Automatic check of a region transforms export (plain python3, no Blender).

  python3 art/tools/check_region_export.py TRANSFORMS.json MODELS_DIR [--expect N] [--expect-runtime N]
        [--runtime-skip REGEX] [--banned REGEX] [--unique LK_lake.glb,LK_bridge.glb,...]

Fails (exit 1) on: template instances (name == GLB basename), duplicate placements (same GLB + same
transform -> z-fighting), GLBs missing from MODELS_DIR, GLBs in _deprecated/_excluded or matching --banned,
non-unit quaternions, non-unique --unique GLBs, count mismatches. Prints CHECK PASS/FAIL + a JSON summary.
"""
import json, os, re, sys, math, argparse, collections
ap = argparse.ArgumentParser()
ap.add_argument('transforms'); ap.add_argument('models')
ap.add_argument('--expect', type=int); ap.add_argument('--expect-runtime', type=int)
ap.add_argument('--runtime-skip', default=r'^(LK_piece_.*|LK_contact_shadow|LK_ripple_ring|LK_board_frame)\.glb$')
ap.add_argument('--banned', default=r'_board_frame\.glb$|_light_shaft\.glb$|_lake_glint\.glb$|_board_cell\.glb$|_wb_cell\.glb$')
ap.add_argument('--unique', default='')
a = ap.parse_args()
d = json.load(open(a.transforms)); I = d['instances'] if isinstance(d, dict) else d
avail = {f for f in os.listdir(a.models) if f.endswith('.glb')}
dead = set()
for sub in ('_deprecated', '_excluded'):
    p = os.path.join(a.models, sub)
    if os.path.isdir(p): dead |= {f for f in os.listdir(p) if f.endswith('.glb')}
err = []; E = lambda m: err.append(m)
tpl = [i['name'] for i in I if i['name'] == re.sub(r'\.glb$', '', i['glb'])]
if tpl: E(f'{len(tpl)} template instances (name == GLB basename): {tpl[:10]}')
seen = collections.defaultdict(list)
for i in I: seen[(i['glb'], tuple(i['pos']), tuple(i['rot_quat_xyzw']), tuple(i['scale']))].append(i['name'])
dup = {k[0]: v for k, v in seen.items() if len(v) > 1}
if dup: E(f'duplicate placements: {dup}')
miss = sorted({i['glb'] for i in I} - avail); miss and E(f'GLB not in models: {miss}')
deadu = sorted({i['glb'] for i in I if i['glb'] in dead or re.search(a.banned, i['glb'])}); deadu and E(f'deprecated/excluded/banned GLB used: {deadu}')
badq = [i['name'] for i in I if abs(math.hypot(*i['rot_quat_xyzw']) - 1) > 1e-3]; badq and E(f'non-unit quats: {badq[:10]}')
origin = [i['name'] for i in I if max(map(abs, i['pos'])) < 1e-4]
cnt = collections.Counter(i['glb'] for i in I)
for u in filter(None, a.unique.split(',')):
    if cnt.get(u, 0) != 1: E(f'{u} expected exactly 1 instance, got {cnt.get(u, 0)}')
runtime = [i for i in I if not re.search(a.runtime_skip, i['glb'])]
if a.expect is not None and len(I) != a.expect: E(f'instances {len(I)} != expected {a.expect}')
if a.expect_runtime is not None and len(runtime) != a.expect_runtime: E(f'runtime scene instances {len(runtime)} != expected {a.expect_runtime}')
if isinstance(d, dict) and 'instance_count' in d and d['instance_count'] != len(I): E('instance_count field mismatch')
summary = dict(instances=len(I), groups=dict(collections.Counter(i['group'] for i in I)), runtime_scene_instances=len(runtime),
               runtime_skipped=dict(collections.Counter(i['glb'] for i in I if re.search(a.runtime_skip, i['glb']))),
               templates=len(tpl), duplicates=len(dup), at_origin=origin, glb_kinds=len(cnt))
print('CHECK', 'FAIL' if err else 'PASS', json.dumps(summary, ensure_ascii=False))
for m in err: print('  ERROR', m)
sys.exit(1 if err else 0)
