# Replace / append animation clips in the character GLB from dense per-frame arrays, with key reduction.
# - existing clips with the same name are replaced IN PLACE (same animation index -> Cocos .meta gltfIndex stays valid)
# - accessors / bufferViews used only by replaced clips are dropped and the BIN is repacked (mesh/skin/image bytes unchanged)
# - per channel greedy key reduction: start from the end keys, insert the original frame with the worst error until the
#   slerp (rotation) / lerp (translation) reconstruction is within tolerance at every frame and half frame
# - rotations of all 28 joints are written; translation only for root/hips (other joints keep their rest translation);
#   scale channels are omitted (rest scale), exactly like locomotion-v1
# - inputs (key times) are shared between channels with identical key sets; identical outputs are shared too
import hashlib
import numpy as np
import rig as RG


def qang(a, b):
    return np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(RG.qnorm(a) * RG.qnorm(b), -1)), 0, 1)))


def recon(t, v, gi, tq, rot):
    tg = t[gi]
    j = np.clip(np.searchsorted(tg, tq, 'right') - 1, 0, len(gi) - 2)
    u = ((tq - tg[j]) / (tg[j + 1] - tg[j]))[:, None]
    a, b = v[gi][j], v[gi][j + 1]
    return RG.slerp(a, b, u) if rot else a + (b - a) * u


def reduce_keys(t, v, rot, tol, pin=()):
    """pin: frames always keyed (start of a still tail, so the reduction cannot blend across it)."""
    n = len(t)
    if n < 3:
        return np.arange(n)
    spread = qang(v, v[:1]).max() if rot else np.abs(v - v[:1]).max()
    if spread < (1e-3 if rot else 1e-6):
        return np.array([0, n - 1])
    tq = np.linspace(t[0], t[-1], (n - 1) * 2 + 1)
    ref = recon(t, v, np.arange(n), tq, rot)
    sel = {0, n - 1} | {int(p) for p in pin if 0 < p < n - 1}
    while True:
        gi = np.array(sorted(sel))
        r = recon(t, v, gi, tq, rot)
        e = qang(r, ref) if rot else np.abs(r - ref).max(-1)
        if e.max() <= tol or len(gi) == n:
            return gi
        fq = int(np.argmax(e)) / 2.0
        added = False
        for c in (int(round(fq)), int(np.floor(fq)), int(np.ceil(fq))):
            c = min(max(c, 0), n - 1)
            if c not in sel:
                sel.add(c)
                added = True
                break
        if not added:
            free = [x for x in range(n) if x not in sel]
            sel.add(min(free, key=lambda x: abs(x - fq)))


def tol_for(name, base_tol):
    """rotation tolerance (deg) per joint: legs/hips tighter (foot sliding, knee), cloth looser."""
    b = name.split('.')[0]
    if b in ('hips', 'thigh', 'shin', 'foot'):
        return base_tol['leg']
    if b.startswith('skirt'):
        return base_tol['skirt']
    if b in ('head', 'upper_arm', 'forearm', 'hand'):
        return base_tol.get('distal', base_tol['other'])
    return base_tol['other']


