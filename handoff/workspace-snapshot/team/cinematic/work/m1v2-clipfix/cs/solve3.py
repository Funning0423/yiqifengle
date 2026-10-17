"""v3 cs solve3: constrained temporal smoothing of the pass2c cloth knots with vertex AND triangle-level contact constraints.
 objective per vertex: ||D2 R_v||^2 + lam ||K_v-K0_v||^2  (R_f = sum_k B[f,k] K_k + P_f; K = free m1_cNN knots; sit/basis frames fixed)
 constraints (frame f, normal n):  sum_s c_s n.X_s(f) >= b   with X_s cloth vertices (variables) or static body/chair points
   - vertex vs body(no bow)/real chair: crossing from the clean original or inside margin  (margin body 2.0, torso 1.4, chair 2.0 mm)
   - triangle overlaps (exact BVH tri-tri) for dress self, apron self, apron x dress, dress/apron x body(incl. bow), dress/apron x chair:
     each vertex of one tri vs the closest point of the other tri, side taken from the clean pass2c original at that frame (margin 1.0/1.2 mm)
 solver: block Gauss-Seidel, exact small QP per vertex (dual active set), detect -> add -> sweep, until no overlap / violation.
usage: blender -b --python solve3.py -- <pre.npz> <out.npz> <lam> <iters>"""
import sys, time, json, ast, collections, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; pre,out=a[:2]; LAM=float(a[2]); ITERS=int(a[3])
M_BODY=0.0020; M_TORSO=0.0014; M_CHAIR=0.0020; M_AD_LO=0.0016; M_AD_HI=0.0024; OVER=0.0002; BAND=0.0003
RHO=1e-2; M_SELF=0.0010; M_ADT=0.0012; M_BT=0.0010
Z=np.load(pre,allow_pickle=True); OB=['G2_DRESS_R5G2','G2_APRON_R5G2']; NF=91
def log(*x): print(*x,flush=True)
D2=np.zeros((NF-2,NF))
for i in range(NF-2): D2[i,i:i+3]=[1,-2,1]
PAR=[]
for on in OB:
    W=[ast.literal_eval(s) for s in Z[on+'_W']]; knots=sorted({k for w in W for k in w if k!='sit_corrective'})
    B=np.zeros((NF,len(knots))); R0=Z[on+'_R0']; K0=np.zeros((len(knots),)+R0.shape[1:])
    for f,w in enumerate(W):
        for k,v in w.items():
            if k!='sit_corrective': B[f,knots.index(k)]=v
        if len(w)==1 and list(w)[0]!='sit_corrective': K0[knots.index(list(w)[0])]=R0[f]
    P=R0-np.einsum('fk,kni->fni',B,K0); G=B.T@D2.T@D2@B; Mi=np.linalg.inv(G+LAM*np.eye(len(knots)))
    A=Z[on+'_A']; t=Z[on+'_t']
    PAR.append(dict(name=on,knots=knots,B=B,K0=K0,P=P,A=A,t=t,X0=Z[on+'_X0'],T=Z[on+'_T'],Mi=Mi,MP=Mi@(B.T@D2.T@D2),
                    AP=np.einsum('fnij,fnj->fni',A,P)+t))
