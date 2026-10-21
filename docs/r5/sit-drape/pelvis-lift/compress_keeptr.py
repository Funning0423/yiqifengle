"""Append compacted locomotion clips to the committed character GLB (existing clips/meshes byte-identical).
usage: compress.py BASE.glb DENSE.glb OUT.glb ROT_TOL_DEG TRANS_TOL_MM clip1 clip2 ...
- scale channels and constant-at-rest translations (every bone except root/hips) dropped: in every clip of this GLB
  they equal the node rest values (<= 0.03 mm / 1.4e-5), so the bone keeps rest either way (baked or realtime mode)
- root translation kept as a 2-key constant, hips translation + all 28 rotations kept
- per channel: coarsest uniform key step k (1,2,3,4,5,6,8,10) whose slerp AND nlerp reconstruction stays within tolerance at
  every original frame (and mid-frames); constant channels -> 2 keys; inputs shared per (clip, k); identical outputs shared
- one bufferView for all new animation data, no min/max on outputs (only inputs, as the spec requires)"""
import sys, json, hashlib, numpy as np
from glb_io import *
BASE, DENSE, OUT = sys.argv[1:4]; RT = float(sys.argv[4]); TT = float(sys.argv[5]) / 1000; CLIPS = sys.argv[6:]
import os; LEGT = float(os.environ.get('LEGTOL', RT)); LEGB = ('root', 'hips', 'thigh', 'shin', 'foot', 'toe')
J0, B0 = load(BASE); JD, BD = load(DENSE)
STEPS = [10, 8, 6, 5, 4, 3, 2, 1]
def qnorm(q): return q / np.linalg.norm(q, axis=-1, keepdims=True)
def slerp(a, b, u):
    d = np.sum(a * b, -1, keepdims=True); b = np.where(d < 0, -b, b); d = np.abs(d)
    th = np.arccos(np.clip(d, -1, 1)); s = np.sin(th)
    w0 = np.where(s > 1e-9, np.sin((1 - u) * th) / np.maximum(s, 1e-12), 1 - u); w1 = np.where(s > 1e-9, np.sin(u * th) / np.maximum(s, 1e-12), u)
    return qnorm(w0 * a + w1 * b)
def nlerp(a, b, u):
    d = np.sum(a * b, -1, keepdims=True); return qnorm((1 - u) * a + u * np.where(d < 0, -b, b))
def qang(a, b): return np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(qnorm(a) * qnorm(b), -1)), 0, 1)))
def grid(n, k): g = list(range(0, n, k)); g.append(n - 1) if g[-1] != n - 1 else None; return np.array(g)
def recon(t, v, gi, tq, rot):
    tg = t[gi]; j = np.clip(np.searchsorted(tg, tq, 'right') - 1, 0, len(gi) - 2); u = ((tq - tg[j]) / (tg[j + 1] - tg[j]))[:, None]
    a, b = v[gi][j], v[gi][j + 1]
    if rot: return slerp(a, b, u), nlerp(a, b, u)
    r = a + (b - a) * u; return r, r
def dense_eval(t, v, tq, rot):   # reference = original per-frame keys, same interpolation
    j = np.clip(np.searchsorted(t, tq, 'right') - 1, 0, len(t) - 2); u = ((tq - t[j]) / (t[j + 1] - t[j]))[:, None]
    a, b = v[j], v[j + 1]
    return (slerp(a, b, u), nlerp(a, b, u)) if rot else (a + (b - a) * u,) * 2
blob = bytearray(); newacc = []; cache = {}; KEYS = dict(rot=0, tr=0, t=0)
bv_index = len(J0['bufferViews']); base_bin = len(B0); pad = (4 - base_bin % 4) % 4
def add_acc(arr, typ, with_minmax=False):
    arr = np.ascontiguousarray(arr, dtype=np.float32); key = (typ, hashlib.sha1(arr.tobytes()).hexdigest())
    if key in cache: return cache[key]
    off = len(blob); blob.extend(arr.tobytes())
    a = dict(bufferView=bv_index, byteOffset=off, componentType=5126, count=int(arr.shape[0]), type=typ)
    if with_minmax: a['min'] = [float(str(x)) for x in arr.min(0)]; a['max'] = [float(str(x)) for x in arr.max(0)]   # shortest float32 repr
    J0['accessors'].append(a); i = len(J0['accessors']) - 1; cache[key] = i; return i
report = {}
for name in CLIPS:
    an = [a for a in JD['animations'] if a['name'] == name][0]; samplers = []; channels = []; ks = {}; err = 0.0
    for ch in an['channels']:
        sm = an['samplers'][ch['sampler']]; t = acc(JD, BD, sm['input'])[:, 0]; v = acc(JD, BD, sm['output'])
        nd = ch['target']['node']; nn = JD['nodes'][nd]['name']; p = ch['target']['path']
        if p == 'scale': continue
        if p == 'translation' and nn not in ('root', 'hips') and np.abs(v - np.array(JD['nodes'][nd].get('translation', [0, 0, 0]))).max() < 3e-5: continue
        rot = p == 'rotation'; n = len(t)
        if rot: v = qnorm(v)
        spread = qang(v, v[:1]).max() if rot else np.abs(v - v[:1]).max()
        if spread < (1e-4 if rot else 1e-7) or n < 3:
            gi = np.array([0, n - 1]); vv = np.repeat(v[:1], 2, 0); k = 'const'
        else:
            tq = np.linspace(t[0], t[-1], (n - 1) * 4 + 1); ref = dense_eval(t, v, tq, rot)
            # greedy key insertion: start from the end keys, add the original key nearest the worst error until within tolerance
            sel = {0, n - 1}; tolx = (LEGT if nn.split('.')[0] in LEGB else RT) if rot else TT
            while True:
                gi = np.array(sorted(sel)); r = recon(t, v, gi, tq, rot)
                e = np.maximum(qang(r[0], ref[0]), qang(r[1], ref[1])) if rot else np.abs(r[0] - ref[0]).max(-1)
                if e.max() <= tolx or len(gi) == n: break
                q = int(np.argmax(e)); free = np.array([x for x in range(n) if x not in sel])
                sel.add(int(free[np.argmin(np.abs(t[free] - tq[q]))]))      # unselected original key nearest the worst error
            err = max(err, float(e.max())); k = 'n%d' % (len(gi) * 10 // n)
            vv = v[gi]
        ks[k] = ks.get(k, 0) + 1
        KEYS['rot' if rot else 'tr'] += len(gi)
        ii = add_acc(t[gi].reshape(-1, 1), 'SCALAR', True); oi = add_acc(vv, 'VEC4' if rot else 'VEC3')
        samplers.append(dict(input=ii, output=oi)); channels.append(dict(sampler=len(samplers) - 1, target=dict(node=nd, path=p)))
    J0['animations'].append(dict(name=name, channels=channels, samplers=samplers))
    report[name] = dict(channels=len(channels), steps=ks, max_err=round(err, 4))
J0['bufferViews'].append(dict(buffer=0, byteOffset=base_bin + pad, byteLength=len(blob)))
BIN = B0 + b'\0' * pad + bytes(blob)
if 'extras' in J0.get('asset', {}): pass
J0['asset'].setdefault('extras', {})
J0['asset']['extras']['locomotion_v1'] = 'compact append (角色动画bot): rot tol %.3f deg, hips tol %.2f mm' % (RT, TT * 1000)
sz = save(OUT, J0, BIN)
print(json.dumps(dict(keys=KEYS, size=sz, added=sz - len(open(BASE, 'rb').read()), anim_bytes=len(blob), clips=report)))
