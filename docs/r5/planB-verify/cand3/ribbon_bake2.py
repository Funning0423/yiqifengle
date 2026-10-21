# ribbon (joint 28, pitch about local X, + = backward) = 角色建模bot follow curve (cand3) * damped-spring offset
import sys,json,math,hashlib,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
SRC,META,OUT,OUTM=sys.argv[1:5]
ZETA,FREQ,LIM,K=0.5,1.6,12.0,float(sys.argv[5]) if len(sys.argv)>5 else 3.0  # K deg per m/s^2 of hips forward accel
SWAY_A,SWAY_HZ=1.5,0.5;FWD=1.0; WIND_A=6.0; TOL=0.2; FPS=30; BL=9
J,B=load(SRC);B=bytearray(B);M=json.load(open(META))
nid={n.get('name'):i for i,n in enumerate(J['nodes'])}
assert J['nodes'][J['skins'][0]['joints'][28]]['name']=='ribbon'
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
def spring(target,x0=0.0,v0=0.0):
    w=2*math.pi*FREQ;x,v=x0,v0;out=[];n=10;dt=1/FPS/n
    for th in target:
        for _ in range(n): acc_=w*w*(th-x)-2*ZETA*w*v;v+=acc_*dt;x+=v*dt
        out.append(x)
    return np.array(out),x,v
LOOP={'walk_loop','idle_breathing_loop'}
def dur(a):
    _,s=chan(a,nid['hips'],'rotation');return float(acc(J,B,s['input']).max())
def drive(a):
    N=int(round(dur(a)*FPS))+1;tq=np.arange(N)/FPS
    ct,st=chan(a,nid['hips'],'translation');cr,sr=chan(a,nid['hips'],'rotation')
    p=samp(acc(J,B,st['input']).ravel(),acc(J,B,st['output']),tq,False);q=samp(acc(J,B,sr['input']).ravel(),acc(J,B,sr['output']),tq,True)
    ac=np.gradient(np.gradient(p,1/FPS,axis=0),1/FPS,axis=0)
    loc=np.array([rotm(q[i]).T@ac[i] for i in range(N)])
    return tq,np.clip(K*loc[:,2],-LIM,LIM)   # +Z forward (ribbon sits at -Z behind hips); forward accel -> lag backward (+pitch)
off={};log={}
order=['walk_loop','idle_breathing_loop']+[a['name'] for a in J['animations'] if a['name'] not in ('walk_loop','idle_breathing_loop')]
A={a['name']:a for a in J['animations']}
for name in order:
    a=A[name];tq,tg=drive(a);N=len(tq)
    if name=='sit_hold': o=SWAY_A*np.sin(2*np.pi*SWAY_HZ*tq)          # 2 s = 1 cycle, 0 at both ends
    elif name=='wind_sway_loop':
        T=tq[-1];n=max(1,round(0.6*T));o=WIND_A*np.sin(2*np.pi*n*tq/T)  # additive wind layer: delta vs frame 0 = o
    elif name in LOOP:
        _,x,v=spring(np.tile(tg[:-1],4));o,_,_=spring(tg,x,v)  # periodic steady state; force exact loop closure
        o=o-(o[-1]-o[0])*tq/tq[-1]
    else:
        o,_,_=spring(tg);o=np.clip(o,-LIM,LIM)
        start=off['walk_loop'][0] if name.startswith(('walk_stop','walk_turn')) else 0.0
        end=off['walk_loop'][0] if name=='walk_start' else 0.0
        if name in ('sit_down','stand_up','door_reach'): start=end=0.0
        u=np.clip(np.arange(N)/BL,0,1);e=u*u*(3-2*u);o=o*e+start*(1-e)
        u=np.clip((N-1-np.arange(N))/BL,0,1);e=u*u*(3-2*u);o=o*e+end*(1-e)
    c,s=chan(a,nid['ribbon'],'rotation');qf=samp(acc(J,B,s['input']).ravel(),acc(J,B,s['output']),tq,True)
    o=np.clip(o,-LIM,LIM)
    if name not in ('sit_hold','wind_sway_loop'):
        # attempt 2: forward (-) swing toward the dress softly limited to FWD deg; sit clips never lean further back than the follow curve's 15 deg (stool)
        o=np.where(o<0,-FWD*np.tanh(-o/FWD),o)
        if name in ('sit_down','stand_up'):
            fp=np.degrees(2*np.arcsin(qf[:,0]));o=np.minimum(o,np.maximum(0,15.0-fp)*0+np.clip(15.0-fp,0,None))
    off[name]=o
    qnw=qn(qmul(qf,qx(o)))
    # greedy uniform step (same scheme as compress_keeptr): coarsest k whose slerp recon <= TOL at every frame
    for k in [10,8,6,5,4,3,2,1]:
        g=list(range(0,N,k));g+= [N-1] if g[-1]!=N-1 else []
        r=samp(tq[g],qnw[g],tq,True);err=np.degrees(2*np.arccos(np.clip(np.abs(np.sum(r*qnw,1)),0,1))).max()
        if err<=TOL:break
    if np.abs(np.diff(qnw,axis=0)).max()<1e-7: g=[0]
    ti=np.asarray(tq[g],np.float32);vo=np.asarray(qnw[g],np.float32)
    while len(B)%4:B.append(0)
    o1=len(B);B+=ti.tobytes();o2=len(B);B+=vo.tobytes()
    J['bufferViews'].append(dict(buffer=0,byteOffset=o1,byteLength=len(ti.tobytes())));J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=len(g),type='SCALAR',min=[float(ti.min())],max=[float(ti.max())]))
    J['bufferViews'].append(dict(buffer=0,byteOffset=o2,byteLength=len(vo.tobytes())));J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=len(g),type='VEC4'))
    a['samplers'].append(dict(input=len(J['accessors'])-2,output=len(J['accessors'])-1));c['sampler']=len(a['samplers'])-1
    log[name]=dict(frames=N,keys=len(g),offset_deg=[round(float(o.min()),2),round(float(o.max()),2)],total_pitch=[round(float(np.degrees(2*np.arcsin(qnw[:,0])).min()),2),round(float(np.degrees(2*np.arcsin(qnw[:,0])).max()),2)],seam_offset=[round(float(o[0]),3),round(float(o[-1]),3)])
    print(name,log[name])
# drop now-unused samplers' accessors are left orphaned (tiny); remove unused samplers to keep the file valid
for a in J['animations']:
    used=sorted(set(c['sampler'] for c in a['channels']));mp={o:i for i,o in enumerate(used)}
    a['samplers']=[a['samplers'][i] for i in used]
    for c in a['channels']:c['sampler']=mp[c['sampler']]
n=save(OUT,J,bytes(B))
m=json.load(open(META));m['wind']['mask']=list(dict.fromkeys(m['wind']['mask']+['ribbon*']))
m['planB']=m.get('planB',{});m['planB']['ribbon_anim']=dict(bake='damped spring zeta %.2f %.1f Hz limit %d deg, input hips forward accel K=%.1f deg/(m/s^2), pitch only (local X, + = back), on 角色建模bot cand3 follow curves; sit_hold sway %.1f deg %.1f Hz; wind_sway_loop ribbon %.0f deg (additive)'%(ZETA,FREQ,LIM,K,SWAY_A,SWAY_HZ,WIND_A))
json.dump(m,open(OUTM,'w'),ensure_ascii=False,indent=1)
json.dump(log,open(OUT+'.log.json','w'),indent=1);print('bytes',n)
