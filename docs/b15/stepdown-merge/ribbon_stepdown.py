# 给已并入的 walk_start_stepdown 补 ribbon(joint28) 通道：跟随曲线 = door_reach@1.8s 的 ribbon 姿态 -> walk_loop@0.453s 的 ribbon 姿态(smoothstep)，
# 叠加与 ribbon_bake5 相同参数的阻尼弹簧(hips 前向加速度驱动)，两端 BL=9 帧淡到 0，保证两端硬切与相邻 clip 完全一致。
import sys,json,math,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
SRC,OUT=sys.argv[1:3]
ZETA,FREQ,LIM,K=0.5,1.6,12.0,3.0;FWD=1.0;TOL=0.2;FPS=30;BL=9
J,B=load(SRC);B=bytearray(B);nid={n.get('name'):i for i,n in enumerate(J['nodes'])};A={a['name']:a for a in J['animations']}
def qn(q):return q/np.linalg.norm(q,axis=-1,keepdims=True)
def slerp(a,b,u):
    d=np.sum(a*b,-1,keepdims=True);b=np.where(d<0,-b,b);d=np.abs(d);th=np.arccos(np.clip(d,-1,1));s=np.sin(th)
    return qn(np.where(s>1e-9,np.sin((1-u)*th)/np.maximum(s,1e-12),1-u)*a+np.where(s>1e-9,np.sin(u*th)/np.maximum(s,1e-12),u)*b)
def samp(t,v,tq,rot):
    if len(t)==1:return np.repeat(v[:1],len(tq),0)
    j=np.clip(np.searchsorted(t,tq,'right')-1,0,len(t)-2);u=np.clip((tq-t[j])/(t[j+1]-t[j]),0,1)[:,None]
    return slerp(v[j],v[j+1],u) if rot else v[j]+(v[j+1]-v[j])*u
def qmul(a,b):
    x1,y1,z1,w1=a.T;x2,y2,z2,w2=b.T
    return np.stack([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2],1)
def qx(deg):h=np.radians(deg)/2;return np.stack([np.sin(h),0*h,0*h,np.cos(h)],1)
def rotm(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def chan(a,node,path):
    for c in a['channels']:
        if c['target']['node']==node and c['target']['path']==path:return c,a['samplers'][c['sampler']]
    return None,None
def at(name,t):
    _,s=chan(A[name],nid['ribbon'],'rotation');return samp(acc(J,B,s['input']).ravel(),qn(acc(J,B,s['output'])),np.array([t]),True)[0]
a=A['walk_start_stepdown'];assert chan(a,nid['ribbon'],'rotation')[0] is None
_,s=chan(a,nid['hips'],'rotation');T=float(acc(J,B,s['input']).max());N=int(round(T*FPS))+1;tq=np.arange(N)/FPS
ct,st=chan(a,nid['hips'],'translation');cr,sr=chan(a,nid['hips'],'rotation')
p=samp(acc(J,B,st['input']).ravel(),acc(J,B,st['output']),tq,False);q=samp(acc(J,B,sr['input']).ravel(),qn(acc(J,B,sr['output'])),tq,True)
ac=np.gradient(np.gradient(p,1/FPS,axis=0),1/FPS,axis=0);loc=np.array([rotm(q[i]).T@ac[i] for i in range(N)]);tg=np.clip(K*loc[:,2],-LIM,LIM)
w=2*math.pi*FREQ;x=v=0.0;o=[];dt=1/FPS/10
for th in tg:
    for _ in range(10):aa=w*w*(th-x)-2*ZETA*w*v;v+=aa*dt;x+=v*dt
    o.append(x)
o=np.clip(np.array(o),-LIM,LIM)
u=np.clip(np.arange(N)/BL,0,1);e=u*u*(3-2*u);o=o*e
u=np.clip((N-1-np.arange(N))/BL,0,1);e=u*u*(3-2*u);o=o*e
o=np.where(o<0,-FWD*np.tanh(-o/FWD),o)
qA=at('door_reach',1.8);qB=at('walk_loop',0.453)
u=(tq/tq[-1])[:,None];u=u*u*(3-2*u);qf=slerp(np.repeat(qA[None],N,0),np.repeat(qB[None],N,0),u)
qnw=qn(qmul(qf,qx(o)))
for k in [10,8,6,5,4,3,2,1]:
    g=list(range(0,N,k));g+=[N-1] if g[-1]!=N-1 else []
    r=samp(tq[g],qnw[g],tq,True);err=np.degrees(2*np.arccos(np.clip(np.abs(np.sum(r*qnw,1)),0,1))).max()
    if err<=TOL:break
ti=np.asarray(tq[g],np.float32);vo=np.asarray(qnw[g],np.float32)
while len(B)%4:B.append(0)
o1=len(B);B+=ti.tobytes();o2=len(B);B+=vo.tobytes()
J['bufferViews'].append(dict(buffer=0,byteOffset=o1,byteLength=len(ti.tobytes())));J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=len(g),type='SCALAR',min=[float(ti.min())],max=[float(ti.max())]))
J['bufferViews'].append(dict(buffer=0,byteOffset=o2,byteLength=len(vo.tobytes())));J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=len(g),type='VEC4'))
a['samplers'].append(dict(input=len(J['accessors'])-2,output=len(J['accessors'])-1));a['channels'].append(dict(sampler=len(a['samplers'])-1,target=dict(node=nid['ribbon'],path='rotation')))
# ribbon 平移：与其他 walk clip 一样 1 键 = 静止值
tr=np.asarray([J['nodes'][nid['ribbon']]['translation']],np.float32);t0=np.asarray([[0.0]],np.float32)
while len(B)%4:B.append(0)
o1=len(B);B+=t0.tobytes();o2=len(B);B+=tr.tobytes()
J['bufferViews'].append(dict(buffer=0,byteOffset=o1,byteLength=4));J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=1,type='SCALAR',min=[0.0],max=[0.0]))
J['bufferViews'].append(dict(buffer=0,byteOffset=o2,byteLength=12));J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=1,type='VEC3'))
a['samplers'].append(dict(input=len(J['accessors'])-2,output=len(J['accessors'])-1));a['channels'].append(dict(sampler=len(a['samplers'])-1,target=dict(node=nid['ribbon'],path='translation')))
pitch=np.degrees(2*np.arcsin(qnw[:,0]))
log=dict(frames=N,keys=len(g),key_err_deg=round(float(err),4),spring_offset_deg=[round(float(o.min()),3),round(float(o.max()),3)],total_pitch_deg=[round(float(pitch.min()),2),round(float(pitch.max()),2)],
 seam_in_deg=float(np.degrees(2*np.arccos(min(1,abs(np.dot(qnw[0],qA)))))),seam_out_deg=float(np.degrees(2*np.arccos(min(1,abs(np.dot(qnw[-1],qB)))))))
print(json.dumps(log));json.dump(log,open(OUT+'.ribbon.json','w'),indent=1)
print('bytes',save(OUT,J,bytes(B)))
