# lantern_pick_up / lantern_put_down 作者脚本（glTF 空间：+Y 上，+Z 前，她的右 = -X；骨骼镜像：.L = 她的右侧）
# 全身 clip（base 层）。设计：蹲深 c(t)∈[0,1] 驱动一切；上身前倾 = LEAN·g(c)，g 只在膝盖已弯后才起（任何帧都不会直腿弯腰）；
# 双脚世界变换锁死（2 骨解析 IK，膝向前略外）；右臂 IK 到灯握把点（socket.lantern），手腕保持绑定局部（不弯不扭），肘极向固定后外；
# 交接段手静止于放置点（交接帧灯与地面/道具对齐）。put_down = pick_up 的严格时间反演（g 只依赖 c，所以反演后仍先屈膝后弯腰）。
# python3 author.py OUT_dense.glb out_info.json   环境 P='{"tx":..,"tz":..,"ty":..,"name":..}' 可多次
import sys,os,json,numpy as np
sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
from scipy.spatial.transform import Rotation as R,Slerp
BASE='/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/split/planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb'
DENSE='/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/work_dense.glb'
OUT,INFO=sys.argv[1:3];VARS=json.loads(os.environ["VARS"])
JD,BD=load(DENSE);J,B=load(DENSE)  # 输出=QA 用 dense（含 *_lantern）；生产包由 compress_keeptr 从 BASE 追加
N={n['name']:i for i,n in enumerate(J['nodes'])};par={c:i for i,n in enumerate(J['nodes']) for c in n.get('children',[])}
sk=J['skins'][0]['joints'];JN=[J['nodes'][i]['name'] for i in sk]
def restT(i):n=J['nodes'][i];return np.array(n.get('translation',[0,0,0]),float),R.from_quat(n.get('rotation',[0,0,0,1]))
def chain_to_root(i):
    c=[]
    while i in par:i=par[i];c.append(i)
    return c[::-1]
def sample(clip,t):
    an=[a for a in JD['animations'] if a['name']==clip][0];L={}
    for ch in an['channels']:
        s=an['samplers'][ch['sampler']];tt=acc(JD,BD,s['input'])[:,0];v=acc(JD,BD,s['output']);nm=JD['nodes'][ch['target']['node']]['name'];p=ch['target']['path']
        if p=='rotation':
            q=R.from_quat(v[0]) if len(tt)<2 else Slerp(tt,R.from_quat(v))(np.clip(t,tt[0],tt[-1]));L.setdefault(nm,{})['r']=q
        elif p=='translation':L.setdefault(nm,{})['t']=np.array([np.interp(t,tt,v[:,k]) for k in range(3)])
    P={}
    for nm in JN:
        t0,r0=restT(N[nm]);P[nm]=[L.get(nm,{}).get('t',t0),L.get(nm,{}).get('r',r0)]
    return P
# 骨架外层节点（root 之上）世界变换
top=chain_to_root(N['root']);TW=(np.zeros(3),R.identity())
for k in top:
    t,r=restT(k);TW=(TW[0]+TW[1].apply(t),TW[1]*r)
PAR={nm:(J['nodes'][par[N[nm]]]['name'] if J['nodes'][par[N[nm]]]['name'] in JN else None) for nm in JN}
def fk(P):
    W={}
    for nm in JN:  # skin joints 顺序假设父在前；保险起见递归
        pass
    def w(nm):
        if nm in W:return W[nm]
        pp=PAR[nm];pt,pr=w(pp) if pp else TW;t,r=P[nm];W[nm]=(pt+pr.apply(t),pr*r);return W[nm]
    for nm in JN:w(nm)
    return W
def setworld(P,W,nm,rw):  # 以世界旋转设定骨（只改该骨局部旋转）
    pp=PAR[nm];pr=W[pp][1] if pp else TW[1];P[nm][1]=pr.inv()*rw
def swing(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);ax=np.cross(a,b);s=np.linalg.norm(ax);c=np.dot(a,b)
    return R.identity() if s<1e-12 else R.from_rotvec(ax/s*np.arctan2(s,c))
