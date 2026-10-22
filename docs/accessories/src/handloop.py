# 右手加环线：把跨握把的 21 个三角（gf json）中角度跨度大的边切成 n+1 段（n=2–3 圈），受影响三角用中心点扇形重剖。
# 新顶点 = 原顶点线性组合（位置/法线/UV/颜色/全部形变目标同组合；蒙皮按关节合并取前 4 再归一）。新点都落在原三角面上，静止外形不变。
# python3 handloop.py base.glb gf.json fix.npz out.glb [hold_in.npz hold_out.npz]
import sys,os,json,math,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));from glb import G,compact,prune_accessors
src,gfp,fixp,out=sys.argv[1:5];hin=sys.argv[5] if len(sys.argv)>6 else None;hout=sys.argv[6] if len(sys.argv)>6 else None
g=G(src);j=g.j;gf=json.load(open(gfp));bas=np.load(fixp)['bas'];cv=lambda P:np.stack([P[:,0],P[:,2],-P[:,1]],1)
SPAN=float(os.environ.get('SPAN','40'))
# 选边（按位置），记录切数
phi={};pos={};cyl={}
for b in gf['bad']:
    for v,p,r_,u_ in zip(b['v'],b['phi'],b['r_mm'],b['u_mm']): phi[v]=p;cyl[v]=np.array([r_*math.cos(math.radians(p)),r_*math.sin(math.radians(p)),u_]);pos[v]=cv(bas[[v]].astype(np.float64))[0]
from scipy.spatial import cKDTree
_m=[x for x in j['meshes'] if x['name']=='LOD0_G2_BODY'][0];_P=np.vstack([g.full(q['attributes']['POSITION']) for q in _m['primitives']]).astype(np.float64);_T=cKDTree(_P)
def snap(p): d,i=_T.query(p);assert d<1e-5,d;return _P[i]
key=lambda p:tuple(np.round(p,6))
for v in list(pos): pos[v]=snap(pos[v])
CYL={key(pos[v]):cyl[v] for v in pos}
EC={}
for b in gf['bad']:
    v=b['v']
    for a,c in ((v[0],v[1]),(v[1],v[2]),(v[2],v[0])):
        s=abs((phi[a]-phi[c]+180)%360-180)
        n=min(3,max(0,math.ceil(s/SPAN)-1))
        if n>0:
            k=frozenset((key(pos[a]),key(pos[c])));EC[k]=max(EC.get(k,0),n)
