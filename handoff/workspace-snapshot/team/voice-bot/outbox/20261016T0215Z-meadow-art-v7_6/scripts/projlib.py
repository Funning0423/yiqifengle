import json,struct,numpy as np,math,sys
import os;G=os.environ['GLB']
b=open(G,'rb').read();jl=struct.unpack('<I',b[12:16])[0];J=json.loads(b[20:20+jl]);B=b[20+jl+8:]
CT={5126:('f',4),5123:('H',2),5125:('I',4),5121:('B',1)};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(i):
 a=J['accessors'][i];bv=J['bufferViews'][a['bufferView']];t,s=CT[a['componentType']];n=NC[a['type']]
 o=bv.get('byteOffset',0)+a.get('byteOffset',0);st=bv.get('byteStride',s*n)
 return np.array([struct.unpack_from('<'+t*n,B,o+k*st) for k in range(a['count'])],float)
N=J['nodes'];par={}
for i,n in enumerate(N):
 for c in n.get('children',[]):par[c]=i
def qm(q):
 x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
ch={}
for an in J['animations']:
 for c in an['channels']:
  s=an['samplers'][c['sampler']];ch[(c['target']['node'],c['target']['path'])]=(acc(s['input'])[:,0],acc(s['output']))
def samp(k,t,d):
 if k not in ch:return d
 T,V=ch[k];t=t%T[-1] if T[-1]>0 else 0;i=np.searchsorted(T,t);i=min(max(i,1),len(T)-1);u=(t-T[i-1])/(T[i]-T[i-1]);v=V[i-1]*(1-u)+V[i]*u
 return v/np.linalg.norm(v) if k[1]=='rotation' else v
def lm(i,t):
 n=N[i];M=np.eye(4)
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 tr=samp((i,'translation'),t,np.array(n.get('translation',[0,0,0])));r=samp((i,'rotation'),t,np.array(n.get('rotation',[0,0,0,1])));s=samp((i,'scale'),t,np.array(n.get('scale',[1,1,1])))
 M[:3,:3]=qm(r)*s;M[:3,3]=tr;return M
def wm(i,t):
 M=lm(i,t)
 while i in par:i=par[i];M=lm(i,t)@M
 return M
def cam(P,T,fov,W,H):
 P=np.array(P,float);f=np.array(T,float)-P;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
 th=math.tan(math.radians(fov)/2);a=W/H
 def pr(X):
  d=X-P;z=d@f;return (d@r)/(z*th*a),(d@u)/(z*th),z
 return pr
def bbox(names,t,pr,W,H):
 out=[]
 for i,n in enumerate(N):
  if n.get('name') in names and 'mesh' in n:
   v=acc(J['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']);p=(wm(i,t)@np.c_[v,np.ones(len(v))].T).T[:,:3]
   out+= [pr(x) for x in p]
 xs,ys,zs=map(np.array,zip(*out));return ((xs.min()+1)/2*W,(1-ys.max())/2*H,(xs.max()+1)/2*W,(1-ys.min())/2*H,zs.min())
