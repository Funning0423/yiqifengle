"""Lakeside seam skirt (场景设计部, b16): the skycity -> lakeside balloon leg (route BG2, ~21.7 s) had a below-horizon ray that
slipped between three meshes and showed the clear colour ~108 m out: it crosses y 0 just past the LK_lake plane's +x edge
(x 50), passes UNDER the lake-facing edge of LK_far_shore (z ~-50.5, y -0.03; nothing below it there because LK_terrain is
sunk to -2.5 and culled under the far-shore strip) and leaves under the LK_far_hills / terrain-shelf edges.

Fix: LK_far_shore's open edges on the lake side (z > -53) beyond the lake plane (|x| > 50) and its two ends (|x| >= 65) hang a skirt straight down to
y = SKIRT_Y (below the terrain floor -2.5), same UV / vertex colour / normal as the edge it hangs from, so it shades like the
shore it continues. far_shore is double-sided. No new mesh, material or draw call.

LK_lake's open edges where LK_terrain under the edge is sunk below -0.5 m anywhere along the edge (or culled) get the same skirt (a low lens near
the north-east corner could see under the water edge the same way).

    python3 lakeside_seam_skirt.py <src models dir> <dst models dir>

Idempotent: mesh.extras.qfSeamSkirt records the original vertex / index counts; running on its own output rebuilds."""
import json, struct, sys, os
import numpy as np
SKIRT_Y = -2.8

