import numpy as np,sys;sys.path.insert(0,'.');from glbio import G
S='../src/models/body09-v44-cold5-static-20261016/'
o=G(S+'sources/original-character.glb');pose=np.load(S+'sources/candidate08-pose.npz');bs=np.load(S+'sources/body09.npz')
sk=o.j['skins'][0];print('joints',len(sk['joints']),sk['joints'][:5],'nodes',len(o.j['nodes']))
IBM=o.acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
W=pose['world'];print('world shape',W.shape)
for m in o.j['meshes']:
  for pi,p in enumerate(m['primitives']):
    P=o.acc(p['attributes']['POSITION']);J=o.acc(p['attributes']['JOINTS_0']).astype(int);w=o.acc(p['attributes']['WEIGHTS_0'])
    # joint index -> node index
    jn=np.array(sk['joints']);M=np.einsum('vk,vkij->vij',w,W[jn[J]]@IBM[J]) if jn.max()<len(W) else None
    if M is None: print('jn>28');continue
    Q=np.einsum('vij,vj->vi',M,np.c_[P,np.ones(len(P))])[:,:3]
    T=pose[f"mesh_{m['name']}_{pi}"];print(m['name'],pi,'maxerr',np.abs(Q-T).max(), 'wsum',w.sum(1).min())
