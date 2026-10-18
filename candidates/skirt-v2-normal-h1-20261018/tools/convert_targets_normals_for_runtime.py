"""Strict, copy-only AP/DRESS target transplant. Never writes source or enables native morph tracks."""
from pathlib import Path
import argparse,copy,hashlib,json,sys,numpy as np
from glb_io import GLB
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--source-sha',required=True);p.add_argument('--meta',required=True);p.add_argument('--meta-sha',required=True);p.add_argument('--output',required=True);p.add_argument('--output-meta',required=True);p.add_argument('--preview',required=True);p.add_argument('--preview-sha',required=True);p.add_argument('--preview-meta',required=True);p.add_argument('--preview-meta-sha',required=True);p.add_argument('--reference',required=True);p.add_argument('--reference-sha',required=True);args=p.parse_args();O=Path(__file__).parent
src=Path(args.source);dst=Path(args.output);mp=Path(args.meta);outmeta=Path(args.output_meta)
assert src.resolve()!=dst.resolve() and mp.resolve()!=outmeta.resolve(),'Source overwrite forbidden'
assert not dst.exists() and not outmeta.exists(),'Output overwrite forbidden'
assert hashlib.sha256(src.read_bytes()).hexdigest()==args.source_sha,'Source SHA mismatch';assert hashlib.sha256(mp.read_bytes()).hexdigest()==args.meta_sha,'Metadata SHA mismatch'
g=GLB(str(src));h=GLB(args.preview);assert h.sha==args.preview_sha,'Preview SHA mismatch';reference=GLB(args.reference);assert reference.sha==args.reference_sha,'Reference SHA mismatch';assert hashlib.sha256(Path(args.preview_meta).read_bytes()).hexdigest()==args.preview_meta_sha,'Preview metadata SHA mismatch';old_json=copy.deepcopy(g.j);oldbin=bytes(g.b);g.b=bytearray(g.b)
assert all(c['target']['path']!='weights'for a in g.j['animations']for c in a['channels']),'Production input must have zero native weights channels'
assert len(g.j['skins'])==len(reference.j['skins'])
for x,y in zip(g.j['skins'],reference.j['skins']):
 assert [g.j['nodes'][i]['name']for i in x['joints']]==[reference.j['nodes'][i]['name']for i in y['joints']],'Joint mapping mismatch'
 assert np.array_equal(g.acc(x['inverseBindMatrices']),reference.acc(y['inverseBindMatrices'])),'Inverse bind mismatch'
meta=json.loads(mp.read_text());preview_meta=json.load(open(args.preview_meta));added=[]
def add(x):
 x=np.asarray(x,dtype='<f4').reshape(-1,3);g.b.extend(b'\0'*((-len(g.b))%4));vi=len(g.j['bufferViews']);g.j['bufferViews'].append(dict(buffer=0,byteOffset=len(g.b),byteLength=x.nbytes));g.b.extend(x.tobytes());ai=len(g.j['accessors']);g.j['accessors'].append(dict(bufferView=vi,componentType=5126,count=len(x),type='VEC3',min=x.min(0).tolist(),max=x.max(0).tolist()));return ai
for name,prefix in [('LOD0_G2_DRESS','front_yellow_drape_oct18'),('LOD0_G2_APRON','apron_source_support_')]:
 mi=next(i for i,m in enumerate(g.j['meshes'])if m['name']==name);m=g.j['meshes'][mi];r=next(m for m in reference.j['meshes']if m['name']==name);cand=next(m for m in h.j['meshes']if m['name']==name);q=m['primitives'][0];rp=r['primitives'][0];cp=cand['primitives'][0];assert len(m['primitives'])==len(r['primitives'])==1
 assert m['extras']['targetNames']==r['extras']['targetNames'],'Old target name/order mismatch'
 assert set(q['attributes'])==set(rp['attributes'])
 for key in q['attributes']:assert np.array_equal(g.acc(q['attributes'][key]),reference.acc(rp['attributes'][key])),f'{name} {key} mismatch'
 assert np.array_equal(g.acc(q['indices']),reference.acc(rp['indices'])),'Topology mismatch'
 assert len(q['targets'])==len(rp['targets'])
 for i,(x,y)in enumerate(zip(q['targets'],rp['targets'])):
  assert set(x)==set(y)
  for key in x:assert np.array_equal(g.acc(x[key]),reference.acc(y[key])),f'Old target {i}/{key} mismatch'
 for i,targetname in enumerate(cand['extras']['targetNames']):
  if i<len(rp['targets']):continue
  assert targetname.startswith(prefix)or targetname.startswith('cloth_normal_'),'Unexpected target family'
  assert targetname not in m['extras']['targetNames'];newidx=len(q['targets']);q['targets'].append({key:add(h.acc(ai))for key,ai in cp['targets'][i].items()});m['extras']['targetNames'].append(targetname);m.setdefault('weights',[0.]*(newidx)).append(0.)
  for node in g.j['nodes']:
   if node.get('mesh')==mi and'weights'in node:node['weights'].append(0.)
  meta['morph']['meshes'][name]['targets'][targetname]=newidx;meta['clips']['walk_loop'].setdefault('morph',{}).setdefault('curves',{})[targetname]=preview_meta['clips']['walk_loop']['morph']['curves'][targetname];added.append(dict(mesh=name,name=targetname,index=newidx))
assert len(added)==sum(len(next(m for m in h.j['meshes']if m['name']==n)['primitives'][0]['targets'])-len(next(m for m in reference.j['meshes']if m['name']==n)['primitives'][0]['targets'])for n in ['LOD0_G2_DRESS','LOD0_G2_APRON'])
assert g.j['animations']==old_json['animations'],'Animations changed'
assert bytes(g.b[:len(oldbin)])==oldbin,'Original buffer modified'
assert g.j['skins']==old_json['skins'],'Skin changed'
for i,(a,b)in enumerate(zip(g.j['meshes'],old_json['meshes'])):
 if a['name']not in ['LOD0_G2_DRESS','LOD0_G2_APRON']:assert a==b,'Non-cloth mesh JSON changed'
g.j['buffers'][0]['byteLength']=len(g.b);meta['glb']=dst.name;dst.parent.mkdir(parents=True,exist_ok=True);g.save(str(dst));outmeta.write_text(json.dumps(meta,indent=2));report=dict(source_sha256=args.source_sha,source_meta_sha256=args.meta_sha,candidate_preview_sha256=h.sha,output_sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),output_meta_sha256=hashlib.sha256(outmeta.read_bytes()).hexdigest(),added=added,original_buffer_prefix_bitwise_unchanged=True,original_animation_json_unchanged=True,native_weights_channels=0,gpu_normals_accepted=False,production_merged=False,scope='Isolated engine-format copy, no source modifications. Preserve source BODY/h1 data; full gameplay acceptance pending.')
Path(str(dst)+'.report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
