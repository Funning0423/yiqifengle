"""accel + crossings + body/chair penetration of a world-space cloth sequence (npz with dress/apron (91,n,3)). usage: blender -b --python analyze_sim.py -- <pre.npz> <seq.npz>"""
import sys, json, collections, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; Z=np.load(a[0],allow_pickle=True); S=np.load(a[1]); OB=['G2_DRESS_R5G2','G2_APRON_R5G2']
def accel(X): return np.linalg.norm(X[2:]-2*X[1:-1]+X[:-2],axis=2).max(1)*1000
def tree(X,T): return BVHTree.FromPolygons([Vector(q) for q in X],T.tolist(),all_triangles=True)
def vn(X,T):
    fn=np.cross(X[T[:,1]]-X[T[:,0]],X[T[:,2]]-X[T[:,0]]); v=np.zeros_like(X)
    for k in range(3): np.add.at(v,T[:,k],fn)
    return v/np.maximum(np.linalg.norm(v,axis=1,keepdims=True),1e-12)
def shell(X,T): n=vn(X,T); return tree(np.vstack([X+n*4e-4,X-n*4e-4]),np.vstack([T,T+len(X)]))
DT=Z[OB[0]+'_T']; AT=Z[OB[1]+'_T']; BX=Z['body_X'].astype(float); BT=Z['body_T']; nob=Z['body_nobow_tris']; CT=tree(Z['chair_X'],Z['chair_T'])
res={'accel':{},'cross':collections.Counter(),'cross_per_frame':{},'pen':collections.Counter()}
for o in OB: acc=accel(S[o]); res['accel'][o]=[round(float(acc.max()),2),int(acc.argmax())+1]; res['accel_f'+o[3:8]]=[round(float(x),1) for x in acc]
for f in range(6,86):
    X={o:S[o][f] for o in OB}; X0={o:Z[o+'_X0'][f] for o in OB}; BF=tree(BX[f],BT); BN=tree(BX[f],BT[nob]); row={}
    for kind,(cur,org) in {'sd':((X[OB[0]],DT),(X0[OB[0]],DT)),'sa':((X[OB[1]],AT),(X0[OB[1]],AT))}.items():
        T=cur[1]; t=tree(cur[0],T); t0=tree(org[0],T); o0=set(t0.overlap(t0))
        row[kind]=len([1 for i,j in t.overlap(t) if i<j and not (set(T[i])&set(T[j])) and (i,j) not in o0])
    sd,sa=shell(X[OB[0]],DT),shell(X[OB[1]],AT); sd0,sa0=shell(X0[OB[0]],DT),shell(X0[OB[1]],AT)
    for kind,A_,B_,A0,B0 in (('ad',sa,sd,sa0,sd0),('db',sd,BF,sd0,BF),('ab',sa,BF,sa0,BF),('dc',sd,CT,sd0,CT),('ac',sa,CT,sa0,CT)):
        o0=set(A0.overlap(B0)); row[kind]=len([1 for pq in A_.overlap(B_) if pq not in o0])
    for k,v in row.items(): res['cross'][k]+=v
    res['cross_per_frame'][f]=sum(row.values())
    # vertex penetration: segment from the clean original crosses body(no bow)/chair
    for o in OB:
        for i in range(0,len(X[o])):
            p=Vector(X[o][i]); r=Vector(X0[o][i]); d=p-r; L=d.length
            if L<1e-6: continue
            for nm,T_ in (('body',BN),('chair',CT)):
                h=T_.ray_cast(r,d/L,L)
                if h[0] is not None: res['pen'][o[3:8]+'x'+nm]=max(res['pen'][o[3:8]+'x'+nm],round((p-h[0]).length*1000,2))
print('ANALYSIS',json.dumps({'accel':res['accel'],'cross':res['cross'],'pen':res['pen']}))
print('ACCF',json.dumps({k:v for k,v in res.items() if k.startswith('accel_f')}))
print('CPF',json.dumps(res['cross_per_frame']))
