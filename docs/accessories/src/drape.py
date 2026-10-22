# 半蹲 drape 修正形变：在给定姿态帧上把 DRESS / APRON 从大腿推出（间隙 CLR），APRON 在 DRESS 外保持 GAPL（8 mm 层间距），
# 修正量在布料网格上拉普拉斯平滑，并把相对未修正姿态的附加拉伸限制在 STR（2.5%）以内；最后用蒙皮雅可比换回静止空间位移。
# blender -b --python drape.py -- rig.glb out.npz   环境：SAMPLES='[["lantern_pick_up_stand",24],...]'  EVAL=targets.npz（只评估）  W='{"clip":[[f,[w...]]...]}'
import bpy,sys,os,json,math,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
glb,out=sys.argv[-2:]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=glb);sc=bpy.context.scene
O={o.name:o for o in bpy.data.objects};arm=[o for o in O.values() if o.type=='ARMATURE'][0];PB=arm.pose.bones
for t in arm.animation_data.nla_tracks: t.mute=True
B,DR,AP=O['LOD0_G2_BODY'],O['LOD0_G2_DRESS'],O['LOD0_G2_APRON']
for o in (B,DR,AP):
    if o.data.shape_keys:
        for kb in o.data.shape_keys.key_blocks[1:]: kb.value=0
gi={g.index:g.name for g in B.vertex_groups}
Dm=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in B.data.vertices]
def isleg(p): ds=[Dm[v] for v in p.vertices];d=max(set(ds),key=ds.count);return d.startswith(('thigh','shin','foot'))
LEGP=[p.index for p in B.data.polygons if isleg(p)]
def setf(clip,f):
    a=[x for x in bpy.data.actions if x.name==clip or x.name.startswith(clip+'_')];a=sorted(a,key=lambda a:len(a.name))[0]
    arm.animation_data.action=a
    try: arm.animation_data.action_slot=a.slots[0]
    except Exception: pass
    sc.frame_set(int(a.frame_range[0])+f)
def ev(o):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();M=oe.matrix_world
    P=np.array([list(M@v.co) for v in me.vertices]);me.calc_loop_triangles();T=[tuple(t.vertices) for t in me.loop_triangles];poly=[t.polygon_index for t in me.loop_triangles];oe.to_mesh_clear();return P,T,poly
def legbvh():
    P,T,poly=ev(B);ls=set(LEGP);return BVHTree.FromPolygons(P.tolist(),[t for t,pi in zip(T,poly) if pi in ls])
def jac(o):
    g={x.index:x.name for x in o.vertex_groups};S={}
    for n in set(g.values()):
        if n in PB: S[n]=np.array((arm.matrix_world@PB[n].matrix@arm.data.bones[n].matrix_local.inverted()@arm.matrix_world.inverted()@o.matrix_world).to_3x3())
    J=np.zeros((len(o.data.vertices),3,3))
    for v in o.data.vertices:
        ws=[(g[x.group],x.weight) for x in v.groups if g[x.group] in S];tw=sum(w for _,w in ws) or 1
        J[v.index]=sum(w*S[n] for n,w in ws)/tw if ws else np.eye(3)
    return J
def edges(o): return np.array([tuple(e.vertices) for e in o.data.edges])
def nbs(o):
    nb=[[] for _ in o.data.vertices]
    for a,b in edges(o): nb[a].append(b);nb[b].append(a)
    return nb
def count(PA,TA,PB_,TB): return len(BVHTree.FromPolygons(PA.tolist(),TA).overlap(BVHTree.FromPolygons(PB_.tolist(),TB)))
CLR=float(os.environ.get('CLR','0.003'));GAPL=float(os.environ.get('GAPL','0.008'));STR=float(os.environ.get('STR','0.025'));REACH=0.03
ED,EA=edges(DR),edges(AP);ND,NA=nbs(DR),nbs(AP)
def groups(P):
    from mathutils.kdtree import KDTree
    kd=KDTree(len(P))
    for i,p in enumerate(P): kd.insert(Vector(p),i)
    kd.balance();pr=[(i,j) for i,p in enumerate(P) for _,j,_ in kd.find_range(Vector(p),1e-6) if j>i];par=list(range(len(P)))
    def fd(x):
        while par[x]!=x: par[x]=par[par[x]];x=par[x]
        return x
    for a,b in pr: par[fd(a)]=fd(b)
    return np.array([fd(i) for i in range(len(P))])
def weld(P,G):
    S=np.zeros_like(P);c=np.zeros(len(P));np.add.at(S,G,P);np.add.at(c,G,1);return S[G]/c[G][:,None]
