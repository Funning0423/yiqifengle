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
OUT,INFO=sys.argv[1:3];VARS=json.loads(os.environ['VARS'])
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
def build(V):
    SIT_S.clear()
    FPS=30;nf=V.get('frames',60)+V.get('lead',0);f_bot=V.get('f_bot',22);f_lift=V.get('f_lift',28);f_up=V.get('f_up',52)
    T=np.array([V['tx'],LAMP_BOTTOM+V.get('ty',0.0),V['tz']])   # 交接帧 socket 世界点（她的根空间）
    LEAN=np.radians(V.get('lean',27));DROP=V.get('drop',None)
    I0=sample('idle_breathing_loop',0.0);I1=sample('idle_breathing_loop_lantern',0.0)
    W0=fk(I0);feet={k:W0[k] for k in ('foot.L','foot.R')}
    frames=[];hold=[];rep=[]
    LEAD=V.get('lead',0)
    for f in range(nf+1):
        f=f-LEAD if f>=LEAD else 0
        # 蹲深 c：0→1（f0..f_bot），保持到 f_lift，1→0（f_lift..f_up）
        c=smoother(f/f_bot) if f<=f_bot else (1.0 if f<=f_lift else 1-smoother((f-f_lift)/(f_up-f_lift)))
        g=ss((c-0.30)/0.55)           # 前倾只在 c>0.30（膝已明显弯）后开始
        before=f<=f_lift
        Pb=I0 if before else I1      # 基础（手臂以外两者一致）
        P={k:[v[0].copy(),v[1]] for k,v in I0.items()}
        # 髋：下沉 + 后移 + 前倾一部分
        hipsW=W0['hips'];drop=DROP*c;back=V.get('back',0.10)*c
        lh=LEAN*g*0.50;ls=LEAN*g*0.28;lc=LEAN*g*0.22
        Wc=fk(P)
        P['root'][0]=P['root'][0]+np.array([0,0,0])
        # hips 的局部平移（父=root，root 世界旋转记作 rr）
        rr=Wc[PAR['hips']][1] if PAR['hips'] else TW[1]
        P['hips'][0]=P['hips'][0]+rr.inv().apply(np.array([0,-drop,-back]))
        Rx=lambda a:R.from_rotvec([a,0,0])
        for nm,a in (('hips',lh),('spine',ls),('chest',lc)):
            Wc=fk(P);setworld(P,Wc,nm,Rx(a)*Wc[nm][1])
        # 头颈：抵消一部分，目光看灯
        for nm,a in (('neck',-0.25*LEAN*g),('head',-0.10*LEAN*g)):
            Wc=fk(P);setworld(P,Wc,nm,Rx(a)*Wc[nm][1])
        # 裙骨：前片随大腿抬起、后片保持近竖直（布料一侧解决）
        # 腿 IK：脚世界锁死
        for side,sx in (('L',-1),('R',1)):
            Wc=fk(P);tgt=feet['foot.'+side][0]
            ik2(P,'thigh.'+side,'shin.'+side,'foot.'+side,np.zeros(3),tgt,np.array([sx*V.get('knee_out',0.45),0,1.0]))
            Wc=fk(P);setworld(P,Wc,'foot.'+side,feet['foot.'+side][1])
        Wc=fk(P)
        # 裙
        th=[]
        for side in ('L','R'):
            d=Wc['shin.'+side][0]-Wc['thigh.'+side][0];th.append(np.arctan2(d[2],-d[1]))
        tf=max(th)
        kf=V.get('sf',0.75)*max(0,tf-np.radians(10))
        back_ang=-(V.get('sb',1.0)*(lh+ls+lc)+V.get('sbx',0.0)*c)   # 后片：抵消髋前倾并再向后撩起（布料一侧）
        for nm,a in (('skirt.front',kf),('skirt.front.mid',kf),('skirt.front.low',V.get('sfl',0.0)*kf),('skirt.front.low.mid',V.get('sfl',0.0)*kf),
                     ('skirt.back',back_ang),('skirt.back.low',-V.get('sbl',0.0)*c)):
            Wc=fk(P);setworld(P,Wc,nm,Rx(a)*Wc[nm][1])
        for nm,side,sx in (('skirt.left','L',-1),('skirt.right','R',1)):
            Wc=fk(P);setworld(P,Wc,nm,R.from_rotvec([V.get('ssd',0.45)*max(0,tf-np.radians(10)),0,0])*R.from_rotvec([0,0,-sx*V.get('sso',0.10)*c])*Wc[nm][1])
        for nm,sx in (('skirt.left.low',-1),('skirt.right.low',1)):
            Wc=fk(P);setworld(P,Wc,nm,R.from_rotvec([0,0,-sx*V.get('sslo',0.0)*c])*Wc[nm][1])
        if V.get('sitcopy'):
            s_=float(np.clip((tf-np.radians(5))/(V.get('tf_sit',1.6)-np.radians(5)),0,1));s_=ss(s_);SIT_S.append(s_)
            for nm in JN:
                if nm.startswith(('skirt','ribbon')):P[nm][1]=Slerp([0,1],R.concatenate([I0[nm][1],SIT[nm][1]]))(s_)
        # 右臂（.L）：前段 = idle 臂 → IK 到 T；后段 = IK 从 T → 提灯臂
        Pn={k:[v[0].copy(),v[1]] for k,v in P.items()}
        for nm in ('upper_arm.L','forearm.L','hand.L'):Pn[nm][1]=(I0 if before else I1)[nm][1]
        if not before:pass
        Wn=fk(Pn);p_nat=Wn['hand.L'][0]+Wn['hand.L'][1].apply(SOCK)
        w=ss((c-V.get('w0',0.5))/(1-V.get('w0',0.5)))
        hand_bind=restT(N['hand.L'])[1]
        for nm in ('upper_arm.L','forearm.L'):P[nm][1]=Pn[nm][1]
        P['hand.L'][1]=Slerp([0,1],R.concatenate([Pn['hand.L'][1],hand_bind]))(min(1,w*1.5)) if before else Pn['hand.L'][1]
        tgt=p_nat+(T-p_nat)*w+np.array(V.get('bulge',[0,0,0]))*np.sin(np.pi*w)   # 路径外鼓：手/灯绕开右膝外侧
        err=0.0
        if w>1e-4:err=ik2(P,'upper_arm.L','forearm.L','hand.L',SOCK,tgt,np.array([-0.55,0.15,-1.0]))
        # 左臂（.R）：自然随前倾稍前垂，搭向左膝外侧（不外张）
        Wc=fk(P);up=Wc['upper_arm.R'][1];
        setworld(P,Wc,'upper_arm.R',Rx(-0.55*(lh+ls+lc))*R.from_rotvec([0,0,V.get('lab',0.0)*g])*Wc['upper_arm.R'][1])
        Wc=fk(P);setworld(P,Wc,'forearm.R',Rx(-V.get('lfa',0.35)*g)*Wc['forearm.R'][1])
        frames.append({k:(v[0].copy(),v[1]) for k,v in P.items()})
        Wc=fk(P);sw=Wc['hand.L'][0]+Wc['hand.L'][1].apply(SOCK)
        dlean=Wc['neck'][0]-Wc['hips'][0];lean_deg=np.degrees(np.arctan2(np.hypot(dlean[0],dlean[2]),dlean[1]))
        kn={s:np.degrees(np.arccos(np.clip(np.dot(Wc['thigh.'+s][1].apply([0,1,0]),Wc['shin.'+s][1].apply([0,1,0])),-1,1))) for s in 'LR'}
        rep.append(dict(f=len(rep),c=round(float(c),4),lean_deg=round(float(lean_deg),2),knee_flex_L=round(float(kn['L']),1),knee_flex_R=round(float(kn['R']),1),
                        sock=[round(float(x),4) for x in sw],ik_err_mm=round(err*1000,2),hips_y=round(float(Wc['hips'][0][1]),4)))
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
    fr,rep=build(V)
    cs=[x['c'] for x in rep];mor={k:[[round(i/30,4),round(float(w*ss((cc-a0)/(1-a0))),4)] for i,cc in enumerate(cs)] for k,(w,a0) in V.get('morphs',{}).items()}
    if V.get('sitcopy'):
        for k,w in SITW.items():
            if w>1e-3:mor[k]=[[round(i/30,4),round(float(w*x),4)] for i,x in enumerate(SIT_S)]
    mor['lantern_hold_R']=V['hold']
    emit(V['name'],fr);info[V['name']]=dict(params=V,frames=len(fr),dur=(len(fr)-1)/30,rows=rep,morph=dict(curves=mor))
    if V.get('reverse_name'):
        emit(V['reverse_name'],fr[::-1]);D=(len(fr)-1)/30;info[V['reverse_name']]=dict(reverse_of=V['name'],frames=len(fr),dur=D,morph=dict(curves={k:[[round(D-t,4),w] for t,w in v[::-1]] for k,v in mor.items() if k!='lantern_hold_R'}|{'lantern_hold_R':V['hold_rev']}))
pad=(4-len(B)%4)%4;J['bufferViews'].append(dict(buffer=0,byteOffset=len(B)+pad,byteLength=len(blob)))
J['animations']+=anims;save(OUT,J,B+b'\0'*pad+bytes(blob));json.dump(info,open(INFO,'w'),indent=1,ensure_ascii=False)
for k,v in info.items():
    if 'rows' in v:
        r=v['rows'];print(k,'maxlean',max(x['lean_deg'] for x in r),'minhips',min(x['hips_y'] for x in r),'ikerr',max(x['ik_err_mm'] for x in r),'knee',max(x['knee_flex_L'] for x in r))
