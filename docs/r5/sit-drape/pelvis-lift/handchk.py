exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
O = {o.name: o for o in CH_MESH}; body = O['LOD0_G2_BODY']; gi = {g.index: g.name for g in body.vertex_groups}
def dom(v): g = max(v.groups, key=lambda g: g.weight, default=None); return gi[g.group] if g else ''
D = [dom(v) for v in body.data.vertices]
print('GROUPS', sorted(set(D)))
for c, f in (('sit_down', 30), ('sit_hold', 0), ('stand_up', 4)):
    setclip(c); place(c, f); vs, ts = wm(body)
    for s in 'LR':
        hv = [i for i, d in enumerate(D) if d.startswith('hand.' + s) or (d.endswith('.' + s) and any(d.startswith(p) for p in ('f_', 'thumb', 'index', 'middle', 'ring', 'pinky', 'finger')))]
        th = [t for t in ts if all(D[v].startswith('thigh.') for v in t)]
        bt = BVHTree.FromPolygons(vs, th); ht = [t for t in ts if all(v in set(hv) for v in t)]; bh = BVHTree.FromPolygons(vs, ht)
        dmin = min(bt.find_nearest(vs[i], 1)[3] for i in hv)
        aprn = O['LOD0_G2_APRON']; av, at = wm(aprn); ba = BVHTree.FromPolygons(av, at); dv, dt = wm(O['LOD0_G2_DRESS']); bd = BVHTree.FromPolygons(dv, dt)
        sv, stt = wm(STOOL_MESH[0]); bs = BVHTree.FromPolygons(sv, stt)
        print('HAND', c, f, s, 'nverts', len(hv), 'min dist to thigh skin mm', round(dmin * 1000, 1), 'hand x thigh pairs', len(bh.overlap(bt)), 'hand x apron', len(bh.overlap(ba)), 'hand x dress', len(bh.overlap(bd)), 'min dist to apron mm', round(min(ba.find_nearest(vs[i], 1)[3] for i in hv) * 1000, 1), 'hand x stool', len(bh.overlap(bs)))
