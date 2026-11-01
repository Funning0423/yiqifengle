"""Task13 candidate gates; explicit CPU checks, no visual acceptance claims."""
from common import *
g,r,ds=load(ASSET);og,rr,ods=load(ROOT/'evidence/offline-character/task12.glb')
report={'assetSHA256':sha(ASSET.read_bytes()),'scope':'CPU only; visual and full runtime acceptance separate'}
for key in ['nodes','skins','materials','animations','images','meshes']:assert g.j[key]==og.j[key],key
for a,b in zip(ds,ods):
 assert np.array_equal(a['F'],b['F']);assert all(np.array_equal(x,y) for x,y in zip(a['D'],b['D']))
 assert np.isfinite(a['P']).all() and np.isfinite(a['W']).all() and abs(a['W'].sum(1)-1).max()<2e-7
 if a['name']!='LOD0_G2_BODY' or a['pi']!=0:assert np.array_equal(a['P'],b['P']) and np.array_equal(a['W'],b['W'])
assert [sha(g.view(i['bufferView'])) for i in g.j['images']]==[sha(og.view(i['bufferView'])) for i in og.j['images']]
report['unchanged']='all rig, inverse binds, animation bytes, morphs, cloth, boots, texture images, topology, materials, metadata and motion code'
m=ds[1];old=ods[1];changed=np.where((np.linalg.norm(m['P']-old['P'],axis=1)>1e-8)|(np.max(abs(m['W']-old['W']),axis=1)>1e-8))[0];assert len(changed)==84;assert m['P'][changed,1].max()<.176;report['changedCoveredCalfVertices']=len(changed)
# Duplicated UV seam points must preserve matching positions and skin weights.
canon={};mismatches=[]
for i,p in enumerate(old['P']):
 key=tuple(p)
 if key in canon:
  j=canon[key]
  if np.array_equal(old['J'][i],old['J'][j]) and np.array_equal(old['W'][i],old['W'][j]):
   if not (np.array_equal(m['P'][i],m['P'][j]) and np.array_equal(m['J'][i],m['J'][j]) and np.array_equal(m['W'][i],m['W'][j])):mismatches.append([j,i])
 else:canon[key]=i
assert not mismatches;report['duplicateSkinSeams']='PASS'
meta=json.load(open(META));seat=collision(ds,r,*actual(r));report['actualSeatedCrossings']=seat
rows=[]
for clip in ['stand_up','sit_down']:
 dur=max(float(g.accessor(s['input'])[-1,0]) for s in r.clips[clip]['samplers'])
 for t in np.linspace(0,dur,int(np.ceil(dur*120))+1):
  c=collision(ds,r,*sample(r,clip,t,meta));rows.append({'clip':clip,'t':float(t),'crossings':c})
report['denseTransitionSamples']=len(rows);report['crossingTotals']={k:sum(x['crossings'][k] for x in rows) for k in seat};report['open']=['leg/dress seated and full transition intersections remain FAIL','apron/dress and sleeve/apron transition intersections remain FAIL','expanded 3m@30Hz contact gate remains FAIL; thresholds unchanged','all-angle wrist/heel/continuous silhouette and natural route require runtime review']
(ROOT/'evidence/offline-character/task13-transition-samples.json').write_text(json.dumps(rows,indent=2));(ROOT/'evidence/offline-character/task13-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
