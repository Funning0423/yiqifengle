# Write dense local-pose clips (npz: Q, T, t, loop) back into a character GLB with the locomotion key reduction.
#   python3 write_clips.py <base.glb> <out.glb> <dir with <clip>.npz | body_<clip>.npz> [prefix]
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402,F401
import glb_clips  # noqa: E402
import numpy as np  # noqa: E402

TOL = dict(leg=0.1, other=0.35, distal=0.8, skirt=0.8, trans_m=0.0004)     # write_glb.py final level


def load(d, prefix='body_'):
    clips = {}
    for c in SL.CLIPS:
        p = os.path.join(d, prefix + c + '.npz')
        z = np.load(p)
        clips[c] = dict(fps=SL.FPS, Q=z['Q'], T=z['T'], loop=bool(z['loop']))
    return clips


def compact(path):
    """glb_clips.write keeps the replaced clips' bytes when they shared a bufferView with kept clips: repack every
    bufferView that only animation accessors use into one tight bufferView (mesh / skin / image views stay verbatim)."""
    RG = SL.RG
    J, B = RG.glb_load(path)
    anim = set()
    for an in J['animations']:
        for s in an['samplers']:
            anim.update((s['input'], s['output']))
    other_bv = set(img['bufferView'] for img in J.get('images', []) if 'bufferView' in img)
    for i, a in enumerate(J['accessors']):
        if i not in anim:
            for v in [a.get('bufferView')] + [a.get('sparse', {}).get(k, {}).get('bufferView') for k in ('indices', 'values')]:
                if v is not None:
                    other_bv.add(v)
    newB = bytearray()
    bvs, bvmap = [], {}
    for i, bv in enumerate(J['bufferViews']):
        if i not in other_bv:
            continue
        while len(newB) % 4:
            newB.append(0)
        o = bv.get('byteOffset', 0)
        nb = dict(bv, byteOffset=len(newB))
        newB.extend(B[o:o + bv['byteLength']])
        bvmap[i] = len(bvs)
        bvs.append(nb)
    while len(newB) % 4:
        newB.append(0)
    start = len(newB)
    blob = bytearray()
    for i in sorted(anim):
        a = J['accessors'][i]
        bv = J['bufferViews'][a['bufferView']]
        o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        n = a['count'] * RG.NC[a['type']] * np.dtype(RG.CT[a['componentType']]).itemsize
        assert 'byteStride' not in bv
        a['byteOffset'] = len(blob)
        a['bufferView'] = len(bvs)
        blob.extend(B[o:o + n])
        while len(blob) % 4:
            blob.append(0)
    for i, a in enumerate(J['accessors']):
        if i in anim:
            continue
        if 'bufferView' in a:
            a['bufferView'] = bvmap[a['bufferView']]
        for k in ('indices', 'values'):
            if k in a.get('sparse', {}):
                a['sparse'][k]['bufferView'] = bvmap[a['sparse'][k]['bufferView']]
    for img in J.get('images', []):
        if 'bufferView' in img:
            img['bufferView'] = bvmap[img['bufferView']]
    bvs.append(dict(buffer=0, byteOffset=start, byteLength=len(blob)))
    newB.extend(blob)
    J['bufferViews'] = bvs
    J['buffers'][0]['byteLength'] = len(newB)
    return RG.glb_save(path, J, bytes(newB))


def write(base, out, clips, tol=TOL):
    rep = glb_clips.write(base, out, clips, tol)
    rep['size'] = compact(out)
    rep['anim'] = glb_clips.anim_bytes(out)
    return rep


if __name__ == '__main__':
    base, out, d = sys.argv[1:4]
    prefix = sys.argv[4] if len(sys.argv) > 4 else 'body_'
    rep = write(base, out, load(d, prefix))
    print(json.dumps(dict(size=rep['size'], anim_total=rep['anim']['total'], clips=rep['clips'],
                          sit={c: rep['anim']['clips'][c] for c in SL.CLIPS})))
