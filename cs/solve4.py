"""v3 cs step 2: constrained temporal smoothing of the pass2c per-frame cloth knots (dress + apron), bones untouched.
 K (free knots m1_cNN, rest space) ; R_f = sum_k B[f,k] K_k + P_f (sit_corrective / basis frames are fixed).
 Smooth(Kt) = argmin ||D2 R||^2 + lam ||K-Kt||^2  (closed form, same matrix for every vertex)
 loop: R=Smooth(K0+O) -> world X=A R+t -> project dress outside body(nobow)/real chair, then apron outside body/chair/dress (apron = outer layer,
       rest-pose side baseline) with margins -> world correction V -> rest A^-1 V -> O += relax*pinv(B) V ; until max violation < tol.
 final: hard projection of the residual (small) applied to the knots.
usage: blender -b --python solve.py -- <pre.npz> <out.npz> <tag> [lam] [iters]"""
import sys, time, json, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; pre,out,tag=a[:3]; LAM=float(a[3]) if len(a)>3 else 0.1; ITERS=int(a[4]) if len(a)>4 else 50
M_BODY=0.0020; M_TORSO=0.0014; M_CHAIR=0.0020; M_AD_LO=0.0016; M_AD_HI=0.0024; TOL=0.00005; RELAX=float(a[5]) if len(a)>5 else 0.6; OVER=0.0002
Z=np.load(pre,allow_pickle=True); OB=['G2_DRESS_R5G2','G2_APRON_R5G2']; NF=91
STATE=f'state_{tag}.npz'
def log(*x): print(*x,flush=True)
# ---- knot parametrisation
import ast
PAR={}
for on in OB:
    W=[ast.literal_eval(s) for s in Z[on+'_W']]
    knots=sorted({k for w in W for k in w if k!='sit_corrective'})
    B=np.zeros((NF,len(knots))); 
    basis=Z[on+'_basis']; R0=Z[on+'_R0']
    # recover absolute knot coords: at its one-hot frame R0 = K
    K0=np.zeros((len(knots),)+basis.shape)
    for f,w in enumerate(W):
        for k,v in w.items():
            if k!='sit_corrective': B[f,knots.index(k)]=v
        if len(w)==1 and list(w)[0]!='sit_corrective' and abs(list(w.values())[0]-1)<1e-6: K0[knots.index(list(w)[0])]=R0[f]
    P=R0-np.einsum('fk,kni->fni',B,K0)          # fixed part (basis / sit_corrective)
    PAR[on]=dict(knots=knots,B=B,K0=K0,P=P,A=Z[on+'_A'],t=Z[on+'_t'],X0=Z[on+'_X0'],T=Z[on+'_T'])
    log('KNOTS',on,len(knots),'fixed frames',[f for f in range(NF) if B[f].sum()==0])
    PAR[on]['Ainv']=np.linalg.inv(PAR[on]['A'])
D2=np.zeros((NF-2,NF)); 
for i in range(NF-2): D2[i,i:i+3]=[1,-2,1]
def smoother(B):
    G=B.T@D2.T@D2@B; Mi=np.linalg.inv(G+LAM*np.eye(B.shape[1])); return Mi, Mi@(B.T@D2.T@D2)
for on in OB: PAR[on]['Mi'],PAR[on]['MP']=smoother(PAR[on]['B']); PAR[on]['pinvB']=np.linalg.pinv(PAR[on]['B']); PAR[on]['gain']=np.diag(LAM*PAR[on]['Mi']).copy(); log('GAIN',on,np.round(PAR[on]['gain'].min(),3),np.round(PAR[on]['gain'].max(),3))
def smooth(on,Kt):
    p=PAR[on]; n=Kt.shape[1]
    K=LAM*np.einsum('jk,kni->jni',p['Mi'],Kt)-np.einsum('jf,fni->jni',p['MP'],p['P'])
    return K
