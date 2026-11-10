import json, struct, numpy as np
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
class GLB:
    def __init__(self, path):
        b = open(path, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]
        self.j = json.loads(b[20:20 + jl]); o = 20 + jl; bl = struct.unpack('<I', b[o:o + 4])[0]; self.bin = b[o + 8:o + 8 + bl]
        self.meshes = {}
        for m in self.j['meshes']:
            p = m['primitives'][0]; d = {k: self.acc(v) for k, v in p['attributes'].items()}; d['indices'] = self.acc(p['indices']).astype(np.uint32)
            self.meshes[m['name']] = d
    def acc(self, i):
        a = self.j['accessors'][i]; bv = self.j['bufferViews'][a['bufferView']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); n = a['count'] * NC[a['type']]
        arr = np.frombuffer(self.bin, CT[a['componentType']], n, off).copy()
        return arr.reshape(a['count'], NC[a['type']]) if NC[a['type']] > 1 else arr
    def names(self): return [m['name'] for m in self.j['meshes']]
    def save(self, path):
        j = self.j; bvs = []; accs = []; blob = bytearray()
        def add(arr, target, ctype, typ, mm=False):
            while len(blob) % 4: blob.append(0)
            data = np.ascontiguousarray(arr.astype(CT[ctype])).tobytes(); bvs.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data), 'target': target}); blob.extend(data)
            a = {'bufferView': len(bvs) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
            if mm: a['min'] = [float(v) for v in arr.min(0)]; a['max'] = [float(v) for v in arr.max(0)]
            accs.append(a); return len(accs) - 1
        for m in j['meshes']:
            d = self.meshes[m['name']]; at = {}
            at['POSITION'] = add(d['POSITION'], 34962, 5126, 'VEC3', True)
            at['NORMAL'] = add(d['NORMAL'], 34962, 5126, 'VEC3')
            at['TEXCOORD_0'] = add(d['TEXCOORD_0'], 34962, 5126, 'VEC2')
            idx = d['indices']; it = 5123 if d['POSITION'].shape[0] < 65536 else 5125
            ii = add(idx, 34963, it, 'SCALAR')
            m['primitives'] = [{'attributes': at, 'indices': ii, 'mode': 4}]
        while len(blob) % 4: blob.append(0)
        j['accessors'] = accs; j['bufferViews'] = bvs; j['buffers'] = [{'byteLength': len(blob)}]
        js = json.dumps(j, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
        open(path, 'wb').write(out)
def flat_normals(pos, idx):
    """unweld: per-face normals (faceted low-poly look)"""
    tri = idx.reshape(-1, 3); P = pos[tri]; n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    return P.reshape(-1, 3), np.repeat(n, 3, 0), np.arange(len(tri) * 3, dtype=np.uint32)
def smooth_normals(pos, idx):
    tri = idx.reshape(-1, 3); P = pos[tri]; fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    n = np.zeros_like(pos); 
    for k in range(3): np.add.at(n, tri[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
