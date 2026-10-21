import os, json, collections
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
O = {o.name[8:]: o for o in CH_MESH}; body = O['BODY']; gi = {g.index: g.name for g in body.vertex_groups}
D = [gi[max(v.groups, key=lambda g: g.weight).group] for v in body.data.vertices]
setclip('sit_down')
for f in (20, 24, 27, 30, 33):
    place('sit_down', f); bv, bt = wm(body); bb = BVHTree.FromPolygons(bv, bt)
    for m in ('DRESS', 'APRON'):
        pr = bb.overlap(BVHTree.FromPolygons(*wm(O[m]))); print('DG', f, m, len(pr), dict(collections.Counter(D[bt[i][0]] for i, j in pr).most_common(5)), flush=True)