def write(base_glb, out_glb, clips, tol=None, extras_note=None):
    """clips: name -> dict(fps, Q [n,J,4] local quats (rig joint order), T [n,J,3] local translations).
    returns dict(size, anim_bytes, per-clip key counts)."""
    tol = tol or dict(leg=0.15, other=0.35, skirt=0.5, trans_m=0.0003)
    J, B = RG.glb_load(base_glb)
    rig = RG.Rig(base_glb)
    names = {a['name']: i for i, a in enumerate(J['animations'])}
    # --- accessor usage
    users = {}

    def mark(a, who):
        users.setdefault(a, set()).add(who)
    for an in J['animations']:
        for s in an['samplers']:
            mark(s['input'], 'anim:' + an['name'])
            mark(s['output'], 'anim:' + an['name'])
    for m in J['meshes']:
        for p in m['primitives']:
            for v in p['attributes'].values():
                mark(v, '#mesh')
            if 'indices' in p:
                mark(p['indices'], '#mesh')
            for tg in p.get('targets', []):
                for v in tg.values():
                    mark(v, '#mesh')
    for s in J.get('skins', []):
        if 'inverseBindMatrices' in s:
            mark(s['inverseBindMatrices'], '#skin')
    drop = set(a for a, w in users.items() if w and all(x.startswith('anim:') and x[5:] in clips for x in w))
    keep_acc = [i for i in range(len(J['accessors'])) if i not in drop]
    # --- rebuild BIN: copy kept bufferViews verbatim (aligned), remember new offsets
    used_bv = sorted(set(J['accessors'][i]['bufferView'] for i in keep_acc if 'bufferView' in J['accessors'][i]) |
                     set(img['bufferView'] for img in J.get('images', []) if 'bufferView' in img))
    newB = bytearray()
    bvmap = {}
    newbvs = []
    for bi in used_bv:
        bv = dict(J['bufferViews'][bi])
        o = bv.get('byteOffset', 0)
        data = B[o:o + bv['byteLength']]
        while len(newB) % 4:
            newB.append(0)
        bv['byteOffset'] = len(newB)
        newB.extend(data)
        bvmap[bi] = len(newbvs)
        newbvs.append(bv)
    accmap = {}
    newacc = []
    for i in keep_acc:
        a = dict(J['accessors'][i])
        if 'bufferView' in a:
            a['bufferView'] = bvmap[a['bufferView']]
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
        if an['name'] in clips:
            continue
        for s in an['samplers']:
            s['input'] = accmap[s['input']]
            s['output'] = accmap[s['output']]
    J['accessors'] = newacc
    J['bufferViews'] = newbvs
    # --- new animation data: one bufferView
    while len(newB) % 4:
        newB.append(0)
    blob = bytearray()
    bvi = len(J['bufferViews'])
    cache = {}

    def add(arr, typ, minmax=False):
        arr = np.ascontiguousarray(arr, dtype=np.float32)
        key = (typ, hashlib.sha1(arr.tobytes()).hexdigest())
        if key in cache:
            return cache[key]
        a = dict(bufferView=bvi, byteOffset=len(blob), componentType=5126, count=int(arr.shape[0]), type=typ)
        if minmax:
            a['min'] = [float(x) for x in arr.min(0)]
            a['max'] = [float(x) for x in arr.max(0)]
        blob.extend(arr.tobytes())
        J['accessors'].append(a)
        cache[key] = len(J['accessors']) - 1
        return cache[key]
    report = {}
    jn = rig.joint_nodes
    for name, c in clips.items():
        Q = RG.qnorm(np.asarray(c['Q'], float))
        T = np.asarray(c['T'], float)
        if c.get('loop'):        # loops: n frames -> n+1 keys, last == first, clip length = n / fps
            Q = np.concatenate([Q, Q[:1]])
            T = np.concatenate([T, T[:1]])
        n = len(Q)
        t = np.arange(n) / c['fps']
        for j in range(Q.shape[1]):          # hemisphere continuity
            for i in range(1, n):
                if np.dot(Q[i, j], Q[i - 1, j]) < 0:
                    Q[i, j] = -Q[i, j]
        samplers, channels = [], []
        nkeys = 0
        for j, nm in enumerate(rig.names):
            gi = reduce_keys(t, Q[:, j], True, tol_for(nm, tol), c.get('pin', ()))
            nkeys += len(gi)
            ii = add(t[gi].reshape(-1, 1), 'SCALAR', True)
            oi = add(Q[gi, j], 'VEC4')
            samplers.append(dict(input=ii, output=oi, interpolation='LINEAR'))
            channels.append(dict(sampler=len(samplers) - 1, target=dict(node=jn[j], path='rotation')))
            if nm in ('root', 'hips'):
                gi = reduce_keys(t, T[:, j], False, tol['trans_m'], c.get('pin', ()))
                nkeys += len(gi)
                ii = add(t[gi].reshape(-1, 1), 'SCALAR', True)
                oi = add(T[gi, j], 'VEC3')
                samplers.append(dict(input=ii, output=oi, interpolation='LINEAR'))
                channels.append(dict(sampler=len(samplers) - 1, target=dict(node=jn[j], path='translation')))
        an = dict(name=name, channels=channels, samplers=samplers)
        if name in names:
            J['animations'][names[name]] = an
        else:
            J['animations'].append(an)
        report[name] = dict(frames=n, keys=nkeys)
    J['bufferViews'].append(dict(buffer=0, byteOffset=len(newB), byteLength=len(blob)))
    newB.extend(blob)
    if extras_note:
        J['asset'].setdefault('extras', {})['mocap_animation'] = extras_note
    size = RG.glb_save(out_glb, J, bytes(newB))
    return dict(size=size, new_anim_bytes=len(blob), clips=report)


def anim_bytes(glb):
    """bytes of all animation accessors (input+output) in a GLB, per clip and total (shared accessors counted once)."""
    J, B = RG.glb_load(glb)
    seen = set()
    per = {}
    for an in J['animations']:
        s = 0
        for sm in an['samplers']:
            for k in ('input', 'output'):
                a = sm[k]
                ac = J['accessors'][a]
                nb = ac['count'] * RG.NC[ac['type']] * 4
                if a not in seen:
                    s += nb
                    seen.add(a)
        per[an['name']] = s
    return dict(total=sum(per.values()), clips=per)