def frames(on,K): p=PAR[on]; return np.einsum('fk,kni->fni',p['B'],K)+p['P']
def world(on,R): p=PAR[on]; return np.einsum('fnij,fnj->fni',p['A'],R)+p['t']
def accel(X): return np.linalg.norm(X[2:]-2*X[1:-1]+X[:-2],axis=2)*1000
# ---- static geometry
BX=Z['body_X'].astype(np.float64); BT=Z['body_T']; nob=Z['body_nobow_tris']; torso=set(Z['body_torso_tris'].tolist())
tri_ids=nob; is_torso=np.array([t in torso for t in tri_ids])
log('building body trees'); t0=time.time()
BTREE=[BVHTree.FromPolygons([Vector(p) for p in BX[f]],BT[tri_ids].tolist(),all_triangles=True) for f in range(NF)]
CTREE=BVHTree.FromPolygons([Vector(p) for p in Z['chair_X']],Z['chair_T'].tolist(),all_triangles=True); log('trees',round(time.time()-t0,1))
# dress boundary faces for the apron layer test
import collections
DT=PAR[OB[0]]['T']; cnt=collections.Counter()
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
# apron layer baseline at rest (same rule as checker.set_layer_baseline: within 20 mm of the dress)
dr=Z[OB[0]+'_rest']; ar=Z[OB[1]+'_rest']; DRT=BVHTree.FromPolygons([Vector(p) for p in dr],DT.tolist(),all_triangles=True)
S0=np.zeros(len(ar)); G0=np.zeros(len(ar))
for i in np.unique(PAR[OB[1]]['T'].ravel()):
    cp,n,fi,d=DRT.find_nearest(Vector(ar[i]),0.02)
    if cp is not None and d>1e-5: S0[i]=np.sign((Vector(ar[i])-cp).dot(n)); G0[i]=d
REQ_AD=np.clip(G0,M_AD_LO,M_AD_HI); log('apron baseline verts',int((S0!=0).sum()),'outer(+)',int((S0>0).sum()),'rest gap p5/p50',np.percentile(G0[S0!=0],[5,50])*1000)
# ---- projection
def sdist(X,tree):
    S=np.full(len(X),9.0)
    for i in range(len(X)):
        cp,n,fi,d=tree.find_nearest(Vector(X[i]),0.06)
        if cp is not None: S[i]=(Vector(X[i])-cp).dot(n)
    return S
def proj_solid(X,Xref,tree,req_of_face,stats,name,Sref=None):
    """v2 (robust to the overlapping leg/torso shells): Xref = original pass2c position at this frame (clean per the tri-tri checker).
    crossing: the segment Xref->X hits the surface -> X went through it -> put it back on the clean side at the first hit + margin.
    margin: no crossing, nearest face within req and X on that face's outer side -> push out to req. (X on the inner side of the nearest
    face without any crossing = it was already there in the clean original = shell-overlap artefact, left alone.)"""
    V=np.zeros_like(X); worst=0.0; NRM=np.zeros_like(X); proj_solid.N=NRM
    for i in range(len(X)):
        p=Vector(X[i]); r=Vector(Xref[i]); dv=p-r; L=dv.length; q=None
        if L>1e-7:
            hit,hn,hf,hd=tree.ray_cast(r,dv/L,L)
            if hit is not None:
                hn=hn if hn.dot(-dv)>0 else -hn; req=req_of_face(hf); q=hit+hn*(req+OVER); viol=req+(p-hit).length; NN=hn
        if q is None:
            cp,n,fi,d=tree.find_nearest(p,0.01)
            if cp is None: continue
            req=req_of_face(fi); s=(p-cp).dot(n)
            if s<0 or s>=req: continue
            q=cp+n*(req+OVER); viol=req-s; NN=n
        V[i]=np.array(q)-X[i]; NRM[i]=np.array(NN)
        if viol>worst: worst=viol; stats[name+'_who']=(int(i),round(viol*1000,2))
    stats[name]=round(worst*1000,3); return V
