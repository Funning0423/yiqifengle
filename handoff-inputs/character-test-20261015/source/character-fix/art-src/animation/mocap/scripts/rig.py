# Target rig (character GLB) in numpy: rest TRS, hierarchy, FK, clip sampling, skinning data. glTF space (Y up, +Z = her forward).
import json, struct
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def glb_load(p):
    b = open(p, 'rb').read()
    assert b[:4] == b'glTF'
    jl = struct.unpack('<I', b[12:16])[0]
    J = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack('<I', b[o:o + 4])[0]
    return J, b[o + 8:o + 8 + bl]


def glb_save(p, J, BIN):
    BIN = BIN + b'\0' * ((4 - len(BIN) % 4) % 4)
    J['buffers'][0]['byteLength'] = len(BIN)
    js = json.dumps(J, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(BIN)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(BIN)) + b'BIN\0' + BIN
    open(p, 'wb').write(out)
    return len(out)


def acc(J, BIN, i):
    a = J['accessors'][i]
    bv = J['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    dt = CT[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    st = bv.get('byteStride', 0)
    isz = np.dtype(dt).itemsize * n
    if st and st != isz:
        raw = np.frombuffer(BIN, np.uint8, count=st * a['count'], offset=off).reshape(a['count'], st)[:, :isz].copy()
        arr = raw.view(dt).reshape(a['count'], n)
    else:
        arr = np.frombuffer(BIN, dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
    arr = np.array(arr, dtype=np.float64)
    if a.get('normalized'):
        arr = arr / {np.int8: 127, np.uint8: 255, np.int16: 32767, np.uint16: 65535}[dt]
    return arr


# ---------------- quaternion helpers (x, y, z, w like glTF) ----------------
def qmul(a, b):
    ax, ay, az, aw = np.moveaxis(np.asarray(a), -1, 0)
    bx, by, bz, bw = np.moveaxis(np.asarray(b), -1, 0)
    return np.stack([aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw,
                     aw * bw - ax * bx - ay * by - az * bz], -1)


def qconj(q):
    q = np.array(q, dtype=np.float64)
    q[..., :3] *= -1
    return q


def qnorm(q):
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def q2m(q):
    q = qnorm(np.asarray(q, dtype=np.float64))
    x, y, z, w = np.moveaxis(q, -1, 0)
    return np.stack([np.stack([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], -1),
                     np.stack([2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], -1),
                     np.stack([2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)], -1)], -2)


def m2q(M):
    M = np.asarray(M, dtype=np.float64)
    sh = M.shape[:-2]
    M = M.reshape(-1, 3, 3)
    m00, m11, m22 = M[:, 0, 0], M[:, 1, 1], M[:, 2, 2]
    tr = m00 + m11 + m22
    cand = np.stack([
        np.stack([M[:, 2, 1] - M[:, 1, 2], M[:, 0, 2] - M[:, 2, 0], M[:, 1, 0] - M[:, 0, 1], 1 + tr], -1),
        np.stack([1 + m00 - m11 - m22, M[:, 0, 1] + M[:, 1, 0], M[:, 0, 2] + M[:, 2, 0], M[:, 2, 1] - M[:, 1, 2]], -1),
        np.stack([M[:, 0, 1] + M[:, 1, 0], 1 + m11 - m00 - m22, M[:, 1, 2] + M[:, 2, 1], M[:, 0, 2] - M[:, 2, 0]], -1),
        np.stack([M[:, 0, 2] + M[:, 2, 0], M[:, 1, 2] + M[:, 2, 1], 1 + m22 - m00 - m11, M[:, 1, 0] - M[:, 0, 1]], -1)], 1)
    k = np.argmax(np.stack([tr, m00, m11, m22], -1), -1)
    out = cand[np.arange(len(M)), k]
    out = out / np.linalg.norm(out, axis=-1, keepdims=True)
    out = np.where(out[:, 3:4] < 0, -out, out)
    return out.reshape(sh + (4,))


def slerp(a, b, u):
    a = np.asarray(a, float)
    b = np.array(b, float)
    d = np.sum(a * b, -1, keepdims=True)
    b = np.where(d < 0, -b, b)
    d = np.abs(d)
    om = np.arccos(np.clip(d, -1, 1))
    so = np.sin(om)
    u = np.asarray(u, float)
    if np.ndim(u) < np.ndim(a):
        u = u[..., None] if np.ndim(u) else u
    small = so < 1e-6
    w0 = np.where(small, 1 - u, np.sin((1 - u) * om) / np.where(small, 1, so))
    w1 = np.where(small, u, np.sin(u * om) / np.where(small, 1, so))
    return qnorm(w0 * a + w1 * b)


def rotvec2m(v):
    v = np.asarray(v, float)
    th = np.linalg.norm(v, axis=-1, keepdims=True)
    k = v / np.maximum(th, 1e-12)
    K = np.zeros(v.shape[:-1] + (3, 3))
    K[..., 0, 1], K[..., 0, 2], K[..., 1, 0], K[..., 1, 2], K[..., 2, 0], K[..., 2, 1] = -k[..., 2], k[..., 1], k[..., 2], -k[..., 0], -k[..., 1], k[..., 0]
    th = th[..., None]
    return np.eye(3) + np.sin(th) * K + (1 - np.cos(th)) * (K @ K)


def m2rotvec(M):
    q = m2q(M)
    s = np.linalg.norm(q[..., :3], axis=-1, keepdims=True)
    ang = 2 * np.arctan2(s, q[..., 3:4])
    return q[..., :3] / np.maximum(s, 1e-12) * ang


def align(a, b):
    """minimal rotation matrix taking unit vector a to unit vector b (batched)."""
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    a = a / np.linalg.norm(a, axis=-1, keepdims=True)
    b = b / np.linalg.norm(b, axis=-1, keepdims=True)
    v = np.cross(a, b)
    c = np.sum(a * b, -1)
    s = np.linalg.norm(v, axis=-1)
    ang = np.arctan2(s, c)
    axis = v / np.maximum(s, 1e-12)[..., None]
    # anti-parallel fallback
    bad = s < 1e-9
    if np.any(bad & (c < 0)):
        perp = np.cross(a, [1, 0, 0])
        perp = np.where(np.linalg.norm(perp, axis=-1, keepdims=True) < 1e-6, np.cross(a, [0, 1, 0]), perp)
        axis = np.where((bad & (c < 0))[..., None], perp / np.linalg.norm(perp, axis=-1, keepdims=True), axis)
    return rotvec2m(axis * ang[..., None])


class Rig:
    def __init__(self, glb):
        self.path = glb
        J, BIN = glb_load(glb)
        self.J, self.BIN = J, BIN
        sk = J['skins'][0]
        self.joint_nodes = sk['joints']
        self.names = [J['nodes'][j]['name'] for j in self.joint_nodes]
        self.idx = {n: i for i, n in enumerate(self.names)}
        par = {}
        for ni, n in enumerate(J['nodes']):
            for c in n.get('children', []):
                par[c] = ni
        self.node_parent = par
        self.parent = [self.idx.get(J['nodes'][par[j]]['name']) if j in par and J['nodes'][par[j]].get('name') in self.idx else None for j in self.joint_nodes]
        # order parents first
        order = []
        seen = set()
        def visit(i):
            if i in seen:
                return
            if self.parent[i] is not None:
                visit(self.parent[i])
            seen.add(i)
            order.append(i)
        for i in range(len(self.names)):
            visit(i)
        self.order = order
        self.rest_t = np.array([J['nodes'][j].get('translation', [0, 0, 0]) for j in self.joint_nodes], float)
        self.rest_r = np.array([J['nodes'][j].get('rotation', [0, 0, 0, 1]) for j in self.joint_nodes], float)
        self.rest_s = np.array([J['nodes'][j].get('scale', [1, 1, 1]) for j in self.joint_nodes], float)
        # world transform of the armature root's parent chain (non-joint ancestors)
        M = np.eye(4)
        n = par.get(self.joint_nodes[self.idx['root']])
        chain = []
        while n is not None:
            chain.append(n)
            n = par.get(n)
        for ni in reversed(chain):
            M = M @ self.node_mat(J['nodes'][ni])
        self.base = M
        self.ibm = acc(J, BIN, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
        rw = self.fk(self.rest_t[None], self.rest_r[None], self.rest_s[None])
        self.rest_world = rw[0]
        self.clips = {a['name']: a for a in J['animations']}

    @staticmethod
    def node_mat(n):
        if 'matrix' in n:
            return np.array(n['matrix']).reshape(4, 4).T
        M = np.eye(4)
        M[:3, :3] = q2m(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1]))[None, :]
        M[:3, 3] = n.get('translation', [0, 0, 0])
        return M

    def fk(self, T, Rq, S=None):
        """T [n,J,3], Rq [n,J,4] local; returns world 4x4 [n,J,4,4] (including the base chain)."""
        n = T.shape[0]
        if S is None:
            S = np.broadcast_to(self.rest_s, (n,) + self.rest_s.shape)
        L = np.zeros((n, len(self.names), 4, 4))
        L[..., :3, :3] = q2m(Rq) * S[..., None, :]
        L[..., :3, 3] = T
        L[..., 3, 3] = 1
        W = np.zeros_like(L)
        for i in self.order:
            p = self.parent[i]
            W[:, i] = (self.base[None] if p is None else W[:, p]) @ L[:, i]
        return W

    def sample_clip(self, name, times):
        """returns local T, R, S arrays [n,J,*] (rest where no channel), glTF LINEAR interpolation."""
        a = self.clips[name]
        times = np.asarray(times, float)
        n = len(times)
        T = np.repeat(self.rest_t[None], n, 0).copy()
        R = np.repeat(self.rest_r[None], n, 0).copy()
        S = np.repeat(self.rest_s[None], n, 0).copy()
        for ch in a['channels']:
            node = ch['target']['node']
            nm = self.J['nodes'][node].get('name')
            if nm not in self.idx:
                continue
            j = self.idx[nm]
            smp = a['samplers'][ch['sampler']]
            ti = acc(self.J, self.BIN, smp['input'])[:, 0]
            vo = acc(self.J, self.BIN, smp['output'])
            path = ch['target']['path']
            k = np.clip(np.searchsorted(ti, times, side='right') - 1, 0, len(ti) - 1)
            k1 = np.clip(k + 1, 0, len(ti) - 1)
            dt = np.where(k1 > k, ti[k1] - ti[k], 1)
            u = np.clip((times - ti[k]) / dt, 0, 1)
            if path == 'rotation':
                R[:, j] = slerp(vo[k], vo[k1], u[:, None])
            elif path == 'translation':
                T[:, j] = vo[k] + (vo[k1] - vo[k]) * u[:, None]
            elif path == 'scale':
                S[:, j] = vo[k] + (vo[k1] - vo[k]) * u[:, None]
        return T, R, S

    def clip_duration(self, name):
        a = self.clips[name]
        return max(self.J['accessors'][s['input']]['max'][0] for s in a['samplers'])

    def pos(self, W, name):
        return W[..., self.idx[name], :3, 3]

    # ---------------- skinning ----------------
    def mesh_data(self, mesh_name):
        J, BIN = self.J, self.BIN
        mi = [i for i, m in enumerate(J['meshes']) if m['name'] == mesh_name][0]
        P, Jn, Wt, F = [], [], [], []
        off = 0
        for pr in J['meshes'][mi]['primitives']:
            at = pr['attributes']
            p = acc(J, BIN, at['POSITION'])
            P.append(p)
            Jn.append(acc(J, BIN, at['JOINTS_0']).astype(int))
            Wt.append(acc(J, BIN, at['WEIGHTS_0']))
            F.append(acc(J, BIN, pr['indices']).astype(int).reshape(-1, 3) + off)
            off += len(p)
        P = np.concatenate(P)
        Jn = np.concatenate(Jn)
        Wt = np.concatenate(Wt)
        Wt = Wt / np.maximum(Wt.sum(1, keepdims=True), 1e-9)
        # mesh node world (skinned meshes ignore node transform in glTF; vertices are in bind space)
        return dict(P=P, J=Jn, W=Wt, F=np.concatenate(F))

    def skin(self, md, W):
        """W [J,4,4] world joint matrices -> skinned vertex positions [V,3]."""
        Sk = W @ self.ibm
        out = np.zeros_like(md['P'])
        for k in range(4):
            Mk = Sk[md['J'][:, k]]
            out += md['W'][:, k:k + 1] * (np.einsum('nij,nj->ni', Mk[:, :3, :3], md['P']) + Mk[:, :3, 3])
        return out
