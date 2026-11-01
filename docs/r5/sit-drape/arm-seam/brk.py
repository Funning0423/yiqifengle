exec(open('arm_seam/arm.py').read().split('out = {}')[0])
def brk():
    M = {n: wm(o) for n, o in O.items()}; bv, bt = M['BODY']
    bh = BVHTree.FromPolygons(bv, [t for t in bt if all(v in HV for v in t)]); bb = BVHTree.FromPolygons(bv, [t for t in bt if not any(v in AV for v in t)])
    return dict(apron=len(bh.overlap(BVHTree.FromPolygons(*M['APRON']))), dress=len(bh.overlap(BVHTree.FromPolygons(*M['DRESS']))), body=len(bh.overlap(bb)))
for c, f in (('sit_down', 22), ('sit_down', 36), ('sit_hold', 0), ('sit_hold', 30), ('stand_up', 0), ('stand_up', 1)):
    setroot(c, f); morphs(c, f); arm.animation_data.action = None; setpose(ORIG[c][f]); print('BRK', c, f, brk())
