from pathlib import Path
import sys,json,struct,numpy as np
P=Path(__file__).resolve().parents[2]
OUT=P/'output/character-continuity';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(P/'tools/static-seat'));from glb_local import Glb,sha
sys.path.insert(0,str(P/'tools/character-repair'));from repair_asset import components
asset=P/'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'
import subprocess
source=subprocess.check_output(['git','-C',str(P),'show','87b6bbde137508c7f0f6f014a6f778773d31d4be:'+str(asset.relative_to(P))])
assert sha(source)=='7df192cbe4461901112a13a4d4abf4029c31b6b732292abc7133337f080be3e1'
(OUT/'dynamic-before.glb').write_bytes(source);g=Glb(OUT/'dynamic-before.glb')
def append(arr,typ,ct):
 arr=np.asarray(arr);pad=(-len(g.b))%4;g.b.extend(b'\0'*pad);off=len(g.b);g.b.extend(arr.tobytes());vi=len(g.j['bufferViews']);g.j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes});ai=len(g.j['accessors']);g.j['accessors'].append({'bufferView':vi,'componentType':ct,'count':len(arr),'type':typ});return ai
mat=len(g.j['materials']);g.j['materials']+=[{'name':'ReferenceBrownBootLeather','pbrMetallicRoughness':{'baseColorFactor':[.30,.205,.135,1],'metallicFactor':0,'roughnessFactor':.88}},{'name':'ReferenceBrownBootSole','pbrMetallicRoughness':{'baseColorFactor':[.16,.105,.063,1],'metallicFactor':0,'roughnessFactor':.95}}]
rows=[]
for mesh in g.j['meshes']:
 out=[]
 for pr in mesh['primitives']:
  a=pr['attributes'];P0=g.accessor(a['POSITION']);N=g.accessor(a['NORMAL']);I=g.accessor(pr['indices']).reshape(-1,3);idsAll=[]
  for ids in components(P0,I):
   v=P0[ids].copy()
   if len(ids)!=257 or v[:,1].max()>.18 or v[:,1].min()>.001:continue
   idsAll+=ids;cx=float((v[:,0].max()+v[:,0].min())/2);front=np.clip((v[:,2]-.035)/.07,0,1);lower=np.clip((.10-v[:,1])/.045,0,1);u=front*front*(3-2*front)*lower
   # Round the pointed toe: broaden the front quarter, shorten only its tip.
   P0[ids,0]=cx+(v[:,0]-cx)*(1+.30*u);P0[ids,2]=v[:,2]-.012*u
   rows.append({'side':'L' if cx<0 else 'R','vertices':len(ids),'before_min':v.min(0).tolist(),'before_max':v.max(0).tolist(),'after_min':P0[ids].min(0).tolist(),'after_max':P0[ids].max(0).tolist()})
  if not idsAll:out.append(pr);continue
  mask=np.isin(I,idsAll).all(1);boot=I[mask];rest=I[~mask]
  normal=np.zeros_like(P0)
  for tri in boot:
   x,y,z=P0[tri];n=np.cross(y-x,z-x)
   for j in tri:normal[j]+=n
  norm=np.linalg.norm(normal[idsAll],axis=1);N[idsAll]=normal[idsAll]/np.maximum(norm[:,None],1e-9)
  g.write_accessor(a['POSITION'],P0);g.write_accessor(a['NORMAL'],N)
  g.j['accessors'][a['POSITION']]['min']=P0.min(0).tolist();g.j['accessors'][a['POSITION']]['max']=P0.max(0).tolist()
  base=dict(pr);base['indices']=append(rest.reshape(-1,1).astype('<u2'),'SCALAR',5123);out.append(base)
  sole=P0[boot,1].mean(1)<.012
  for tris,mi in [(boot[~sole],mat),(boot[sole],mat+1)]:
   if len(tris):pp=dict(pr);pp['indices']=append(tris.reshape(-1,1).astype('<u2'),'SCALAR',5123);pp['material']=mi;out.append(pp)
 mesh['primitives']=out
# Every existing animation/skin byte is untouched; only boot POSITION/NORMAL and per-boot materials/indices change.
g.j['buffers'][0]['byteLength']=len(g.b);j=json.dumps(g.j,separators=(',',':')).encode();j+=b' '*((-len(j))%4);b=bytes(g.b);b+=b'\0'*((-len(b))%4);data=struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b
(OUT/'dynamic-after.glb').write_bytes(data)
json.dump({'before_sha256':sha(source),'after_sha256':sha(data),'boots':rows,'bytes':len(data)},open(OUT/'boots-repair.json','w'),indent=2)
print(len(data),rows)
