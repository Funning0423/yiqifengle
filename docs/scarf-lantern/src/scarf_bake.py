# 围巾 scarf.tail(idx29, 父 neck) 烘焙：各 clip = 等效重力摆(重力 - neck 加速度) 跟随 + 阻尼弹簧；wind_flutter_loop = 前扬 + 左右摆(加法层)。
# 轴(neck 局部=绑定世界轴, glTF)：绕 +X 正 = 尾尖向后(压胸口)；绕 +Z 正 = 尾尖向 +X。
# 限幅：后 ≤10°（walk_turn_180_bodyR 后 ≤0°），前 ≤35°，左右 ≤20°，静态+风叠加后也不超。其他通道一字节不动（只追加 accessor/bufferView + 新 channel）。
# 用法: python3 scarf_bake.py base30.glb meta_in.json out.glb out_meta.json
import sys,json,math,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
SRC,META,OUT,OUTM=sys.argv[1:5]
FPS=30;TOL=float(__import__('os').environ.get('STOL','0.5'));ZETA=0.45;FREQ=1.5;GAIN=0.6;BACK=10.0;FWD=35.0;LAT=20.0;BL=9
WCOEF=0.5;W_LIFT=WCOEF*FWD;W_LAT=WCOEF*LAT   # 风强最大(层权重1)时：前扬 17.5°、左右 ±10°
J,B=load(SRC);B=bytearray(B);nid={n.get('name'):i for i,n in enumerate(J['nodes'])};A={a['name']:a for a in J['animations']}
SC=nid['scarf.tail'];assert J['nodes'][J['skins'][0]['joints'][29]]['name']=='scarf.tail'
PAR={}
for i,n in enumerate(J['nodes']):
    for c in n.get('children',[]):PAR[c]=i
def qn(q):return q/np.linalg.norm(q,axis=-1,keepdims=True)
def slerp(a,b,u):
    d=np.sum(a*b,-1,keepdims=True);b=np.where(d<0,-b,b);d=np.abs(d);th=np.arccos(np.clip(d,-1,1));s=np.sin(th)
    return qn(np.where(s>1e-9,np.sin((1-u)*th)/np.maximum(s,1e-12),1-u)*a+np.where(s>1e-9,np.sin(u*th)/np.maximum(s,1e-12),u)*b)
def samp(t,v,tq,rot):
    if len(t)==1:return np.repeat(v[:1],len(tq),0)
    j=np.clip(np.searchsorted(t,tq,'right')-1,0,len(t)-2);u=np.clip((tq-t[j])/(t[j+1]-t[j]),0,1)[:,None]
    return slerp(v[j],v[j+1],u) if rot else v[j]+(v[j+1]-v[j])*u
