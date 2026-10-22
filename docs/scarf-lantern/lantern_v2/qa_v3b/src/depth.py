# v3b 追加测量（exec 进 QA 脚本，measure 之后调用 extra(r)）
# 1) 手指 × 握把：手(HANDR) 顶点到握把网格的有符号距离（握把法线朝外；负 = 穿入），给出最小值 mm 与穿入顶点数
# 2) 穿入深度：腿×裙、腿×围裙、裙×围裙 —— 内层顶点越过外层布面（沿外层法线为正）的最大深度 mm（只看 60 mm 邻域）
from mathutils.bvhtree import BVHTree as _BVH
def _pen_depth(inner_v,inner_t,outer_v,outer_t,ctr):
    """局部化穿入深度：只看两网格相交三角对里的内层顶点；外层法线翻成背离骨盆中心(ctr)；内层顶点在外层面外侧的距离 = 穿入深度。返回 (最大 mm, 三角对数)"""
    TI=_BVH.FromPolygons(inner_v,inner_t);TO=_BVH.FromPolygons(outer_v,outer_t);ov=TI.overlap(TO)
    if not ov:return 0.0,0
    vs={k for a,_ in ov for k in inner_t[a]};mx=0.0
    for k in vs:
        v=inner_v[k];h=TO.find_nearest(v,0.08)
        if h[0] is None:continue
        n=h[1]
        if n.dot(h[0]-ctr)<0:n=-n
        s=(v-h[0]).dot(n)
        if s>mx:mx=s
    return mx*1000,len(ov)
GRIP_R=float(os.environ.get('GRIP_R','0.006'));GRIP_HALF=0.018   # prop extras grip_diameter_m=0.012，握把长 36 mm
def _gripdist(hv):
    """握把是圆柱（轴 = 握把局部 Y，中心 = socket）。轴向窗内：径向距离 - R（负 = 穿入）；另给手到握把网格的最近无符号距离。"""
    _,pv=socket_world(arm);ax=(GRIP.matrix_world.to_3x3()@Vector((0,1,0))).normalized();mn=1e9;n=0
    for v in hv:
        d=v-pv;a=d.dot(ax)
        if abs(a)>GRIP_HALF:continue
        s=(d-ax*a).length-GRIP_R;mn=min(mn,s);n+=s<0
    gv,gt=wm(GRIP);G=_BVH.FromPolygons(gv,[x for x,_ in gt]);un=min([G.find_nearest(v,0.05)[3] for v in hv if G.find_nearest(v,0.05)[0] is not None] or [1.0])
    return mn,n,un
def _lant_hand(V,hand):
    # 手 × 灯各部件的三角对数（握把 / 提环以下灯身 / 发光片）
    from mathutils.bvhtree import BVHTree as B_
    hp=[tuple(p.vertices) for p in Bo.data.polygons if PC[p.index]=='HANDR'] if False else None
    out={}
    bv,bt=wm(Bo);cl=CLS_ACTIVE;TH=B_.FromPolygons(bv,[x for x,pi in bt if cl[pi]=='HANDR'])
    for o in LM:
        v,t=wm(o);out['HAND_x_'+o.name.split('.')[-1]]=len(B_.FromPolygons(v,[x for x,_ in t]).overlap(TH))
    return out
CLS_ACTIVE=None
_BARY=[(a/6,b/6) for a in range(7) for b in range(7-a)]
def _tris_body():
    v,t=wm(Bo);return t
def extra(r,hand_cls='HANDR',classes=None):
    global CLS_ACTIVE
    classes=classes or PC;CLS_ACTIVE=classes
    dg=bpy.context.evaluated_depsgraph_get();oe=Bo.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    hand=set();leg=set()
    for p in me.polygons:
        c=classes[p.index]
        if c==hand_cls:hand.update(p.vertices)
        elif c=='LEG':leg.update(p.vertices)
    V=[Mw@v.co for v in me.vertices];oe.to_mesh_clear()
    mn,n,un=_gripdist([V[i] for i in hand]);r['grip_min_mm']=round(mn*1000,2) if mn<1e8 else None;r['grip_pen_verts']=int(n);r['grip_mesh_gap_mm']=round(un*1000,2)
    lt=_lant_hand(V,hand);r.update(lt)
    ctr=arm.matrix_world@PB['hips'].head
    lt=[x for x,pi in _tris_body() if classes[pi]=='LEG']
    C={}
    for k in ('DRESS','APRON'):
        v,t=wm(M[k]);C[k]=(v,[x for x,_ in t])
    for a,b,(iv,it) in (('LEG','DRESS',(V,lt)),('LEG','APRON',(V,lt)),('DRESS','APRON',C['DRESS'])):
        mx,n=_pen_depth(iv,it,C[b][0],C[b][1],ctr);r[f'{a}_{b}_depth_mm']=round(mx,1);r[f'{a}_{b}_tris']=n
    # 手表面密采样到握把轴（面级，不只看顶点）
    _,pv=socket_world(arm);ax=(GRIP.matrix_world.to_3x3()@Vector((0,1,0))).normalized();mn=9.0;cnt=0
    for x,pi in _tris_body():
        if classes[pi]!=hand_cls:continue
        A,B_,Cc=V[x[0]],V[x[1]],V[x[2]];hit=False
        for u,w in _BARY:
            q=A*u+B_*w+Cc*(1-u-w);d=q-pv;a_=d.dot(ax)
            if abs(a_)<GRIP_HALF:
                sd=(d-ax*a_).length-GRIP_R;mn=min(mn,sd);hit|=sd<0
        cnt+=hit
    r['grip_surface_min_mm']=round(mn*1000,2) if mn<8 else None;r['grip_surface_pen_tris']=cnt
    return r
