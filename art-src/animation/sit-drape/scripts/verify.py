# Penetration check on the RUNTIME GLB (Blender import = shape keys + skin as exported):
#   blender -b -P verify.py -- <glb> <anim_meta.json> <out.json>
# Per frame: pose the clip, put the character root where the driver puts it (anim_meta root_motion.forward_m: sit_down
# slides back from 0.494 m in front of the seated root, stand_up forward), set the shape-key weights from the anim_meta
# morph curves, then count intersecting triangle pairs (BVH overlap) per part pair.  The chair is the room chair mesh.
import bpy, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from mathutils import Vector
import sdlib as S

a = sys.argv[sys.argv.index('--') + 1:]
GLB, META, OUT = a[0], a[1], a[2]
meta = json.load(open(META))
FR = [('sit_hold', 0.0)] + [('sit_hold', t) for t in (0.5, 1.0, 1.5)] + [('sit_down', t) for t in (0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.8667, 1.0, 1.2)] + \
     [('stand_up', t) for t in (0.1333, 0.3, 0.45, 0.6, 0.75, 0.8667, 1.0)]
PAIRS = [('legs', 'dress'), ('legs', 'apron'), ('apron', 'dress'), ('dress', 'chair'), ('apron', 'chair'), ('bow', 'chair'), ('legs', 'chair'),
         ('torso', 'chair'), ('hand_L', 'apron'), ('hand_R', 'apron'), ('hand_L', 'dress'), ('hand_R', 'dress'),
         ('sleeve_L', 'apron'), ('sleeve_R', 'apron'), ('dress', 'floor'), ('apron', 'floor')]


def curve(c, t):
    c = np.asarray(c, float)
    return float(np.interp(t, c[:, 0], c[:, 1]))


def weights(clip, t):
    m = meta['clips'][clip].get('morph', {}).get('curves', {})
    return {k: curve(v, t) for k, v in m.items()}


def root_z(clip, t):
    rm = meta['clips'][clip].get('root_motion')
    if not isinstance(rm, dict):
        return 0.0
    f = np.asarray(rm['forward_m'], float)
    v = float(np.interp(t, f[:, 0], f[:, 1]))
    return (-f[-1, 1] + v) if clip == 'sit_down' else v


bpy.ops.wm.read_factory_settings(use_empty=True)
CV, CF = S.extract_chair()
chairV = S.gl2bl(S.chair_in_seated_root(CV))
ch = S.Character(GLB)
cls = S.body_parts(ch)
BF = ch.faces('LOD0_G2_BODY')
parts = {}
for f in BF:
    parts.setdefault(cls[f[0]], []).append(f)
floorV = np.array([[-3, -3, 0], [3, -3, 0], [3, 3, 0], [-3, 3, 0]], float)
floorF = [[0, 1, 2, 3]]
keys = {n: ch.mesh[n].data.shape_keys for n in ('LOD0_G2_DRESS', 'LOD0_G2_APRON')}
res = []
for clip, t in FR:
    w = weights(clip, t)
    for n, sk in keys.items():
        if sk:
            for kb in sk.key_blocks[1:]:
                kb.value = w.get(kb.name, 0.0)
    rz = root_z(clip, t)
    ch.top.location = Vector((0, -rz, 0))
    ch.pose(clip, t)
    VB = ch.deformed('LOD0_G2_BODY')
    T = {k: S.bvh(VB, v) for k, v in parts.items()}
    T['dress'] = S.bvh(ch.deformed('LOD0_G2_DRESS'), ch.faces('LOD0_G2_DRESS'))
    T['apron'] = S.bvh(ch.deformed('LOD0_G2_APRON'), ch.faces('LOD0_G2_APRON'))
    T['bow'] = S.bvh(ch.deformed('LOD0_G2_BOW'), ch.faces('LOD0_G2_BOW'))
    T['chair'] = S.bvh(chairV, CF)
    T['floor'] = S.bvh(floorV, floorF)
    ov = {x + '-' + y: len(T[x].overlap(T[y])) for x, y in PAIRS if x in T and y in T}
    r = dict(clip=clip, t=t, root_z=round(rz, 4), weights={k: round(v, 3) for k, v in w.items()}, overlaps=ov)
    res.append(r)
    print('VERIFY', json.dumps(r), flush=True)
json.dump(res, open(OUT, 'w'), indent=1)
