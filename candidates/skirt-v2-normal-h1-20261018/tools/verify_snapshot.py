#!/usr/bin/env python3
"""Check the frozen stage snapshot. This is not an engine or contact test."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from glb_io import GLB

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1])
args = p.parse_args()
root = args.directory
manifest = json.loads((root / 'manifest.json').read_text())
for name, expected in manifest['files'].items():
    actual = hashlib.sha256((root / name).read_bytes()).hexdigest()
    assert actual == expected, f'Hash mismatch: {name}'
g = GLB(root / 'character-skirt-v2-normal-h1.glb')
meta = json.loads((root / 'anim_meta.json').read_text())
meshes = {m['name']: m for m in g.j['meshes']}
assert meta['glb'] == 'character-skirt-v2-normal-h1.glb'
native_weights = sum(c['target']['path'] == 'weights'
                     for a in g.j['animations'] for c in a['channels'])
assert native_weights == 0
assert sum(len(a['channels']) for a in g.j['animations']) == 504
assert len(g.j['animations']) == 14
normal_only = 0
new_names = set()
for name, count, old_count in [('LOD0_G2_APRON', 53, 29), ('LOD0_G2_DRESS', 49, 32)]:
    mesh = meshes[name]
    primitive = mesh['primitives'][0]
    names = mesh['extras']['targetNames']
    assert len(primitive['targets']) == len(names) == count
    for target_name, index in meta['morph']['meshes'][name]['targets'].items():
        assert names[index] == target_name
    for i in range(old_count, count):
        new_names.add(names[i])
        target = primitive['targets'][i]
        for accessor in target.values():
            assert np.isfinite(g.acc(accessor)).all()
        if names[i].startswith('cloth_normal_'):
            normal_only += 1
            assert not np.count_nonzero(g.acc(target['POSITION']))
            assert np.count_nonzero(g.acc(target['NORMAL']))
assert normal_only == 32
assert len(new_names) == 25
curves = meta['clips']['walk_loop']['morph']['curves']
for name in new_names:
    curve = np.asarray(curves[name], dtype=float)
    assert np.isfinite(curve).all()
    assert np.all(np.diff(curve[:, 0]) > 0), name
    assert np.all((curve[:, 1] >= 0) & (curve[:, 1] <= 1)), name
for clip_name, clip in meta['clips'].items():
    if clip_name != 'walk_loop':
        assert not new_names.intersection(clip.get('morph', {}).get('curves', {}))
body = meshes['LOD0_G2_BODY']
assert [len(p['targets']) for p in body['primitives']] == [16] * 6
shoe = body['primitives'][1]
assert len(g.acc(shoe['attributes']['POSITION'])) == 864
assert len(g.acc(shoe['indices'])) == 4992
assert all(not np.count_nonzero(g.acc(a)) for t in shoe['targets'] for a in t.values())
assert len(np.unique(g.acc(body['primitives'][2]['indices']))) == 130
assert meta['sole_contact']['source_sha256'] == 'fd52aa0669ee70ce2f1f699d2fd15890dd6ba77a5bf50ad937a833ed31161711'
print(json.dumps({
    'status': 'PASS', 'files_hashed': len(manifest['files']),
    'native_weights_channels': native_weights, 'skeletal_channels': 504,
    'apron_targets': 53, 'dress_targets': 49, 'normal_only_targets': normal_only,
    'new_curve_names': len(new_names), 'shoe_vertices': 864,
    'contact_solver_accepted': False, 'cocos_importer_gpu_accepted': False,
    'scope': 'Snapshot hash and structure checks only; known inherited sampler duplicates are not repaired.'
}, indent=2))