FREE=[f for f in range(NF) if PAR[0]['B'][f].sum()>0]; FREESET=set(FREE)
def smooth(p,Kt): return LAM*np.einsum('jk,kni->jni',p['Mi'],Kt)-np.einsum('jf,fni->jni',p['MP'],p['P'])
def world(p,K): return np.einsum('fnij,fnj->fni',p['A'],np.einsum('fk,kni->fni',p['B'],K)+p['P'])+p['t']
def accel(X): return np.linalg.norm(X[2:]-2*X[1:-1]+X[:-2],axis=2)*1000
BX=Z['body_X'].astype(np.float64); BT=Z['body_T']; nob=Z['body_nobow_tris']; torso=set(Z['body_torso_tris'].tolist()); is_torso=np.array([t_ in torso for t_ in nob])
CX=Z['chair_X']; CTRI=Z['chair_T']
t0=time.time()
BTREE=[BVHTree.FromPolygons([Vector(q) for q in BX[f]],BT[nob].tolist(),all_triangles=True) for f in range(NF)]
BFULL=[BVHTree.FromPolygons([Vector(q) for q in BX[f]],BT.tolist(),all_triangles=True) for f in range(NF)]
CTREE=BVHTree.FromPolygons([Vector(q) for q in CX],CTRI.tolist(),all_triangles=True); log('trees',round(time.time()-t0,1))
# apron layer baseline at rest (checker rule)
DT=PAR[0]['T']; AT=PAR[1]['T']
dr=Z[OB[0]+'_rest']; ar=Z[OB[1]+'_rest']; DRT=BVHTree.FromPolygons([Vector(q) for q in dr],DT.tolist(),all_triangles=True)
S0=np.zeros(len(ar)); G0=np.zeros(len(ar))
for i in np.unique(AT.ravel()):
    cp,n,fi,d=DRT.find_nearest(Vector(ar[i]),0.02)
    if cp is not None and d>1e-5: S0[i]=np.sign((Vector(ar[i])-cp).dot(n)); G0[i]=d
REQ_AD=np.clip(G0,M_AD_LO,M_AD_HI)
cnt=collections.Counter()
for tri in DT:
    for i in range(3): cnt[tuple(sorted((tri[i],tri[(i+1)%3])))]+=1
bedges={e for e,c in cnt.items() if c==1}; FBE=collections.defaultdict(list)
for fi,tri in enumerate(DT):
    for i in range(3):
        e=tuple(sorted((tri[i],tri[(i+1)%3])))
        if e in bedges: FBE[fi].append(e)
def on_bnd(Xd,fi,cp):
    for e in FBE.get(fi,()):
        a_,b_=Xd[e[0]],Xd[e[1]]; ab=b_-a_; tt=np.clip(np.dot(cp-a_,ab)/max(ab@ab,1e-18),0,1)
        if np.linalg.norm(cp-(a_+tt*ab))<2e-5: return True
    return False
# candidates for the vertex-level body/chair tests
Ku=[smooth(p,p['K0']) for p in PAR]; K=[k.copy() for k in Ku]; X=[world(p,k) for p,k in zip(PAR,K)]
CAND=[]
for oi,p in enumerate(PAR):
    C=[]
    for f in range(NF):
        c=[i for i in range(len(p['X0'][f])) if any(T_.find_nearest(Vector(Y),0.06)[0] is not None for Y in (X[oi][f][i],p['X0'][f][i]) for T_ in (BTREE[f],CTREE))]
        C.append(np.array(c,int))
    CAND.append(C)
# ---------- constraints
CONS=[]; KEY={}; BYV=collections.defaultdict(set)
def add_con(key,f,n,terms,b,soff=0.0):
    """terms: list of (oi,v,c) variables; soff: static part (already n.dot'ed); constraint sum c n.X + soff >= b"""
    if f not in FREESET: return 0
    n=np.asarray(n,float); n=n/np.linalg.norm(n)
    if key in KEY:
        j=KEY[key]; CONS[j]=(f,n,terms,b,soff)
    else:
        j=len(CONS); CONS.append((f,n,terms,b,soff)); KEY[key]=j
    oi,v,c=terms[0]; BYV[(oi,v)].add(j)   # only the first term is the variable; the others are evaluated at their current position
    return 1
def closest_tri(p,a,b,c):
    """closest point on triangle abc to p, barycentric (Ericson)"""
    ab=b-a; ac=c-a; ap=p-a; d1=ab@ap; d2=ac@ap
    if d1<=0 and d2<=0: return a,(1,0,0)
    bp=p-b; d3=ab@bp; d4=ac@bp
    if d3>=0 and d4<=d3: return b,(0,1,0)
    vc=d1*d4-d3*d2
    if vc<=0 and d1>=0 and d3<=0: v=d1/(d1-d3); return a+v*ab,(1-v,v,0)
    cp=p-c; d5=ab@cp; d6=ac@cp
    if d6>=0 and d5<=d6: return c,(0,0,1)
    vb=d5*d2-d1*d6
    if vb<=0 and d2>=0 and d6<=0: w=d2/(d2-d6); return a+w*ac,(1-w,0,w)
    va=d3*d6-d5*d4
    if va<=0 and (d4-d3)>=0 and (d5-d6)>=0: w=(d4-d3)/((d4-d3)+(d5-d6)); return b+w*(c-b),(0,1-w,w)
    den=1/(va+vb+vc); v=vb*den; w=vc*den; return a+ab*v+ac*w,(1-v-w,v,w)
