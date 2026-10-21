# per-30fps-frame QA, every frame of sit_down/sit_hold/stand_up (patched anim_meta via META_PATCH): stool/body/cloth/hand intersections, wrist/foot/knee kinematics
import os, json, csv
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUT = os.environ['QOUT']; FR = {'sit_down': 36, 'sit_hold': 60, 'stand_up': 38}; PB = arm.pose.bones; MW = arm.matrix_world
O = {o.name[8:]: o for o in CH_MESH}; body = O['BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]
HV = set(i for i, d in enumerate(D) if d.startswith(('hand.', 'forearm.'))); AV = HV | set(i for i, d in enumerate(D) if d.startswith('upper_arm.'))
sv, stt = wm(STOOL_MESH[0]); bst = BVHTree.FromPolygons(sv, stt); rows = []
import bmesh
REST = {tuple(e.vertices): (O['BOW'].data.vertices[e.vertices[0]].co - O['BOW'].data.vertices[e.vertices[1]].co).length for e in O['BOW'].data.edges if (O['BOW'].data.vertices[e.vertices[0]].co - O['BOW'].data.vertices[e.vertices[1]].co).length > 1e-5}
for c, N in FR.items():
    setclip(c)
    for f in range(N + 1):
        place(c, f); M = {n: wm(o) for n, o in O.items()}; B = {n: BVHTree.FromPolygons(*M[n]) for n in M}
        bv, bt = M['BODY']; bh = BVHTree.FromPolygons(bv, [t for t in bt if all(v in HV for v in t)]); bb = BVHTree.FromPolygons(bv, [t for t in bt if not any(v in AV for v in t)])
        r = dict(clip=c, f=f)
        for n in ('DRESS', 'APRON', 'BOW', 'BODY'): r[n + 'xStool'] = len(B[n].overlap(bst))
        r['DRESSxBODY'] = len(B['DRESS'].overlap(B['BODY'])); r['APRONxBODY'] = len(B['APRON'].overlap(B['BODY'])); r['DRESSxAPRON'] = len(B['DRESS'].overlap(B['APRON']))
        r['BOWxBODY'] = len(B['BOW'].overlap(bb)); r['BOWxDRESS'] = len(B['BOW'].overlap(B['DRESS'])); r['BOWxAPRON'] = len(B['BOW'].overlap(B['APRON'])); r['BOWxHAND'] = len(bh.overlap(B['BOW']))
        wv = M['BOW'][0]; r['BOW_strain_pct'] = round(max(abs((wv[a]-wv[b]).length/REST[(a,b)]-1) for a,b in REST)*100, 2)
        r['HANDxAPRON'] = len(bh.overlap(B['APRON'])); r['HANDxDRESS'] = len(bh.overlap(B['DRESS'])); r['HANDxBODY'] = len(bh.overlap(bb))
        for s in 'LR':
            w = MW @ PB['hand.' + s].head; r['wrist' + s] = tuple(round(x, 6) for x in w)
            r['ankle' + s] = tuple(round(x, 6) for x in MW @ PB['foot.' + s].head); r['toe' + s] = tuple(round(x, 6) for x in MW @ PB['foot.' + s].tail)
            r['knee' + s] = tuple(round(x, 6) for x in MW @ PB['shin.' + s].head)
            r['clear' + s + '_mm'] = round(min(B['APRON'].find_nearest(bv[i])[3] for i in HV if D[i] == 'hand.' + s) * 1000, 2)
        r['pose'] = {b.name: [list(b.location), list(b.rotation_quaternion)] for b in PB}
        rows.append(r)
    print('Q3', c, {k: max(x[k] for x in rows if x['clip'] == c) for k in rows[-1] if k.endswith(('Stool', 'BODY', 'APRON', 'DRESS', 'HAND', 'pct'))}, flush=True)
json.dump(rows, open(OUT, 'w'))
