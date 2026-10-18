src = open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/arm_seam/arm2.py').read().split('LOG = {}; OUT = {}')[0]
exec(src)
import collections
def cnt():
    bv, bt = wm(body); bb = BVHTree.FromPolygons(bv, bt); return {m: len(bb.overlap(BVHTree.FromPolygons(*wm(O[m])))) for m in ('DRESS', 'APRON')}
base_pose_sd = pose_sd
for name, excl in (('full', ()), ('noskirt', ('skirt',)), ('nolegs', ('thigh', 'shin', 'foot')), ('none', ('skirt', 'thigh', 'shin', 'foot'))):
    out = []
    for f in (22, 24, 27, 30, 33, 35):
        setroot('sit_down', f); setmorph('sit_down', f); P = ORIG['sit_down'][f]; wL = sm((f - LEG0) / (END - LEG0))
        Q = dict(P)
        for k in P:
            if not k.startswith(('hips', 'root') + ARMB + excl): Q[k] = (P[k][0].lerp(HOLD[k][0], wL), slq(P[k][1], HOLD[k][1], wL), P[k][2])
        setpose(Q); out.append((f, cnt()))
    print('V', name, out, flush=True)
# skirt diff over sit_down frames vs hold
for f in range(14, 37, 2):
    P = ORIG['sit_down'][f]; print('SK', f, {k: (round(math.degrees(2 * math.acos(min(1, abs(P[k][1].dot(HOLD[k][1]))))), 1), round((P[k][0] - HOLD[k][0]).length * 1000, 1)) for k in P if k.startswith(('skirt.back', 'skirt.front', 'thigh.L'))})
