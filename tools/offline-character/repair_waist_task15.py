"""Task15: withdraw the proven six-point sit_drape waist regression on the rise path only."""
from pathlib import Path
import sys,subprocess,json,numpy as np,hashlib
from common import *
BASE='cf88d7ed2f83df66464c59f53657735ca514f933';raw=subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+str(ASSET.relative_to(ROOT))]);assert sha(raw)=='cda750cb9fef860ca60f7c4552b1c3d91b9dec384705759ccb1fb2de63792f7c';base=ROOT/'evidence/offline-character/task13-baseline.glb';base.parent.mkdir(parents=True,exist_ok=True);base.write_bytes(raw);g,r,ds=load(base);fields=np.load(ROOT/'tools/offline-character/task15-waist-fields.npz');report={}
def sparse(ai,V):
 V=np.asarray(V,dtype='<f4');ids=np.where(np.max(abs(V),axis=1)>1e-8)[0];ids=ids if len(ids) else np.array([0]);views=[]
 for arr in [ids.astype('<u2'),V[ids]]:
  g.b.extend(b'\0'*((-len(g.b))%4));off=len(g.b);g.b.extend(arr.tobytes());g.j['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=arr.nbytes));views.append(len(g.j['bufferViews'])-1)
 a=dict(componentType=5126,count=len(V),type='VEC3',min=V.min(0).tolist(),max=V.max(0).tolist(),sparse=dict(count=len(ids),indices=dict(bufferView=views[0],componentType=5123),values=dict(bufferView=views[1])))
 if ai is None:g.j['accessors'].append(a);return len(g.j['accessors'])-1
 g.j['accessors'][ai]=a;return ai
def normals(V,F,rep):
 N=np.zeros_like(V);fn=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]])
 for lane in range(3):np.add.at(N,F[:,lane],fn)
 S=np.zeros((rep.max()+1,3));np.add.at(S,rep,N);N=S[rep];return N/np.maximum(np.linalg.norm(N,axis=1,keepdims=True),1e-12)
for md in [ds[0],ds[-1]]:
 C=fields[md['name']];P=md['P']+C[0];_,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True);rep=rep.ravel();N=md['N'].copy();changed=np.any(np.linalg.norm(C,axis=2)>1e-8,axis=0);affected=np.unique(md['F'][np.any(changed[md['F']],axis=1)]);N[affected]=normals(P,md['F'],rep)[affected];g.write_accessor(md['pr']['attributes']['POSITION'],P);g.write_accessor(md['pr']['attributes']['NORMAL'],N);a=g.j['accessors'][md['pr']['attributes']['POSITION']];a['min']=P.min(0).tolist();a['max']=P.max(0).tolist()
 for k,target in enumerate(md['pr']['targets']):
  delta=md['D'][k]+C[k+1];sparse(target['POSITION'],delta);nd=g.accessor(target['NORMAL']).copy();nd[affected]=(normals(P+delta,md['F'],rep)-N)[affected];sparse(target['NORMAL'],nd)
 mesh=next(m for m in g.j['meshes'] if m['name']==md['name'])
 for k,name in [(5,'cloth_return_clearance'),(6,'cloth_rise_clearance'),(7,'cloth_waist_rise_seam')]:
  newP=sparse(None,C[k]);nn=np.zeros_like(N);nn[affected]=(normals(P+C[k],md['F'],rep)-N)[affected];newN=sparse(None,nn);md['pr']['targets'].append(dict(POSITION=newP,NORMAL=newN));mesh['extras']['targetNames'].append(name);mesh['weights'].append(0.)
 for node in g.j['nodes']:
  if node.get('mesh')==g.j['meshes'].index(mesh) and 'weights' in node:node['weights'].extend([0.,0.,0.])
 report[md['name']]={'baseMaxM':float(np.linalg.norm(C[0],axis=1).max()),'fieldMaxM':float(np.linalg.norm(C,axis=2).max()),'changedVertices':int(np.any(np.linalg.norm(C,axis=2)>1e-8,axis=0).sum())}
# Repack only referenced bufferViews; preserve accessor numbers and channel identity.
used=set()
for a in g.j['accessors']:
 if 'bufferView' in a:used.add(a['bufferView'])
 if 'sparse' in a:
  used.add(a['sparse']['indices']['bufferView']);used.add(a['sparse']['values']['bufferView'])
for im in g.j.get('images',[]):
 if 'bufferView' in im:used.add(im['bufferView'])
new=bytearray();views=[];mapping={}
for old in sorted(used):
 v=dict(g.j['bufferViews'][old]);data=bytes(g.b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);new.extend(b'\0'*((-len(new))%4));v['byteOffset']=len(new);new.extend(data);mapping[old]=len(views);views.append(v)
for a in g.j['accessors']:
 if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
 if 'sparse' in a:
  for k in ['indices','values']:a['sparse'][k]['bufferView']=mapping[a['sparse'][k]['bufferView']]
for im in g.j.get('images',[]):
 if 'bufferView' in im:im['bufferView']=mapping[im['bufferView']]
g.j['bufferViews']=views;R.glb_save(str(ASSET),g.j,bytes(new))
meta=json.load(open(META));meta['clips']['sit_down']['morph']['curves']['cloth_return_clearance']=[[0,0],[.2,1],[.61,1],[.95,.25],[1.2,0]]
meta['clips']['stand_up']['morph']['curves']['cloth_rise_clearance']=[[0,0],[.211111,1],[.422222,.5],[.633333,0],[1.266667,0]]
for name in ['LOD0_G2_DRESS','LOD0_G2_APRON']:
 entry=meta['morph']['meshes'][name];entry=entry.get('targets',entry);entry['cloth_return_clearance']=4;entry['cloth_rise_clearance']=5;entry['cloth_waist_rise_seam']=6
meta['clips']['stand_up']['morph']['curves']['cloth_waist_rise_seam']=meta['clips']['stand_up']['morph']['curves']['sit_drape']
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');report['inputSHA256']=sha(raw);report['outputSHA256']=sha(ASSET.read_bytes());(ROOT/'evidence/offline-character/task15-waist-install.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
