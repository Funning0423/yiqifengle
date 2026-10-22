"""Exact-input append-only Cocos import compatibility repair. Never edits source/Mac assets.
Only add zero NORMAL accessors to APRON targets29..36 and DRESS target32.
"""
from pathlib import Path
import json,hashlib,struct,copy,argparse
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source',type=Path,required=True);ap.add_argument('--meta',type=Path,required=True);ap.add_argument('--out-dir',type=Path,required=True);args=ap.parse_args()
O=args.out_dir.resolve();SRC=args.source.resolve();META=(args.meta or SRC.with_name('anim_meta.json')).resolve()
O.mkdir(parents=True,exist_ok=True)
SOURCE_SHA='af5c0efa865211679610a785c39bdf19a1c8ea5720be8fa769ddae06da90c20d'
META_SHA='aeaa23399c6dba01871f8303da704e5ca053e5b56c11398125ce6aa1587249bb'
DST=O/'character-skirt-v2-normal-h1-cocos-attrs-r1.glb';DM=O/'anim_meta.json';REPORT=O/'repair-manifest.json'
assert not any(p.exists()for p in [DST,DM,REPORT]),'Refuse overwrite'
raw=SRC.read_bytes();mb=META.read_bytes();assert hashlib.sha256(raw).hexdigest()==SOURCE_SHA;assert hashlib.sha256(mb).hexdigest()==META_SHA
assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
p=12;parts=[]
while p<len(raw):
 n,k=struct.unpack_from('<II',raw,p);parts.append((k,raw[p+8:p+8+n]));p+=8+n
assert len(parts)==2 and parts[0][0]==0x4e4f534a and parts[1][0]==0x004e4942
g=json.loads(parts[0][1]);old=copy.deepcopy(g);oldbin=parts[1][1];b=bytearray(oldbin);added=[]
for name,indices,count in [('LOD0_G2_APRON',list(range(29,37)),690),('LOD0_G2_DRESS',[32],5721)]:
 mi=next(i for i,m in enumerate(g['meshes'])if m['name']==name);m=g['meshes'][mi];assert len(m['primitives'])==1;p=m['primitives'][0];assert g['accessors'][p['attributes']['POSITION']]['count']==count
 assert [i for i,t in enumerate(p['targets'])if set(t)=={'POSITION'}]==indices
 for i,t in enumerate(p['targets']):assert set(t)==({'POSITION'}if i in indices else {'POSITION','NORMAL'})
 b.extend(b'\0'*((-len(b))%4));offset=len(b);nbytes=count*3*4;vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':nbytes});b.extend(b'\0'*nbytes);ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':5126,'count':count,'type':'VEC3','min':[0,0,0],'max':[0,0,0]})
 for ti in indices:p['targets'][ti]['NORMAL']=ai;added.append({'mesh_index':mi,'mesh':name,'primitive':0,'target_index':ti,'target_name':m['extras']['targetNames'][ti],'normal_accessor':ai,'count':count,'zero_float32_bytes':nbytes})
g['buffers'][0]['byteLength']=len(b)
assert bytes(b[:len(oldbin)])==oldbin and g['animations']==old['animations']
for m in g['meshes']:
 for p in m['primitives']:
  if p.get('targets'):assert len({tuple(sorted(t))for t in p['targets']})==1
j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4)
out=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b
meta=json.loads(mb);meta['glb']=DST.name
DST.write_bytes(out);DM.write_text(json.dumps(meta,indent=2))
r={'source_path':SRC.name,'source_sha256':SOURCE_SHA,'source_metadata_sha256':META_SHA,'output_path':DST.name,'output_sha256':hashlib.sha256(out).hexdigest(),'metadata_path':DM.name,'metadata_sha256':hashlib.sha256(DM.read_bytes()).hexdigest(),'added_zero_normal_references':added,'new_accessors':2,'new_bin_bytes':len(b)-len(oldbin),'original_binary_prefix_unchanged':True,'target_counts':{'APRON':53,'DRESS':49,'BODY_each':16},'native_weights_channels':0,'source_not_overwritten':True,'contact':'Unchanged old sole_contact. Preserve the Mac existing h1-preview gate that disables old foot solver; do not revert gate or claim contact fixed.','scope':'Cocos target-attribute shape compatibility repair only. Actual importer/build/GPU rerun pending. No v9 sculpt, new geometry, new normal fit, or solver change.'}
REPORT.write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
