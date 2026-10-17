import numpy as np, ast
Z=np.load('pre.npz',allow_pickle=True); NF=91
D2=np.zeros((NF-2,NF))
for i in range(NF-2): D2[i,i:i+3]=[1,-2,1]
for on in ['G2_DRESS_R5G2','G2_APRON_R5G2']:
    W=[ast.literal_eval(s) for s in Z[on+'_W']]; knots=sorted({k for w in W for k in w if k!='sit_corrective'})
    B=np.zeros((NF,len(knots))); R0=Z[on+'_R0']; K0=np.zeros((len(knots),)+R0.shape[1:])
    for f,w in enumerate(W):
        for k,v in w.items():
            if k!='sit_corrective': B[f,knots.index(k)]=v
        if len(w)==1 and list(w)[0]!='sit_corrective': K0[knots.index(list(w)[0])]=R0[f]
    P=R0-np.einsum('fk,kni->fni',B,K0); A=Z[on+'_A']; t=Z[on+'_t']
    X0=Z[on+'_X0']; acc=lambda X: np.linalg.norm(X[2:]-2*X[1:-1]+X[:-2],axis=2).max(1)*1000
    a0=acc(X0); print(on,'orig max',a0.max().round(2),'@',a0.argmax()+1, 'bone-only (R fixed=P+basis?)')
    for lam in (1.0,0.3,0.1,0.03,0.01):
        G=B.T@D2.T@D2@B; Mi=np.linalg.inv(G+lam*np.eye(len(knots)))
        K=lam*np.einsum('jk,kni->jni',Mi,K0)-np.einsum('jf,fni->jni',Mi@(B.T@D2.T@D2),P)
        R=np.einsum('fk,kni->fni',B,K)+P; X=np.einsum('fnij,fnj->fni',A,R)+t; a=acc(X)
        sh=np.linalg.norm(X-X0,axis=2).max()*1000
        print(' lam',lam,'max acc',a.max().round(2),'@',a.argmax()+1,'max shift mm',sh.round(1))
    # bone-only acceleration: rest shape fixed at basis
    Xb=np.einsum('fnij,nj->fni',A,Z[on+'_basis'])+t; print(' bone-only accel (basis shape)',acc(Xb).max().round(2))
    print(' orig per-frame acc', ' '.join(f'{i+1}:{x:.0f}' for i,x in enumerate(a0)))
    lam=0.1; G=B.T@D2.T@D2@B; Mi=np.linalg.inv(G+lam*np.eye(len(knots)))
    K=lam*np.einsum('jk,kni->jni',Mi,K0)-np.einsum('jf,fni->jni',Mi@(B.T@D2.T@D2),P)
    R=np.einsum('fk,kni->fni',B,K)+P; X=np.einsum('fnij,fnj->fni',A,R)+t
    print(' shift per frame lam.1', ' '.join(f'{i}:{x:.0f}' for i,x in enumerate(np.linalg.norm(X-X0,axis=2).max(1)*1000)))
    sp=np.linalg.norm(np.diff(X0,axis=0),axis=2).max(1)*1000; print(' orig speed', ' '.join(f'{i}:{x:.0f}' for i,x in enumerate(sp)))