def ik2(P,a,b,c,tip_local,T,pole):
    """a,b,c 三骨链名；tip_local=末端点在 c 骨局部（例如 c 的头=0，或 socket 在 hand 局部）；把末端放到 T，肘/膝朝 pole"""
    W=fk(P);S=W[a][0];E=W[b][0];tipw=W[c][0]+W[c][1].apply(tip_local)
    la=np.linalg.norm(E-S);lb=np.linalg.norm(tipw-E);d=T-S;L=np.linalg.norm(d);L=min(L,la+lb-1e-5);dn=(T-S)/np.linalg.norm(T-S)
    ca=(la*la+L*L-lb*lb)/(2*la*L);ca=np.clip(ca,-1,1);pn=pole-dn*np.dot(pole,dn);pn/=np.linalg.norm(pn)
    Es=S+la*(ca*dn+np.sqrt(1-ca*ca)*pn)
    setworld(P,W,a,swing(E-S,Es-S)*W[a][1]);W=fk(P)
    tipw=W[c][0]+W[c][1].apply(tip_local);E=W[b][0]
    setworld(P,W,b,swing(tipw-E,T-E)*W[b][1]);W=fk(P)
    tipw=W[c][0]+W[c][1].apply(tip_local);return float(np.linalg.norm(tipw-T))
