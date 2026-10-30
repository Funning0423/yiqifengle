#!/usr/bin/env python3
"""qfinst v2：分块存储。每个网格 = 模板段 + 若干实例块；每块 ≤ CHUNK_V 个展开顶点（按实例整除）。
存储为未压缩连续段（出货时由微信分包 zip / http gzip 压缩，运行时 0 解压）；每块数据自包含，可单独 DataView 读取。
用法: python3 bake2.py <env_meadow.glb> <out.qfi2> [CHUNK_V=1024]"""
import json,struct,sys,zlib,numpy as np
exec(open(__file__.replace('bake2.py','bake.py')).read().split("def main")[0])
def main(src,out,CV=1024):
  CV=int(CV);j,bn=glb(src);hdr={'v':2,'chunkV':CV,'meshes':[]};blobs=[];off=0
  def put(arr):
    nonlocal off;b=np.ascontiguousarray(arr).tobytes();pad=(-len(b))%4;blobs.append(b+b'\0'*pad);o=off;off+=len(b)+pad;return [o,len(b),str(arr.dtype)]
  for n in j['nodes']:
    nm=n.get('name')
    if nm not in CNT:continue
    p=j['meshes'][n['mesh']]['primitives'][0];N=CNT[nm];A={k:acc(j,bn,v).astype(np.float64) for k,v in p['attributes'].items()};I=acc(j,bn,p['indices']).ravel()
    V=len(A['POSITION'])//N;K=len(I)//N;tI=I[:K];P=A['POSITION'].reshape(N,V,3);T=P[0]
    inst=np.zeros((N,8),np.float32)
    for k in range(N):s,R,t=umeyama(T,P[k]);inst[k]=[*t,*mat2q(R),s]
    m={'name':nm,'n':N,'v':V,'k':K,'tpl':{'idx':put(tI.astype(np.uint16)),'POSITION':put(T.astype(np.float32))},'attrs':{},'chunks':[]}
    per={}  # attr -> (mode, per-instance array or None)
    for a,arr in A.items():
      if a=='POSITION':continue
      X=arr.reshape(N,V,-1)
      if a=='NORMAL':m['attrs'][a]={'mode':'rot','c':3};m['tpl'][a]=put(X[0].astype(np.float32));continue
      if np.allclose(X,X[0],atol=1e-6):m['attrs'][a]={'mode':'tpl','c':X.shape[2]};m['tpl'][a]=put(X[0].astype(np.float32));continue
      if a=='COLOR_0':m['attrs'][a]={'mode':'u8','c':X.shape[2]};per[a]=np.round(np.clip(X,0,1)*255).astype(np.uint8);continue
      D=X-X[0:1];o_=D[:,0,:];assert np.abs(D-o_[:,None,:]).max()<1e-5,a
      cols=[c for c in range(X.shape[2]) if np.abs(o_[:,c]).max()>0];m['attrs'][a]={'mode':'tplPlusOffset','c':X.shape[2],'cols':cols};m['tpl'][a]=put(X[0].astype(np.float32));per[a]=o_[:,cols].astype(np.float32)
    ipc=max(1,CV//V)
    for s0 in range(0,N,ipc):
      s1=min(N,s0+ipc);ch={'i0':s0,'n':s1-s0,'xf':put(inst[s0:s1])}
      for a,v in per.items():ch[a]=put(v[s0:s1])
      m['chunks'].append(ch)
    hdr['meshes'].append(m);print(nm,'N',N,'V',V,'inst/chunk',ipc,'chunks',len(m['chunks']))
  H=json.dumps(hdr,separators=(',',':')).encode();raw=b'QFI2'+struct.pack('<I',len(H))+H+b'\0'*((-len(H))%4)+b''.join(blobs)
  open(out,'wb').write(raw);print('raw',len(raw),'deflate9(≈出货 zip)',len(zlib.compress(raw,9)))
if __name__=='__main__':main(*sys.argv[1:4])
