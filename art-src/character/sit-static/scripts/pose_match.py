# Compare sit_down's last sample with stand_up's first sample in the runtime GLB.
# The static sitting mesh is sit_down's last frame with the armature applied, then
# the skirt and apron re-authored. Bone TRS at that frame is the body pose.
import json, os, struct
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
GLB = os.path.join(ROOT, 'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
OUT = os.path.join(ROOT, 'art-src/character/sit-static/data/pose_match.json')

def load(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen
    clen = struct.unpack_from('<I', data, bin_off)[0]
    blob = data[bin_off + 8:bin_off + 8 + clen]
    return j, blob

def read_acc(j, blob, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = a['count']
    comps = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    return np.frombuffer(blob, dtype=np.float32, count=n * comps, offset=off).reshape(n, comps).copy()

def anim_map(j, blob, name):
    a = next(x for x in j['animations'] if x['name'] == name)
    out = {}
    for ch in a['channels']:
        sm = a['samplers'][ch['sampler']]
        key = (ch['target']['node'], ch['target']['path'])
        out[key] = (read_acc(j, blob, sm['input'])[:, 0], read_acc(j, blob, sm['output']))
    return out

def eval_at(times, vals, t):
    if t <= times[0]:
        return vals[0]
    if t >= times[-1]:
        return vals[-1]
    i = int(np.searchsorted(times, t))
    u = (t - times[i - 1]) / (times[i] - times[i - 1] + 1e-12)
    return vals[i - 1] * (1 - u) + vals[i] * u

def main():
    j, blob = load(GLB)
    names = {i: n.get('name') for i, n in enumerate(j['nodes'])}
    sit = anim_map(j, blob, 'sit_down')
    stand = anim_map(j, blob, 'stand_up')
    rows = []
    for key, (st, sv) in stand.items():
        if key not in sit:
            continue
        tt, tv = sit[key]
        a = eval_at(tt, tv, float(tt[-1]))
        b = eval_at(st, sv, float(st[0]))
        if key[1] == 'rotation':
            dot = min(1.0, abs(float(np.dot(a, b))))
            delta = float(np.degrees(2 * np.arccos(dot)))
            unit = 'deg'
        else:
            delta = float(np.linalg.norm(a - b) * 1000)
            unit = 'mm'
        rows.append({'node': names[key[0]], 'path': key[1], 'delta': round(delta, 4), 'unit': unit})
    rows.sort(key=lambda r: -r['delta'])
    report = {
        'runtime_glb': os.path.relpath(GLB, ROOT),
        'sit_down_duration_s': 1.2,
        'stand_up_duration_s': 1.266667,
        'compare': 'sit_down last sample vs stand_up first sample',
        'max_rotation_deg': max((r['delta'] for r in rows if r['unit'] == 'deg'), default=0),
        'max_translation_mm': max((r['delta'] for r in rows if r['unit'] == 'mm'), default=0),
        'note': 'Static body is sit_down last frame, armature applied, no body verts moved. Skirt bones cannot follow the sculpted sheet; the 0.3 s camera fade covers that swap. Clips are not rewritten.',
        'channels': rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(report, f, indent=1)
        f.write('\n')
    print('max rot deg', report['max_rotation_deg'], 'max trans mm', report['max_translation_mm'])

if __name__ == '__main__':
    main()