def read_tris(path):
    b = open(path, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bin_ = b[28 + jl:]
    pr = j['meshes'][0]['primitives'][0]
    def acc(i, dt, c):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        return np.frombuffer(bin_, dt, a['count'] * c, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, c)
    P = acc(pr['attributes']['POSITION'], np.float32, 3).astype(np.float64); I = acc(pr['indices'], np.uint16, 1).reshape(-1, 3)
    return P[I]
def top_y(T, x, z):
    a, b, c = T[:, 0], T[:, 1], T[:, 2]
    d = (b[:, 2] - c[:, 2]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 2] - c[:, 2]); ok = np.abs(d) > 1e-12; d = np.where(ok, d, 1)
    w1 = ((b[:, 2] - c[:, 2]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (z - c[:, 2])) / d; w2 = ((c[:, 2] - a[:, 2]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (z - c[:, 2])) / d
    w3 = 1 - w1 - w2; m = ok & (w1 >= -1e-9) & (w2 >= -1e-9) & (w3 >= -1e-9)
    return float((w1 * a[:, 1] + w2 * b[:, 1] + w3 * c[:, 1])[m].max()) if m.any() else None

def skirt(src, dst, want):
    b = open(src, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
    bin_ = b[28 + jl:28 + jl + struct.unpack('<I', b[20 + jl:24 + jl])[0]]
    prim = j['meshes'][0]['primitives'][0]; at = prim['attributes']
    def acc(i, dt, c):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        return np.frombuffer(bin_, dt, a['count'] * c, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, c).copy()
    P, N, T, C = acc(at['POSITION'], np.float32, 3), acc(at['NORMAL'], np.float32, 3), acc(at['TEXCOORD_0'], np.float32, 2), acc(at['COLOR_0'], np.uint8, 4)
    I = acc(prim['indices'], np.uint16, 1).reshape(-1).astype(np.int64)
    ex = j['meshes'][0].get('extras', {}).get('qfSeamSkirt')
    if ex: P, N, T, C, I = P[:ex['baseVerts']], N[:ex['baseVerts']], T[:ex['baseVerts']], C[:ex['baseVerts']], I[:ex['baseIndices']]
    nv0, ni0 = len(P), len(I)
    key = lambda v: tuple(np.round(P[v], 3))
    cnt = {}
    for t in I.reshape(-1, 3):
        for e in range(3):
            a, c = t[e], t[(e + 1) % 3]; k = tuple(sorted([key(a), key(c)])); cnt.setdefault(k, []).append((a, c))
    NP, NN, NT, NC, NI = [], [], [], [], []; drop = {}
    for k, uses in cnt.items():
        if len(uses) != 1: continue
        a, c = uses[0]; pa, pc = P[a], P[c]
        if not want(pa, pc): continue
        bot = []
        for v in (a, c):   # the top of the skirt reuses the edge's own vertex; one new vertex per edge end at SKIRT_Y (shared)
            if v not in drop:
                p = P[v].copy(); p[1] = SKIRT_Y; drop[v] = nv0 + len(NP); NP.append(p); NN.append(N[v]); NT.append(T[v]); NC.append(C[v])
            bot.append(drop[v])
        NI += [a, bot[0], bot[1], a, bot[1], c]
    PA = np.concatenate([P, np.array(NP, np.float32)]); NA = np.concatenate([N, np.array(NN, np.float32)])
    TA = np.concatenate([T, np.array(NT, np.float32)]); CA = np.concatenate([C, np.array(NC, np.uint8)])
    IA = np.concatenate([I, np.array(NI, np.int64)]); assert len(PA) <= 65535; IA = IA.astype(np.uint16)
    data = {at['POSITION']: PA, at['NORMAL']: NA, at['TEXCOORD_0']: TA, at['COLOR_0']: CA, prim['indices']: IA}
    bvof = {j['accessors'][ai]['bufferView']: arr for ai, arr in data.items()}
    out = b''; views = []
    for kk in range(len(j['bufferViews'])):
        if kk in bvof: bl = bvof[kk].tobytes()
        else: v0 = j['bufferViews'][kk]; bl = bin_[v0.get('byteOffset', 0):v0.get('byteOffset', 0) + v0['byteLength']]
        out += b'\0' * ((4 - len(out) % 4) % 4)
        v = dict(j['bufferViews'][kk]); v['byteOffset'] = len(out); v['byteLength'] = len(bl); views.append(v); out += bl
    j['bufferViews'] = views; j['buffers'][0]['byteLength'] = len(out)
    for ai, arr in data.items(): j['accessors'][ai]['count'] = len(arr)
    j['accessors'][at['POSITION']]['min'] = PA.min(0).astype(float).tolist(); j['accessors'][at['POSITION']]['max'] = PA.max(0).astype(float).tolist()
    j['meshes'][0].setdefault('extras', {})['qfSeamSkirt'] = {'baseVerts': nv0, 'baseIndices': ni0, 'skirtY': SKIRT_Y}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); out += b'\0' * ((4 - len(out) % 4) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + out
    open(dst, 'wb').write(glb)
    return ({'file': os.path.basename(dst), 'baseTris': ni0 // 3, 'skirtTris': len(NI) // 3, 'totalTris': len(IA) // 3, 'verts': len(PA), 'bytes': len(glb), 'srcBytes': len(b)})

def main(src_dir, dst_dir):
    terrain = read_tris(os.path.join(src_dir, 'LK_terrain.glb'))
    # LK_lake_i sits at (0, 0, -8) (terrain / far shore at the origin, no rotation / scale): sample the terrain in lake-local + that
    tr = json.load(open(os.path.join(os.path.dirname(os.path.abspath(src_dir)), 'scene_r5h_slim_transforms.json')))
    li = next(i for i in tr['instances'] if i.get('name') == 'LK_lake_i')
    assert li['rot_quat_xyzw'] == [0, 0, 0, 1] and li['scale'] == [1, 1, 1]
    off = np.array(li['pos'], np.float64)
    def shore(pa, pc):  # lake-facing edge beyond the lake plane (inside |x| < 50 the water lies under it), and the two ends
        return (min(pa[2], pc[2]) > -53.0 and max(abs(pa[0]), abs(pc[0])) > 49.9) or (abs(pa[0]) >= 65.0 and abs(pc[0]) >= 65.0)
    def lake(pa, pc):   # water edge with the terrain anywhere along it sunk (or culled) more than 0.5 m below it: a low ray can pass under the water
        ys = [top_y(terrain, *(off + pa + (pc - pa) * t)[[0, 2]]) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
        return any(y is None or y < -0.5 for y in ys)
    out = [skirt(os.path.join(src_dir, 'LK_far_shore.glb'), os.path.join(dst_dir, 'LK_far_shore.glb'), shore),
           skirt(os.path.join(src_dir, 'LK_lake.glb'), os.path.join(dst_dir, 'LK_lake.glb'), lake)]
    print(json.dumps(out))

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
