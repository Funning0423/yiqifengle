# per-frame QA at 30 fps: body/cloth x stool (BVH overlap = UI-bot probe method), hand-thigh distance, ankle drift, knee angle, hips height
import os, sys, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUT = os.environ['QOUT']; FR = {'sit_down': 36, 'sit_hold': 60, 'stand_up': 38}
O = {o.name: o for o in CH_MESH}; body = O['LOD0_G2_BODY']
gi = {g.index: g.name for g in body.vertex_groups}
def grp(pref): return [v.index for v in body.data.vertices if sum(g.weight for g in v.groups if gi[g.group].startswith(pref)) > .5]
HAND = {s: grp('hand.' + s) + [i for p in ('f_', 'thumb', 'finger') for i in grp(p) if s in gi.get(0, '')] for s in 'LR'}
ARMV = set(grp('hand.')) | set(grp('forearm.')) | set(grp('upper_arm.')) | set(grp('f_')) | set(grp('thumb')) | set(grp('finger'))
THIGH = set(grp('thigh.'))
sv, stt = wm(STOOL_MESH[0]); bst = BVHTree.FromPolygons(sv, stt)
PB = arm.pose.bones; res = {}
for c, N in FR.items():
    setclip(c); rows = []
    for f in range(N + 1):
        place(c, f); r = {'f': f}
        for n, o in O.items():
            vs, ts = wm(o); b = BVHTree.FromPolygons(vs, ts); r[n[8:] + 'xStool'] = len(b.overlap(bst))
            if n == 'LOD0_G2_BODY':
                BV, BT = vs, ts; mind = 1
                for i in range(0, len(vs)):
                    loc, nr, _, d = bst.find_nearest(vs[i], .05)
                    if loc is not None:
                        sd = d if (vs[i] - loc).dot(nr) >= 0 else -d; mind = min(mind, sd)
                r['bodyStoolMin_mm'] = round(mind * 1000, 2)
        tt = [t for t in BT if not any(v in ARMV for v in t)]; bb = BVHTree.FromPolygons(BV, tt)
        tth = [t for t in BT if all(v in THIGH for v in t)]; bth = BVHTree.FromPolygons(BV, tth) if tth else None
        for s in 'LR':
            hv = HAND[s]; dmin = 9; pen = 0
            for i in hv:
                loc, nr, _, d = bth.find_nearest(BV[i], .3) if bth else (None, 0, 0, 0)
                if loc is None: continue
                sd = d if (BV[i] - loc).dot(nr) >= 0 else -d; dmin = min(dmin, sd)
            r['hand' + s + '_thigh_mm'] = round(dmin * 1000, 1)
            M = arm.matrix_world
            r['ankle' + s] = [round(x, 5) for x in (M @ PB['foot.' + s].head)]
            a = (PB['thigh.' + s].tail - PB['thigh.' + s].head).normalized(); b2 = (PB['shin.' + s].tail - PB['shin.' + s].head).normalized()
            r['knee' + s] = round(math.degrees(a.angle(b2)), 2)
        r['hipsZ_mm'] = round((arm.matrix_world @ PB['hips'].head).z * 1000, 2)
        r['bodyMesh_pairs'] = 0
        rows.append(r)
    res[c] = rows; print('QA', c, 'bodyxStool max', max(x['BODYxStool'] for x in rows), 'frames', [x['f'] for x in rows if x['BODYxStool']])
json.dump(res, open(OUT, 'w'))
