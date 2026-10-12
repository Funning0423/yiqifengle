# Minimal in-place GLB editor for the seated drape (python3):
#  - replace_channels(): new rotation curves for some joints in some clips (other channels and clips are untouched, byte for byte)
#  - set_morph(): morph targets on a mesh's primitive(s) as SPARSE float32 POSITION accessors (core glTF 2.0; only the moved
#    vertices are stored: uint16/uint32 index + VEC3 delta), mesh.weights all 0, mesh.extras.targetNames
#  - save(): drops accessors / bufferViews nobody references any more and repacks the BIN (images, meshes, skin kept as is)
import hashlib
import numpy as np
import sddata as D
RG = D.RG


class Glb:
    def __init__(self, path):
        self.J, B = RG.glb_load(path)
        self.B = bytes(B)
        self.blob = bytearray()          # new data, appended as one bufferView at save time
        self.new_acc = []                # indices of accessors pointing into self.blob (bufferView = -1 placeholder)
        self._cache = {}

    def _add(self, arr, ctype, typ, minmax=False):
        dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[ctype]
        arr = np.ascontiguousarray(arr, dtype=dt)
        key = (ctype, typ, hashlib.sha1(arr.tobytes()).hexdigest(), minmax)
        if key in self._cache:
            return self._cache[key]
        while len(self.blob) % 4:
            self.blob.append(0)
        n = 1 if arr.ndim == 1 else arr.shape[1]
        a = dict(bufferView=-1, byteOffset=len(self.blob), componentType=ctype, count=int(arr.shape[0]), type=typ)
        if minmax:
            a['min'] = [float(x) for x in np.atleast_2d(arr.reshape(len(arr), -1)).min(0)]
            a['max'] = [float(x) for x in np.atleast_2d(arr.reshape(len(arr), -1)).max(0)]
        self.blob.extend(arr.tobytes())
        self.J['accessors'].append(a)
        i = len(self.J['accessors']) - 1
        self.new_acc.append(i)
        self._cache[key] = i
        return i

    def node_index(self, name):
        return [i for i, n in enumerate(self.J['nodes']) if n.get('name') == name][0]

    def replace_channels(self, clip, curves, path='rotation'):
        """curves: joint name -> (times [k], values [k,4] quats | [k,3] translations) LINEAR curve; replaces (or adds)
        that joint's channel for `path`."""
        an = [a for a in self.J['animations'] if a['name'] == clip][0]
        for nm, (t, q) in curves.items():
            node = self.node_index(nm)
            ch = [c for c in an['channels'] if c['target']['node'] == node and c['target']['path'] == path]
            ii = self._add(np.asarray(t, float).reshape(-1, 1), 5126, 'SCALAR', True)
            if path == 'rotation':
                oi = self._add(RG.qnorm(np.asarray(q, float)), 5126, 'VEC4')
            else:
                oi = self._add(np.asarray(q, float), 5126, 'VEC3')
            an['samplers'].append(dict(input=ii, output=oi, interpolation='LINEAR'))
            si = len(an['samplers']) - 1
            if ch:
                ch[0]['sampler'] = si
            else:
                an['channels'].append(dict(sampler=si, target=dict(node=node, path=path)))
        # drop samplers no channel uses any more
        used = sorted(set(c['sampler'] for c in an['channels']))
        remap = {o: n for n, o in enumerate(used)}
        an['samplers'] = [an['samplers'][o] for o in used]
        for c in an['channels']:
            c['sampler'] = remap[c['sampler']]

    def replace_translation(self, clip, curves):
        self.replace_channels(clip, curves, 'translation')

    def set_morph(self, mesh_name, targets, eps=0.0):
        """targets: list of (name, delta [V,3] in bind space over the mesh's concatenated primitive vertices)."""
        mi = [i for i, m in enumerate(self.J['meshes']) if m['name'] == mesh_name][0]
        m = self.J['meshes'][mi]
        off = 0
        report = []
        for pr in m['primitives']:
            n = self.J['accessors'][pr['attributes']['POSITION']]['count']
            pr['targets'] = []
            for name, d in targets:
                dd = np.asarray(d[off:off + n], float)
                nz = np.where(np.linalg.norm(dd, axis=1) > eps)[0]
                if len(nz) == 0:
                    nz = np.array([0])
                vals = dd[nz]
                ict = 5123 if n < 65536 else 5125
                ia = self._add(nz.astype(np.uint16 if ict == 5123 else np.uint32), ict, 'SCALAR')
                va = self._add(vals.astype(np.float32), 5126, 'VEC3')
                acc = dict(componentType=5126, count=n, type='VEC3',
                           min=[float(x) for x in np.minimum(vals.min(0), 0)], max=[float(x) for x in np.maximum(vals.max(0), 0)],
                           sparse=dict(count=int(len(nz)), indices=dict(bufferView=-1, byteOffset=self.J['accessors'][ia]['byteOffset'], componentType=ict),
                                       values=dict(bufferView=-1, byteOffset=self.J['accessors'][va]['byteOffset'])))
                self.J['accessors'].append(acc)
                ai = len(self.J['accessors']) - 1
                self.new_acc.append(ai)
                pr['targets'].append(dict(POSITION=ai))
                report.append(dict(target=name, count=int(len(nz)),
                                   bytes=int(len(nz) * (2 if ict == 5123 else 4) + len(nz) * 12)))
            off += n
        m['weights'] = [0.0] * len(targets)
        m.setdefault('extras', {})['targetNames'] = [t[0] for t in targets]
        return report

    def save(self, path):
        J = self.J
        # placeholder accessors used only as sparse storage are removed after their offsets were copied into the sparse block
        users = {}

        def mark(a):
            users[a] = users.get(a, 0) + 1
        for an in J['animations']:
            for s in an['samplers']:
                mark(s['input'])
                mark(s['output'])
        for m in J['meshes']:
            for p in m['primitives']:
                for v in p['attributes'].values():
                    mark(v)
                if 'indices' in p:
                    mark(p['indices'])
                for tg in p.get('targets', []):
                    for v in tg.values():
                        mark(v)
        for s in J.get('skins', []):
            if 'inverseBindMatrices' in s:
                mark(s['inverseBindMatrices'])
        keep = [i for i in range(len(J['accessors'])) if i in users]
        newB = bytearray()
        bvmap = {}
        newbvs = []
        old_bvs = set()
        for i in keep:
            a = J['accessors'][i]
            if a.get('bufferView', None) not in (None, -1):
                old_bvs.add(a['bufferView'])
            sp = a.get('sparse')
            if sp:
                for k in ('indices', 'values'):
                    if sp[k]['bufferView'] != -1:
                        old_bvs.add(sp[k]['bufferView'])
        for img in J.get('images', []):
            if 'bufferView' in img:
                old_bvs.add(img['bufferView'])
        for bi in sorted(old_bvs):
            bv = dict(J['bufferViews'][bi])
            o = bv.get('byteOffset', 0)
            data = self.B[o:o + bv['byteLength']]
            while len(newB) % 4:
                newB.append(0)
            bv['byteOffset'] = len(newB)
            newB.extend(data)
            bvmap[bi] = len(newbvs)
            newbvs.append(bv)
        # the new blob: one plain bufferView (animation accessors and sparse blocks share it; no byteStride)
        while len(newB) % 4:
            newB.append(0)
        blob_bv = len(newbvs)
        newbvs.append(dict(buffer=0, byteOffset=len(newB), byteLength=len(self.blob)))
        newB.extend(self.blob)
        accmap = {}
        newacc = []
        for i in keep:
            a = dict(J['accessors'][i])
            if 'bufferView' in a:
                a['bufferView'] = blob_bv if a['bufferView'] == -1 else bvmap[a['bufferView']]
            if 'sparse' in a:
                sp = {k: (dict(v) if isinstance(v, dict) else v) for k, v in a['sparse'].items()}
                for k in ('indices', 'values'):
                    sp[k]['bufferView'] = blob_bv if sp[k]['bufferView'] == -1 else bvmap[sp[k]['bufferView']]
                a['sparse'] = sp
            accmap[i] = len(newacc)
            newacc.append(a)
        for img in J.get('images', []):
            if 'bufferView' in img:
                img['bufferView'] = bvmap[img['bufferView']]
        for m in J['meshes']:
            for p in m['primitives']:
                p['attributes'] = {k: accmap[v] for k, v in p['attributes'].items()}
                if 'indices' in p:
                    p['indices'] = accmap[p['indices']]
                for tg in p.get('targets', []):
                    for k in list(tg):
                        tg[k] = accmap[tg[k]]
        for s in J.get('skins', []):
            if 'inverseBindMatrices' in s:
                s['inverseBindMatrices'] = accmap[s['inverseBindMatrices']]
        for an in J['animations']:
            for s in an['samplers']:
                s['input'] = accmap[s['input']]
                s['output'] = accmap[s['output']]
        J['accessors'] = newacc
        J['bufferViews'] = newbvs
        return RG.glb_save(path, J, bytes(newB))


def sparse_bytes(J, acc_index):
    a = J['accessors'][acc_index]
    sp = a['sparse']
    isz = 2 if sp['indices']['componentType'] == 5123 else 4
    return sp['count'] * (isz + 12)