# geometry access: obj ids 0 dress, 1 apron, 2 body(full, static per frame), 3 chair (static)
def geo(oi,f,orig=False):
    if oi<2: return (PAR[oi]['X0'][f] if orig else X[oi][f]),PAR[oi]['T']
    if oi==2: return BX[f],BT
    return CX,CTRI
def tri_pair_cons(f,oP,tP,oQ,tQ,margin,kind,move='P'):
    """vertices of tri tP (object oP) against tri tQ (object oQ). move='P': the P vertex is the variable (tri Q taken at its current
    position); move='Q': the heavy vertices (w>=0.2) of tri Q are the variables, each kept beyond the P point."""
    XP,TP=geo(oP,f); XQ,TQ=geo(oQ,f); XP0,_=geo(oP,f,True); XQ0,_=geo(oQ,f,True)
    q=TQ[tQ]; qa,qb,qc=XQ[q[0]],XQ[q[1]],XQ[q[2]]; nQ=np.cross(qb-qa,qc-qa); L=np.linalg.norm(nQ)
    if L<1e-12: return 0
    nQ/=L; q0=XQ0[q]; nQ0=np.cross(q0[1]-q0[0],q0[2]-q0[0]); L0=np.linalg.norm(nQ0)
    if L0<1e-12: return 0
    nQ0/=L0; k=0
    for v in TP[tP]:
        x=XP[v]; cp,w=closest_tri(x,qa,qb,qc); p0=w[0]*q0[0]+w[1]*q0[1]+w[2]*q0[2]; s0=nQ0@(XP0[v]-p0)
        if abs(s0)<1e-6: continue
        n=np.sign(s0)*nQ
        if move=='P' and oP<2:
            dyn=[(oQ,int(qi),-wi) for wi,qi in zip(w,q) if wi>1e-9] if oQ<2 else []
            soff=0.0 if oQ<2 else -float(n@cp)
            k+=add_con((kind,f,oP,int(v),oQ,int(tQ)),f,n,[(oP,int(v),1.0)]+dyn,margin,soff)
        elif move=='Q' and oQ<2:
            for wi,qi in zip(w,q):
                if wi<0.2: continue
                dyn=[(oP,int(v),-1.0)] if oP<2 else []; soff=0.0 if oP<2 else float(n@x)
                k+=add_con((kind+'Q',f,oP,int(v),oQ,int(qi)),f,-n,[(oQ,int(qi),1.0)]+dyn,margin,soff)
    return k
def unary_vertex(f,oi,stats):
    """vertex vs body(no bow)/chair: crossing from the clean original, or within margin on the outer side"""
    p=PAR[oi]; c=CAND[oi][f]; k=0; worst=0.0
    for i in c:
        x=Vector(X[oi][f][i]); r=Vector(p['X0'][f][i]); dv=x-r; Ld=dv.length
        for tag,tree in (('b',BTREE[f]),('c',CTREE)):
            reqf=(lambda fi: M_TORSO if is_torso[fi] else M_BODY) if tag=='b' else (lambda fi: M_CHAIR)
            hit=None
            if Ld>1e-7:
                hit,hn,hf,hd=tree.ray_cast(r,dv/Ld,Ld)
            if hit is not None:
                hn=hn if hn.dot(-dv)>0 else -hn; req=reqf(hf); viol=req+(x-hit).length
                k+=add_con(('u'+tag,f,oi,int(i),int(hf)),f,np.array(hn),[(oi,int(i),1.0)],req+OVER,-float(np.array(hn)@np.array(hit))); worst=max(worst,viol)
            else:
                cp,n,fi,d=tree.find_nearest(x,0.01)
                if cp is None: continue
                req=reqf(fi); s=(x-cp).dot(n)
                if s<0 or s>=req+BAND: continue
                k+=add_con(('u'+tag,f,oi,int(i),int(fi)),f,np.array(n),[(oi,int(i),1.0)],req+OVER,-float(np.array(n)@np.array(cp))); worst=max(worst,req-s)
    stats['unary_'+str(oi)]=max(stats.get('unary_'+str(oi),0),worst*1000); return k
