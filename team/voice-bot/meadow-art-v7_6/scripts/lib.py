import json,struct,numpy as np
CT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8,5122:np.int16,5120:np.int8}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
  d=open(p,'rb').read();L=struct.unpack('<I',d[12:16])[0];j=json.loads(d[20:20+L]);o=20+L;bl=struct.unpack('<I',d[o:o+4])[0];return j,bytearray(d[o+8:o+8+bl])
def acc(j,b,i):
  a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];n=NC[a['type']];dt=np.dtype(CT[a['componentType']])
  st=bv.get('byteStride',n*dt.itemsize);off=bv.get('byteOffset',0)+a.get('byteOffset',0)
  raw=np.frombuffer(bytes(b[off:off+st*(a['count']-1)+n*dt.itemsize]),np.uint8)
  if st==n*dt.itemsize: return np.frombuffer(raw.tobytes(),dt).reshape(a['count'],n)
  return np.stack([np.frombuffer(raw[k*st:k*st+n*dt.itemsize].tobytes(),dt) for k in range(a['count'])])
def save(p,j,b):
  while len(b)%4:b.append(0)
  j['buffers']=[{'byteLength':len(b)}];js=json.dumps(j,separators=(',',':')).encode()
  js+=b' '*((4-len(js)%4)%4);tot=12+8+len(js)+8+len(b)
  open(p,'wb').write(struct.pack('<4sII',b'glTF',2,tot)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(b),b'BIN\0')+bytes(b))
