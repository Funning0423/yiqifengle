"""Verify frozen hashes and the repair envelope. Does not rerun historical CPU pose or Cocos/GPU tests."""
from pathlib import Path
import json,copy,hashlib,sys,numpy as np
O=Path(__file__).resolve().parent
sys.path.insert(0,str(O.parent/'tools'))
from glb_io import GLB
manifest=json.loads((O/'manifest.json').read_text())
for name,expected in manifest['files'].items():
 assert hashlib.sha256((O/name).read_bytes()).hexdigest()==expected,'Hash mismatch: '+name
S=O.parent/'character-skirt-v2-normal-h1.glb';D=O/'character-skirt-v2-normal-h1-cocos-attrs-r1.glb';s=GLB(S);d=GLB(D);meta=json.loads((O/'anim_meta.json').read_text());sm=json.loads(S.with_name('anim_meta.json').read_text());report={'scope':'Portable file/hash and canonical target delta verification only. Historical 345-frame replay is separately recorded in cpu-verification.json. Actual Creator importer and GPU rerun pending. Keep h1-preview old-solver-disable gate.', 'source_sha256':s.sha,'output_sha256':d.sha,'checks':{}}
def ck(k,v):report['checks'][k]=bool(v);assert v,k
ck('expected_source_sha',s.sha=='af5c0efa865211679610a785c39bdf19a1c8ea5720be8fa769ddae06da90c20d')
ck('old_bin_prefix_bitwise_equal',d.b[:len(s.b)]==s.b)
ck('all_original_accessor_json_equal',d.j['accessors'][:len(s.j['accessors'])]==s.j['accessors'])
ck('all_original_bufferView_json_equal',d.j['bufferViews'][:len(s.j['bufferViews'])]==s.j['bufferViews'])
ck('all_original_accessor_values_equal',all(np.array_equal(s.acc(i),d.acc(i))for i in range(len(s.j['accessors']))))
allowed=copy.deepcopy(s.j);added=[];sets=[]
for mi,(a,b)in enumerate(zip(s.j['meshes'],d.j['meshes'])):
 ck(a['name']+'_target_names_and_weights_equal',a.get('extras',{}).get('targetNames')==b.get('extras',{}).get('targetNames')and a.get('weights')==b.get('weights'))
 counts=[]
 for pi,(ap,bp)in enumerate(zip(a['primitives'],b['primitives'])):
  n=s.j['accessors'][ap['attributes']['POSITION']]['count'];counts.append(len(bp.get('targets',[])));attrs={tuple(sorted(t))for t in bp.get('targets',[])};sets.append({'mesh':a['name'],'primitive':pi,'targets':len(bp.get('targets',[])),'attribute_sets':[list(x)for x in attrs]});assert len(attrs)<=1
  assert len(ap.get('targets',[]))==len(bp.get('targets',[]))
  for ti,(at,bt)in enumerate(zip(ap.get('targets',[]),bp.get('targets',[]))):
   assert at.keys()<=bt.keys()
   for k in bt.keys()-at.keys():
    assert k=='NORMAL'and ((mi==0 and pi==0 and ti in range(29,37))or(mi==3 and pi==0 and ti==32));ai=bt[k];acc=d.j['accessors'][ai];assert acc['count']==n and acc['type']=='VEC3'and acc['componentType']==5126 and ai>=len(s.j['accessors']);assert np.all(d.acc(ai)==0);allowed['meshes'][mi]['primitives'][pi]['targets'][ti][k]=ai;added.append([mi,pi,ti])
   # Canonical omitted delta = zero. Exact tensors imply equivalence for arbitrary weights, poses and worlds.
   for k in {'POSITION','NORMAL','TANGENT'}:
    x=s.acc(at[k])if k in at else np.zeros((n,3),dtype='<f4');y=d.acc(bt[k])if k in bt else np.zeros((n,3),dtype='<f4');assert np.array_equal(x,y)
 ck(a['name']+'_same_target_count_across_primitives',len(set(counts))<=1)
allowed['accessors']=d.j['accessors'];allowed['bufferViews']=d.j['bufferViews'];allowed['buffers']=d.j['buffers'];ck('only_nine_normal_keys_two_accessors_added',len(added)==9 and len(d.j['accessors'])==len(s.j['accessors'])+2 and len(d.j['bufferViews'])==len(s.j['bufferViews'])+2);ck('all_other_json_exact',allowed==d.j)
ck('all_targets_canonical_delta_tensors_exact',True);ck('zero_native_weights',all(c['target']['path']!='weights'for a in d.j['animations']for c in a['channels']))
sm['glb']=D.name;ck('metadata_only_glb_name_changed',meta==sm);ck('source_files_untouched',hashlib.sha256(S.read_bytes()).hexdigest()==s.sha and hashlib.sha256(S.with_name('anim_meta.json').read_bytes()).hexdigest()=='aeaa23399c6dba01871f8303da704e5ca053e5b56c11398125ce6aa1587249bb')
report['primitive_attributes']=sets

ck('expected_output_sha',d.sha=='8a79b26ec12d4e248abe14310dd75febca433a15097b1f22ea94144cd3f5a592')
ck('expected_metadata_sha',hashlib.sha256((O/'anim_meta.json').read_bytes()).hexdigest()=='6d775f7779127f2254aa18f243f7cd2a0fcba177564c8ca1c921eed42684182c')
report['status']='PASS'
print(json.dumps(report,indent=2))
