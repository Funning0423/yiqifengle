# per 30-fps frame: cloth/body x stool, cloth x body, dress x apron, hand/forearm x apron/dress (anim_meta weights by target name; BOW sit_drape driven like dress)
import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUT = os.environ['QOUT']; FR = {'sit_down': 36, 'sit_hold': 60, 'stand_up': 38}
O = {o.name[8:]: o for o in CH_MESH}; body = O['BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]; HV = set(i for i, d in enumerate(D) if d.startswith(('hand.', 'forearm.')))
sv, stt = wm(STOOL_MESH[0]); bst = BVHTree.FromPolygons(sv, stt); res = {}
for c, N in FR.items():
    setclip(c); rows = []
    for f in range(0, N + 1, 1 if c != 'sit_hold' else 10):
        place(c, f); B = {}
        M = {n: wm(o) for n, o in O.items()}
        for n in M: B[n] = BVHTree.FromPolygons(*M[n])
        bv, bt = M['BODY']; bh = BVHTree.FromPolygons(bv, [t for t in bt if all(v in HV for v in t)])
        r = {'f': f}
        for n in ('DRESS', 'APRON', 'BOW', 'BODY'): r[n + 'xStool'] = len(B[n].overlap(bst))
        r['DRESSxBODY'] = len(B['DRESS'].overlap(B['BODY'])); r['APRONxBODY'] = len(B['APRON'].overlap(B['BODY'])); r['DRESSxAPRON'] = len(B['DRESS'].overlap(B['APRON']))
        r['HANDxCLOTH'] = len(bh.overlap(B['APRON'])) + len(bh.overlap(B['DRESS']))
        rows.append(r)
    res[c] = rows; print('Q2', c, {k: (max(x[k] for x in rows), sum(x[k] for x in rows)) for k in rows[0] if k != 'f'})
json.dump(res, open(OUT, 'w'))