def proj_layer(Xa,Xd,dtree,stats,Sref=None):
    V=np.zeros_like(Xa); worst=0.0; nb=0; NRM=np.zeros_like(Xa); proj_layer.N=NRM
    for i in np.where(S0!=0)[0]:
        p=Vector(Xa[i]); cp,n,fi,d=dtree.find_nearest(p,0.03)
        if cp is None or on_bnd(Xd,fi,np.array(cp)): continue
        s=S0[i]*(p-cp).dot(n)
        req=REQ_AD[i]
        if Sref is not None and Sref[i]< -0.005: req=min(req,Sref[i]-0.0002)   # deep sign flip already in the clean original = fold/nearest artefact
        if s>=req: continue
        q=cp+n*(S0[i]*(req+OVER)); V[i]=np.array(q)-Xa[i]; nb+=1; NRM[i]=np.array(n)*S0[i]
        if req-s>worst: worst=req-s; stats['apron_x_dress_who']=(int(i),round(float(s)*1000,2))
    stats['apron_x_dress']=round(worst*1000,3); stats['apron_x_dress_n']=nb; return V
CAND={}
def project(Xd,Xa,only=None):
    """returns world corrections Vd,Va (NF,n,3) and per-frame stats"""
    Vd=np.zeros_like(Xd); Va=np.zeros_like(Xa); ST=[]
    for f in range(NF):
        st={}
        ft=lambda fi: M_TORSO if is_torso[fi] else M_BODY
        cd=CAND['d'][f]; ca=CAND['a'][f]
        Vd[f][cd]=proj_solid(Xd[f][cd],PAR[OB[0]]['X0'][f][cd],BTREE[f],ft,st,'dress_x_body',SREF['db'][f])
        Xd2=Xd[f]+Vd[f]
        Vd[f][cd]+=proj_solid(Xd2[cd],PAR[OB[0]]['X0'][f][cd],CTREE,lambda fi:M_CHAIR,st,'dress_x_chair',SREF['dc'][f]); Xd2=Xd[f]+Vd[f]
        va=np.zeros_like(Xa[f])
        va[ca]=proj_solid(Xa[f][ca],PAR[OB[1]]['X0'][f][ca],BTREE[f],ft,st,'apron_x_body',SREF['ab'][f])
        va[ca]+=proj_solid((Xa[f]+va)[ca],PAR[OB[1]]['X0'][f][ca],CTREE,lambda fi:M_CHAIR,st,'apron_x_chair',SREF['ac'][f])
        dtree=BVHTree.FromPolygons([Vector(p) for p in Xd2],DT.tolist(),all_triangles=True)
        va+=proj_layer(Xa[f]+va,Xd2,dtree,st,SLAY[f]); Va[f]=va; ST.append(st)
    return Vd,Va,ST
def to_knots(on,V,g=False):
    p=PAR[on]; Vr=np.einsum('fnij,fnj->fni',p['Ainv'],V); Kc=np.einsum('kf,fni->kni',p['pinvB'],Vr)
    return Kc/p['gain'][:,None,None] if g else Kc
# candidates: within 60 mm of body / chair at the original or the plain-smoothed state
K={on:smooth(on,PAR[on]['K0']) for on in OB}; X={on:world(on,frames(on,K[on])) for on in OB}
ACC0={on:accel(PAR[on]['X0']).max() for on in OB}; ACCs={on:accel(X[on]).max() for on in OB}
log('ACCEL orig',{o[3:8]:round(v,2) for o,v in ACC0.items()},'plain-smoothed lam',LAM,{o[3:8]:round(v,2) for o,v in ACCs.items()})
for key,on in (('d',OB[0]),('a',OB[1])):
    CAND[key]=[]
    for f in range(NF):
        c=[]
        for i in range(len(X[on][f])):
            for Y in (X[on][f][i],PAR[on]['X0'][f][i]):
                if BTREE[f].find_nearest(Vector(Y),0.06)[0] is not None or CTREE.find_nearest(Vector(Y),0.06)[0] is not None: c.append(i); break
        CAND[key].append(np.array(c,int))
SREF={'db':[],'dc':[],'ab':[],'ac':[]}
for f in range(NF):
    for k,on,c in (('d',OB[0],CAND['d'][f]),('a',OB[1],CAND['a'][f])):
        SREF[k+'b'].append(sdist(PAR[on]['X0'][f][c],BTREE[f])); SREF[k+'c'].append(sdist(PAR[on]['X0'][f][c],CTREE))
