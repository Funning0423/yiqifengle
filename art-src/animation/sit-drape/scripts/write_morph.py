# Add sparse morph targets (POSITION only, no normals / tangents) to meshes of a GLB.
#   keys = {mesh_name: {target_name: delta [V, 3] in the primitive's vertex order}}
# Each target is a sparse accessor without a bufferView (base = zeros): uint16 indices + float32 VEC3 values of the
# vertices whose delta is non-zero, so a key costs 14 bytes per moved vertex.  mesh.weights = 0, the names go to
# mesh.extras.targetNames (read by Blender, three.js and the Cocos importer).
import numpy as np

import sitlib as SL

RG = SL.RG


def _append(BIN, data, align=4):
    while len(BIN) % align:
        BIN.append(0)
    off = len(BIN)
    BIN.extend(data)
    return off


def add_morph(src, dst, keys, eps=1e-7):
    J, B = RG.glb_load(src)
    BIN = bytearray(B)
    info = {}
    for mesh_name, targets in keys.items():
        m = [x for x in J['meshes'] if x['name'] == mesh_name][0]
        assert len(m['primitives']) == 1, mesh_name
        pr = m['primitives'][0]
        assert not pr.get('targets'), mesh_name + ' already has morph targets'
        V = J['accessors'][pr['attributes']['POSITION']]['count']
        assert V < 65536
        pr['targets'] = []
        names = []
        for name, D in targets.items():
            D = np.asarray(D, np.float32)
            assert D.shape == (V, 3), (mesh_name, D.shape, V)
            idx = np.where(np.abs(D).max(1) > eps)[0].astype(np.uint16)
            vals = D[idx].astype('<f4')
            oi = _append(BIN, idx.astype('<u2').tobytes())
            J['bufferViews'].append(dict(buffer=0, byteOffset=oi, byteLength=int(idx.nbytes)))
            bi = len(J['bufferViews']) - 1
            ov = _append(BIN, vals.tobytes())
            J['bufferViews'].append(dict(buffer=0, byteOffset=ov, byteLength=int(vals.nbytes)))
            bv = len(J['bufferViews']) - 1
            full = np.zeros((V, 3), np.float32)
            full[idx] = vals
            J['accessors'].append(dict(componentType=5126, count=int(V), type='VEC3',
                                       min=[float(x) for x in full.min(0)], max=[float(x) for x in full.max(0)],
                                       sparse=dict(count=int(len(idx)), indices=dict(bufferView=bi, componentType=5123),
                                                   values=dict(bufferView=bv))))
            pr['targets'].append(dict(POSITION=len(J['accessors']) - 1))
            names.append(name)
            info['%s/%s' % (mesh_name, name)] = dict(verts=int(len(idx)), bytes=int(idx.nbytes + vals.nbytes))
        m['weights'] = [0.0] * len(names)
        m.setdefault('extras', {})['targetNames'] = names
    while len(BIN) % 4:
        BIN.append(0)
    J['buffers'][0]['byteLength'] = len(BIN)
    size = RG.glb_save(dst, J, bytes(BIN))
    info['size'] = size
    return info
