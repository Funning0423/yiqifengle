# Asset tool (场景特效bot r5 S3 fix_r1, not shipped): settle the LK_seal_rock_* instances (lakeside_under_seal.cjs) on the
# LK_terrain slope: tilt each rock to the local terrain normal (keeps its yaw), then lower it until no bottom vertex floats
# (max gap <= -0.02 m). Only untilted (new) rocks are touched, so it can run after every lakeside_under_seal.cjs pass. Writes scene_r5h_slim_transforms.json in place and prints the per-rock gap / top height.
#   python3 lakeside_seal_settle.py [--dry]
import json, struct, sys, os, math
import numpy as np
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../creator-build-project/assets/bundles/region_lakeside/')
TF = B + 'scene_r5h_slim_transforms.json'
def glb(f):
    b = open(f, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); bn = b[28 + n:]; out = []
    def acc(i):
        a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]; o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        dt = {5126: 'f4', 5123: 'u2', 5125: 'u4', 5121: 'u1'}[a['componentType']]; k = {'SCALAR': 1, 'VEC3': 3, 'VEC2': 2, 'VEC4': 4}[a['type']]
        r = np.frombuffer(bn, dtype=dt, count=a['count'] * k, offset=o); return r.reshape(a['count'], k) if k > 1 else r
    for m in j['meshes']:
        for p in m['primitives']:
            P = acc(p['attributes']['POSITION']).astype(float); I = acc(p['indices']).astype(int).reshape(-1, 3); out.append(P[I])
    return np.concatenate(out)
def rot(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]
T = json.load(open(TF)); ter = glb(B + 'models/LK_terrain.glb'); rock = glb(B + 'models/LK_rock.glb').reshape(-1, 3)
W = np.concatenate([ter @ (rot(i['rot_quat_xyzw']) * np.array(i['scale'])).T + np.array(i['pos']) for i in T['instances'] if i['glb'] == 'LK_terrain.glb'])
a, b, c = W[:, 0], W[:, 1], W[:, 2]; den = (b[:, 2] - c[:, 2]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 2] - c[:, 2]); okd = np.abs(den) > 1e-12; den = np.where(okd, den, 1)
def height(x, z):
    l1 = ((b[:, 2] - c[:, 2]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (z - c[:, 2])) / den; l2 = ((c[:, 2] - a[:, 2]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (z - c[:, 2])) / den; l3 = 1 - l1 - l2
    m = okd & (l1 >= -1e-9) & (l2 >= -1e-9) & (l3 >= -1e-9)
    return None if not m.any() else float((l1 * a[:, 1] + l2 * b[:, 1] + l3 * c[:, 1])[m].max())
for i in T['instances']:
    if not i['name'].startswith('LK_seal_rock_'): continue
    if abs(i['rot_quat_xyzw'][0]) + abs(i['rot_quat_xyzw'][2]) > 1e-6: continue  # already settled (tilted)
    x, _, z = i['pos']; e = 0.8; h0 = height(x, z)
    hx = (height(x + e, z) - height(x - e, z)) / (2 * e); hz = (height(x, z + e) - height(x, z - e)) / (2 * e)
    n = np.array([-hx, 1, -hz]); n /= np.linalg.norm(n); ax = np.cross([0, 1, 0], n); s = np.linalg.norm(ax); ang = math.asin(min(1, s))
    yawq = i['rot_quat_xyzw']
    yq = [0, yawq[1], 0, yawq[3]]; l = math.hypot(yq[1], yq[3]); yq = [0, yq[1] / l, 0, yq[3] / l]
    tq = [0, 0, 0, 1] if s < 1e-9 else list(np.append(ax / s * math.sin(ang / 2), math.cos(ang / 2)))
    q = qmul(tq, yq); i['rot_quat_xyzw'] = [round(v, 5) for v in q]
    R = rot(i['rot_quat_xyzw']) * np.array(i['scale']); i['pos'] = [x, h0, z]
    V = rock @ R.T + np.array(i['pos']); low = V[V[:, 1] < V[:, 1].min() + 0.25]
    gap = max(v[1] - (height(v[0], v[2]) if height(v[0], v[2]) is not None else -9) for v in low)
    i['pos'] = [round(x, 4), round(h0 - gap - 0.02, 4), round(z, 4)]
    V = rock @ R.T + np.array(i['pos']); top = V[:, 1].max() - h0
    print(i['name'], 'tilt %.1f deg' % math.degrees(ang), 'sink %.2f' % (gap + 0.02), 'top %.2f m' % top)
if '--dry' not in sys.argv: open(TF, 'w').write(json.dumps(T))
