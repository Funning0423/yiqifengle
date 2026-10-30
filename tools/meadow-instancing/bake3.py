#!/usr/bin/env python3
"""qfinst v3：分块且每块各自 zlib（level 9）压缩。构建产物按文件字节计 → 存储保持压缩。
每个网格：模板段（zlib）+ 若干实例块（各自 zlib，块内 = xf + 每实例数据）。运行时每帧：inflate 一块 + 展开到最终交错缓冲。
用法: python3 bake3.py <env_meadow.glb> <out.qfi3> [CHUNK_V=1024]"""
import json,struct,sys,zlib,numpy as np
exec(open(__file__.replace('bake3.py','bake.py')).read().split("def main")[0])
class Seg:
  def __init__(s):s.parts=[];s.off=0
  def put(s,arr):
    b=np.ascontiguousarray(arr).tobytes();pad=(-len(b))%4;s.parts.append(b+b'\0'*pad);o=s.off;s.off+=len(b)+pad;return [o,len(b),str(arr.dtype)]
  def bytes(s):return b''.join(s.parts)
def main(src,out,CV=1024):
  CV=int(CV);j,bn=glb(src);hdr={'v':3,'chunkV':CV,'meshes':[]};blobs=[];off=0
  def emit(raw):
    nonlocal off;z=zlib.compress(raw,9);pad=(-len(z))%4;blobs.append(z+b'\0'*pad);o=off;off+=len(z)+pad;return [o,len(z),len(raw)]
  for n in j['nodes']:
    nm=n.get('name')
    if nm not in CNT:continue
    p=j['meshes'][n['mesh']]['primitives'][0];N=CNT[nm];A={k:acc(j,bn,v).astype(np.float64) for k,v in p['attributes'].items()};I=acc(j,bn,p['indices']).ravel()
    V=len(A['POSITION'])//N;K=len(I)//N;tI=I[:K];P=A['POSITION'].reshape(N,V,3);T=P[0]
    inst=np.zeros((N,8),np.float32)
    for k in range(N):s,R,t=umeyama(T,P[k]);inst[k]=[*t,*mat2q(R),s]
    ts=Seg();m={'name':nm,'n':N,'v':V,'k':K,'tplF':{'idx':ts.put(tI.astype(np.uint16)),'POSITION':ts.put(T.astype(np.float32))},'attrs':{},'chunks':[]}
    per={}
    for a,arr in A.items():
      if a=='POSITION':continue
      X=arr.reshape(N,V,-1)
      if a=='NORMAL':m['attrs'][a]={'mode':'rot','c':3};m['tplF'][a]=ts.put(X[0].astype(np.float32));continue
      if np.allclose(X,X[0],atol=1e-6):m['attrs'][a]={'mode':'tpl','c':X.shape[2]};m['tplF'][a]=ts.put(X[0].astype(np.float32));continue
      if a=='COLOR_0':m['attrs'][a]={'mode':'u8','c':X.shape[2]};per[a]=np.round(np.clip(X,0,1)*255).astype(np.uint8);continue
      D=X-X[0:1];o_=D[:,0,:];cols=[c for c in range(X.shape[2]) if np.abs(o_[:,c]).max()>0]
      m['attrs'][a]={'mode':'tplPlusOffset','c':X.shape[2],'cols':cols};m['tplF'][a]=ts.put(X[0].astype(np.float32));per[a]=o_[:,cols].astype(np.float32)
    m['tplZ']=emit(ts.bytes())
    ipc=max(1,CV//V);ramp=[max(1,(CV//8)//V),max(1,(CV//4)//V),max(1,(CV//2)//V)]  # 前 3 块渐增（解释执行/JIT 预热期更小）
    s0=0;ci=0
    while s0<N:
      s1=min(N,s0+(ramp[ci] if ci<len(ramp) else ipc));ci+=1;cs=Seg();ch={'i0':s0,'n':s1-s0,'f':{'xf':cs.put(inst[s0:s1])}}
      for a,v in per.items():ch['f'][a]=cs.put(v[s0:s1])
      ch['z']=emit(cs.bytes());m['chunks'].append(ch);s0=s1
    hdr['meshes'].append(m);print(nm,'chunks',len(m['chunks']),'chunk z bytes max',max(c['z'][1] for c in m['chunks']),'raw max',max(c['z'][2] for c in m['chunks']))
  H=zlib.compress(json.dumps(hdr,separators=(',',':')).encode(),9);raw=b'QFI3'+struct.pack('<I',len(H))+H+b'\0'*((-len(H))%4)+b''.join(blobs)
  open(out,'wb').write(raw);print('file bytes',len(raw),'(header',len(H),') zip',len(zlib.compress(raw,9)))
if __name__=='__main__':main(*sys.argv[1:4])
