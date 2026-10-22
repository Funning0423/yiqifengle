# 局部化穿入深度（覆盖 depth.py 的版本）：最近点只在"相交三角对"所涉外层面里找，不设距离窗（避免饱和）
from mathutils.bvhtree import BVHTree as _BV2
def _pen_depth(inner_v,inner_t,outer_v,outer_t,ctr):
    TI=_BV2.FromPolygons(inner_v,inner_t);TO=_BV2.FromPolygons(outer_v,outer_t);ov=TI.overlap(TO)
    if not ov:return 0.0,0
    sub=sorted({b for _,b in ov});TS=_BV2.FromPolygons(outer_v,[outer_t[b] for b in sub]);mx=0.0
    for k in {k for a,_ in ov for k in inner_t[a]}:
        v=inner_v[k];h=TS.find_nearest(v)
        if h[0] is None:continue
        n=h[1]
        if n.dot(h[0]-ctr)<0:n=-n
        mx=max(mx,(v-h[0]).dot(n))
    return mx*1000,len(ov)
