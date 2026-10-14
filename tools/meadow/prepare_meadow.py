#!/usr/bin/env python3
"""Deterministic Cocos compatibility derivative. Never alter the authorized source ZIP.
Expand GPU instances into eight merged meshes (not 1150 draw-call nodes), turn
wind-data COLOR_0 into actual root/tip color, move wind weight/phase into UV1.
Keep source geometry, anchors, materials, cameras and windmill keys unchanged.
"""
import argparse,copy,hashlib,json,math,struct,uuid
from pathlib import Path
from PIL import Image
EXPECTED='8349b9a8f39203e6eb9bcc6296a9cf55f690cba7e659058223cc4ff0a6afe712'
def rotate(q,v):
 x,y,z,w=q; a,b,c=v; t=[2*(y*c-z*b),2*(z*a-x*c),2*(x*b-y*a)]
 return [a+w*t[0]+y*t[2]-z*t[1],b+w*t[1]+z*t[0]-x*t[2],c+w*t[2]+x*t[1]-y*t[0]]
def prepare(source,destination):
 raw=(source/'meadow_greybox_v0_8.glb').read_bytes();assert hashlib.sha256(raw).hexdigest()==EXPECTED
 size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);offset=20+size;blob=bytearray(raw[offset+8:offset+8+struct.unpack_from('<I',raw,offset)[0]])
 def read(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];cnt={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];w=struct.calcsize(fmt)*cnt;stride=v.get('byteStride',w);start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [list(struct.unpack_from('<'+fmt*cnt,blob,start+j*stride))for j in range(a['count'])]
 def write(values,typ,ctype=5126):
  while len(blob)%4:blob.append(0)
  offset=len(blob);fmt={5126:'f',5125:'I',5123:'H'}[ctype]
  for row in values:blob.extend(struct.pack('<'+fmt*len(row),*row))
  vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(blob)-offset})
  a={'bufferView':vi,'componentType':ctype,'count':len(values),'type':typ}
  if typ=='VEC3':a.update(min=[min(x[i]for x in values)for i in range(3)],max=[max(x[i]for x in values)for i in range(3)])
  i=len(g['accessors']);g['accessors'].append(a);return i
 palette=Image.open(source/'textures/meadow_palette_256.png').convert('RGB')
 def linear(v):
  v=v/255;return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 def color(uv):return [linear(v)for v in palette.getpixel((min(255,max(0,int(uv[0]*256))),min(255,max(0,int(uv[1]*256)))))]
 expanded=[]
 for node in g['nodes']:
  ext=node.get('extensions',{}).get('EXT_mesh_gpu_instancing')
  if not ext:continue
  inst=ext['attributes'];translations=read(inst['TRANSLATION']);rotations=read(inst['ROTATION']);scales=read(inst['SCALE']);root=read(inst['_ROOT_COLOR'])if'_ROOT_COLOR'in inst else None
  mesh=g['meshes'][node['mesh']];new=copy.deepcopy(mesh);new['name']=node['name']+'_merged';triangles=0
  for primitive in new['primitives']:
   assert primitive.get('mode',4)==4;original={k:read(i)for k,i in primitive['attributes'].items()};indices=read(primitive['indices']);out={k:[]for k in original if not k.startswith('_')};out['COLOR_0']=[]
   if root:out['TEXCOORD_1']=[]
   outIndices=[];vertexCount=len(original['POSITION'])
   for k,(t,q,s)in enumerate(zip(translations,rotations,scales)):
    for j,p in enumerate(original['POSITION']):
     pp=rotate(q,[p[a]*s[a]for a in range(3)]);out['POSITION'].append([pp[a]+t[a]for a in range(3)])
     if 'NORMAL'in original:
      normal=rotate(q,[original['NORMAL'][j][a]/s[a]for a in range(3)]);length=math.sqrt(sum(a*a for a in normal));out['NORMAL'].append([a/length for a in normal])
     for name,values in original.items():
      if name in ['POSITION','NORMAL','COLOR_0']or name.startswith('_')or(root and name=='TEXCOORD_1'):continue
      out[name].append(values[j])
     if root:
      data=original['COLOR_0'][j];weight=data[0];f=max(0,min(1,(weight-.05)/.9));f=f*f*(3-2*f)
      tip=[color(original['TEXCOORD_0'][j])[a]*.4+linear([196,230,90][a])*.6 for a in range(3)]
      out['COLOR_0'].append([root[k][a]*(1-f)+tip[a]*f for a in range(3)]+[data[3]])
      out['TEXCOORD_1'].append([weight,2*math.pi*((t[0]*.944+t[2]*-.330)/26+data[1])])
     else:out['COLOR_0'].append(original.get('COLOR_0',[[1,1,1,1]]*vertexCount)[j])
    outIndices.extend([[v[0]+k*vertexCount]for v in indices])
   primitive['attributes']={name:write(values,'VEC'+str(len(values[0])))for name,values in out.items()};primitive['indices']=write(outIndices,'SCALAR',5123 if len(out['POSITION'])<=65535 else 5125);triangles+=len(outIndices)//3
  node['mesh']=len(g['meshes']);g['meshes'].append(new);node['extensions'].pop('EXT_mesh_gpu_instancing');
  if not node['extensions']:node.pop('extensions')
  expanded.append({'node':node['name'],'instances':len(translations),'triangles':triangles,'grassWind':bool(root)})
 g['extensionsUsed']=[e for e in g.get('extensionsUsed',[])if e!='EXT_mesh_gpu_instancing'];g['scenes'][g.get('scene',0)]['name']='env_meadow'
 g['asset']['extras']={'sourceSHA256':EXPECTED,'derivative':'Cocos merged GPU-instance compatibility; wind data UV1 and color alpha','sourceVersion':'GGbot meadow v0.8.0'}
 # Remove orphan template meshes and original instance accessors/data so the
 # importer cannot create redundant assets. Retain all image/animation buffers.
 used=sorted({n['mesh'] for n in g['nodes'] if 'mesh' in n});remap={v:i for i,v in enumerate(used)}
 for n in g['nodes']:
  if 'mesh' in n:n['mesh']=remap[n['mesh']]
 g['meshes']=[g['meshes'][i]for i in used]
 access=set()
 for m in g['meshes']:
  for p in m['primitives']:access.update(p['attributes'].values());access.add(p['indices'])
 for a in g.get('animations',[]):
  for s in a['samplers']:access.add(s['input']);access.add(s['output'])
 access=sorted(access);amap={v:i for i,v in enumerate(access)}
 for m in g['meshes']:
  for p in m['primitives']:p['attributes']={k:amap[v]for k,v in p['attributes'].items()};p['indices']=amap[p['indices']]
 for a in g.get('animations',[]):
  for s in a['samplers']:s['input']=amap[s['input']];s['output']=amap[s['output']]
 # Capture loop keys before compacting the accessors used by read().
 originalAnim=copy.deepcopy(g['animations'][0]);originalSampler=g['animations'][0]['samplers'][0]
 oldInput=access[originalSampler['input']];oldOutput=access[originalSampler['output']]
 windTimes=[v[0]for v in read(oldInput)];windQuats=read(oldOutput)
 g['accessors']=[g['accessors'][i]for i in access]
 views=sorted({a['bufferView']for a in g['accessors']}|{im['bufferView']for im in g.get('images',[])if'bufferView'in im});vmap={v:i for i,v in enumerate(views)};newBlob=bytearray();newViews=[]
 for vi in views:
  old=g['bufferViews'][vi];start=old.get('byteOffset',0)
  while len(newBlob)%4:newBlob.append(0)
  newViews.append({**old,'byteOffset':len(newBlob)});newBlob.extend(blob[start:start+old['byteLength']])
 for a in g['accessors']:a['bufferView']=vmap[a['bufferView']]
 for im in g.get('images',[]):
  if'bufferView'in im:im['bufferView']=vmap[im['bufferView']]
 g['bufferViews']=newViews;blob=newBlob
 g['buffers'][0]['byteLength']=len(blob)
 js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4)
 result=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
 destination.mkdir(parents=True,exist_ok=True);(destination/'env_meadow.glb').write_bytes(result)
 cameras={}
 for n in g['nodes']:
  if'camera'not in n:continue
  d=rotate(n.get('rotation',[0,0,0,1]),[0,0,-1]);p=n['translation'];cameras[n['name']]={'position':p,'target':[p[i]+60*d[i]for i in range(3)],'fovVerticalDeg':g['cameras'][n['camera']]['perspective']['yfov']*180/math.pi}
 anim=g['animations'][0];times=windTimes;quats=windQuats
 report={'sourceSHA256':EXPECTED,'derivedSHA256':hashlib.sha256(result).hexdigest(),'derivedBytes':len(result),'expanded':expanded,'cameras':cameras,'windmill':{'target':'windmill_sail_hub','clip':anim['name'],'seconds':times[-1],'times':times,'quaternions':quats},'sourceVersion':'v0.8.0','approval':'Candidate integration; latest scene within inspected Drive folder/revision scope, not final user visual approval'}
 (destination/'meadow-source.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k not in['cameras','windmill']},indent=2))
 return report
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path);a=parser.parse_args();prepare(a.source,a.destination)