SLAY=[]
for f in range(NF):
    Xd0=PAR[OB[0]]['X0'][f]; t_=BVHTree.FromPolygons([Vector(p) for p in Xd0],DT.tolist(),all_triangles=True); sl=np.full(len(S0),9.0)
    for i in np.where(S0!=0)[0]:
        cp,n,fi,d=t_.find_nearest(Vector(PAR[OB[1]]['X0'][f][i]),0.03)
        if cp is not None and not on_bnd(Xd0,fi,np.array(cp)): sl[i]=S0[i]*(Vector(PAR[OB[1]]['X0'][f][i])-cp).dot(n)
    SLAY.append(sl)
log('orig layer flips >5mm (left as artefact):',int(sum((x<-0.005).sum() for x in SLAY)),' 0.5-5mm (fixed):',int(sum(((x<-0.0005)&(x>=-0.005)).sum() for x in SLAY)))
log('artefact refs (orig < -0.5 mm) dress-body/chair apron-body/chair:',[int(sum((x<-0.0005).sum() for x in SREF[k])) for k in ('db','dc','ab','ac')])
log('candidates dress/apron mean',np.mean([len(c) for c in CAND['d']]),np.mean([len(c) for c in CAND['a']]))
if tag=='diag':
    for lab,XX in (('ORIG',{on:PAR[on]['X0'] for on in OB}),('SMOOTH',X)):
        _,_,ST=project(XX[OB[0]],XX[OB[1]])
        for f,st in enumerate(ST):
            if any(v>0.5 for k,v in st.items() if not k.endswith(('_n','_who'))): log(lab,f,st)
    sys.exit(0)

# ================= v3 per-vertex QP =================
# min ||D2 R_v||^2 + lam||K_v-K0_v||^2  s.t. n.(X_v,f) >= b  for every accumulated contact (v,f,kind); dual active set per vertex.
CON={on:{} for on in OB}   # (v,f,kind) -> (n, b)
FREE=[f for f in range(NF) if PAR[OB[0]]['B'][f].sum()>0]
def add_cons(on,f,idx,V,N,X,kind):
    k=0
    for j,i in enumerate(idx):
        if N[j].any():
            q=X[i]+V[j]; n=N[j]/np.linalg.norm(N[j]); b=float(n@q); L=CON[on].setdefault((int(i),f,kind),[])
            for m,(n2,b2) in enumerate(L):
                if n2@n>0.995: L[m]=(n2,max(b2,b)); break
            else: L.append((n,b))
            k+=1
    return k
def qp_vertex(on,v,Ku):
    p=PAR[on]; rows=[(f,n,b) for (vv,f,kd),L in CON_BY_V[on].get(v,[]) for (n,b) in L]
    if not rows: return Ku
    Mi=p['MiL'][LEVEL[on][v]]; B=p['B']
    F=np.array([r[0] for r in rows]); Nn=np.array([r[1] for r in rows]); bb=np.array([r[2] for r in rows])
    Av=p['A'][F,v]                      # (m,3,3)
    a=np.einsum('mji,mj->mi',Av,Nn)    # A^T n
    Bf=B[F]                             # (m,nk)
    MiB=Bf@Mi                           # (m,nk)
    Q=(MiB@Bf.T)*(a@a.T); Q=Q+1e-3*np.median(np.diag(Q))*np.eye(len(Q))
    off=np.einsum('mi,mi->m',Nn,np.einsum('mij,mj->mi',Av,p['P'][F,v])+p['t'][F,v])
    GK=np.einsum('mk,mi,ki->m',Bf,a,Ku)
    r=bb-off-GK                         # required increase
    mu=np.zeros(len(rows)); act=r>0
    for _ in range(60):
        mu[:]=0
        if act.any():
            ia=np.where(act)[0]; Qa=Q[np.ix_(ia,ia)]+1e-12*np.eye(len(ia))
            sol=np.linalg.lstsq(Qa,r[ia],rcond=None)[0]
            neg=sol<0
            if neg.any(): act[ia[np.argmin(sol)]]=False; continue
            mu[ia]=sol
        w=Q@mu-r
        bad=(~act)&(w<-1e-7)
        if not bad.any(): break
        act[np.argmin(np.where(~act,w,np.inf))]=True
    dK=np.einsum('m,mk,mi->ki',mu,MiB,a)
    if not np.isfinite(dK).all() or np.abs(dK).max()>0.03: dK=np.clip(np.nan_to_num(dK),-0.03,0.03); CLAMPS.append((on[3:8],v))
    return Ku+dK
