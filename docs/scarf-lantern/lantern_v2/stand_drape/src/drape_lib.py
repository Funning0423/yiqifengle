# 高台半蹲布料骨骼"顶起"：只动 skirt.front / .mid / .low / .low.mid（裙前片 + 围裙前片共用这几根骨），由膝角驱动
# w(k) = smootherstep((k-30)/(104-30))，k = 两膝屈角较大者；每根骨在 clip 原姿态上右乘 绕骨局部 X 的旋转 A_b·w
import math
from mathutils import Quaternion,Vector
DRAPE=[None]   # dict(bone->deg)
K0,K1=30.0,104.0
def drape_w(k,g=1.0):
    x=min(1,max(0,(k-K0)/(K1-K0)));x=1-(1-x)**g   # g>1：前段更快接入（起点斜率仍为 0）
    return x*x*x*(x*(6*x-15)+10)
def knee_now(P):
    def kn(s):
        a=PB['thigh.'+s].matrix.to_3x3()@Vector((0,1,0));b=PB['shin.'+s].matrix.to_3x3()@Vector((0,1,0));return math.degrees(a.angle(b))
    return max(kn('L'),kn('R'))
def drape_apply(P):
    w=drape_w(knee_now(P),DRAPE[0].get('gamma',1.0))
    if w<=0:return
    for b,deg in DRAPE[0].items():
        if b=='gamma':continue
        l,q,s_=P[b];P[b]=(l,q@Quaternion(Vector((1,0,0)),math.radians(deg*w)),s_)
def set_drape(d):
    DRAPE[0]=d;CACHE.clear()
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
