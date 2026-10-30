import sys,json,struct,numpy as np,DracoPy
f=sys.argv[1];d=open(f,'rb').read();l=struct.unpack('<I',d[12:16])[0];j=json.loads(d[20:20+l]);bo=20+l;bl=struct.unpack('<I',d[bo:bo+4])[0];bin_=d[bo+8:bo+8+bl]
N=j['nodes']
def trs(n):
  if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
  t=n.get('translation',[0,0,0]);r=n.get('rotation',[0,0,0,1]);s=n.get('scale',[1,1,1]);x,y,z,w=r
  R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
  M=np.eye(4);M[:3,:3]=R*np.array(s);M[:3,3]=t;return M
W={}
def walk(i,P):
  W[i]=P@trs(N[i])
  for c in N[i].get('children',[]):walk(c,W[i])
for r in j['scenes'][j.get('scene',0)]['nodes']:walk(r,np.eye(4))
def acc(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];c={'SCALAR':1,'VEC4':4,'MAT4':16,'VEC3':3}[a['type']]
  return np.frombuffer(bin_,dtype=np.float32,count=a['count']*c,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],c)
out={}
for i,n in enumerate(N):
  if 'palm' not in n.get('name','') or 'mesh' not in n: continue
  pr=j['meshes'][n['mesh']]['primitives'][0];ext=pr['extensions']['KHR_draco_mesh_compression'];v=j['bufferViews'][ext['bufferView']]
  m=DracoPy.decode(bin_[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
  ids=ext['attributes'];att={}
  for a in m.attributes:
    for k,u in ids.items():
      if a['unique_id']==u: att[k]=np.array(a['data'])
  P=np.array(m.points).reshape(-1,3);P=np.c_[P,np.ones(len(P))]
  unsk=(W[i]@P.T).T[:,:3]
  if 'skin' in n:
    sk=j['skins'][n['skin']];IB=acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    JM=np.array([W[jn]@IB[k] for k,jn in enumerate(sk['joints'])])
    J=att['JOINTS_0'].astype(int).reshape(len(P),4);Wt=att['WEIGHTS_0'].reshape(len(P),4)
    M=np.einsum('vk,vkab->vab',Wt,JM[J]);sk_=np.einsum('vab,vb->va',M,P)[:,:3]
  else: sk_=unsk
  out[n['name']]={'unskinned':unsk,'skinned':sk_,'faces':np.array(m.faces).reshape(-1,3)}
  def bb(a):return [list(np.round(a.min(0),2)),list(np.round(a.max(0),2))]
  t=sk_[sk_[:,1]<sk_[:,1].min()+1.2]
  print(n['name'],'unskinned',bb(unsk),'skinned',bb(sk_),'trunk(y<1.2 above base) xz',bb(t[:,[0,2]]))
np.save('/workspace/skin/palms.npy',{k:{kk:vv for kk,vv in v.items()} for k,v in out.items()},allow_pickle=True)
import hashlib,gzip
res={'glb':'static_seat_preview/room/room_no_original_chair.glb','sha256':hashlib.sha256(d).hexdigest(),'note':'rest-pose linear-blend skinning (W_joint*IBM); lib-glb/bake ignore skins','objects':{}}
for k,v in out.items():
  t=v['skinned'][v['faces']].reshape(-1).astype(np.float32)
  res['objects'][k]=[round(float(x),4) for x in t]
open(sys.argv[2],'wb').write(gzip.compress(json.dumps(res).encode()))
