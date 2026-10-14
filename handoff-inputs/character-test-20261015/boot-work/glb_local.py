"""Lossless, bounded glTF 2.0 binary access; never exports via Blender."""
import hashlib, json, struct
from pathlib import Path
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}
def sha(data): return hashlib.sha256(data).hexdigest()
class Glb:
 def __init__(self,path):
  self.path=Path(path); self.raw=self.path.read_bytes()
  magic,version,size=struct.unpack_from('<III',self.raw)
  assert magic==0x46546c67 and version==2 and size==len(self.raw)
  self.chunks=[]; p=12
  while p<len(self.raw):
   n,t=struct.unpack_from('<I4s',self.raw,p); self.chunks.append((t,p+8,n)); p+=8+n
  assert p==len(self.raw)
  jt=next(c for c in self.chunks if c[0]==b'JSON'); bt=next(c for c in self.chunks if c[0]==b'BIN\0')
  self.j=json.loads(self.raw[jt[1]:jt[1]+jt[2]]); self.bin_offset=bt[1]; self.b=bytearray(self.raw[bt[1]:bt[1]+bt[2]])
 def view(self,index):
  v=self.j['bufferViews'][index]; o=v.get('byteOffset',0); return bytes(self.b[o:o+v['byteLength']])
 def accessor(self,index):
  a=self.j['accessors'][index]; nc=NC[a['type']]; dt=np.dtype(DT[a['componentType']])
  if 'bufferView' in a:
   v=self.j['bufferViews'][a['bufferView']]; off=v.get('byteOffset',0)+a.get('byteOffset',0)
   out=np.ndarray((a['count'],nc),dt,buffer=self.b,offset=off,strides=(v.get('byteStride',nc*dt.itemsize),dt.itemsize)).copy()
  else: out=np.zeros((a['count'],nc),dt)
  if 'sparse' in a:
   s=a['sparse']; ix=s['indices']; vv=s['values']; vi=self.j['bufferViews'][ix['bufferView']]; vd=self.j['bufferViews'][vv['bufferView']]
   ids=np.frombuffer(self.b,DT[ix['componentType']],s['count'],vi.get('byteOffset',0)+ix.get('byteOffset',0))
   vals=np.frombuffer(self.b,dt,s['count']*nc,vd.get('byteOffset',0)+vv.get('byteOffset',0)).reshape(-1,nc); out[ids]=vals
  return out
 def write_accessor(self,index,arr):
  a=self.j['accessors'][index]; assert 'sparse' not in a
  nc=NC[a['type']]; dt=np.dtype(DT[a['componentType']]); arr=np.asarray(arr,dtype=dt); assert arr.shape==(a['count'],nc)
  v=self.j['bufferViews'][a['bufferView']]; off=v.get('byteOffset',0)+a.get('byteOffset',0)
  dst=np.ndarray(arr.shape,dt,buffer=self.b,offset=off,strides=(v.get('byteStride',nc*dt.itemsize),dt.itemsize)); dst[:]=arr
 def write_lossless(self,path):
  out=bytearray(self.raw); out[self.bin_offset:self.bin_offset+len(self.b)]=self.b
  Path(path).parent.mkdir(parents=True,exist_ok=True); Path(path).write_bytes(out)
 def primitive(self,name): return next(m for m in self.j['meshes'] if m['name']==name)['primitives'][0]
 def fingerprint(self):
  return {'file_sha256':sha(self.raw),'bytes':len(self.raw),'json_sha256':sha(json.dumps(self.j,sort_keys=True).encode()),'nodes':self.j['nodes'],'skins':self.j['skins'],'materials':self.j['materials'],
   'accessors':{str(i):sha(self.accessor(i).tobytes()) for i in range(len(self.j['accessors']))},
   'animations':{a['name']:{'channels':a['channels'],'samplers':a['samplers'],'data_sha256':sha(b''.join(self.accessor(s[k]).tobytes() for s in a['samplers'] for k in ('input','output')))} for a in self.j['animations']},
   'images':[sha(self.view(i['bufferView'])) for i in self.j.get('images',[]) if 'bufferView' in i]}
