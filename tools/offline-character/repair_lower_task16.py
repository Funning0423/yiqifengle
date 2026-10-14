"""Task16: lower cloth envelope with disjoint continuous contact-support intervals.
Fixed task15 input. Does not change body, skin, rig, materials or triangle indices.
"""
from common import *
import subprocess
BASE='375fb067f9455c17620aab2030d1863d730d2b2c'
raw=subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+str(ASSET.relative_to(ROOT))])
assert sha(raw)=='858f61c9e47a8d754681496bf65dfbcbc921c405a9719304d144553694c4dc25'
p=ROOT/'evidence/offline-character/task16-baseline.glb';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
g,r,ds=load(p);metaRaw=subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+str(META.relative_to(ROOT))]);assert sha(metaRaw)=='d1ffc700153b0cd65afcf960eaf9300a93c3575de1fad4757aff8cba424ca9c7';meta=json.loads(metaRaw);fields=np.load(ROOT/'tools/offline-character/task16-lower-fields.npz');report={}
keys={clip:np.linspace(0,max(float(g.accessor(s['input'])[-1,0]) for s in r.clips[clip]['samplers']),9) for clip in ['stand_up','sit_down']}
names=['cloth_envelope_'+clip+'_'+str(k) for clip in keys for k in range(9)]
def gain(clip,t):
 return float(np.interp(t,[0,.14,.17,.215,.245,keys[clip][-1]],[1,1,0,0,1,1])) if clip=='stand_up' else 1.0
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
 mesh=next(m for m in g.j['meshes'] if m['name']==md['name']);_,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True);rep=rep.ravel();entry=meta['morph']['meshes'][md['name']];entry=entry.get('targets',entry)
 for name,D in zip(names,fields[md['name']]):
  affected=np.unique(md['F'][np.any((np.linalg.norm(D,axis=1)>1e-8)[md['F']],axis=1)]);N=np.zeros_like(md['N']);N[affected]=(normals(md['P']+D,md['F'],rep)-normals(md['P'],md['F'],rep))[affected]
  entry[name]=len(md['pr']['targets']);md['pr']['targets'].append(dict(POSITION=sparse(None,D),NORMAL=sparse(None,N)));mesh['extras']['targetNames'].append(name);mesh['weights'].append(0.)
  for node in g.j['nodes']:
   if node.get('mesh')==g.j['meshes'].index(mesh) and 'weights' in node:node['weights'].append(0.)
 report[md['name']]={'maxDisplacementM':float(np.linalg.norm(fields[md['name']],axis=2).max()),'changedVertices':int(np.any(np.linalg.norm(fields[md['name']],axis=2)>1e-8,axis=0).sum())}
md=ds[0];D=np.load(ROOT/'tools/offline-character/task16-cuff-field.npy');mesh=next(m for m in g.j['meshes'] if m['name']==md['name']);entry=meta['morph']['meshes'][md['name']];entry=entry.get('targets',entry);entry['cloth_cuff_clearance']=len(md['pr']['targets']);_,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True);rep=rep.ravel();affected=np.unique(md['F'][np.any((np.linalg.norm(D,axis=1)>1e-8)[md['F']],axis=1)]);N=np.zeros_like(md['N']);N[affected]=(normals(md['P']+D,md['F'],rep)-normals(md['P'],md['F'],rep))[affected];md['pr']['targets'].append(dict(POSITION=sparse(None,D),NORMAL=sparse(None,N)));mesh['extras']['targetNames'].append('cloth_cuff_clearance');mesh['weights'].append(0.)
for node in g.j['nodes']:
 if node.get('mesh')==g.j['meshes'].index(mesh) and 'weights' in node:node['weights'].append(0.)
meta['clips']['stand_up']['morph']['curves']['cloth_cuff_clearance']=[[.235,0],[.25,0],[.2649238187503191,1],[.28,0],[.3,0]]
report['cuff']={'maxM':float(np.linalg.norm(D,axis=1).max()),'vertices':int((np.linalg.norm(D,axis=1)>0).sum())}
for clip in keys:
 ts=sorted(set(keys[clip].tolist()+([.14,.17,.215,.245] if clip=='stand_up' else [.30,.34])))
 def subdivide(a,b,fn):
  m=(a+b)/2;error=abs(fn(m)-(fn(a)+fn(b))/2)
  return subdivide(a,m,fn)[:-1]+subdivide(m,b,fn) if error>1e-5 else [a,b]
 for k in range(9):
  values=np.eye(9)[k];fn=lambda t:float(np.interp(t,keys[clip],values)*gain(clip,t));sub=[]
  for a,b in zip(ts[:-1],ts[1:]):sub+=subdivide(a,b,fn)[:-1]
  sub.append(ts[-1]);meta['clips'][clip]['morph']['curves'][names[(0 if clip=='stand_up' else 9)+k]]=[[float(t),fn(t)] for t in sub]
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
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');report['outputSHA256']=sha(ASSET.read_bytes());report['metadataSHA256']=sha(META.read_bytes());(ROOT/'evidence/offline-character/task16-install.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