def layer_vertex(f,stats,dtree):
    Xa=X[1][f]; Xd=X[0][f]; k=0; worst=0.0
    for i in np.where(S0!=0)[0]:
        x=Vector(Xa[i]); cp,n,fi,d=dtree.find_nearest(x,0.03)
        if cp is None or on_bnd(Xd,fi,np.array(cp)): continue
        s=S0[i]*(x-cp).dot(n); req=REQ_AD[i]
        if SLAY[f][i]<-0.005: req=min(req,SLAY[f][i]-0.0002)
        if s>=req+BAND: continue
        tri=DT[fi]; cpa=np.array(cp); _,w=closest_tri(cpa,Xd[tri[0]],Xd[tri[1]],Xd[tri[2]]); nn=S0[i]*np.array(n)
        terms=[(1,int(i),1.0)]+[(0,int(tri[m]),-w[m]) for m in range(3) if w[m]>1e-9]
        k+=add_con(('l',f,int(i),int(fi)),f,nn,terms,req+OVER); worst=max(worst,req-s)
    stats['layer']=max(stats.get('layer',0),worst*1000); return k
SLAY=[]
for f in range(NF):
    Xd0=PAR[0]['X0'][f]; t_=BVHTree.FromPolygons([Vector(q) for q in Xd0],DT.tolist(),all_triangles=True); sl=np.full(len(S0),9.0)
    for i in np.where(S0!=0)[0]:
        cp,n,fi,d=t_.find_nearest(Vector(PAR[1]['X0'][f][i]),0.03)
        if cp is not None and not on_bnd(Xd0,fi,np.array(cp)): sl[i]=S0[i]*(Vector(PAR[1]['X0'][f][i])-cp).dot(n)
    SLAY.append(sl)
def tree_of(oi,f): Xc,T=geo(oi,f); return BVHTree.FromPolygons([Vector(q) for q in Xc],T.tolist(),all_triangles=True)
def nonadj(T,i,j): return not (set(T[i].tolist())&set(T[j].tolist()))
ORIGOV={}
def orig_overlaps():
    for f in FREE:
        td=BVHTree.FromPolygons([Vector(q) for q in PAR[0]['X0'][f]],DT.tolist(),all_triangles=True); ta=BVHTree.FromPolygons([Vector(q) for q in PAR[1]['X0'][f]],AT.tolist(),all_triangles=True)
        for kind,A_,B_ in (('sd',td,td),('sa',ta,ta),('ad',ta,td),('db',td,BFULL[f]),('ab',ta,BFULL[f]),('dc',td,CTREE),('ac',ta,CTREE)):
            ORIGOV[(kind,f)]=set(A_.overlap(B_))
    log('orig overlaps (excluded, shell-overlap/design contacts):',{k:sum(len(v) for (kk,f),v in ORIGOV.items() if kk==k) for k in ('sd','sa','ad','db','ab','dc','ac')})
