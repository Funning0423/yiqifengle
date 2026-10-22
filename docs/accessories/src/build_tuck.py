# lantern_tuck_R：DRESS + APRON 新增形态键（她的右侧 = -X = hand.L 侧内收）。PBD 保边长求解，围裙用同一位移场转移并保 8mm 层距。
# python3 build_tuck.py base.glb out.glb   环境：TUCK（内收量 m，默认 0.025）
import sys,os,json,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from glb import G
from scipy.spatial import cKDTree
A=float(os.environ.get('TUCK','0.025'));Y0,Y1,YP=float(os.environ.get('TY0','0.50')),float(os.environ.get('TY1','1.00')),float(os.environ.get('TYP','0.76'))
base,out=sys.argv[1:3];g=G(base);j=g.j
def mesh(n):
    m=[x for x in j['meshes'] if x['name']==n][0];p=m['primitives'][0]
    return m,p,g.full(p['attributes']['POSITION']).astype(np.float64),g.full(p['indices']).reshape(-1,3),g.full(p['attributes']['NORMAL']).astype(np.float64)
def weld(P):
    k=np.round(P/1e-5).astype(np.int64);_,u,inv=np.unique(k,axis=0,return_index=True,return_inverse=True);return u,inv.reshape(-1)
def edges(F):
    E=np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]);E=np.sort(E,1);return np.unique(E,axis=0)
def ss(t): t=np.clip(t,0,1);return t*t*(3-2*t)
def band(y): return np.where(y<YP,ss((y-Y0)/(YP-Y0)),ss((Y1-y)/(Y1-YP)))
XR0,XR1=float(os.environ.get('XR0','0.02')),float(os.environ.get('XR1','0.17'))
def target(P): return A*band(P[:,1])*ss((-P[:,0]-XR0)/(XR1-XR0))
mD,pD,PD,FD,ND=mesh('LOD0_G2_DRESS');mA,pA,PA,FA,NA=mesh('LOD0_G2_APRON')
def solve(P,F,it=int(os.environ.get('IT','2500')),gd=None):
    u,inv=weld(P);Q=P[u].copy();Fi=inv[F];E=edges(Fi);L0=np.linalg.norm(Q[E[:,0]]-Q[E[:,1]],axis=1);ok=L0>1e-5;E=E[ok];L0=L0[ok]
    if gd is None: tx=target(Q);goal=Q.copy();goal[:,0]+=tx
    else: gq=gd[u];tx=np.linalg.norm(gq,axis=1);goal=Q+gq
    PINMODE=os.environ.get('PIN','waist')
    pin=(Q[:,1]>Y1) if PINMODE=='waist' else ((Q[:,1]>Y1)|(Q[:,1]<Y0-0.02)|(Q[:,0]>0.0))
    GW=float(os.environ.get('GW','0.3'))
    act=tx>A*0.25
    X=Q.copy()
    for k in range(it):
        d=X[E[:,1]]-X[E[:,0]];l=np.linalg.norm(d,axis=1)+1e-12;c=((l-L0)/l)[:,None]*d*0.5
        D=np.zeros_like(X);n=np.zeros(len(X))
        we=(1.0/L0)[:,None] if os.environ.get('WE','1')=='1' else np.ones((len(L0),1))
        np.add.at(D,E[:,0],c*we);np.add.at(D,E[:,1],-c*we);np.add.at(n,E[:,0],we[:,0]);np.add.at(n,E[:,1],we[:,0])
        X+=0.9*D/np.maximum(n,1)[:,None]
        X[pin]=Q[pin]
        X[act]=(1-GW)*X[act]+GW*goal[act] if gd is not None else X[act]
        if gd is None: X[act,0]=(1-GW)*X[act,0]+GW*goal[act,0]   # 软约束：内收量
    s=np.abs(np.linalg.norm(X[E[:,0]]-X[E[:,1]],axis=1)/L0-1);return (X-Q)[inv],float(s.max()),tx[inv]
dD,sD,txD=solve(PD,FD)
# 围裙：取最近 4 个裙顶点位移（IDW）
tr=cKDTree(PD);dd,ii=tr.query(PA,4);w=1/(dd+1e-4);w/=w.sum(1,keepdims=True);dA0=(dD[ii]*w[:,:,None]).sum(1);dA,sA,_=solve(PA,FA,gd=dA0)
# 层距：围裙顶点到裙面（最近顶点近似）距离，前后对比
def gap(PA_,PD_):
    t=cKDTree(PD_);return t.query(PA_)[0]
g0=gap(PA,PD);g1=gap(PA+dA,PD+dD)
# 修层距：若某围裙顶点层距变小>0.5mm，沿原法线外推补回
lo=(g0-g1)>0.0005
for _ in range(5):
    g1=gap(PA+dA,PD+dD);lo=(g0-g1)>0.0005
    if not lo.any(): break
    dA[lo]+=NA[lo]*(g0-g1)[lo,None]
dA,sA,_=solve(PA,FA,gd=dA)
for _ in range(4):
    g1=gap(PA+dA,PD+dD);need=np.minimum(g0,0.008)-g1   # 层距：原 ≥8mm 处保持 ≥8mm，原 <8mm 处不减小
    lo=need>0.0002
    if not lo.any(): break
    dA[lo]+=NA[lo]*need[lo,None]*1.1
