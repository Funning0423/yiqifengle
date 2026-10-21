# search skirt.back(.low) local-X offset curves for sit_down end / stand_up start; seams (sd f36, su f0) offset 0
import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
from mathutils import Quaternion
O = {o.name[8:]: o for o in CH_MESH}; PB = arm.pose.bones
sv, stt = wm(STOOL_MESH[0]); bst = BVHTree.FromPolygons(sv, stt)
FR = {'sit_down': 36, 'stand_up': 38}; BONES = json.loads(os.environ.get('BONES', '["skirt.back"]'))
def sm(u): u = min(1, max(0, u)); return u * u * (3 - 2 * u)
ORIG = {}
for c, N in FR.items():
    setclip(c); ORIG[c] = []
    for f in range(N + 1):
        sc.frame_set(f); bpy.context.view_layer.update(); ORIG[c].append({b: PB[b].rotation_quaternion.copy() for b in BONES})
def env(c, f, P):  # P: dict(a=deg, s0, s1 ramp-in start/peak, e0,e1 ramp-out) in frames
    if c == 'sit_down': return sm((f - P['a0']) / max(1, P['a1'] - P['a0'])) * (1 - sm((f - P['b0']) / max(1, 36 - P['b0'])))
    return sm(f / max(1, P['c0'])) * (1 - sm((f - P['c1']) / max(1, P['c2'] - P['c1'])))
def write(c, P, ax):
    act = bpy.data.actions[c]
    for b in BONES:
        fcs = [act.fcurves.find(f'pose.bones["{b}"].rotation_quaternion', index=i) for i in range(4)]
        for i in range(4):
            if fcs[i] is None: fcs[i] = act.fcurves.new(f'pose.bones["{b}"].rotation_quaternion', index=i, action_group=b)
            fcs[i].keyframe_points.clear(); fcs[i].keyframe_points.add(FR[c] + 1)
        for f in range(FR[c] + 1):
            k = env(c, f, P) * P['deg'] * P.get('w_' + b, 1.0)
            q = ORIG[c][f][b] @ Quaternion(ax, math.radians(k))
            for i in range(4): fcs[i].keyframe_points[f].co = (f, q[i]); fcs[i].keyframe_points[f].interpolation = 'LINEAR'
        for fc in fcs: fc.update()
def measure(c, frames):
    setclip(c); out = []
    for f in frames:
        place(c, f); M = {n: wm(O[n]) for n in ('DRESS', 'APRON', 'BODY')}; T = {n: BVHTree.FromPolygons(*M[n]) for n in M}
        out.append(dict(f=f, DB=len(T['DRESS'].overlap(T['BODY'])), DA=len(T['DRESS'].overlap(T['APRON'])), AB=len(T['APRON'].overlap(T['BODY'])), DS=len(T['DRESS'].overlap(bst)), AS=len(T['APRON'].overlap(bst))))
    return out
TR = json.loads(os.environ['TRIALS']); res = []
for P in TR:
    ax = Vector(P.get('ax', (1, 0, 0)))
    for c in FR: write(c, P, ax)
    r = {c: measure(c, range(FR[c] + 1)) for c in FR}
    s = {c: {k: (max(x[k] for x in r[c]), sum(x[k] for x in r[c])) for k in ('DB', 'DA', 'AB', 'DS', 'AS')} for c in r}
    res.append(dict(P=P, s=s, rows=r)); print('T', json.dumps(P), json.dumps(s), flush=True)
json.dump(res, open(os.environ['SOUT'], 'w'))
if os.environ.get('EXPORT'):
    P = TR[-1]
    for c in FR: write(c, P, Vector(P.get('ax', (1, 0, 0))))
    json.dump({c: {f: {b: list(ORIG[c][f][b] @ Quaternion(Vector(P.get('ax', (1, 0, 0))), math.radians(env(c, f, P) * P['deg'] * P.get('w_' + b, 1.0)))) for b in BONES} for f in range(FR[c] + 1)} for c in FR}, open(os.environ['EXPORT'], 'w'))