def q2m(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def qmul(a,b):
    x1,y1,z1,w1=a.T;x2,y2,z2,w2=b.T
    return np.stack([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2],1)
def qaxis(ax,deg):
    h=np.radians(deg)/2;q=np.zeros((len(h),4));q[:,ax]=np.sin(h);q[:,3]=np.cos(h);return q
def chan(a,node,path):
    for c in a['channels']:
        if c['target']['node']==node and c['target']['path']==path:return c,a['samplers'][c['sampler']]
    return None,None
def dur(a):return max(float(acc(J,B,a['samplers'][c['sampler']]['input']).max()) for c in a['channels'])
def neck_world(a,tq):
    chain=[];i=nid['neck']
    while True:
        chain.append(i)
        if i not in PAR:break
        i=PAR[i]
    N=len(tq);R=np.repeat(np.eye(3)[None],N,0);P=np.zeros((N,3))
    for i in reversed(chain):
        n=J['nodes'][i];c,s=chan(a,i,'rotation');q=samp(acc(J,B,s['input']).ravel(),qn(acc(J,B,s['output'])),tq,True) if c else np.repeat(np.array([n.get('rotation',[0,0,0,1])]),N,0)
        c,s=chan(a,i,'translation');t=samp(acc(J,B,s['input']).ravel(),acc(J,B,s['output']),tq,False) if c else np.repeat(np.array([n.get('translation',[0,0,0])]),N,0)
        sc=np.array(n.get('scale',[1,1,1]))
        Rl=np.array([q2m(x) for x in q])*sc
        P=P+np.einsum('nij,nj->ni',R,t);R=np.einsum('nij,njk->nik',R,Rl)
    return R,P
def spring(tg,x0,v0=0.0):
    w=2*math.pi*FREQ;x,v=x0,v0;o=[];n=10;dt=1/FPS/n
    for th in tg:
        for _ in range(n):aa=w*w*(th-x)-2*ZETA*w*v;v+=aa*dt;x+=v*dt
        o.append(x)
    return np.array(o),x,v
def softlim(x,lo,hi):   # 线性区到 70% 后 tanh 软收到上限
    def s(v,L):k=0.7*L;return np.where(v<=k,v,k+(L-k)*np.tanh((v-k)/(L-k))) if L>0 else np.minimum(v,0)
    return np.where(x>=0,s(np.abs(x),hi),-s(np.abs(x),-lo))
LOOP={'walk_loop','idle_breathing_loop'}
log={};BK={}
BLOB=bytearray();BVI=len(J['bufferViews'])
while len(B)%4:B.append(0)
ORDER=sorted(J['animations'],key=lambda a:a['name']!='walk_loop')
for a in ORDER:
    name=a['name'];T=dur(a);N=int(round(T*FPS))+1;tq=np.arange(N)/FPS
    assert chan(a,SC,'rotation')[0] is None
    if name=='wind_flutter_loop':
        n1=max(1,round(0.6*T));n2=max(1,round(0.9*T))
        lift=W_LIFT*(1-np.cos(2*np.pi*n1*tq/T))/2      # 0..17.5 前扬，f0=0
        lat=W_LAT*np.sin(2*np.pi*n2*tq/T+0.0)          # ±10，f0=0
        bx=-lift;bz=lat
    else:
        R,P=neck_world(a,tq)
        Pp=np.pad(P,((6,6),(0,0)),mode='edge');acc_=np.gradient(np.gradient(Pp,1/FPS,axis=0),1/FPS,axis=0)[6:-6]   # 非循环：两端视为静止（无端点假加速度）
        if name in LOOP:acc_=np.gradient(np.gradient(np.r_[P[-4:-1],P,P[1:4]],1/FPS,axis=0),1/FPS,axis=0)[3:-3]
        g=np.array([0,-9.81,0])-acc_;d=np.einsum('nji,nj->ni',R,g)   # neck 局部等效重力方向
        gx=np.degrees(np.arctan2(-d[:,2],-d[:,1]));gz=np.degrees(np.arctan2(d[:,0],-d[:,1]))
        ds=np.einsum('nji,j->ni',R,np.array([0,-9.81,0]));gs=np.degrees(np.arctan2(-ds[:,2],-ds[:,1]))
        gzs=np.degrees(np.arctan2(ds[:,0],-ds[:,1]));sx=GAIN*(gs-np.maximum(gs,0));sz=GAIN*gzs   # 静态下垂值(无加速度)
        tx=GAIN*(gx-np.maximum(gs,0));tz=GAIN*gz   # 身体后仰时尾巴由胸口托住：静态重力的"向后"分量不计，只保留前倾下垂和惯性
        if name in LOOP:
            _,x,v=spring(np.tile(tx[:-1],4),tx[0]);bx,_,_=spring(tx,x,v);bx=bx-(bx[-1]-bx[0])*tq/tq[-1]
            _,x,v=spring(np.tile(tz[:-1],4),tz[0]);bz,_,_=spring(tz,x,v);bz=bz-(bz[-1]-bz[0])*tq/tq[-1]
        else:
            WL=BK['walk_loop'];fromW=name.startswith(('walk_stop','walk_turn'));toW=name.startswith(('walk_start','walk_turn'))
            s0=(WL[0][0],WL[1][0]) if fromW else (sx[0],sz[0]);s1=(WL[0][0],WL[1][0]) if toW else (sx[-1],sz[-1])   # 接 walk_loop 的一端对齐 walk_loop f0，接静止的一端=静态下垂
            bx,_,_=spring(tx,s0[0]);bz,_,_=spring(tz,s0[1])
            u=np.clip(np.arange(N)/BL,0,1);e=u*u*(3-2*u);bx=bx*e+s0[0]*(1-e);bz=bz*e+s0[1]*(1-e)
            u=np.clip((N-1-np.arange(N))/BL,0,1);e=u*u*(3-2*u);bx=bx*e+s1[0]*(1-e);bz=bz*e+s1[1]*(1-e)   # 结尾淡到静态下垂值，与下一个 clip 起点一致
        hb=0.0 if name=='walk_turn_180_bodyR' else BACK
        # 风叠加余量：行走/待机类要给风留 前扬 17.5、左右 10 的余量
        windy=name.startswith('walk') or name=='idle_breathing_loop'
        bx=softlim(bx,-(FWD-(W_LIFT if windy else 0)),hb)
        bz=softlim(bz,-(LAT-(W_LAT if windy else 0)),LAT-(W_LAT if windy else 0))
    q=qn(qmul(qaxis(0,bx),qaxis(2,bz)))
    # compress_keeptr.py 同法：两端起步，贪心插入误差最大处最近的原始帧，直到 slerp 与 nlerp 重建在 4 倍细分时刻都 ≤ TOL
    tqq=np.linspace(0,tq[-1],(N-1)*4+1);ref=samp(tq,q,tqq,True);sel={0,N-1}
    def nl(t,v,x):
        j=np.clip(np.searchsorted(t,x,'right')-1,0,len(t)-2);u=np.clip((x-t[j])/(t[j+1]-t[j]),0,1)[:,None];a_,b_=v[j],v[j+1];d=np.sum(a_*b_,-1,keepdims=True);return qn((1-u)*a_+u*np.where(d<0,-b_,b_))
    while True:
        gg=sorted(sel);r1=samp(tq[gg],q[gg],tqq,True);r2=nl(tq[gg],q[gg],tqq)
        e=np.maximum(*[np.degrees(2*np.arccos(np.clip(np.abs(np.sum(r*ref,1)),0,1))) for r in (r1,r2)])
        if e.max()<=TOL or len(gg)==N:break
        fr=np.array([x for x in range(N) if x not in sel]);sel.add(int(fr[np.argmin(np.abs(tq[fr]-tqq[int(np.argmax(e))]))]))
    err=float(e.max())
    ti=np.asarray(tq[gg],np.float32);vo=np.asarray(q[gg],np.float32)
    o1=len(BLOB);BLOB.extend(ti.tobytes());o2=len(BLOB);BLOB.extend(vo.tobytes())   # 全部新数据放一个 bufferView
    J['accessors'].append(dict(bufferView=BVI,byteOffset=o1,componentType=5126,count=len(gg),type='SCALAR',min=[float(ti.min())],max=[float(ti.max())]))
    J['accessors'].append(dict(bufferView=BVI,byteOffset=o2,componentType=5126,count=len(gg),type='VEC4'))
    a['samplers'].append(dict(input=len(J['accessors'])-2,output=len(J['accessors'])-1));a['channels'].append(dict(sampler=len(a['samplers'])-1,target=dict(node=SC,path='rotation')))
    BK[name]=(bx,bz)
    log[name]=dict(frames=N,keys=len(gg),err=round(err,3),back_deg=[round(float(bx.min()),2),round(float(bx.max()),2)],lat_deg=[round(float(bz.min()),2),round(float(bz.max()),2)],ends=[[round(float(bx[0]),2),round(float(bz[0]),2)],[round(float(bx[-1]),2),round(float(bz[-1]),2)]])
    print(name,log[name])
# 风强最大时叠加后的包络
wx,wz=BK['wind_flutter_loop']
for nm,(bx,bz) in BK.items():
    if nm!='wind_flutter_loop' and (nm.startswith('walk') or nm=='idle_breathing_loop'):
        log[nm]['with_wind_max']=dict(back_max=round(float(bx.max()),2),fwd_max=round(float(-(bx.min()+wx.min())),2),lat_absmax=round(float(np.abs(bz).max()+np.abs(wz).max()),2))
J['bufferViews'].append(dict(buffer=0,byteOffset=len(B),byteLength=len(BLOB)));B+=BLOB
n=save(OUT,J,bytes(B))
m=json.load(open(META));m['glb']=OUT.split('/')[-1]
w=m['wind'];w['mask']=w['mask']+(['scarf*'] if 'scarf*' not in w['mask'] else [])
w['scarf']=dict(bone='scarf.tail',joint_index=29,parent='neck',coef=WCOEF,
  bake='wind_flutter_loop scarf.tail = 前扬 %.1f°(0..峰, 不向后) + 左右 ±%.1f°（=系数 0.5 × 实测上限 35°/20°，已烘进 clip，运行时无逐骨系数）；顺风/顶风同一套（左右+向前上扬）'%(W_LIFT,W_LAT),
  limits_deg=dict(back=BACK,back_walk_turn_180_bodyR=0,forward=FWD,lateral=LAT),
  axes='neck 局部（绑定=世界轴）：绕 +X 正=尾尖向后；绕 +Z 正=尾尖向 +X')
m.setdefault('accessories',{})['scarf_v1']=dict(mesh='LOD0_G2_SCARF',tris=400,material='M_G2_SCARF',source='角色建模bot chr_b_scarf_v1 (9a5d8ce4) build_scarf.py 重跑在 stepdown 生产版上')
m.setdefault('planB',{})['scarf_anim']=dict(bake='各 clip：等效重力(重力−neck 加速度)在 neck 局部的下垂方向 × %.1f，阻尼弹簧 ζ%.2f %.1fHz；循环 clip 周期稳态闭合；非循环结尾 %d 帧淡回静态下垂；后摆软限 %g°（walk_turn_180_bodyR 0°），前/左右软限并为风留余量'%(GAIN,ZETA,FREQ,BL,BACK))
json.dump(m,open(OUTM,'w'),ensure_ascii=False,indent=1)
json.dump(log,open(OUT+'.scarf.json','w'),ensure_ascii=False,indent=1);print('bytes',n)