TH=float(os.environ.get('DTH','0.00001'))  # 位移 <0.1mm 置零（稀疏存储，省包体）
dD[np.linalg.norm(dD,axis=1)<TH]=0;dA[np.linalg.norm(dA,axis=1)<TH]=0
g1=gap(PA+dA,PD+dD)
def strain(P,F,dP):
    u,inv=weld(P);Fi=inv[F];E=edges(Fi);Q=P[u];
    dq=np.zeros_like(Q);dq[inv]=dP;L0=np.linalg.norm(Q[E[:,0]]-Q[E[:,1]],axis=1);L1=np.linalg.norm((Q+dq)[E[:,0]]-(Q+dq)[E[:,1]],axis=1)
    ok=L0>1e-3;return float(np.abs(L1[ok]/L0[ok]-1).max()*100)   # 同前法：只计 >1mm 的边
def vnorm(P,F):
    N=np.zeros_like(P)
    for a,b,c in F: pass
    n=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]]);np.add.at(N,F[:,0],n);np.add.at(N,F[:,1],n);np.add.at(N,F[:,2],n)
    return N/(np.linalg.norm(N,axis=1,keepdims=True)+1e-12)
def add_target(m,p,P,F,N,dP,name):
    dN=vnorm(P+dP,F)-vnorm(P,F);idx=np.where(np.linalg.norm(dP,axis=1)>0)[0].astype(np.uint32)
    def sp(vals):
        ia=g.add(idx,'SCALAR',5125);va=g.add(vals[idx].astype(np.float32),'VEC3',5126)
        ai=j['accessors'][ia];av=j['accessors'][va]
        acc={'componentType':5126,'count':len(P),'type':'VEC3','sparse':{'count':len(idx),'indices':{'bufferView':ai['bufferView'],'componentType':5125},'values':{'bufferView':av['bufferView']}}}
        if vals is dP: d=vals[idx];acc['min']=[float(min(0,x)) for x in d.min(0)];acc['max']=[float(max(0,x)) for x in d.max(0)]
        j['accessors'].append(acc);return len(j['accessors'])-1
    p['targets'].append({'POSITION':sp(dP),'NORMAL':sp(dN)});m['extras']['targetNames'].append(name)
    if 'weights' in m: m['weights'].append(0.0)
    return len(p['targets'])-1,len(idx)
iD,nD=add_target(mD,pD,PD,FD,ND,dD,'lantern_tuck_R');iA,nA=add_target(mA,pA,PA,FA,NA,dA,'lantern_tuck_R')
g.save(out)
inA=PA[:,0]<-0.05
info=dict(tuck_m=A,band=[Y0,YP,Y1],dress_target=iD,apron_target=iA,dress_verts=nD,apron_verts=nA,
 dress_strain_pct=round(strain(PD,FD,dD),3),apron_strain_pct=round(strain(PA,FA,dA),3),dress_max_dx_mm=round(float(dD[:,0].max()*1000),2),dress_max_disp_mm=round(float(np.linalg.norm(dD,axis=1).max()*1000),2),
 dress_bulge_z_mm=[round(float(dD[:,2].min()*1000),2),round(float(dD[:,2].max()*1000),2)],
 gap_before_mm=dict(min=round(float(g0.min()*1000),2),p5=round(float(np.percentile(g0,5)*1000),2),mean=round(float(g0.mean()*1000),2)),
 gap_after_mm=dict(min=round(float(g1.min()*1000),2),p5=round(float(np.percentile(g1,5)*1000),2),mean=round(float(g1.mean()*1000),2)),
 gap_violations=int(((g1<np.minimum(g0,0.008)-0.0002)).sum()),gap_ge8_before=int((g0>=0.008).sum()),gap_ge8_after=int((g1>=0.008).sum()),gap_change_mm=dict(min=round(float((g1-g0).min()*1000),2),max=round(float((g1-g0).max()*1000),2)),
 gap_rightside_after_min_mm=round(float(g1[inA].min()*1000),2),gap_rightside_before_min_mm=round(float(g0[inA].min()*1000),2))
json.dump(info,open(out+'.tuck.json','w'),indent=1);print('TUCK',json.dumps(info))
if os.environ.get('DIAG'):
    for nm_,P,F,dP in (('D',PD,FD,dD),('A',PA,FA,dA)):
        u,inv=weld(P);Fi=inv[F];E=edges(Fi);Q=P[u];dq=np.zeros_like(Q);dq[inv]=dP;L0=np.linalg.norm(Q[E[:,0]]-Q[E[:,1]],axis=1);L1=np.linalg.norm((Q+dq)[E[:,0]]-(Q+dq)[E[:,1]],axis=1)
        ok=L0>1e-3;s=np.abs(L1/np.maximum(L0,1e-9)-1);s[~ok]=0
        print(nm_,'p99',np.percentile(s[ok],99)*100,'p999',np.percentile(s[ok],99.9)*100,'n>2.5%',(s>0.025).sum(),'of',ok.sum())
        k=np.argsort(-s)[:5]
        for e in k: print('  ',round(s[e]*100,1),'L0mm',round(L0[e]*1000,2),Q[E[e,0]].round(3),dq[E[e,0]].round(4),dq[E[e,1]].round(4))
