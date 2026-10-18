import sys, json, numpy as np
sys.path.insert(0, '/workspace/yiqifengle/previews/角色动画bot/compress'); from glb_io import *
SRC, BAKE, OUT = sys.argv[1:4]
J, BIN = load(SRC); BIN = bytearray(BIN); bk = json.load(open(BAKE))
def bl2gl(a): a = np.asarray(a); return np.stack([a[:, 0], a[:, 2], -a[:, 1]], 1)
def add_acc(arr):
    global BIN
    while len(BIN) % 4: BIN.append(0)
    off = len(BIN); b = arr.astype('<f4').tobytes(); BIN += b
    J['bufferViews'].append(dict(buffer=0, byteOffset=off, byteLength=len(b))); bv = len(J['bufferViews']) - 1
    J['accessors'].append(dict(bufferView=bv, componentType=5126, count=len(arr), type='VEC3', min=arr.min(0).tolist(), max=arr.max(0).tolist())); return len(J['accessors']) - 1
def racc(i):
    a = J['accessors'][i]
    if 'sparse' not in a: return acc(J, bytes(BIN), i).reshape(-1, 3)
    out = np.zeros((a['count'], 3)) if 'bufferView' not in a else acc(J, bytes(BIN), i).reshape(-1, 3)
    sp = a['sparse']; c = sp['count']
    def raw(d, ct, nc):
        bv = J['bufferViews'][d['bufferView']]; off = bv.get('byteOffset', 0) + d.get('byteOffset', 0)
        return np.frombuffer(bytes(BIN), CT[ct], count=c * nc, offset=off)
    idx = raw(sp['indices'], sp['indices']['componentType'], 1); val = raw(sp['values'], a['componentType'], 3).reshape(-1, 3)
    out[idx] = val; return out
rep = {}
for name, d in bk.items():
    m = [x for x in J['meshes'] if x['name'] == name][0]; p = m['primitives'][0]
    pos = acc(J, bytes(BIN), p['attributes']['POSITION']).reshape(-1, 3)
    basis = bl2gl(d['basis']); err = np.abs(pos - basis).max()
    delta = bl2gl(d['key']) - basis
    names = (m.get('extras') or {}).get('targetNames')
    if names and 'sit_drape' in names:
        ti = names.index('sit_drape'); old = racc(p['targets'][ti]['POSITION'])
        p['targets'][ti]['POSITION'] = add_acc(delta)
    else:
        old = np.zeros_like(delta); p.setdefault('targets', []).append({'POSITION': add_acc(delta)})
        m.setdefault('extras', {}).setdefault('targetNames', []).append('sit_drape'); m.setdefault('weights', []).append(0)
    ch = np.linalg.norm(delta - old, axis=1)
    rep[name] = dict(basis_match_err=float(err), verts_changed=int((ch > 1e-5).sum()), max_change_mm=round(float(ch.max()) * 1000, 1))
J['buffers'][0]['byteLength'] = len(BIN)
save(OUT, J, bytes(BIN)); print(json.dumps(rep))
