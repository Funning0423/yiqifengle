# Cloth reference for the sit drape (Blender cloth, headless).  The character is driven exactly like the game
# (sitlib.sequence: standing pre-roll -> sit_down with the controller root moving to the seat -> sit_hold x2 ->
# stand_up -> hold, 0.2 s crossfades); the skinned shapes come from numpy (sitlib) and are fed to Blender as PC2 point
# caches, so Blender only solves the cloth.
#   pass dress:  LOD0_G2_DRESS cloth   vs body (no arms / hands), chair, floor
#   pass apron:  LOD0_G2_APRON + LOD0_G2_BOW cloth (self collision) vs body, chair, floor and the simulated dress
#   blender -b -P drape_sim.py -- <glb> <out_dir> dress|apron
# out_dir/sim_<pass>.npz: per mesh (original GLB vertex order) world positions [frames, V, 3] in game space, the sim
# frame index of every clip frame (sitlib.sequence), the pin weights.
import os
import struct
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT, PASS = args[0], args[1], args[2]
os.makedirs(OUT, exist_ok=True)

CLOTH = dict(dress=('DRESS',), apron=('APRON', 'BOW'))[PASS]
PAR = dict(quality=15, mass=0.3, air=1.0, tension=40.0, shear=15.0, bend=2.0 if PASS == 'dress' else 1.0)
PAR.update({k: float(v) for k, v in (x.split('=') for x in os.environ.get('DRAPE_PAR', '').split(',') if x)})
PIN_HI, PIN_LO = 1.12, 1.08  # rest height (m): waist band pinned to the skinned shape above PIN_HI, free below PIN_LO
GAP_BODY = 0.0010          # collider outer thickness (body / chair / dress) ...
GAP_CLOTH = 0.0010         # ... + cloth collision distance = clearance the solver keeps


def g2b(P):
    P = np.asarray(P)
    return np.stack([P[..., 0], -P[..., 2], P[..., 1]], -1)


def b2g(P):
    return np.stack([P[..., 0], P[..., 2], -P[..., 1]], -1)


def write_pc2(path, frames):
    frames = np.asarray(frames, np.float32)
    with open(path, 'wb') as f:
        f.write(b'POINTCACHE2\0' + struct.pack('<iiffi', 1, frames.shape[1], 0.0, 1.0, frames.shape[0]))
        f.write(frames.tobytes())


def mesh_obj(name, V, F, coll=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in V], [], [tuple(int(i) for i in f) for f in F])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def add_cache(ob, path):
    m = ob.modifiers.new('cache', 'MESH_CACHE')
    m.cache_format = 'PC2'
    m.filepath = path
    m.frame_start = 1.0          # scene frame 1 = sample 0
    m.forward_axis, m.up_axis = 'POS_Y', 'POS_Z'
    return m


def add_collision(ob, thick=GAP_BODY, friction=8.0, single=False):
    ob.modifiers.new('collision', 'COLLISION')
    c = ob.collision
    c.use_normal = single          # single sided: cloth is always pushed out along the (outward) face normals
    c.thickness_outer = thick
    c.thickness_inner = 0.02
    c.cloth_friction = friction
    c.damping = 0.6
    c.use_culling = False
    return c


def welded(P, F):
    inv, Fw, _ = SL.weld(P, F)
    n = inv.max() + 1
    rep = np.zeros(n, int)
    rep[inv] = np.arange(len(inv))
    keep = (Fw[:, 0] != Fw[:, 1]) & (Fw[:, 1] != Fw[:, 2]) & (Fw[:, 0] != Fw[:, 2])
    return inv, rep, Fw[keep]