SOCK=np.array([0.0138,0.0803,0.0073]);LAMP_BOTTOM=0.1502   # 灯底在 socket 下 0.1502 m（prop_lantern_v2 build.json）
def ss(x):x=np.clip(x,0,1);return x*x*(3-2*x)
def smoother(x):x=np.clip(x,0,1);return x*x*x*(x*(6*x-15)+10)
SIT=sample('sit_hold',0.0)
META=json.load(open('/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json'))
SITW={k:float(np.interp(1.2,[a for a,b in v],[b for a,b in v])) for k,v in META['clips']['sit_down']['morph']['curves'].items() if not k.startswith(('corrective','wrist','hand_rest'))}
SITW.update({k:float(np.interp(0,[a for a,b in v],[b for a,b in v])) for k,v in META['clips']['sit_hold'].get('morph',{}).get('curves',{}).items() if not k.startswith(('corrective','wrist','hand_rest'))})
print('SITW',{k:round(v,2) for k,v in SITW.items() if v>0});SIT_S=[]
WS=fk(SIT);_d=WS['shin.L'][0]-WS['thigh.L'][0];print('sit thigh angle',np.degrees(np.arctan2(_d[2],-_d[1])))
# ===== stand 版（高台半蹲）：分段时间线，pick 与 put 各自独立（put 有自己的预备和重心转移，不是倒放） =====
def slerpR(a,b,t):return Slerp([0,1],R.concatenate([a,b]))(float(np.clip(t,0,1)))
def seg(f,a,b):return smoother((f-a)/(b-a))
I0=sample('idle_breathing_loop',0.0);I1=sample('idle_breathing_loop_lantern',0.0)
import struct
def _hbw():
    a=J['accessors'][J['skins'][0]['inverseBindMatrices']];IB=acc(J,B,J['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    return R.from_matrix(np.linalg.inv(IB[JN.index('hand.L')])[:3,:3])
HBW=_hbw()
_q=json.loads(os.environ.get('SOCK_ROT','[1,0,0,0]'));_ax=np.array([_q[1],_q[3]*0+_q[3],_q[2]])
QSG=R.from_quat([_q[1],_q[3],-_q[2],_q[0]])   # Blender(x,y,z)->glTF(x,z,-y)
ARM=('upper_arm.L','forearm.L','hand.L');HB=restT(N['hand.L'])[1]
def timeline(V,f):
    UP=np.array([0,1,0]);T=V['T'];L=V.get('lift',0.12)
    if V['mode']=='pick':
        c=seg(f,4,24) if f<=32 else 1-seg(f,32,56)
        sx=seg(f,2,12)*(1-seg(f,40,58))*0.5
        if f<=31:
            w=seg(f,8,27);return dict(c=c,sx=sx,aL=0,pk=w,tgt=('lerp0',T,w),arc=np.sin(np.pi*w),ikw=w,hand=slerpR(I0['hand.L'][1],HB,w),up=w)
        u=seg(f,31,40);v=seg(f,40,58)
        return dict(c=c,sx=sx,aL=v,tgt=('lerp1',T+UP*(L*u+V['drop']*(1-c)),1-v),pk=1-v,ikw=1-v,hand=slerpR(HB,I1['hand.L'][1],v),up=1-v)
    # put
    c=seg(f,8,30) if f<=40 else 1-seg(f,40,64)
    sx=seg(f,0,10)*(1-seg(f,50,68))
    if f<=26:
        v=seg(f,8,26);return dict(c=c,sx=sx,aL=1-v,tgt=('lerp1',T+UP*(L+V['drop']*(1-c)),v),pk=v,ikw=v,hand=slerpR(I1['hand.L'][1],HB,v),up=v)
    if f<=40:return dict(c=c,sx=sx,aL=0,tgt=('abs',T+UP*L*(1-seg(f,26,34))),ikw=1,hand=HB,up=1)
    u=seg(f,40,46);v=seg(f,44,64)
    return dict(c=c,sx=sx,aL=0,tgt=('lerp0',T+UP*0.03*u,1-v),arc=np.sin(np.pi*v),ikw=1-v,hand=slerpR(HB,I0['hand.L'][1],v),up=1-seg(f,40,48))
def build(V):
    nf=V['frames'];V['T']=np.array([V['tx'],LAMP_BOTTOM+V['ty'],V['tz']]);LEAN=np.radians(V.get('lean',25));DROP=V['drop']
    W0=fk(I0);feet={k:W0[k] for k in ('foot.L','foot.R')};frames=[];rep=[]
    for f in range(nf+1):
        S=timeline(V,f);c=S['c'];g=ss((c-0.30)/0.55)
        P={k:[v[0].copy(),v[1]] for k,v in I0.items()}
        for nm in ARM:P[nm][1]=slerpR(I0[nm][1],I1[nm][1],S['aL'])
        Wc=fk(P);rr=Wc[PAR['hips']][1] if PAR['hips'] else TW[1]
        P['hips'][0]=P['hips'][0]+rr.inv().apply(np.array([V.get('shift',0.018)*S['sx'],-DROP*c,-V.get('back',0.08)*c]))
        lh=LEAN*g*0.50;ls=LEAN*g*0.28;lc=LEAN*g*0.22;Rx=lambda a:R.from_rotvec([a,0,0])
        for nm,a in (('hips',lh),('spine',ls),('chest',lc),('neck',-0.25*LEAN*g),('head',-0.10*LEAN*g+V.get('look',0.12)*S['sx'])):
            Wc=fk(P);setworld(P,Wc,nm,Rx(a)*Wc[nm][1])
        for side,sxx in (('L',-1),('R',1)):
            Wk=fk(P);hk,kk,ft=Wk['thigh.'+side][0],Wk['shin.'+side][0],Wk['foot.'+side][0];dn=(ft-hk)/np.linalg.norm(ft-hk);pl=(kk-hk)-dn*np.dot(kk-hk,dn);pl/=np.linalg.norm(pl)
            ik2(P,'thigh.'+side,'shin.'+side,'foot.'+side,np.zeros(3),feet['foot.'+side][0],pl+np.array([sxx*V.get('knee_out',0.15)*c,0,0]))
            Wc=fk(P);setworld(P,Wc,'foot.'+side,feet['foot.'+side][1])
        Wc=fk(P);th=[]
        for side in ('L','R'):
            d=Wc['shin.'+side][0]-Wc['thigh.'+side][0];th.append(np.arctan2(d[2],-d[1]))
        tf=max(th);kf=V.get('sf',0.6)*max(0,tf-np.radians(10));back_ang=-(V.get('sb',1.0)*(lh+ls+lc)+V.get('sbx',0.0)*c)
        for nm,a in (('skirt.front',kf),('skirt.front.mid',kf),('skirt.front.low',V.get('sfl',0.0)*kf),('skirt.front.low.mid',V.get('sfl',0.0)*kf),('skirt.back',back_ang),('skirt.back.low',-V.get('sbl',0.0)*c)):
            Wc=fk(P);setworld(P,Wc,nm,Rx(a)*Wc[nm][1])
        for nm,sxx in (('skirt.left',-1),('skirt.right',1)):
            Wc=fk(P);setworld(P,Wc,nm,R.from_rotvec([V.get('ssd',0.5)*max(0,tf-np.radians(10)),0,0])*R.from_rotvec([0,0,-sxx*V.get('sso',0.05)*c])*Wc[nm][1])
        # 右臂（.L = 她的右手）：FK（idle/提灯臂混合）与 IK（socket→目标）按 ikw 混合；手腕局部只在绑定/待机之间 slerp（不扭）
        P['hand.L'][1]=S['hand'];Wc=fk(P);p_nat=Wc['hand.L'][0]+Wc['hand.L'][1].apply(SOCK)
        tg=S['tgt'];tgt=tg[1] if tg[0]=='abs' else p_nat+(tg[1]-p_nat)*float(np.clip(tg[2],0,1));tgt=tgt+np.array(V.get('arc',[0,0,0.08]))*S.get('arc',0.0)
        pk=S.get('pk',1.0);POLE=np.array(V.get('pole',[-0.55,0.15,-1.0]))*pk+np.array([-0.55,0.15,-1.0])*(1-pk)
        err=0.0
        if S['ikw']>1e-5:
            Q={n:[v[0].copy(),v[1]] for n,v in P.items()};err=ik2(Q,'upper_arm.L','forearm.L','hand.L',SOCK,tgt,POLE)
            bI=float(ss(min(1.0,S['ikw']/0.3)));S['bI']=bI   # 路径前 30% 内 FK→IK 渐入（此段目标点仍贴近自然位）
            for nm in ('upper_arm.L','forearm.L'):P[nm][1]=slerpR(P[nm][1],Q[nm][1],bI)
            if bI<1:err=None
        tw_deg=0.0;flex_deg=0.0
        if S.get('up',0)>1e-4:
            for it in range(4):
                Wc=fk(P);Hw=Wc['hand.L'][1];G=Hw*HBW.inv()*QSG   # 当前握把世界旋转
                yv=G.apply([0,1,0]);fwd=G.apply([0,0,1]) ;fw=np.array([fwd[0],0,fwd[2]]);psi=np.arctan2(fw[0],fw[2])
                Gd=R.from_rotvec([0,psi,0]);Hd=Gd*QSG.inv()*HBW;Hd=slerpR(Hw,Hd,S['up'])
                F=Wc['forearm.L'][1];hl=P['hand.L'][1];hd=F.inv()*Hd;q=hd*hl.inv()
                qq=q.as_quat();tw=np.array([0,qq[1],0,qq[3]]);tw/=np.linalg.norm(tw);TWq=R.from_quat(tw);SW=q*TWq.inv()
                P['forearm.L'][1]=P['forearm.L'][1]*TWq;P['hand.L'][1]=TWq.inv()*SW*TWq*hl
                for _ in range(3):   # 把手骨相对绑定的 Y 扭转全部移到前臂（旋前/旋后），手腕零扭转
                    rr_=(HB.inv()*P['hand.L'][1]).as_quat();t_=np.array([0,rr_[1],0,rr_[3]]);t_/=np.linalg.norm(t_);Ty=R.from_quat(t_)
                    P['forearm.L'][1]=P['forearm.L'][1]*Ty;P['hand.L'][1]=Ty.inv()*P['hand.L'][1]
                if S.get('bI',0)>0.999:err=ik2(P,'upper_arm.L','forearm.L','hand.L',SOCK,tgt,POLE)
            Wc=fk(P);tw_deg=float(np.degrees((I0['forearm.L'][1].inv()*P['forearm.L'][1]).magnitude()));flex_deg=float(np.degrees((HB.inv()*P['hand.L'][1]).magnitude()))
        Wc=fk(P);G=Wc['hand.L'][1]*HBW.inv()*QSG;upv=G.inv().apply([0,1,0]);grip_tilt=float(np.degrees(np.arccos(np.clip(upv[1],-1,1))))
        Wc=fk(P);setworld(P,Wc,'upper_arm.R',Rx(-0.55*(lh+ls+lc))*Wc['upper_arm.R'][1])
        Wc=fk(P);setworld(P,Wc,'forearm.R',Rx(-V.get('lfa',0.35)*g)*Wc['forearm.R'][1])
        if f==nf:  # 结束帧 = 目标待机 f0（精确）
            E=I1 if V['mode']=='pick' else I0;dmax=sorted(((round(float(np.degrees((P[n][1].inv()*E[n][1]).magnitude())),2),n) for n in JN))[-4:];P={k:[v[0].copy(),v[1]] for k,v in E.items()};print('end-frame pre-snap dev',dmax)
        frames.append({k:(v[0].copy(),v[1]) for k,v in P.items()})
        Wc=fk(P);sw=Wc['hand.L'][0]+Wc['hand.L'][1].apply(SOCK);dl=Wc['neck'][0]-Wc['hips'][0]
        kn={s:np.degrees(np.arccos(np.clip(np.dot(Wc['thigh.'+s][1].apply([0,1,0]),Wc['shin.'+s][1].apply([0,1,0])),-1,1))) for s in 'LR'}
        rep.append(dict(f=f,c=round(float(c),4),lean_deg=round(float(np.degrees(np.arctan2(np.hypot(dl[0],dl[2]),dl[1]))),2),knee_flex_L=round(float(kn['L']),1),knee_flex_R=round(float(kn['R']),1),
            sock=[round(float(x),4) for x in sw],sock_to_T_mm=round(float(np.linalg.norm(sw-V['T']))*1000,2),ik_err_mm=None if err is None else round(err*1000,2),hips_y=round(float(Wc['hips'][0][1]),4),grip_tilt_deg=round(grip_tilt,2),wrist_dev_from_bind_deg=round(flex_deg,2)))
    return frames,rep
blob=bytearray();anims=[];info={}
def add(arr,typ,mm=False):
    arr=np.ascontiguousarray(arr,np.float32);off=len(blob);blob.extend(arr.tobytes())
    a=dict(bufferView=len(J['bufferViews']),byteOffset=off,componentType=5126,count=int(arr.shape[0]),type=typ)
    if mm:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
    J['accessors'].append(a);return len(J['accessors'])-1
def emit(name,frames):
    n=len(frames);t=np.arange(n)/30.;ti=add(t.reshape(-1,1),'SCALAR',True);ch=[];sm=[]
    for nm in JN:
        Q=np.array([fr[nm][1].as_quat() for fr in frames])
        for k in range(1,n):
            if Q[k]@Q[k-1]<0:Q[k]=-Q[k]
        o=add(Q,'VEC4');sm.append(dict(input=ti,output=o));ch.append(dict(sampler=len(sm)-1,target=dict(node=N[nm],path='rotation')))
        if nm in('root','hips'):
            o=add(np.array([fr[nm][0] for fr in frames]),'VEC3');sm.append(dict(input=ti,output=o));ch.append(dict(sampler=len(sm)-1,target=dict(node=N[nm],path='translation')))
    anims.append(dict(name=name,channels=ch,samplers=sm))
for V in VARS:
    fr,rep=build(V);emit(V['name'],fr);V2={k:(v.tolist() if hasattr(v,'tolist') else v) for k,v in V.items()}
    info[V['name']]=dict(params=V2,frames=len(fr),dur=(len(fr)-1)/30,rows=rep,morph=dict(curves={'lantern_hold_R':V['hold']}))
    r=rep;print(V['name'],'maxlean',max(x['lean_deg'] for x in r),'minhips',min(x['hips_y'] for x in r),'ikerr',max((x['ik_err_mm'] or 0) for x in r),'knee',max(x['knee_flex_L'] for x in r),'T_mm@attach',r[V['attach_f']]['sock_to_T_mm'])
pad=(4-len(B)%4)%4;J['bufferViews'].append(dict(buffer=0,byteOffset=len(B)+pad,byteLength=len(blob)))
J['animations']+=anims;save(OUT,J,B+b'\0'*pad+bytes(blob));json.dump(info,open(INFO,'w'),indent=1,ensure_ascii=False)
