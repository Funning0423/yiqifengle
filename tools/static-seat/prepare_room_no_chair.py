#!/usr/bin/env python3
"""Derive seat-preview room. Preserve source bytes/JSON except one primitive indices+Draco decode.
Original GLB never overwritten. Full chair selection is exact complete connected components.
"""
import argparse,json,hashlib,struct,copy,sys
from pathlib import Path
import numpy as np
from glb_local import Glb
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--decoded',required=True);p.add_argument('--chair',required=True);p.add_argument('--out',required=True);a=p.parse_args()
src=Glb(a.source);dec=Glb(a.decoded);assert hashlib.sha256(src.raw).hexdigest()=='1d9c4b56f601677f2dd59849fd8b9ada7509c7f72dd0f6e03fca784fe841f5d3';assert hashlib.sha256(dec.raw).hexdigest()=='7d336918443e103705d4cdc8c62744086d79237465d17ed236bdae231f5ba8c4'
out=Path(a.out);assert out.resolve()!=Path(a.source).resolve();out.parent.mkdir(parents=True,exist_ok=True)
chair=np.load(a.chair);remove=np.asarray(chair['source_triangle_indices'],int);assert len(remove)==512
mi=next(i for i,m in enumerate(src.j['meshes']) if m['name']=='env_interior_props_merged');dmi=next(i for i,m in enumerate(dec.j['meshes']) if m['name']=='env_interior_props_merged');assert mi==dmi
pr=copy.deepcopy(dec.j['meshes'][mi]['primitives'][0]);d=copy.deepcopy(src.j);b=bytearray(src.b);original_bin=bytes(b);original_pr=copy.deepcopy(src.j['meshes'][mi]['primitives'][0]);assert len(src.j['meshes'][mi]['primitives'])==1
P=dec.accessor(pr['attributes']['POSITION']);F=dec.accessor(pr['indices']).reshape(-1,3);assert np.max(remove)<len(F);assert np.array_equal(np.sort(np.unique(F[remove])),np.sort(chair['source_vertex_indices']))
keep=np.ones(len(F),bool);keep[remove]=False;NF=F[keep].reshape(-1,1);new_pr=copy.deepcopy(original_pr);new_pr.get('extensions',{}).pop('KHR_draco_mesh_compression',None)
if not new_pr.get('extensions'):new_pr.pop('extensions',None)
def append_accessor(ai,arr):
 arr=np.ascontiguousarray(arr);b.extend(b'\0'*((-len(b))%4));off=len(b);b.extend(arr.tobytes());v={'buffer':0,'byteOffset':off,'byteLength':arr.nbytes};vi=len(d['bufferViews']);d['bufferViews'].append(v);ac=copy.deepcopy(dec.j['accessors'][ai]);ac['bufferView']=vi;ac.pop('byteOffset',None);ac.pop('sparse',None);ac['count']=len(arr)
 if 'min' in ac:ac['min']=arr.min(0).tolist()
 if 'max' in ac:ac['max']=arr.max(0).tolist()
 idx=len(d['accessors']);d['accessors'].append(ac);return idx
new_pr['attributes']={key:append_accessor(ai,dec.accessor(ai)) for key,ai in pr['attributes'].items()};new_pr['indices']=append_accessor(pr['indices'],NF);d['meshes'][mi]['primitives'][0]=new_pr;d['buffers'][0]['byteLength']=len(b)
# All existing buffers, views, accessors, nodes, materials and other mesh JSON remain exact.
assert bytes(b[:len(original_bin)])==original_bin
for key in ['nodes','skins','animations','materials','images','textures','samplers','scenes']:
 assert d.get(key)==src.j.get(key),key
assert d['accessors'][:len(src.j['accessors'])]==src.j['accessors'];assert d['bufferViews'][:len(src.j['bufferViews'])]==src.j['bufferViews']
for i in range(len(d['meshes'])):
 if i!=mi:assert d['meshes'][i]==src.j['meshes'][i]
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4);raw=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(b))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b;out.write_bytes(raw)
r=Glb(out);assert np.array_equal(r.accessor(new_pr['indices']).reshape(-1,3),F[keep]);attributes={}
for key,ai in new_pr['attributes'].items():
 aa=r.accessor(ai);bb=dec.accessor(pr['attributes'][key]);assert aa.tobytes()==bb.tobytes();attributes[key]=hashlib.sha256(aa.tobytes()).hexdigest()
assert Path(a.source).read_bytes()==src.raw
report={'source_sha256':hashlib.sha256(src.raw).hexdigest(),'decoded_sha256':hashlib.sha256(dec.raw).hexdigest(),'chair_selection_sha256':hashlib.sha256(Path(a.chair).read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'mesh_index':mi,'removed_complete_chair_triangles':len(remove),'before_triangles':len(F),'after_triangles':len(F[keep]),'original_binary_prefix_unchanged':True,'other_meshes_nodes_materials_images_unchanged':True,'attribute_arrays_equal_decoded_source':attributes,'scope':'Preview room only: chair is absent for fused seated heroine+stool. Not suitable for standing/walk scene without a separately rebuilt stool. No animation integration acceptance.'};out.with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
