#!/usr/bin/env python3
"""b19 草花实例化 方案 R 原型：把 env_meadow.glb 的 8 个 *_instances 合并网格拆成 模板 + 每实例相似变换。
用法: python3 bake.py <env_meadow.glb> <out.bin>   （out.bin = deflate 的 qfinst v1 数据；同时打印还原误差）
只读 glb，不改任何资源（颜色/贴图一律原样保留：COLOR_0 按实例逐顶点 u8 存）。"""
import json,struct,sys,zlib,numpy as np
CNT={'meadow_grass_instances.0':41,'meadow_grass_instances.1':220,'meadow_grass_instances.2':621,'meadow_grass_instances.3':64,'meadow_grass_instances.4':54,
     'meadow_flower_instances.0':48,'meadow_flower_instances.1':60,'meadow_flower_instances.2':42}
CT={5126:'f4',5123:'u2',5125:'u4'};SZ={5126:4,5123:2,5125:4};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def glb(p):
  b=open(p,'rb').read();L=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+L]);o=20+L;BL=struct.unpack('<I',b[o:o+4])[0];return j,b[o+8:o+8+BL]
def acc(j,bn,i):
  a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];sz=SZ[a['componentType']];n=NC[a['type']];st=bv.get('byteStride',sz*n);off=bv.get('byteOffset',0)+a.get('byteOffset',0)
  raw=np.frombuffer(bn,np.uint8,st*(a['count']-1)+sz*n,off);return np.lib.stride_tricks.as_strided(raw,(a['count'],sz*n),(st,1)).copy().view(CT[a['componentType']]).reshape(a['count'],n)
def umeyama(A,B):  # B ≈ s R A + t
  ma,mb=A.mean(0),B.mean(0);a,b=A-ma,B-mb;U,S,Vt=np.linalg.svd(b.T@a/len(A));D=np.eye(3);D[2,2]=np.sign(np.linalg.det(U@Vt));R=U@D@Vt
  s=(S*np.diag(D)).sum()/((a**2).sum()/len(A));return s,R,mb-s*R@ma
def mat2q(R):
  w=np.sqrt(max(0,1+R[0,0]+R[1,1]+R[2,2]))/2;x=np.sqrt(max(0,1+R[0,0]-R[1,1]-R[2,2]))/2;y=np.sqrt(max(0,1-R[0,0]+R[1,1]-R[2,2]))/2;z=np.sqrt(max(0,1-R[0,0]-R[1,1]+R[2,2]))/2
  x=np.copysign(x,R[2,1]-R[1,2]);y=np.copysign(y,R[0,2]-R[2,0]);z=np.copysign(z,R[1,0]-R[0,1]);return np.array([x,y,z,w])
def q2m(q):
  x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def main(src,out):
  j,bn=glb(src);hdr={'v':1,'meshes':[]};blobs=[];off=0
  def put(arr):
    nonlocal off;b=np.ascontiguousarray(arr).tobytes();pad=(-len(b))%4;blobs.append(b+b'\0'*pad);o=off;off+=len(b)+pad;return [o,len(b),str(arr.dtype),list(arr.shape)]
  for n in j['nodes']:
    nm=n.get('name');
    if nm not in CNT:continue
    p=j['meshes'][n['mesh']]['primitives'][0];N=CNT[nm];A={k:acc(j,bn,v).astype(np.float64) for k,v in p['attributes'].items()};I=acc(j,bn,p['indices']).ravel()
    V=len(A['POSITION'])//N;K=len(I)//N;assert V*N==len(A['POSITION']) and K*N==len(I)
    tI=I[:K];assert all((I[k*K:(k+1)*K]-k*V==tI).all() for k in range(N))
    P=A['POSITION'].reshape(N,V,3);T=P[0];inst=np.zeros((N,8),np.float32);err=0
    for k in range(N):
      s,R,t=umeyama(T,P[k]);q=mat2q(R);inst[k]=[*t,*q,s];err=max(err,np.abs((s*(q2m(q)@T.T)).T+t-P[k]).max())
    m={'name':nm,'n':N,'v':V,'k':K,'posErr':float(err),'idx':put(tI.astype(np.uint16)),'pos':put(T.astype(np.float32)),'inst':put(inst),'attrs':{}}
    for a,arr in A.items():
      if a=='POSITION':continue
      X=arr.reshape(N,V,-1)
      if a=='NORMAL':m['attrs'][a]={'mode':'rot','tpl':put(X[0].astype(np.float32))};continue
      if np.allclose(X,X[0],atol=1e-6):m['attrs'][a]={'mode':'tpl','tpl':put(X[0].astype(np.float32))};continue
      if a!='COLOR_0':  # 模板 + 每实例常数偏移（风相位 / 叶片 v 偏移）
        D=X-X[0:1];off_=D[:,0,:];
        if np.abs(D-off_[:,None,:]).max()<1e-5:
          cols=[c for c in range(X.shape[2]) if np.abs(off_[:,c]).max()>0]
          prev=[b for b,v in m['attrs'].items() if v.get('src')==arr.tobytes().__hash__()]
          if prev:m['attrs'][a]={'mode':'alias','of':prev[0]};continue
          m['attrs'][a]={'mode':'tplPlusOffset','tpl':put(X[0].astype(np.float32)),'cols':cols,'off':put(off_[:,cols].astype(np.float32)),'src':arr.tobytes().__hash__()};continue
      if a=='COLOR_0':
        q8=np.round(np.clip(X,0,1)*255).astype(np.uint8);m['attrs'][a]={'mode':'u8','data':put(q8.reshape(N*V,-1)),'err':float(np.abs(q8/255-X).max())};continue
      m['attrs'][a]={'mode':'f32','data':put(arr.astype(np.float32))}
    [v.pop('src',None) for v in m['attrs'].values()];hdr['meshes'].append(m);print(nm,'N',N,'V',V,'posErr %.2e'%err,{k:v['mode'] for k,v in m['attrs'].items()})
  H=json.dumps(hdr).encode();raw=b'QFI1'+struct.pack('<I',len(H))+H+b'\0'*((-len(H))%4)+b''.join(blobs)
  z=zlib.compress(raw,9);open(out,'wb').write(z);print('raw',len(raw),'deflate9',len(z))
if __name__=='__main__':main(*sys.argv[1:3])