ITER=int(os.environ.get('ITER','150'))
def solve(P0,E,NB,constr,anchor,iters=None):
    """PBD：碰撞投影 + 附加拉伸 ≤STR（相对蒙皮后的边长）+ 弱位移平滑；anchor 顶点不动（腰头）"""
    iters=iters or ITER
    G=groups(P0);P=P0.copy();L0=np.linalg.norm(P0[E[:,0]]-P0[E[:,1]],axis=1);k=L0>1e-6;E=E[k];L0=L0[k]
    mv=(~anchor).astype(float)
    for it in range(iters):
        C=constr(P)
        for i,t in C.items():
            if not anchor[i]: P[i]=t
        for _ in range(3):
            v=P[E[:,1]]-P[E[:,0]];L=np.linalg.norm(v,axis=1)+1e-12;ex=np.maximum(L-L0*(1+STR),0)
            wa=mv[E[:,0]];wb=mv[E[:,1]];ws=wa+wb+1e-12;c=v/L[:,None]*ex[:,None]
            dP=np.zeros_like(P);cnt=np.zeros(len(P))
            np.add.at(dP,E[:,0],c*(wa/ws)[:,None]);np.add.at(dP,E[:,1],-c*(wb/ws)[:,None]);np.add.at(cnt,E[:,0],ex>0);np.add.at(cnt,E[:,1],ex>0)
            P=P+dP/np.maximum(cnt,1)[:,None]*1.5
        Dl=P-P0;M=np.array([Dl[n].mean(0) if n else Dl[i] for i,n in enumerate(NB)]);P=P0+np.where(anchor[:,None],0,0.8*Dl+0.2*M)
        P=weld(P,G)
    v=P[E[:,1]]-P[E[:,0]];strain=float((np.linalg.norm(v,axis=1)/L0-1).max());rem=len(constr(P))
    return P,strain,rem
import sys as _s;_s.path.append('/workspace/tools/bpy_site')
import scipy.sparse as sp_,scipy.sparse.linalg as spl
WS,WC,WA=float(os.environ.get("WS","1")),float(os.environ.get('WC','30')),100.0
def solve(P0,E,NB,constr_pts,anchor,iters=None):
    """第 2 种方法：全局最小二乘（projective dynamics）。边：长度投影到 [0.85,1+STR]·L0；碰撞：顶点 + 边中点线性约束；腰头锚定。"""
    iters=iters or int(os.environ.get('ITER','40'))
    G=groups(P0);n=len(P0);L0=np.linalg.norm(P0[E[:,0]]-P0[E[:,1]],axis=1);k=L0>1e-6;E=E[k];L0=L0[k];m=len(E)
    De=sp_.csr_matrix((np.r_[np.ones(m),-np.ones(m)],(np.r_[np.arange(m),np.arange(m)],np.r_[E[:,1],E[:,0]])),shape=(m,n))
    # 焊接：重合顶点之间加硬弹簧
    wpairs=[(i,int(G[i])) for i in range(n) if G[i]!=i]
    if wpairs:
        W=np.array(wpairs);Dw=sp_.csr_matrix((np.r_[np.ones(len(W)),-np.ones(len(W))],(np.r_[np.arange(len(W)),np.arange(len(W))],np.r_[W[:,0],W[:,1]])),shape=(len(W),n))
    else: Dw=sp_.csr_matrix((0,n))
    An=sp_.diags(anchor.astype(float))
    P=P0.copy();rem=0
    for it in range(iters):
        v=De@P;L=np.linalg.norm(v,axis=1)+1e-12;Lt=np.clip(L,L0*0.85,L0*(1+STR));tgt_e=v/L[:,None]*Lt[:,None]
        rows,cols,vals,rhs=constr_pts(P,E)
        Cm=sp_.csr_matrix((vals,(rows,cols)),shape=(len(rhs),n)) if len(rhs) else sp_.csr_matrix((0,n))
        A=(WS*De.T@De+WC*Cm.T@Cm+WA*An+1e3*Dw.T@Dw+1e-4*sp_.eye(n)).tocsc()
        b=WS*De.T@tgt_e+(WC*Cm.T@np.array(rhs).reshape(-1,3) if len(rhs) else 0)+WA*An@P0+1e-4*P
        lu=spl.splu(A);P=np.column_stack([lu.solve(np.asarray(b[:,c]).ravel()) for c in range(3)])
        rem=len(rhs)
    v=P[E[:,1]]-P[E[:,0]];sr=np.linalg.norm(v,axis=1)/L0-1;big=L0>1e-3
    print('STRAIN pct(L0>1mm) p50/p99/p99.9/max',np.round(np.percentile(sr[big],[50,99,99.9,100])*100,2),'n>2.5%',int((sr[big]>STR+1e-4).sum()),'of',int(big.sum()),'max tiny',round(float(sr.max()*100),1),flush=True)
    strain=float(sr[big].max())
    rows,cols,vals,rhs=constr_pts(P,E);return P,strain,len(rhs)
