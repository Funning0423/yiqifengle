import numpy as np,sys;sys.path.insert(0,'.');from glbio import G
S='../src/models/body09-v44-cold5-static-20261016/'
o=G(S+'sources/original-character.glb');pose=np.load(S+'sources/candidate08-pose.npz')
sk=o.j['skins'][0];jn=np.array(sk['joints'])
IBMr=o.acc(sk['inverseBindMatrices']).reshape(-1,4,4)
m=o.j['meshes'][1];p=m['primitives'][0]
P=o.acc(p['attributes']['POSITION']);J=o.acc(p['attributes']['JOINTS_0']).astype(int);w=o.acc(p['attributes']['WEIGHTS_0']);T=pose['mesh_LOD0_G2_BODY_0']
W=pose['world']
for wn,WW in [('W',W),('Wt',W.transpose(0,2,1))]:
 for ib,IB in [('ibmT',IBMr.transpose(0,2,1)),('ibm',IBMr)]:
  for idx,ix in [('node',jn),('joint',np.arange(28))]:
    M=np.einsum('vk,vkij->vij',w,WW[ix[J]]@IB[J]);Q=np.einsum('vij,vj->vi',M,np.c_[P,np.ones(len(P))])[:,:3]
    print(wn,ib,idx,np.abs(Q-T).max())
print(o.j['nodes'][28:34] if len(o.j['nodes'])>28 else '', [n.get('name') for n in o.j['nodes']][:3], o.j['scenes'])