orig_overlaps()
def detect():
    stats={}; nadd=0; ov=collections.Counter()
    for f in FREE:
        for oi in (0,1): nadd+=unary_vertex(f,oi,stats)
        td=tree_of(0,f); ta=tree_of(1,f)
        nadd+=layer_vertex(f,stats,td)
        for (oP,tP_tree,oQ,tQ_tree,m,kind) in ((0,td,0,td,M_SELF,'sd'),(1,ta,1,ta,M_SELF,'sa'),(1,ta,0,td,M_ADT,'ad'),(0,td,2,BFULL[f],M_BT,'db'),(1,ta,2,BFULL[f],M_BT,'ab'),(0,td,3,CTREE,M_BT,'dc'),(1,ta,3,CTREE,M_BT,'ac')):
            pairs=[pq for pq in tP_tree.overlap(tQ_tree) if pq not in ORIGOV[(kind,f)]]
            if oP==oQ: pairs=[(i,j) for i,j in pairs if i<j and nonadj(PAR[oP]['T'],i,j)]
            ov[kind]+=len(pairs)
            for i,j in pairs:
                if kind in ('sd','sa'): nadd+=tri_pair_cons(f,oP,i,oQ,j,m,kind,'P'); nadd+=tri_pair_cons(f,oQ,j,oP,i,m,kind,'P')
                elif kind=='ad':   # apron = outer layer: only apron vertices move (vs dress tri), dress vertices push the apron tri
                    nadd+=tri_pair_cons(f,1,i,0,j,m,kind,'P'); nadd+=tri_pair_cons(f,0,j,1,i,m,kind,'Q')
                else:              # garment vs static body/chair
                    nadd+=tri_pair_cons(f,oP,i,oQ,j,m,kind,'P'); nadd+=tri_pair_cons(f,oQ,j,oP,i,m,kind,'Q')
    return nadd,dict(ov),stats
def qp_vertex(oi,v):
    p=PAR[oi]; rows=[]
    for j in BYV[(oi,v)]:
        f,n,terms,b,soff=CONS[j]; c=0.0; rest=0.0
        for (o2,v2,c2) in terms:
            if o2==oi and v2==v: c+=c2
            else: rest+=c2*(n@X[o2][f][v2])
        if c==0: continue
        rows.append((f,n,c,b-soff-rest))
    if not rows: return
    F=np.array([r[0] for r in rows]); Nn=np.array([r[1] for r in rows]); cc=np.array([r[2] for r in rows]); bb=np.array([r[3] for r in rows])
    Av=p['A'][F,v]; a_=np.einsum('mji,mj->mi',Av,Nn)*cc[:,None]
    Bf=p['B'][F]; MiB=Bf@p['Mi']; Q=(MiB@Bf.T)*(a_@a_.T); Q=Q+RHO*np.median(np.diag(Q))*np.eye(len(Q))   # slightly soft: conflicting contacts -> compromise, bounded multipliers
    off=cc*np.einsum('mi,mi->m',Nn,p['AP'][F,v]); Kv0=Ku[oi][:,v,:]
    GK=np.einsum('mk,mi,ki->m',Bf,a_,Kv0); r=bb-off-GK
    mu=np.zeros(len(rows)); act=r>0
    for _ in range(80):
        mu[:]=0
        if act.any():
            ia=np.where(act)[0]; sol=np.linalg.lstsq(Q[np.ix_(ia,ia)]+1e-14*np.eye(len(ia)),r[ia],rcond=None)[0]
            if (sol<0).any(): act[ia[np.argmin(sol)]]=False; continue
            mu[ia]=sol
        w=Q@mu-r; bad=(~act)&(w<-1e-8)
        if not bad.any(): break
        act[np.argmin(np.where(~act,w,np.inf))]=True
    dK=np.einsum('m,mk,mi->ki',mu,MiB,a_)
    if not np.isfinite(dK).all() or np.abs(dK).max()>0.03:   # safety: never move a knot more than 8 cm for contact
        QPLOG.append((oi,v,len(rows),float(np.abs(dK).max()) if np.isfinite(dK).all() else -1)); dK=np.clip(np.nan_to_num(dK),-0.03,0.03)
    K[oi][:,v,:]=Kv0+dK
    X[oi][:,v,:]=np.einsum('fij,fj->fi',p['A'][:,v],p['B']@K[oi][:,v,:]+p['P'][:,v])+p['t'][:,v]