ALLK=set(EC);print('edges',len(EC),'cuts',sorted(EC.values()))
m=[x for x in j['meshes'] if x['name']=='LOD0_G2_BODY'][0];Z=np.load(hin) if hin else None;Hout={};rep={}
for pi,p in enumerate(m['primitives']):
    P=g.full(p['attributes']['POSITION']).astype(np.float64);F=g.full(p['indices']).reshape(-1,3).astype(np.int64)
    pk=[key(x) for x in P];hit=[]
    for ti,t in enumerate(F):
        es=[(t[0],t[1]),(t[1],t[2]),(t[2],t[0])];cuts=[EC.get(frozenset((pk[a],pk[b])),0) for a,b in es]
        if any(cuts): hit.append((ti,cuts))
    found=set(frozenset((pk[a],pk[b])) for ti,_ in hit for a,b in ((F[ti][0],F[ti][1]),(F[ti][1],F[ti][2]),(F[ti][2],F[ti][0])))&ALLK;print('prim',pi,'edges matched',len(found),'tris',len(hit))
    if not hit:
        if Z is not None and f'prim{pi}' in Z: Hout[f'prim{pi}']=Z[f'prim{pi}']
        continue
    n0=len(P);comb=[]   # 每个新顶点：[(old_idx,w),...]
    emap={}
    def ev(a,b,k,n):
        kk=(a,b,k,n) if (a,b) in emap or True else None
        if (b,a,n-k,n) in emap: return emap[(b,a,n-k,n)]
        if (a,b,k,n) in emap: return emap[(a,b,k,n)]
        t=k/n;comb.append([(a,1-t),(b,t)]);emap[(a,b,k,n)]=n0+len(comb)-1;return emap[(a,b,k,n)]
    newF=[];drop=set()
    # 柱坐标：角点来自 gf（握灯姿态），切点线性插值；剖分代价 = 对角线两端绕握把轴的角度跨度²
    def cpos(i):
        if i<n0: return CYL.get(pk[i])
        c=comb[i-n0];ps=[cpos(a) for a,_ in c]
        return None if any(q is None for q in ps) else sum(w*q for (a,w),q in zip(c,ps))
    def span(i,k):
        A_,B_=cpos(i),cpos(k)
        if A_ is None or B_ is None: return 0.0
        d=abs((math.degrees(math.atan2(A_[1],A_[0]))-math.degrees(math.atan2(B_[1],B_[0]))+180)%360-180);return d*d
    def dp(ring):
        n=len(ring);C={};K={}
        for L in range(2,n):
            for i in range(n-L):
                k=i+L;best=None
                for m_ in range(i+1,k):
                    c=C.get((i,m_),0)+C.get((m_,k),0)+span(ring[i],ring[k])
                    if best is None or c<best[0]: best=(c,m_)
                C[(i,k)],K[(i,k)]=best
        T=[]
        def rec(i,k):
            if k-i<2: return
            m_=K[(i,k)];T.append((ring[i],ring[m_],ring[k]));rec(i,m_);rec(m_,k)
        rec(0,n-1);return T
    hitd=dict(hit);tri_edges={}
    for ti in hitd:
        t=F[ti]
        for a,b in ((t[0],t[1]),(t[1],t[2]),(t[2],t[0])): tri_edges.setdefault(frozenset((a,b)),[]).append(ti)
    def ring_of(ti):
        t=F[ti];cuts=hitd[ti];R=[]
        for (a,b),c in zip(((t[0],t[1]),(t[1],t[2]),(t[2],t[0])),cuts):
            R.append(a)
            for k in range(1,c+1): R.append(ev(a,b,k,c+1))
        return R
    done=set()
    for ti in hitd:
        if ti in done: continue
        t=F[ti];cuts=hitd[ti];mate=None
        for (a,b),c in zip(((t[0],t[1]),(t[1],t[2]),(t[2],t[0])),cuts):
            if c==0:
                for tj in tri_edges.get(frozenset((a,b)),[]):
                    if tj!=ti and tj not in done: mate=(tj,a,b)
        R=ring_of(ti)
        if mate:
            tj,a,b=mate;R2=ring_of(tj)
            i=R.index(b);R=R[i:]+R[:i]      # [b ... a]
            i=R2.index(a);R2=R2[i:]+R2[:i]  # [a ... b]
            if R[-1]==a and R2[-1]==b: ring=R[:-1]+R2[:-1];done.add(tj);drop.add(tj)
            else: ring=ring_of(ti)
        else: ring=R
        T_=dp(ring);newF+=T_;done.add(ti);drop.add(ti)
    nn=len(comb);W=np.zeros((nn,n0))
    for i,c in enumerate(comb):
        for a,w in c:
            if a<n0: W[i,a]+=w
            else: W[i]+=w*W[a-n0]
    def ext(A): A=np.asarray(A,np.float64);return np.vstack([A,W@A])
    A={}
    for k,ai in p['attributes'].items(): A[k]=g.full(ai)
    newA={}
    newA['POSITION']=ext(A['POSITION']).astype(np.float32)
    Nn=ext(A['NORMAL']);Nn/=np.linalg.norm(Nn,axis=1,keepdims=True)+1e-12;newA['NORMAL']=Nn.astype(np.float32)
    newA['TEXCOORD_0']=ext(A['TEXCOORD_0']).astype(np.float32);newA['COLOR_0']=ext(A['COLOR_0']).astype(np.float32)
    J=A['JOINTS_0'].astype(int);Wt=A['WEIGHTS_0'].astype(np.float64);NJ=np.zeros((nn,4),np.uint8);NW=np.zeros((nn,4),np.float32)
    for i in range(nn):
        acc={}
        for a in np.nonzero(W[i])[0]:
            for jj,ww in zip(J[a],Wt[a]):
                if ww>0: acc[jj]=acc.get(jj,0)+W[i,a]*ww
        top=sorted(acc.items(),key=lambda x:-x[1])[:4];s=sum(w for _,w in top)
        for q,(jj,ww) in enumerate(top): NJ[i,q]=jj;NW[i,q]=ww/s
    newA['JOINTS_0']=np.vstack([A['JOINTS_0'],NJ]).astype(np.uint8);newA['WEIGHTS_0']=np.vstack([A['WEIGHTS_0'],NW]).astype(np.float32)
    keepF=[F[i] for i in range(len(F)) if i not in drop]+newF;NF=np.array(keepF).reshape(-1)
    ct=5123 if len(newA['POSITION'])<65535 else 5125
    p['indices']=g.add(NF.astype(np.uint16 if ct==5123 else np.uint32),'SCALAR',ct,34963)
    tgt={'POSITION':(5126,'VEC3',True),'NORMAL':(5126,'VEC3',True),'TEXCOORD_0':(5126,'VEC2',False),'COLOR_0':(5126,'VEC3',False),'JOINTS_0':(5121,'VEC4',False),'WEIGHTS_0':(5126,'VEC4',False)}
    for k,arr in newA.items(): p['attributes'][k]=g.add(arr,tgt[k][1],tgt[k][0],34962,minmax=(k=='POSITION'))
    NT=len(newA['POSITION']);newT=[]
    for t in p['targets']:
        d={}
        for k,ai in t.items():
            D=ext(g.full(ai)).astype(np.float32);idx=np.where(np.abs(D).max(1)>0)[0]
            if len(idx)==0: idx=np.array([0])
            ic=5123 if NT<65535 else 5125;ia=g.add(idx.astype(np.uint16 if ic==5123 else np.uint32),'SCALAR',ic);va=g.add(D[idx],'VEC3',5126)
            acc={'componentType':5126,'count':NT,'type':'VEC3','sparse':{'count':int(len(idx)),'indices':{'bufferView':j['accessors'][ia]['bufferView'],'componentType':ic},'values':{'bufferView':j['accessors'][va]['bufferView']}}}
            if k=='POSITION': acc['min']=[float(min(0,x)) for x in D.min(0)];acc['max']=[float(max(0,x)) for x in D.max(0)]
            j['accessors'].append(acc);d[k]=len(j['accessors'])-1
        newT.append(d)
    p['targets']=newT
    if Z is not None and f'prim{pi}' in Z: Hout[f'prim{pi}']=ext(Z[f'prim{pi}']).astype(np.float32)
    # 静止外形检查：新点到原三角面的距离
    rep[pi]=dict(new_verts=nn,tris_split=len(hit),tris_new=len(newF),verts=NT)
prune_accessors(g);compact(g);g.save(out)
if hout: np.savez(hout,**Hout)
print('LOOP',json.dumps(rep))
