import json,struct,numpy as np,math,sys
G='/workspace/wechat-game/team/voice-bot/outbox/20261015T2318Z-meadow-art-v7_5/env_meadow_vb_meadowart_v7_5_candidate.glb'
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

import re
bf=sorted({n['name'] for n in N if re.fullmatch(r'meadow_butterfly_\d\d',n.get('name',''))})
print(bf)
def frame(P,T):
 P=np.array(P,float);f=np.array(T,float)-P;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);M=np.eye(4);M[:3,0]=r;M[:3,1]=u;M[:3,2]=-f;M[:3,3]=P;return M
S=frame([9,19,42],[0.3274661665889038,5.509406509325702,-15.81687522999821]);Gm=frame([0,24,45],[0,4,4])
X=Gm@np.linalg.inv(S);np.set_printoptions(precision=4,suppress=True);print('stale->game rigid transform\n',X)
pr=cam([0,24,45],[0,4,4],49.42635311494791,375,812)
for b in bf:
 ids=[i for i,n in enumerate(N) if n.get('name','').startswith(b)];vv={i:acc(J['meshes'][N[i]['mesh']]['primitives'][0]['attributes']['POSITION']) for i in ids if 'mesh' in N[i]}
 best=0;vis=0
 for k in range(240):
  t=k/30;pts=np.vstack([(wm(i,t)@np.c_[v,np.ones(len(v))].T).T[:,:3] for i,v in vv.items()]);q=np.array([pr(p) for p in pts])
  if q[:,2].min()>0 and abs(q[:,0].mean())<1 and abs(q[:,1].mean())<1: vis+=1;best=max(best,(q[:,0].max()-q[:,0].min())/2*375)
 r0=[i for i,n in enumerate(N) if n.get('name')==b][0];print(b,'game pose visible %d/240 frames, max %.1f px @375w'%(vis,best),'pos t=1',wm(r0,1.0)[:3,3].round(2))
