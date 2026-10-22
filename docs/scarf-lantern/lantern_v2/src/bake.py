# 提灯 v2 右臂（她的右手 = .L）：屈肘提灯在腰前。glTF 空间（+Y 上，+Z 前，她的右 = -X）
# 每帧：上臂/前臂方向在 chest 局部系里固定（相对绑定姿态做最小摆转 swing，不加扭转），hand.L 保持绑定局部旋转（腕不弯不扭）；
# 再叠原 clip 上臂/前臂相对其均值的 MOD 倍（随身体的轻微起伏）。输出：只含 3 个右臂旋转通道的 dense clip（覆盖层用）+ 整身 dense clip（QA 用）
# python3 bake.py BASE.glb OUT_dense_arm.glb CLIPS...
import sys,os,json,numpy as np
sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
from scipy.spatial.transform import Rotation as R, Slerp
BASE,OUT=sys.argv[1:3];CLIPS=sys.argv[3:]
P=json.loads(os.environ.get('P','{}'))
FLEX=P.get('flex',12);ABD=P.get('abd',None);FD=P.get('fore_down',10);FIN=P.get('fore_in',20);MOD=P.get('mod',0.15)
J,B=load(BASE);N={n['name']:i for i,n in enumerate(J['nodes'])}
par={c:i for i,n in enumerate(J['nodes']) for c in n.get('children',[])}
def rest(i):return R.from_quat(J['nodes'][i].get('rotation',[0,0,0,1]))
def chain(i):
    c=[]
    while i in par:c.append(par[i]);i=par[i]
    return c[::-1]
CH=chain(N['upper_arm.L'])  # ... chest
def W(i,get):  # 世界旋转（只旋转）
    r=R.identity()
    for k in chain(i)+[i]:r=r*get(k)
    return r
Y=np.array([0,1,0.])
def swing(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);ax=np.cross(a,b);s=np.linalg.norm(ax);c=np.dot(a,b)
    if s<1e-9:return R.identity()
    return R.from_rotvec(ax/s*np.arctan2(s,c))
restget=lambda k:rest(k)
Wc0=W(N['chest'],restget);Ru0=rest(N['upper_arm.L']);Rf0=rest(N['forearm.L']);Rh0=rest(N['hand.L'])
d0=(Wc0*Ru0).apply(Y)
abd=np.degrees(np.arctan2(-d0[0],-d0[1])) if ABD is None else ABD
def dirv(flex,abd):  # 世界(绑定)方向：下垂，前屈 flex°，外展 abd°（向 -X）
    f,a=np.radians(flex),np.radians(abd);v=np.array([-np.sin(a),-np.cos(a)*np.cos(f),np.cos(a)*np.sin(f)]);return v/np.linalg.norm(v)
tu=Wc0.inv().apply(dirv(FLEX,abd))           # chest 局部
d,i=np.radians(FD),np.radians(FIN);tf=Wc0.inv().apply(np.array([np.sin(i)*np.cos(d),-np.sin(d),np.cos(i)*np.cos(d)]))
# 局部目标（与时间无关部分）：上臂 local = swing_in_chest · Ru0
Su=swing(Ru0.apply(Y),tu);Ul=Su*Ru0
Fdir_in_u=Ul.inv().apply(tf);Sf=swing(Rf0.apply(Y),Fdir_in_u);Fl=Sf*Rf0
def sampler(an,node,path):
    for ch in an['channels']:
        if ch['target']['node']==node and ch['target']['path']==path:
            s=an['samplers'][ch['sampler']];return acc(J,B,s['input'])[:,0],acc(J,B,s['output'])
    return None
def evalq(tv,t):
    tt,v=tv
    if len(tt)<2:return R.from_quat(v[0])
    return Slerp(tt,R.from_quat(v))(np.clip(t,tt[0],tt[-1]))
def mean(rs):
    q=rs.as_quat();q*=np.sign(q@q[0])[:,None];m=q.mean(0);return R.from_quat(m/np.linalg.norm(m))
newanims=[];blob=bytearray();info={}
def add(arr,typ,mm=False):
    arr=np.ascontiguousarray(arr,np.float32);off=len(blob);blob.extend(arr.tobytes())
    a=dict(bufferView=len(J['bufferViews']),byteOffset=off,componentType=5126,count=int(arr.shape[0]),type=typ)
    if mm:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
    J['accessors'].append(a);return len(J['accessors'])-1
for c in CLIPS:
    an=[a for a in J['animations'] if a['name']==c][0]
    T=max(acc(J,B,s['input'])[-1,0] for s in an['samplers']);n=int(round(T*30));t=np.arange(n+1)/30.;t[-1]=T
    qu=evalq(sampler(an,N['upper_arm.L'],'rotation'),t);qf=evalq(sampler(an,N['forearm.L'],'rotation'),t)
    du=Ru0.inv()*qu;df=Rf0.inv()*qf;mu=mean(du);mf=mean(df)
    U=[];F=[];H=[]
    for k in range(len(t)):
        eu=(mu.inv()*du[k]).as_rotvec()*MOD;ef=(mf.inv()*df[k]).as_rotvec()*MOD
        U.append((Ul*R.from_rotvec(eu)).as_quat());F.append((Fl*R.from_rotvec(ef)).as_quat());H.append(Rh0.as_quat())
    def fix(Q):
        Q=np.array(Q)
        for k in range(1,len(Q)):
            if Q[k]@Q[k-1]<0:Q[k]=-Q[k]
        return Q
    U,F,H=fix(U),fix(F),fix(H)
    ti=add(t.reshape(-1,1),'SCALAR',True)
    arm=[('upper_arm.L',U),('forearm.L',F),('hand.L',H)]
    # 整身：原通道 + 替换右臂
    chs=[];sms=[]
    for ch in an['channels']:
        nn=J['nodes'][ch['target']['node']]['name']
        if ch['target']['path']=='rotation' and nn in dict(arm):continue
        s=an['samplers'][ch['sampler']];sms.append(dict(input=s['input'],output=s['output']));chs.append(dict(sampler=len(sms)-1,target=dict(ch['target'])))
    armch=[];armsm=[]
    for nn,Q in arm:
        o=add(Q,'VEC4');sms.append(dict(input=ti,output=o));chs.append(dict(sampler=len(sms)-1,target=dict(node=N[nn],path='rotation')))
        armsm.append(dict(input=ti,output=o));armch.append(dict(sampler=len(armsm)-1,target=dict(node=N[nn],path='rotation')))
    newanims.append(dict(name=c+'_lantern',channels=chs,samplers=sms))
    newanims.append(dict(name=c+'_lanternarm',channels=armch,samplers=armsm))
    info[c]=dict(frames=len(t),dur=float(T))
pad=(4-len(B)%4)%4;J['bufferViews'].append(dict(buffer=0,byteOffset=len(B)+pad,byteLength=len(blob)))
J['animations']+=newanims
save(OUT,J,B+b'\0'*pad+bytes(blob))
print(json.dumps(dict(P=dict(flex=FLEX,abd=round(float(abd),2),fore_down=FD,fore_in=FIN,mod=MOD),clips=info)))
