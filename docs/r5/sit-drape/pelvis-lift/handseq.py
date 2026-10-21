exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
O = {o.name: o for o in CH_MESH}; body = O['LOD0_G2_BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]
HV = set(i for i, d in enumerate(D) if d.startswith('hand.') or d.startswith('forearm.'))
out = {}
for c, N in (('sit_down', 36), ('stand_up', 38)):
    setclip(c); row = []
    for f in range(N + 1):
        place(c, f); vs, ts = wm(body); ht = [t for t in ts if all(v in HV for v in t)]; bh = BVHTree.FromPolygons(vs, ht)
        n = sum(len(bh.overlap(BVHTree.FromPolygons(*wm(O[m])))) for m in ('LOD0_G2_APRON', 'LOD0_G2_DRESS'))
        row.append(n)
    print('HSEQ', c, row)
