import numpy as np,sys,json;sys.path.insert(0,'.');from glbio import G
S='../src/models/body09-v44-cold5-static-20261016/'
o=G(S+'sources/original-character.glb');n=G(S+'character-body09-v44-cold5-static-candidate.glb');pose=np.load(S+'sources/candidate08-pose.npz');bs=np.load(S+'sources/body09.npz')
c,s=np.cos(float(bs['sceneYawRad'])),np.sin(float(bs['sceneYawRad']));yaw=np.array([[c,0,s],[0,1,0],[-s,0,c]])
R=bs['analysisRotation'];org=bs['analysisOrigin'];root=bs['sceneRoot']
sk=o.j['skins'][0];IB=o.acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);W=pose['world']
rep=[]
for mi,m in enumerate(o.j['meshes']):
  for pi,p in enumerate(m['primitives']):
    a=p['attributes'];P=o.acc(a['POSITION']);J=o.acc(a['JOINTS_0']).astype(int);w=o.acc(a['WEIGHTS_0'])
    M=np.einsum('vk,vkij->vij',w,W[J]@IB[J]);Q=np.einsum('vij,vj->vi',M,np.c_[P,np.ones(len(P))])[:,:3]
    T=pose[f"mesh_{m['name']}_{pi}"]
    Pn=n.acc(n.j['meshes'][mi]['primitives'][pi]['attributes']['POSITION']).astype(float)
    Tn=((Pn@R.T)+org-root)@yaw          # back to pose space
    D=Tn-T
    fwd=((T@yaw.T+root)-org)@R          # sanity: pose->analysis
    Dl=np.einsum('vij,vj->vi',np.linalg.inv(M[:,:3,:3]),D)
    Pb=P+Dl
    # recompute normals via inverse skin of new normals
    Nn=n.acc(n.j['meshes'][mi]['primitives'][pi]['attributes']['NORMAL']).astype(float)@R.T@yaw
    Nb=np.einsum('vij,vj->vi',np.linalg.inv(M[:,:3,:3]),Nn);Nb/=np.linalg.norm(Nb,axis=1,keepdims=True)+1e-30
    Q2=np.einsum('vij,vj->vi',M,np.c_[Pb,np.ones(len(P))])[:,:3]
    r=dict(mesh=m['name'],prim=pi,skinResidual_m=float(np.abs(Q-T).max()),maxDeltaMm=float(np.linalg.norm(D,axis=1).max()*1000),movedVerts=int((np.linalg.norm(D,axis=1)>1e-6).sum()),verts=len(P),reskinErr_m=float(np.abs(Q2-T-D).max()))
    rep.append(r);print(r)
    a['POSITION']=o.add(Pb);a['NORMAL']=o.add(Nb)
o.j.setdefault('extras',{})['grokbot']='BODY09+v44-cold5 static deltas (65bdd4c) inverse-skinned onto original rig at candidate08 pose; original 14 clips kept'
import glbio;glbio.compact(o);o.save('../char_hybrid_rigged.glb');json.dump(rep,open('../hybrid-report.json','w'),indent=1)