def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = SL.FPS
    ch = SL.Character(GLB)
    frames, index = SL.sequence(ch)
    NF = len(frames)
    sc.frame_start, sc.frame_end = 1, NF
    meshes = ('BODY', 'DRESS', 'APRON', 'BOW')
    sk = {m: np.zeros((NF, len(ch.md[m]['P']), 3)) for m in meshes}
    for f, fr in enumerate(frames):
        W = SL.world_joints(ch, fr)
        for m in meshes:
            sk[m][f] = ch.skin(m, W)
    print('skinned', NF, 'frames %.1fs' % (time.time() - t0), flush=True)

    # ---------------- colliders: chair, floor, body (torso + legs; arms / hands / head do not push the cloth)
    d = np.load(SL.CHAIR_NPZ)
    chair = mesh_obj('chair', g2b(d['chair_V']), d['chair_F'])
    add_collision(chair, friction=6.0)
    fl = mesh_obj('floor', g2b(d['floor_V']) + np.array([0, 0, 0.0]), d['floor_F'])
    add_collision(fl, friction=6.0, single=False)
    B = ch.md['BODY']
    inv, rep, Fw = welded(B['P'], B['F'])
    skip = np.zeros(len(B['P']), bool)
    skip[ch.ids['arm']] = True
    skip[ch.ids['head']] = True
    Fb = Fw[~skip[rep][Fw].any(1)]
    used = np.unique(Fb)
    remap = -np.ones(len(rep), int)
    remap[used] = np.arange(len(used))
    body = mesh_obj('body', g2b(sk['BODY'][0][rep[used]]), remap[Fb])
    write_pc2(os.path.join(OUT, 'body.pc2'), g2b(sk['BODY'][:, rep[used]]))
    add_cache(body, os.path.join(OUT, 'body.pc2'))
    add_collision(body, friction=10.0)
    if PASS == 'apron':
        Dz = np.load(os.path.join(OUT, 'sim_dress.npz'))
        DP = Dz['DRESS']
        Dm = ch.md['DRESS']
        dinv, drep, dFw = welded(Dm['P'], Dm['F'])
        dress = mesh_obj('dress_sim', g2b(DP[0][drep]), dFw)
        write_pc2(os.path.join(OUT, 'dress.pc2'), g2b(DP[:, drep]))
        add_cache(dress, os.path.join(OUT, 'dress.pc2'))
        add_collision(dress, friction=6.0, single=False)

    # ---------------- cloth object (welded, one object per pass)
    parts = []
    off = 0
    Vs, Fs, pins = [], [], []
    for m in CLOTH:
        md = ch.md[m]
        inv, rep, Fw = welded(md['P'], md['F'])
        pin = SL_smooth((md['P'][:, 1] - PIN_LO) / (PIN_HI - PIN_LO))
        parts.append(dict(mesh=m, inv=inv, rep=rep, off=off, n=len(rep)))
        Vs.append(sk[m][:, rep])
        Fs.append(Fw + off)
        pins.append(pin[rep])
        off += len(rep)
    V = np.concatenate(Vs, 1)
    F = np.concatenate(Fs)
    pin = np.concatenate(pins)
    cl = mesh_obj('cloth', g2b(V[0]), F)
    vg = cl.vertex_groups.new(name='pin')
    for w in np.unique(np.round(pin, 3)):
        if w > 0:
            vg.add([int(i) for i in np.where(np.round(pin, 3) == w)[0]], float(w), 'REPLACE')
    write_pc2(os.path.join(OUT, 'cloth_%s.pc2' % PASS), g2b(V))
    add_cache(cl, os.path.join(OUT, 'cloth_%s.pc2' % PASS))
    mod = cl.modifiers.new('cloth', 'CLOTH')
    s = mod.settings
    s.quality = int(PAR['quality'])
    s.mass = PAR['mass']
    s.air_damping = PAR['air']
    s.tension_stiffness = s.compression_stiffness = PAR['tension']
    s.shear_stiffness = PAR['shear']
    s.bending_stiffness = PAR['bend']
    s.tension_damping = s.compression_damping = 5.0
    s.bending_damping = 0.5
    s.vertex_group_mass = 'pin'
    s.pin_stiffness = 4.0
    s.time_scale = 1.0
    c = mod.collision_settings
    c.collision_quality = int(PAR.get('cq', 8))
    c.distance_min = GAP_CLOTH
    c.impulse_clamp = 0.0
    c.use_self_collision = True
    c.self_distance_min = 0.0015
    c.self_friction = 4.0
    c.self_impulse_clamp = 0.0
    mod.point_cache.frame_start = 1
    mod.point_cache.frame_end = NF
    print('cloth', PASS, len(V[0]), 'verts', len(F), 'faces; pinned', int((pin > 0.999).sum()), 'soft', int(((pin > 0) & (pin < 0.999)).sum()), flush=True)

    out = np.zeros((NF, len(V[0]), 3))
    dg = bpy.context.evaluated_depsgraph_get()
    for f in range(1, NF + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cl.evaluated_get(dg)
        co = np.zeros(len(ev.data.vertices) * 3)
        ev.data.vertices.foreach_get('co', co)
        out[f - 1] = b2g(co.reshape(-1, 3))
        if f == 2:
            bo = body.evaluated_get(dg)
            cb = np.zeros(len(bo.data.vertices) * 3)
            bo.data.vertices.foreach_get('co', cb)
            err = np.abs(b2g(cb.reshape(-1, 3)) - sk['BODY'][1][rep_body(ch, used)]).max()
            print('pc2 frame check (body, frame 2): %.2e m' % err, flush=True)
        if f % 20 == 0:
            print('frame', f, '/', NF, '%.0fs' % (time.time() - t0), flush=True)
    res = dict(index_sit_down=index['sit_down'], index_sit_hold=index['sit_hold'], index_stand_up=index['stand_up'])
    for p in parts:
        res[p['mesh']] = out[:, p['off']:p['off'] + p['n']][:, p['inv']].astype(np.float32)
        res[p['mesh'] + '_skinned'] = sk[p['mesh']].astype(np.float32)
        res[p['mesh'] + '_pin'] = pin[p['off']:p['off'] + p['n']][p['inv']]
    np.savez_compressed(os.path.join(OUT, 'sim_%s.npz' % PASS), **res)
    print('done %.0fs' % (time.time() - t0), flush=True)


def SL_smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def rep_body(ch, used):
    B = ch.md['BODY']
    inv, rep, _ = welded(B['P'], B['F'])
    return rep[used]


main()
