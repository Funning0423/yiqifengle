# Point door_reach's right palm at the door. The reach is the existing two-bone IK (arm_ik), not hand-authored keys.
# Only door_reach's right arm is rewritten (upper_arm.L, forearm.L, hand.L). Walk, sit, turns, idle, and the other
# bones of door_reach keep their curves. Bone names, hierarchy, and IBM are not touched. STANCE_MM is not touched.
#   python3 bake_door_palm.py
import json
import os
import shutil
import numpy as np
import rig as RG
import author_lib as AL
import clipbuild as CB
import glb_clips as GC
import clips as CL
import write_glb as WG

FPS = CB.FPS
LIMIT = int(1.5 * 1024 * 1024)
TOL_DEG = 0.20
CONTACT = (0.50, 1.60)          # palm is on the handle through here in the shipped clip


def sample_dense(rig, name):
    d = float(rig.clip_duration(name))
    if name == 'walk_loop':
        n = int(round(d * FPS))
        t = np.arange(max(n, 1)) / FPS
    else:
        n = int(round(d * FPS)) + 1
        t = np.minimum(np.arange(n) / FPS, d)
    T, Q, S = rig.sample_clip(name, t)
    return Q, T, t


def qang(a, b):
    return np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(RG.qnorm(a) * RG.qnorm(b), -1)), 0, 1)))


def palm_report(rig, Q, T):
    local = AL._palm_local(AL.Ctx(rig))['L']
    W = rig.fk(T, Q)
    i = rig.idx['hand.L']
    R = W[:, i, :3, :3]
    R = R / np.linalg.norm(R, axis=-2, keepdims=True)
    n = np.einsum('nij,j->ni', R, local)
    hy = R[:, :, 1]
    palm = W[:, i, :3, 3] + hy * CL.PALM
    err = np.linalg.norm(palm - CL.HANDLE, axis=1)
    ang = np.degrees(np.arccos(np.clip(n @ CL.DOOR_PALM, -1, 1)))
    return ang, err, n


def already_aimed(rig, Q, T, times):
    ang, err, _n = palm_report(rig, Q, T)
    m = (times >= CONTACT[0]) & (times <= CONTACT[1])
    return float(ang[m].max()) < 8.0 and float(err[m].max()) * 1000 < 8.0


def mesh_fingerprint(path):
    J, B = RG.glb_load(path)
    h = __import__('hashlib').sha1()
    for m in J['meshes']:
        for p in m['primitives']:
            for k in sorted(p['attributes']):
                h.update(RG.acc(J, B, p['attributes'][k]).tobytes())
            if 'indices' in p:
                h.update(RG.acc(J, B, p['indices']).tobytes())
    h.update(RG.acc(J, B, J['skins'][0]['inverseBindMatrices']).tobytes())
    nodes = []
    for n in J['nodes']:
        nodes.append(tuple(sorted((k, json.dumps(n[k], sort_keys=True)) for k in n if k != 'extras')))
    return h.hexdigest(), nodes, [a['name'] for a in J['animations']], J['skins'][0]['joints']


def splice(src_glb, dst_glb, curves):
    """Replace rotation samplers of named bones on door_reach. Everything else in the BIN stays the original bytes."""
    J, B = RG.glb_load(src_glb)
    anim = [a for a in J['animations'] if a['name'] == 'door_reach'][0]
    by_node = {}
    for ch in anim['channels']:
        if ch['target']['path'] != 'rotation':
            continue
        by_node[J['nodes'][ch['target']['node']]['name']] = ch
    newB = bytearray(B)
    while len(newB) % 4:
        newB.append(0)
    blob = bytearray()
    bvi = len(J['bufferViews'])

    def add(arr, typ, minmax=False):
        arr = np.ascontiguousarray(arr, np.float32)
        a = dict(bufferView=bvi, byteOffset=len(blob), componentType=5126, count=int(arr.shape[0]), type=typ)
        if minmax:
            a['min'] = [float(x) for x in arr.reshape(arr.shape[0], -1).min(0)]
            a['max'] = [float(x) for x in arr.reshape(arr.shape[0], -1).max(0)]
        blob.extend(arr.tobytes())
        J['accessors'].append(a)
        return len(J['accessors']) - 1

    for name, (times, quats) in curves.items():
        ch = by_node[name]
        sm = anim['samplers'][ch['sampler']]
        sm['input'] = add(np.asarray(times, float).reshape(-1, 1), 'SCALAR', True)
        sm['output'] = add(np.asarray(quats, float), 'VEC4', False)
        sm['interpolation'] = 'LINEAR'
    J['bufferViews'].append(dict(buffer=0, byteOffset=len(newB), byteLength=len(blob)))
    newB.extend(blob)
    # original payload is the prefix; mesh, skin, and untouched clips live there
    if bytes(newB[:len(B)]) != B:
        raise SystemExit('splice rewrote bytes before the new arm curves')
    RG.glb_save(dst_glb, J, bytes(newB))