LV=[0.05,0.1,0.2,0.4,0.8,1.6,3.2,6.4,12.8,25.6,100.0,1000.0]
for on in OB:
    p=PAR[on]; G=p['B'].T@D2.T@D2@p['B']
    p['MiL']=[np.linalg.inv(G+l*np.eye(G.shape[0])) for l in LV]; p['MPL']=[Mi_@(p['B'].T@D2.T@D2) for Mi_ in p['MiL']]
LEVEL={on:np.zeros(PAR[on]['K0'].shape[1],int) for on in OB}
def ku_all(on):
    p=PAR[on]; Kx=np.empty_like(p['K0'])
    for L in np.unique(LEVEL[on]):
        m=LEVEL[on]==L; Kx[:,m]=LV[L]*np.einsum('jk,kni->jni',p['MiL'][L],p['K0'][:,m])-np.einsum('jf,fni->jni',p['MPL'][L],p['P'][:,m])
    return Kx
Ku={on:ku_all(on) for on in OB}; K={on:Ku[on].copy() for on in OB}
CON_BY_V={on:{} for on in OB}
def solve_obj(on):
    CON_BY_V[on]={}
    for key,L in CON[on].items(): CON_BY_V[on].setdefault(key[0],[]).append((key,L))
    vs=sorted(CON_BY_V[on])
    for v in vs: K[on][:,v,:]=qp_vertex(on,v,Ku[on][:,v,:])
    return len(vs)
hist=[]
def stage(names,maxit):
    for it in range(maxit):
        t0=time.time(); X={on:world(on,frames(on,K[on])) for on in OB}; nnew=0; worst={}
        for f in FREE:
            st={}; ft=lambda fi: M_TORSO if is_torso[fi] else M_BODY
            cd=CAND['d'][f]; ca=CAND['a'][f]
            if 'dress' in names:
                Xd=X[OB[0]][f]
                V=proj_solid(Xd[cd],PAR[OB[0]]['X0'][f][cd],BTREE[f],ft,st,'dress_x_body',None); nnew+=add_cons(OB[0],f,cd,V,proj_solid.N,Xd,'b')
                V=proj_solid(Xd[cd],PAR[OB[0]]['X0'][f][cd],CTREE,lambda fi:M_CHAIR,st,'dress_x_chair',None); nnew+=add_cons(OB[0],f,cd,V,proj_solid.N,Xd,'c')
            if 'apron' in names:
                Xa=X[OB[1]][f]; Xd=X[OB[0]][f]
                V=proj_solid(Xa[ca],PAR[OB[1]]['X0'][f][ca],BTREE[f],ft,st,'apron_x_body',None); nnew+=add_cons(OB[1],f,ca,V,proj_solid.N,Xa,'b')
                V=proj_solid(Xa[ca],PAR[OB[1]]['X0'][f][ca],CTREE,lambda fi:M_CHAIR,st,'apron_x_chair',None); nnew+=add_cons(OB[1],f,ca,V,proj_solid.N,Xa,'c')
                dtree=BVHTree.FromPolygons([Vector(p) for p in Xd],DT.tolist(),all_triangles=True)
                V=proj_layer(Xa,Xd,dtree,st,SLAY[f]); allv=np.arange(len(Xa)); nnew+=add_cons(OB[1],f,allv,V,proj_layer.N,Xa,'l')
            for k,v in st.items():
                if not k.endswith(('_n','_who')) and v>worst.get(k,(0,))[0]: worst[k]=(v,f,st.get(k+'_who'))
        mv=max([w[0] for w in worst.values()]+[0])
        acc={o[3:8]:round(float(accel(X[o]).max()),2) for o in OB}
        log('STAGE',names,'it',it,'maxviol_mm',round(mv,3),'cons',{o[3:8]:sum(len(L) for L in CON[o].values()) for o in OB},'worst',worst,'accel',acc,round(time.time()-t0,1),'s')
        hist.append({'stage':names,'it':it,'maxviol_mm':mv,'worst':{k:list(map(str,v)) for k,v in worst.items()},'accel':acc})
        if mv<0.05: return True
        t1=time.time()
        for on in ([OB[0]] if names==('dress',) else [OB[1]] if names==('apron',) else OB): solve_obj(on)
        log('  qp',round(time.time()-t1,1),'s')
    return False

