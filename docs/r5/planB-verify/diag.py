import os, json, collections
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
O = {o.name[8:]: o for o in CH_MESH}
def dom(o):
    gi = {g.index: g.name for g in o.vertex_groups}; return [gi[max(v.groups, key=lambda g: g.weight).group] if v.groups else '-' for v in o.data.vertices]
DB, DD = dom(O['BODY']), dom(O['DRESS'])
FR = json.loads(os.environ['FRAMES']); res = {}
for c, fl in FR.items():
    setclip(c)
    for f in fl:
        place(c, f); bv, bt = wm(O['BODY']); dv, dt = wm(O['DRESS'])
        pr = BVHTree.FromPolygons(dv, dt).overlap(BVHTree.FromPolygons(bv, bt))
        cb = collections.Counter(); cd = collections.Counter(); cz = collections.Counter()
        for i, j in pr:
            b = DB[bt[j][0]]; d = DD[dt[i][0]]; cb[b] += 1; cd[d] += 1
            # thigh side: local position of the body tri relative to thigh bone
            p = sum((bv[k] for k in bt[j]), Vector()) / 3
            cz[b + ':' + ('front' if (p - (arm.matrix_world @ arm.pose.bones['hips'].head)).dot(Vector((math.cos(YAW+math.pi/2), math.sin(YAW+math.pi/2), 0))) > 0 else 'back')] += 1
        res[f'{c}_{f}'] = dict(n=len(pr), body=cb.most_common(6), dress=cd.most_common(6), side=cz.most_common(6))
        print('D', c, f, json.dumps(res[f'{c}_{f}']), flush=True)
json.dump(res, open(os.environ['DOUT'], 'w'), indent=1)