def clip_keys(path, name):
    J, _B = RG.glb_load(path)
    anim = [a for a in J['animations'] if a['name'] == name][0]
    return sum(J['accessors'][s['input']]['count'] for s in anim['samplers'])


def update_anim_meta(glb):
    ab = GC.anim_bytes(glb)
    if ab['total'] > WG.ANIM_BUDGET:
        raise SystemExit('animation data %d over budget %d' % (ab['total'], WG.ANIM_BUDGET))
    with open(WG.ANIM_META) as f:
        am = json.load(f)
    edits = ('hips travel x0.5, spine/neck 60% of the performer lean, her left arm 15% of the performer (idle-like), '
             'right arm IK keeps the palm centre on the handle and turns the palm to face the door on the performer\'s reach timing')
    am['clips']['door_reach']['source']['edits'] = edits
    am['clips']['door_reach']['keys'] = '%d keys, reduced per channel (see top-level compression), LINEAR' % clip_keys(glb, 'door_reach')
    am['compression']['anim_bytes_total'] = ab['total']
    am['compression']['anim_bytes_per_clip'] = ab['clips']
    note = am['compression']['clips']
    extra = (' door_reach right arm (upper_arm.L, forearm.L, hand.L): palm aimed at the closed door with the same two-bone IK, '
             'key tolerance %.2f deg on those three curves' % TOL_DEG)
    if 'palm aimed at the closed door' not in note:
        if note and note[-1] not in '.!?':
            note += '.'
        am['compression']['clips'] = note + extra
    with open(WG.ANIM_META, 'w') as f:
        json.dump(am, f, indent=1, ensure_ascii=False)
        f.write('\n')
    return ab


