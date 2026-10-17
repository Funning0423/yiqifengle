from pathlib import Path
import json,struct,hashlib,copy,argparse,numpy as np
O=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=O);args=parser.parse_args();OUT=args.output_dir;OUT.mkdir(parents=True,exist_ok=True)
SRC=O/'sources/original-character.glb'
BODY=O/'sources/body09.npz'
CLOTH=O/'sources/cloth-v44-cold5.npz'
POSE=O/'sources/candidate08-pose.npz'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p,h in [(SRC,'42ca2486ad1ecdfb5070d6e2991042b60476b90b609859f39398fbcbacebafec'),(BODY,'14acc74e49a22b51bc8bbeaba43bf29f574d26fadf7bd0959fb8645f3d8a3ec4'),(CLOTH,'839bc8fc42e518720059f550e96366ad53ce666f23739f29cdc8d82db1aa4aae'),(POSE,'756c3b08e6dbae7cbf52bfba9e2b966319a5f4b727c5f7aeef8a8607c439b235')]:assert sha(p)==h
b=SRC.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);bn,bt=struct.unpack_from('<II',b,20+n);blob=bytearray(b[28+n:28+n+bn]);original=copy.deepcopy(j)
def readacc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];assert not v.get('byteStride');return np.frombuffer(blob,dtype=dt,count=a['count']*nc,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,nc).copy()
def addacc(a):
 a=np.asarray(a,dtype='<f4');blob.extend(b'\0'*((-len(blob))%4));off=len(blob);blob.extend(a.tobytes());vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes,'target':34962});ai=len(j['accessors']);j['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(a),'type':'VEC3','min':a.min(0).tolist(),'max':a.max(0).tolist()});return ai
bs=np.load(BODY);pose=np.load(POSE);V=np.load(CLOTH)['render'];c,s=np.cos(float(bs['sceneYawRad'])),np.sin(float(bs['sceneYawRad']));yaw=np.array([[c,0,s],[0,1,0],[-s,0,c]]);mapping=bs['bodyVertexMap'];checks=[]
for mesh in j['meshes']:
 name=mesh['name'];mesh.pop('weights',None)
 for pi,pr in enumerate(mesh['primitives']):
  P=((pose[f'mesh_{name}_{pi}']@yaw.T+bs['sceneRoot'])-bs['analysisOrigin'])@bs['analysisRotation']
  if name=='LOD0_G2_BODY':
   mask=mapping[:,0]==pi;P[mapping[mask,1]]=bs['body'][mask]
  elif name=='LOD0_G2_DRESS':P=V[:5721].copy()
  elif name=='LOD0_G2_APRON':P=V[5721:].copy()
  F=readacc(pr['indices']).reshape(-1,3);assert len(P)==j['accessors'][pr['attributes']['POSITION']]['count'];N=np.zeros_like(P);face=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
  for k in range(3):np.add.at(N,F[:,k],face)
  norms=np.linalg.norm(N,axis=1);N/=np.maximum(norms[:,None],1e-30)
  pr['attributes']['POSITION']=addacc(P);pr['attributes']['NORMAL']=addacc(N)
  for k in list(pr['attributes']):
   if k.startswith(('JOINTS_','WEIGHTS_')) or k=='TANGENT':del pr['attributes'][k]
  pr.pop('targets',None);checks.append({'mesh':name,'primitive':pi,'vertices':len(P),'faces':len(F),'maxFloat32ErrorM':float(np.max(np.abs(P.astype(np.float32).astype(float)-P)))})
# Keep original reference skeleton nodes and skins as metadata/reference, never attach them to baked meshes.
for node in j['nodes']:node.pop('mesh',None);node.pop('skin',None);node.pop('weights',None)
for i in range(28):
 j['nodes'][i].pop('matrix',None);j['nodes'][i].update(translation=pose['T'][i].tolist(),rotation=pose['Q'][i].tolist(),scale=pose['S'][i].tolist())
mesh_nodes=[]
for i,m in enumerate(j['meshes']):mesh_nodes.append(len(j['nodes']));j['nodes'].append({'name':m['name']+'_STATIC_BODY09_V44','mesh':i})
j['scenes']=[{'name':'BODY09 + v44-cold5 STATIC CANDIDATE','nodes':mesh_nodes}];j['scene']=0;j.pop('animations',None);j['buffers']=[{'byteLength':len(blob)}];j.setdefault('extras',{}).update(status='STATIC_RESEARCH_CANDIDATE_NOT_ANIMATION_OR_NATIVE_ACCEPTANCE',referenceSkeleton='Original nodes and skin definitions retained, detached from rendered scene and baked meshes.',bodySHA256=sha(BODY),clothSHA256=sha(CLOTH))
raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);blob.extend(b'\0'*((-len(blob))%4));out=struct.pack('<4sII',b'glTF',2,28+len(raw)+len(blob))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(blob),0x004e4942)+blob
P=OUT/'character-body09-v44-cold5-static-candidate.glb';assert not P.exists();P.write_bytes(out)
report={'status':'STATIC_GEOMETRY_EXPORT_VERIFIED_NOT_CONTACT_RECERTIFIED','file':P.name,'bytes':len(out),'sha256':sha(P),'sourceFiles':{str(p.relative_to(O)):sha(p)for p in [SRC,BODY,CLOTH,POSE]},'checks':checks,'materialsPreserved':j['materials']==original['materials'],'imagesPreserved':j['images']==original['images'],'animations':0,'meshCount':len(j['meshes']),'sourceRigRetainedAsDetachedReference':True,'limits':['Static float32 render export; exact float64 contact audit does not transfer automatically.','Original rig preserved as detached reference; no executable skinning or animation.','BOW and complete character native/dynamic acceptance remain unvalidated.','No geometry simplification, hand flattening, new wrist edits, or simulation performed.']}
(OUT/'export-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
