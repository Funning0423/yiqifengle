#!/usr/bin/env python3
"""GLB accessor and append-only writer helpers; numpy required."""
import argparse, hashlib, json, struct
from pathlib import Path
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class GLB:
 def __init__(self,path):
  raw=Path(path).read_bytes();self.sha=hashlib.sha256(raw).hexdigest();self.raw=raw;off=12
  while off<len(raw):
   n,typ=struct.unpack_from('<II',raw,off);b=raw[off+8:off+8+n];off+=8+n
   if typ==0x4e4f534a:self.j=json.loads(b)
   elif typ==0x004e4942:self.b=b
 def view(self,vi,off,dtype,count,nc=1):
  v=self.j['bufferViews'][vi];dt=np.dtype(dtype);stride=v.get('byteStride',nc*dt.itemsize)
  return np.ndarray((count,nc),dtype=dt,buffer=self.b,offset=v.get('byteOffset',0)+off,strides=(stride,dt.itemsize)).copy()
 def acc(self,i):
  a=self.j['accessors'][i];n=a['count'];nc=NC[a['type']];dt=DT[a['componentType']]
  x=self.view(a['bufferView'],a.get('byteOffset',0),dt,n,nc) if 'bufferView'in a else np.zeros((n,nc),dtype=dt)
  if 'sparse'in a:
   s=a['sparse'];ix=s['indices'];va=s['values'];ids=self.view(ix['bufferView'],ix.get('byteOffset',0),DT[ix['componentType']],s['count']).ravel();x[ids]=self.view(va['bufferView'],va.get('byteOffset',0),dt,s['count'],nc)
  if a.get('normalized'):x=np.maximum(x/np.iinfo(x.dtype).max,-1)
  return x
 def save(self,p):
  b=self.b+b'\0'*((-len(self.b))%4);j=json.dumps(self.j,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
  Path(p).write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