def main():
    src = CB.GLB
    rig = RG.Rig(src)
    Q, T, times = sample_dense(rig, 'door_reach')
    if already_aimed(rig, Q, T, times):
        print('door_reach palm already faces the door; left the GLB alone')
        return
    ang0, err0, _ = palm_report(rig, Q, T)
    Q2, w = CL.aim_door_palm_q(Q, T, rig)
    # second pass on the dense curves must not drift (w=1 is a fixed point of the IK)
    Q3, _w3 = CL.aim_door_palm_q(Q2, T, rig)
    drift = max(float(qang(Q2[:, rig.idx[n]], Q3[:, rig.idx[n]]).max()) for n in CL.DOOR_ARM)
    print('second-pass drift deg', round(drift, 4))
    if drift > 0.5:
        raise SystemExit('door palm aim is not stable on a second pass')
    for name in rig.names:
        if name in CL.DOOR_ARM:
            continue
        e = float(qang(Q[:, rig.idx[name]], Q2[:, rig.idx[name]]).max())
        if e > 1e-4:
            raise SystemExit('aim moved %s by %s deg' % (name, e))
    ang, err, _nrm = palm_report(rig, Q2, T)
    print('t   w   palm0  palm1  err0mm  err1mm  dHand')
    step = 0.0
    for i, t in enumerate(times):
        dhand = float(qang(Q2[i - 1, rig.idx['hand.L']], Q2[i, rig.idx['hand.L']])) if i else 0.0
        step = max(step, dhand)
        if i % 3 == 0:
            print('%4.2f %4.2f %6.1f %6.1f %7.1f %7.1f %6.1f' % (
                t, w[i], ang0[i], ang[i], err0[i] * 1000, err[i] * 1000, dhand))
    print('max hand.L step deg/frame', round(step, 2))
    m = (times >= CONTACT[0]) & (times <= 1.05)   # the second the door is opening
    if float(ang[m].max()) > 1.0 or float(err[m].max()) * 1000 > 2.0:
        raise SystemExit('palm does not sit on the door during the open (ang %s err mm %s)'
                         % (round(float(ang[m].max()), 2), round(float(err[m].max()) * 1000, 2)))
    # ends stay the shipped pose (handoff to idle)
    for i in (0, -1):
        e = max(float(qang(Q[i, rig.idx[n]], Q2[i, rig.idx[n]])) for n in CL.DOOR_ARM)
        if e > 1e-4:
            raise SystemExit('door_reach end frame moved %s deg' % e)
    # fingers point up while the palm is on the door, not out in the walk pose
    W2 = rig.fk(T, Q2)
    hy = W2[:, rig.idx['hand.L'], :3, 1]
    hy = hy / np.linalg.norm(hy, axis=1, keepdims=True)
    if float(np.median(hy[m, 1])) < 0.5:
        raise SystemExit('fingers are not up on the door (median hand-Y up %s)' % round(float(np.median(hy[m, 1])), 3))
    curves = {}
    t = times
    for name in CL.DOOR_ARM:
        j = rig.idx[name]
        gi = GC.reduce_keys(t, Q2[:, j], True, TOL_DEG)
        curves[name] = (t[gi], RG.qnorm(Q2[gi, j]))
        print(name, 'keys', len(gi))
    os.makedirs('/tmp/mc', exist_ok=True)
    dst = '/tmp/mc/door_palm.glb'
    splice(src, dst, curves)
    size = os.path.getsize(dst)
    ab = GC.anim_bytes(dst)
    print('glb', size, 'anim', ab['total'], 'door', ab['clips']['door_reach'])
    if size > LIMIT:
        raise SystemExit('GLB %d over 1.5 MB' % size)
    if ab['total'] > WG.ANIM_BUDGET:
        raise SystemExit('anim bytes %d over %d' % (ab['total'], WG.ANIM_BUDGET))
    hb0, nodes0, anims0, joints0 = mesh_fingerprint(src)
    hb1, nodes1, anims1, joints1 = mesh_fingerprint(dst)
    if hb0 != hb1 or nodes0 != nodes1 or anims0 != anims1 or joints0 != joints1:
        raise SystemExit('mesh, IBM, node rest, or animation list changed')
    rig2 = RG.Rig(dst)
    Qw, Tw, tw = sample_dense(rig2, 'door_reach')
    angw, errw, _nrmw = palm_report(rig2, Qw, Tw)
    mw = (tw >= CONTACT[0]) & (tw <= 1.05)
    print('written open palm deg', round(float(angw[mw].max()), 2), 'err mm', round(float(errw[mw].max()) * 1000, 2))
    if float(angw[mw].max()) > 4.0 or float(errw[mw].max()) * 1000 > 6.0:
        raise SystemExit('key reduction pulled the palm off the door')
    for i in (0, -1):
        e = max(float(qang(Q[i, rig.idx[n]], Qw[i, rig.idx[n]])) for n in CL.DOOR_ARM)
        if e > 0.05:
            raise SystemExit('written end frame differs by %s deg' % e)
    for name in rig.names:
        if name in CL.DOOR_ARM:
            continue
        e = float(qang(Q[:, rig.idx[name]], Qw[:, rig.idx[name]]).max())
        if e > 0.05:
            raise SystemExit('written door_reach moved %s by %s deg' % (name, e))
    for name in rig.clips:
        if name == 'door_reach':
            continue
        A, Ta, ta = sample_dense(rig, name)
        B, Tb, tb = sample_dense(rig2, name)
        e = float(qang(A, B).max())
        if e > 0.02 or np.max(np.abs(Ta - Tb)) > 1e-6:
            raise SystemExit('%s changed (deg %s)' % (name, e))
    stance = open(os.path.join(CB.REPO, 'tools/walk-driver/test_locomotion.cjs')).read()
    if 'const STANCE_MM=6;' not in stance:
        raise SystemExit('STANCE_MM is no longer 6')
    shutil.copyfile(dst, src)
    ab = update_anim_meta(src)
    print('wrote', src, 'anim_bytes', ab['total'])


if __name__ == '__main__':
    main()