def push_out(bvh,clr):
    """返回线性约束：穿入（s<clr）的顶点和边中点目标位置"""
    def f(P,E):
        rows=[];cols=[];vals=[];rhs=[];r=0
        mids=(P[E[:,0]]+P[E[:,1]])/2
        for i,p in enumerate(P):
            h=bvh.find_nearest(Vector(p),REACH)
            if h[0] is None: continue
            loc,nn=np.array(h[0]),np.array(h[1])
            if (p-loc)@nn<clr-1e-5: rows.append(r);cols.append(i);vals.append(1.0);rhs.append(loc+nn*clr);r+=1
        for e,p in zip(E,mids):
            h=bvh.find_nearest(Vector(p),REACH)
            if h[0] is None: continue
            loc,nn=np.array(h[0]),np.array(h[1])
            if (p-loc)@nn<clr-1e-5: rows+=[r,r];cols+=[int(e[0]),int(e[1])];vals+=[0.5,0.5];rhs.append(loc+nn*clr);r+=1
        return rows,cols,vals,rhs
    return f
def both(f1,f2):
    def f(P,E):
        a=f1(P,E);b=f2(P,E);o=len(a[3]);return a[0]+[x+o for x in b[0]],a[1]+b[1],a[2]+b[2],a[3]+b[3]
    return f
def anchors(o,P):
    g={x.index:x.name for x in o.vertex_groups};hz=(arm.matrix_world@PB['hips'].head).z
    return np.array([P[v.index][2]>hz-float(os.environ.get('ANCH','0.03')) for v in o.data.vertices])
def correct(clip,f):
    setf(clip,f);bpy.context.view_layer.update();LB=legbvh()
    Pd,Td,_=ev(DR);Pa,Ta,_=ev(AP)
    Pd2,sd,rd=solve(Pd,ED,ND,push_out(LB,CLR),anchors(DR,Pd))
    DB=BVHTree.FromPolygons(Pd2.tolist(),Td);fl=push_out(LB,CLR);fd=push_out(DB,GAPL)
    Pa2,sa,ra=solve(Pa,EA,NA,both(fd,fl),anchors(AP,Pa))
    Jd,Ja=jac(DR),jac(AP)
    dd=np.einsum('kij,kj->ki',np.linalg.inv(Jd),Pd2-Pd);da=np.einsum('kij,kj->ki',np.linalg.inv(Ja),Pa2-Pa)
    st=dict(clip=clip,f=f,strain_d=round(sd*100,2),strain_a=round(sa*100,2),unresolved_d=rd,unresolved_a=ra,max_d_mm=round(float(np.linalg.norm(Pd2-Pd,axis=1).max()*1000),1),max_a_mm=round(float(np.linalg.norm(Pa2-Pa,axis=1).max()*1000),1))
    return dd,da,st
def legset():
    P,T,poly=ev(B);ls=set(LEGP);return P,[t for t,pi in zip(T,poly) if pi in ls]
def metrics():
    PL,TL=legset();Pd,Td,_=ev(DR);Pa,Ta,_=ev(AP)
    # 层间距：围裙顶点到裙面的最近距离（在 3 cm 内）最小值
    DB=BVHTree.FromPolygons(Pd.tolist(),Td);g=[]
    for p in Pa:
        h=DB.find_nearest(Vector(p),REACH)
        if h[0] is not None: g.append((Vector(p)-h[0]).dot(h[1]))
    return dict(LEG_DRESS=count(PL,TL,Pd,Td),LEG_APRON=count(PL,TL,Pa,Ta),DRESS_APRON=count(Pd,Td,Pa,Ta),gap_min_mm=round(min(g)*1000,2) if g else None,gap_p5_mm=round(float(np.percentile(g,5))*1000,2) if g else None)
if os.environ.get('EVAL'):
    Z=np.load(os.environ['EVAL']);names=list(Z['names']);W=json.load(open(os.environ['W']))
    for o,k in ((DR,'d'),(AP,'a')):
        if not o.data.shape_keys: o.shape_key_add(name='Basis')
        bs=o.data.shape_keys.key_blocks[0]
        for ni,n in enumerate(names):
            kb=o.shape_key_add(name=n);D=Z[k][ni];co=np.array([list(bs.data[i].co) for i in range(len(bs.data))])+D
            kb.data.foreach_set('co',co.ravel())
    rows=[]
    for clip,fr in W.items():
        for f,ws in fr:
            setf(clip,f)
            for o in (DR,AP):
                for ni,n in enumerate(names): o.data.shape_keys.key_blocks[n].value=ws[ni]
            bpy.context.view_layer.update();r=dict(clip=clip,f=f,w=ws);r.update(metrics());rows.append(r)
    json.dump(rows,open(out,'w'));print('EVAL done',len(rows))
else:
    S=json.loads(os.environ['SAMPLES']);dd=[];da=[];info=[]
    for clip,f in S:
        setf(clip,f);bpy.context.view_layer.update();m0=metrics()
        d,a,st=correct(clip,f);st['metrics_before']=m0;dd.append(d);da.append(a);info.append(st);print('SAMPLE',json.dumps(st),flush=True)
    np.savez(out,d=np.array(dd),a=np.array(da),names=np.array([f'drape_{c[8:12]}_{f}' for c,f in S]),bas_d=np.array([list(v.co) for v in DR.data.vertices]),bas_a=np.array([list(v.co) for v in AP.data.vertices]))
    json.dump(info,open(out+'.json','w'),indent=1)
