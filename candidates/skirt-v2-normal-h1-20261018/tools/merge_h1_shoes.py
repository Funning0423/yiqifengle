"""Append-only h1 shoe primitive transplant into exact verified skirt engine source."""
from pathlib import Path
import argparse,json,copy,hashlib,numpy as np
from glb_io import GLB
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',required=True)
p.add_argument('--source-meta',required=True)
p.add_argument('--h1',required=True)
p.add_argument('--output-dir',required=True)
args=p.parse_args()
O=Path(args.output_dir);O.mkdir(parents=True,exist_ok=True);src=Path(args.source);hsrc=Path(args.h1);
assert not (O/'character-skirt-v2-normal-h1.glb').exists() and not (O/'anim_meta.json').exists(),'Output overwrite forbidden'
assert hashlib.sha256(Path(args.source_meta).read_bytes()).hexdigest()=='b60faae0fe44e8ae1be710cf42cfe9c60ba7cda5f6055050ff21ba2ae6625273','Source metadata mismatch'
g=GLB(str(src));h=GLB(str(hsrc));assert g.sha=='4daf91c1a172d3a97a3f042279c94a1a784794cf9c05e64b87380e9605a311fc';assert h.sha=='c7da4672f9e0f42191b65cbc744d46ef7a6ddc6cf307c0bf5e40889250fc486a';old=copy.deepcopy(g.j);oldbin=bytes(g.b);g.b=bytearray(g.b)
assert g.j['nodes']==h.j['nodes'];assert g.j['skins']==h.j['skins'];assert g.j['materials']==h.j['materials']
for sk,hs in zip(g.j['skins'],h.j['skins']):assert np.array_equal(g.acc(sk['inverseBindMatrices']),h.acc(hs['inverseBindMatrices']))
mi=next(i for i,m in enumerate(g.j['meshes'])if m['name']=='LOD0_G2_BODY');hm=next(m for m in h.j['meshes']if m['name']=='LOD0_G2_BODY');m=g.j['meshes'][mi];assert m['extras']['targetNames']==hm['extras']['targetNames'];assert len(m['primitives'])==6
DT={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
def append_array(x,template):
 a=copy.deepcopy(template);a.pop('sparse',None);a.pop('byteOffset',None);x=np.asarray(x,dtype=DT[a['componentType']]);g.b.extend(b'\0'*((-len(g.b))%4));vi=len(g.j['bufferViews']);g.j['bufferViews'].append(dict(buffer=0,byteOffset=len(g.b),byteLength=x.nbytes));g.b.extend(x.tobytes());a['bufferView']=vi;a['count']=len(x);sh=x.reshape(len(x),-1)
 if 'min'in a:a['min']=sh.min(0).tolist()
 if 'max'in a:a['max']=sh.max(0).tolist()
 ai=len(g.j['accessors']);g.j['accessors'].append(a);return ai
hp=hm['primitives'][1];assert hp['material']==m['primitives'][1]['material'];np1=copy.deepcopy(hp);np1['attributes']={k:append_array(h.acc(ai),h.j['accessors'][ai])for k,ai in hp['attributes'].items()};np1['indices']=append_array(h.acc(hp['indices']),h.j['accessors'][hp['indices']]);np1['targets']=[{k:append_array(h.acc(ai),h.j['accessors'][ai])for k,ai in target.items()}for target in hp['targets']];assert len(np1['targets'])==16
for t in hp['targets']:
 for ai in t.values():assert np.count_nonzero(h.acc(ai))==0
m['primitives'][1]=np1
p=m['primitives'][2];hp=hm['primitives'][2];assert p['material']==hp['material'];assert np.array_equal(g.acc(p['indices']),h.acc(hp['indices']));ids=np.unique(g.acc(p['indices']));assert len(ids)==130
for k in ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0']:
 ai=p['attributes'][k];x=g.acc(ai).copy();x[ids]=h.acc(hp['attributes'][k])[ids];p['attributes'][k]=append_array(x,g.j['accessors'][ai])
assert bytes(g.b[:len(oldbin)])==oldbin;assert g.j['animations']==old['animations'];assert g.j['nodes']==old['nodes'];assert g.j['skins']==old['skins']
for i,(new,prior)in enumerate(zip(g.j['meshes'],old['meshes'])):
 if i!=mi:assert new==prior
 else:
  for j in [0,3,4,5]:assert new['primitives'][j]==prior['primitives'][j]
assert all(c['target']['path']!='weights'for a in g.j['animations']for c in a['channels']);g.j['buffers'][0]['byteLength']=len(g.b);out=O/'character-skirt-v2-normal-h1.glb';assert not out.exists();g.save(str(out));meta=json.loads(Path(args.source_meta).read_text());meta['glb']=out.name;(O/'anim_meta.json').write_text(json.dumps(meta,indent=2));report=dict(source_sha256=g.sha,h1_sha256=h.sha,output_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),metadata_sha256=hashlib.sha256((O/'anim_meta.json').read_bytes()).hexdigest(),body0_untouched=True,original_bin_prefix_unchanged=True,bone_animation_json_unchanged=True,native_weight_channels=0,h2b_used=False,primitive1_actual_vertices=len(g.acc(np1['attributes']['POSITION'])),primitive2_referenced_vertices=len(ids),scope='Cloud isolated geometry merge only. Existing sole_contact still old foot-frame metadata; shin solver adaptation and merged geometry/GPU acceptance pending.')
(O/'merge-manifest.json').write_text(json.dumps(report,indent=2));print(report)
