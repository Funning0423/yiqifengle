"""Validated post-build correction of winding/normals only. No second Creator build.
Does not establish runtime/GPU acceptance. Inputs: rejected/final GLB, Creator
library mesh descriptor, build output. Checks every imported vertex attribute
and index buffer before writing; all positions/weights/UV/colors remain equal.
"""
import sys,json,hashlib,struct
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'art-src/animation/mocap/scripts'));import rig as R
old,new,descriptor,build,receipt=map(Path,sys.argv[1:]);a=R.Rig(str(old));b=R.Rig(str(new));assert a.J['nodes']==b.J['nodes'] and a.J['animations']==b.J['animations'];am=next(m for m in a.J['meshes'] if m['name']=='LOD0_G2_BODY');bm=next(m for m in b.J['meshes'] if m['name']=='LOD0_G2_BODY');desc=json.loads(descriptor.read_text());assert desc['__type__']=='cc.Mesh';uid=descriptor.stem;native=build/'subpackages/region_island/native/dc'/(uid+'.bin');raw=native.read_bytes();data=bytearray(raw);rows=[]
layout=[('POSITION',0,np.float32,3),('NORMAL',12,np.float32,3),('TEXCOORD_0',24,np.float32,2),('JOINTS_0',32,np.uint16,4),('WEIGHTS_0',40,np.float32,4),('COLOR_0',56,np.float32,3)]
for pi in range(3):
 view=desc['_struct']['vertexBundles'][pi]['view'];assert view['stride']==68
 for key,offset,dtype,n in layout:
  arr=np.ndarray((view['count'],n),dtype,buffer=data,offset=view['offset']+offset,strides=(68,np.dtype(dtype).itemsize));oldarr=R.acc(a.J,a.BIN,am['primitives'][pi]['attributes'][key]);newarr=R.acc(b.J,b.BIN,bm['primitives'][pi]['attributes'][key]);
  if key=='JOINTS_0':
   weights=R.acc(a.J,a.BIN,am['primitives'][pi]['attributes']['WEIGHTS_0']);assert np.array_equal(arr[weights>0],oldarr[weights>0]);assert np.all(arr[weights==0]==0),'Creator prunes unused joint lanes to zero'
  else:assert np.array_equal(arr,oldarr), (pi,key,'native input mismatch')
  if key=='NORMAL':arr[:]=newarr
  else:assert np.array_equal(oldarr,newarr),(pi,key,'unexpected change')
 ix=desc['_struct']['primitives'][pi]['indexView'];assert ix['stride']==2;arr=np.frombuffer(data,np.uint16,count=ix['count'],offset=ix['offset']);assert np.array_equal(arr,R.acc(a.J,a.BIN,am['primitives'][pi]['indices']).ravel());arr[:]=R.acc(b.J,b.BIN,bm['primitives'][pi]['indices']).ravel();rows.append({'primitive':pi,'positionsUVColorsWeightsExact':True,'weightedJointLanesExact':True,'unweightedJointLanesPrunedByCreator':True,'normalsAndIndicesMatchFinalGLB':True})
# Native Mesh.hash getter computes murmurhash2(data,666) whenever serialized
# _hash is zero (Creator 3.8.8 cocos/3d/assets/mesh.ts:339-342).
imports=list((build/'subpackages/region_island/import').rglob('*.json'));oldhash=desc['_hash'];hits=[]
for p in imports:
 text=p.read_text()
 if str(oldhash) in text:hits.append((p,text))
assert len(hits)==1 and hits[0][1].count(str(oldhash))==1,'ambiguous serialized mesh hash'
p,text=hits[0];beforejson=p.read_bytes();newtext=text.replace(str(oldhash),'0');json.loads(newtext);native.write_bytes(data);p.write_text(newtext)
sha=lambda x:hashlib.sha256(x).hexdigest();out={'inputGLBSHA256':sha(old.read_bytes()),'finalGLBSHA256':sha(new.read_bytes()),'nativeFile':str(native),'beforeNativeSHA256':sha(raw),'afterNativeSHA256':sha(data),'bytesChanged':sum(x!=y for x,y in zip(raw,data)),'unchangedNativeLength':len(raw)==len(data),'serializedImportFile':str(p),'beforeImportSHA256':sha(beforejson),'afterImportSHA256':sha(p.read_bytes()),'meshHashRuntimeRecomputed':True,'checks':rows,'CreatorBuildCount':1,'finalRuntimeTest':'NOT_RUN: only s8 recorded rejected input winding candidate; no reopen'};receipt.write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