QPLOG=[]
hist=[]
SCHED=[float(x) for x in (a[4].split(',') if len(a)>4 else ['3','1','0.3','0.15','0.08',str(LAM)])]
LAM_FINAL=LAM
def set_lam(l):
    global LAM
    LAM=l
    for p in PAR:
        G=p['B'].T@D2.T@D2@p['B']; p['Mi']=np.linalg.inv(G+l*np.eye(G.shape[0])); p['MP']=p['Mi']@(p['B'].T@D2.T@D2)
    for oi,p in enumerate(PAR): Ku[oi]=smooth(p,p['K0'])
    for (oi,v) in sorted(BYV): qp_vertex(oi,v)
    vs=set(BYV)
    for oi,p in enumerate(PAR):
        free=np.array([v for v in range(p['K0'].shape[1]) if (oi,v) not in vs],int)
        K[oi][:,free,:]=Ku[oi][:,free,:]; X[oi][:,free,:]=world(p,K[oi][:,free,:]) if False else np.einsum('fnij,fnj->fni',p['A'][:,free],np.einsum('fk,kni->fni',p['B'],K[oi][:,free,:])+p['P'][:,free])+p['t'][:,free]
it=0
for lam in SCHED:
    set_lam(lam); log('== LAM',lam,'accel',[round(float(accel(X[oi]).max()),2) for oi in (0,1)])
    for sub in range(ITERS):
        t0=time.time(); nadd,ov,st=detect(); t1=time.time()
        acc=[round(float(accel(X[oi]).max()),2) for oi in (0,1)]
        log('IT',it,'lam',lam,'new',nadd,'cons',len(CONS),'overlaps',ov,'viol_mm',{k:round(v,3) for k,v in st.items()},'accel',acc,'detect',round(t1-t0,1),'s')
        hist.append({'it':it,'lam':lam,'overlaps':ov,'viol':st,'accel':acc,'ncons':len(CONS)}); it+=1
        if sum(ov.values())==0 and max(st.values())<0.05: break
        vs=sorted(BYV)
        for sweep in range(2):
            for (oi,v) in vs: qp_vertex(oi,v)
        disp=[float(np.linalg.norm(X[oi]-PAR[oi]['X0'],axis=2).max()*1000) for oi in (0,1)]
        log('  qp clamps',len(QPLOG),QPLOG[:5]); QPLOG.clear()
        log('  sweep',round(time.time()-t1,1),'s','max shift from orig mm',[round(d,1) for d in disp],'accel',[round(float(accel(X[oi]).max()),2) for oi in (0,1)])
        np.savez(out.replace('.npz','_wip.npz'),**{PAR[oi]['name']+'__'+k:K[oi][i] for oi in (0,1) for i,k in enumerate(PAR[oi]['knots'])})
fin={'iters':len(hist),'last':hist[-1],'accel_final':{PAR[oi]['name']:round(float(accel(X[oi]).max()),2) for oi in (0,1)},'accel_final_at':{PAR[oi]['name']:int(accel(X[oi]).max(1).argmax())+1 for oi in (0,1)},
     'per_frame_accel':{PAR[oi]['name']:[round(float(x),2) for x in accel(X[oi]).max(1)] for oi in (0,1)},
     'max_shift_from_orig_mm':{PAR[oi]['name']:round(float(np.linalg.norm(X[oi]-PAR[oi]['X0'],axis=2).max()*1000),2) for oi in (0,1)},'lam':LAM,
     'margins_mm':{'body':M_BODY*1e3,'torso':M_TORSO*1e3,'chair':M_CHAIR*1e3,'apron_dress_vertex':[M_AD_LO*1e3,M_AD_HI*1e3],'self_tri':M_SELF*1e3,'apron_dress_tri':M_ADT*1e3,'body_tri':M_BT*1e3},'hist':hist}
np.savez(out,**{PAR[oi]['name']+'__'+k:K[oi][i] for oi in (0,1) for i,k in enumerate(PAR[oi]['knots'])})
json.dump(fin,open(out.replace('.npz','.json'),'w'),indent=0,default=str); log('SOLVEDONE',json.dumps({k:v for k,v in fin.items() if k not in ('hist','per_frame_accel')},default=str))