def vnormals(Xf,T):
    fn=np.cross(Xf[T[:,1]]-Xf[T[:,0]],Xf[T[:,2]]-Xf[T[:,0]]); vn=np.zeros_like(Xf)
    for k in range(3): np.add.at(vn,T[:,k],fn)
    return vn/np.maximum(np.linalg.norm(vn,axis=1,keepdims=True),1e-12)
AT=PAR[OB[1]]['T']; NV={OB[0]:len(PAR[OB[0]]['K0'][0]),OB[1]:len(PAR[OB[1]]['K0'][0])}
def shells(Xf,T):
    vn=vnormals(Xf,T); co=np.vstack([Xf+vn*0.0004,Xf-vn*0.0004]); n=len(Xf); t=np.vstack([T,T+n])
    return BVHTree.FromPolygons([Vector(q) for q in co],t.tolist(),all_triangles=True),t,n
BFULL=[BVHTree.FromPolygons([Vector(q) for q in Z['body_X'][f].astype(float)],Z['body_T'].tolist(),all_triangles=True) for f in range(NF)]
def tree(Xf,T): return BVHTree.FromPolygons([Vector(q) for q in Xf],T.tolist(),all_triangles=True)
def crossings(XX):
    """tri crossings per frame (midsurface self; 0.8 mm shells for apron x dress and garment x body/chair) -> vertex sets, counts"""
    hit={OB[0]:set(),OB[1]:set()}; cnt=collections.Counter(); perf=collections.Counter()
    for f in FREE:
        Xd=XX[OB[0]][f]; Xa=XX[OB[1]][f]
        for kind,(on,Xo,T) in (('sd',(OB[0],Xd,DT)),('sa',(OB[1],Xa,AT))):
            tr=tree(Xo,T); pr=[(i,j) for i,j in tr.overlap(tr) if i<j and not (set(T[i])&set(T[j])) and (i,j) not in ORIG[(kind,f)]]
            cnt[kind]+=len(pr); perf[f]+=len(pr)
            for i,j in pr: hit[on].update(T[i].tolist()); hit[on].update(T[j].tolist())
        sd_,tdd,nd=shells(Xd,DT); sa_,taa,na=shells(Xa,AT)
        for kind,A_,tA,nA,onA,B_,tB,nB,onB in (('ad',sa_,taa,na,OB[1],sd_,tdd,nd,OB[0]),('db',sd_,tdd,nd,OB[0],BFULL[f],None,0,None),('ab',sa_,taa,na,OB[1],BFULL[f],None,0,None),
                                              ('dc',sd_,tdd,nd,OB[0],CTREE,None,0,None),('ac',sa_,taa,na,OB[1],CTREE,None,0,None)):
            pr=[pq for pq in A_.overlap(B_) if (pq[0]%len(tA)//1 if False else pq) not in ORIG[(kind,f)]]
            cnt[kind]+=len(pr); perf[f]+=len(pr)
            for i,j in pr:
                hit[onA].update((tA[i]%nA).tolist())
                if onB: hit[onB].update((tB[j]%nB).tolist())
    return hit,dict(cnt),perf
ORIG={}
for f in FREE:
    Xd=PAR[OB[0]]['X0'][f]; Xa=PAR[OB[1]]['X0'][f]
    for kind,(Xo,T) in (('sd',(Xd,DT)),('sa',(Xa,AT))):
        tr=tree(Xo,T); ORIG[(kind,f)]=set(tr.overlap(tr))
    sd_,_,_=shells(Xd,DT); sa_,_,_=shells(Xa,AT)
    for kind,A_,B_ in (('ad',sa_,sd_),('db',sd_,BFULL[f]),('ab',sa_,BFULL[f]),('dc',sd_,CTREE),('ac',sa_,CTREE)): ORIG[(kind,f)]=set(A_.overlap(B_))
log('ORIG overlaps excluded',{k:sum(len(v) for (kk,f),v in ORIG.items() if kk==k) for k in ('sd','sa','ad','db','ab','dc','ac')})
ADJ={on:[set() for _ in range(NV[on])] for on in OB}
for on,T in ((OB[0],DT),(OB[1],AT)):
    for t_ in T:
        for i in t_: ADJ[on][i].update(t_.tolist())
ok=[]; rounds=[]; CLAMPS=[]
for rnd in range(40):
    ok1=stage(('dress',),ITERS); ok2=stage(('apron',),ITERS); ok.append((ok1,ok2))
    XX={on:world(on,frames(on,K[on])) for on in OB}
    hit,cnt,perf=crossings(XX)
    acc={o[3:8]:round(float(accel(XX[o]).max()),2) for o in OB}
    log('ROUND',rnd,'crossings',cnt,'raised',{o[3:8]:len(hit[o]) for o in OB},'levels>0',{o[3:8]:int((LEVEL[o]>0).sum()) for o in OB},'clamps',len(CLAMPS),'accel',acc)
    rounds.append({'round':rnd,'crossings':cnt,'n_hit':{o:len(hit[o]) for o in OB},'accel':acc,'unary_ok':[ok1,ok2]})
    np.savez(out.replace('.npz','_wip.npz'),**{on+'__'+k:K[on][i] for on in OB for i,k in enumerate(PAR[on]['knots'])})
    np.savez(out.replace('.npz','_levels.npz'),**LEVEL)
    CLAMPS.clear()
    if sum(cnt.values())==0: break
    for on in OB:
        h=np.array(sorted(hit[on]),int); ring=set(h.tolist())
        for i in h: ring.update(ADJ[on][i])
        r=np.array(sorted(ring),int); LEVEL[on][r]=np.minimum(LEVEL[on][r]+1,len(LV)-1)
        # keep the strength field smooth: neighbours differ by <= 1 level
        for _ in range(3):
            nb=np.array([max(LEVEL[on][list(ADJ[on][i])]) for i in range(NV[on])]); LEVEL[on]=np.maximum(LEVEL[on],nb-1)
        Ku[on]=ku_all(on); K[on]=Ku[on].copy(); CON[on].clear()   # fresh contact planes every round (stale layer planes conflict)
X={on:world(on,frames(on,K[on])) for on in OB}
fin={'rounds':rounds,'unary_ok':ok[-1],'accel_final':{o:round(float(accel(X[o]).max()),2) for o in OB},'accel_final_at':{o:int(accel(X[o]).max(1).argmax())+1 for o in OB},
     'accel_orig':{o:round(float(v),2) for o,v in ACC0.items()},'per_frame_accel':{o:[round(float(x),2) for x in accel(X[o]).max(1)] for o in OB},
     'max_shift_from_orig_mm':{o:round(float(np.linalg.norm(X[o]-PAR[o]['X0'],axis=2).max()*1000),2) for o in OB},'n_constraints':{o:len(CON[o]) for o in OB},
     'level_hist':{o:np.bincount(LEVEL[o],minlength=len(LV)).tolist() for o in OB},'levels_lam':LV,
     'margins_mm':[M_BODY*1e3,M_TORSO*1e3,M_CHAIR*1e3,M_AD_LO*1e3,M_AD_HI*1e3],'hist':hist}
np.savez(out,**{on+'__'+k:K[on][i] for on in OB for i,k in enumerate(PAR[on]['knots'])})
json.dump(fin,open(out.replace('.npz','.json'),'w'),indent=0,default=str); log('SOLVEDONE',json.dumps({k:v for k,v in fin.items() if k not in ('hist','per_frame_accel','rounds')},default=str))
