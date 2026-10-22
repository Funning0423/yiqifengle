# 围巾 v1：在 GLB 上直接追加 scarf.tail(idx29, 父 neck) + LOD0_G2_SCARF 网格；不改原 28 骨/飘带骨/原蒙皮。
# 用法: blender -b --python build_scarf.py -- base.glb out.glb   （只用 Blender 的 BVH 做间隙计算，不经 Blender 导出）
import sys,os,io,json,math,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from glb import G
from rig import glob
from mathutils import Vector
from mathutils.bvhtree import BVHTree
base,out=sys.argv[-2:]
g=G(base);j=g.j;nodes=j['nodes'];sk=j['skins'][0];J=sk['joints'];nm=[nodes[i]['name'] for i in J]
assert len(J)==29 and nm[28]=='ribbon' and 'scarf.tail' not in nm
IB=g.full(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
BODY=[m for m in j['meshes'] if m['name']=='LOD0_G2_BODY'][0]
# 静止碰撞体：BODY 全部 primitive（含脸/发/帽）
PV=[];PT=[];o=0;BW=[]
for p in BODY['primitives']:
    P=g.full(p['attributes']['POSITION']);I=g.full(p['indices']).reshape(-1,3)
    PV.append(P);PT.append(I+o);o+=len(P)
    if p is BODY['primitives'][0]: B0=(P,g.full(p['attributes']['JOINTS_0']),g.full(p['attributes']['WEIGHTS_0']))
PV=np.concatenate(PV);PT=np.concatenate(PT)
bvh=BVHTree.FromPolygons([Vector(v) for v in PV],[tuple(map(int,t)) for t in PT])
def clr(p): r=bvh.find_nearest(Vector(p));return r[3]
def ray_front(x,y):
    h=bvh.ray_cast(Vector((x,y,0.4)),Vector((0,0,-1)));return h[0].z if h[0] else None
HEADW=float(os.environ.get('HEADW','0'))
GAP=float(os.environ.get('GAP','0.006'))
# ---------- 颈圈 ----------
NS=18;NC=7;HY=float(os.environ.get("HY","0.019"));HT=float(os.environ.get("HT","0.013"))
th=np.linspace(-math.pi,math.pi,NS,endpoint=False)+math.pi/NS
yc=1.414-0.006*np.cos(th)          # 前低后高
cz=-0.005
def sect(i,r):
    a=th[i];d=np.array([math.sin(a),0,math.cos(a)]);c=np.array([0,yc[i],cz])+d*(r+HT)
    vs=[]
    for k in range(NC):
        phi=2*math.pi*k/NC;vs.append(c+d*HT*math.cos(phi+math.pi)*1.0+np.array([0,HY*math.sin(phi+math.pi),0]))
    return np.array(vs)
R=np.full(NS,0.06)
for it in range(40):
    for i in range(NS):
        vs=sect(i,R[i]);inner=vs[[0,1,NC-1]]
        c=min(clr(v) for v in vs)
        R[i]+= (GAP-c)*0.8
CV=np.concatenate([sect(i,R[i]) for i in range(NS)])
cmin=[min(clr(v) for v in sect(i,R[i])) for i in range(NS)]
# ---------- 尾巴（左前侧 = +X，+Z 前） ----------
def tail(x0,L,Wd,TK,nseg,twist):
    ys=np.linspace(0,L,nseg+1);pts=[]
    for s in ys:
        y=1.395-s*0.97;x=x0+0.10*s
        zs=ray_front(x,y) or 0.08
        pts.append([x,y,zs])
    pts=np.array(pts)
    secs=[]
    for k,pt in enumerate(pts):
        u=k/nseg;ang=twist*u;w=Wd*(1-0.18*u)
        ax=np.array([math.cos(ang),0,math.sin(ang)])
        nz=np.array([-math.sin(ang)*0.3,0,1.0]);nz/=np.linalg.norm(nz)
        c=pt.copy()
        for _ in range(30):
            q=[c+ax*w/2-nz*TK/2,c-ax*w/2-nz*TK/2,c-nz*TK/2]
            m=min(clr(v) for v in q)
            if m>=0.008+0.004*u: break
            c=c+nz*0.002
        secs.append(np.array([c+ax*w/2+nz*TK/2,c-ax*w/2+nz*TK/2,c-ax*w/2-nz*TK/2,c+ax*w/2-nz*TK/2]))
    return np.array(secs)
T1=tail(0.030,0.18,0.045,0.009,8,0.25)
T2=tail(0.058,0.14,0.040,0.009,7,-0.30)
# 颈圈外表面再离尾巴根：尾巴根被颈圈盖住（结）
# ---------- 网格拼装 ----------
V=[];UV=[];F=[];PART=[]
def addv(p,uv,part): V.append(p);UV.append(uv);PART.append(part);return len(V)-1
# 颈圈：每段 NC 顶点，u 沿圈，v 沿截面
idx=np.zeros((NS+1,NC),int)
for i in range(NS+1):
    for k in range(NC): idx[i,k]=addv(CV[(i%NS)*NC+k],(i/NS*3.0,k/NC),('collar',i%NS,k))
for i in range(NS):
    for k in range(NC):
        a,b,c,d=idx[i,k],idx[i+1,k],idx[i+1,(k+1)%NC],idx[i,(k+1)%NC]
        F+= [(a,b,c),(a,c,d)]
# 截面环在 k=NC 处 uv 接缝：再复制一列（v=1）
def tailmesh(S,name,L):
    n=len(S);ids=np.zeros((n,5),int)
    for i in range(n):
        for k in range(5): ids[i,k]=addv(S[i,k%4],(0.25+0.25*(k%4==1 or k%4==2),i/(n-1)*L/0.06),(name,i,k%4,(i/(n-1))*L))
    for i in range(n-1):
        for k in range(4):
            a,b,c,d=ids[i,k],ids[i+1,k],ids[i+1,k+1],ids[i,k+1];F.extend([(a,d,c),(a,c,b)])
    for i,(fl) in ((0,True),(n-1,False)):
        q=[ids[i,0],ids[i,1],ids[i,2],ids[i,3]]
        F.extend([(q[0],q[1],q[2]),(q[0],q[2],q[3])] if not fl else [(q[0],q[2],q[1]),(q[0],q[3],q[2])])
tailmesh(T1,'tail1',0.18);tailmesh(T2,'tail2',0.14)
# 结：六角柱盖住两尾根
kc=(T1[0].mean(0)+T2[0].mean(0))/2;kc[2]+=0.004;kc[1]+=0.004
kd=np.array([kc[0],0,kc[2]+0.005]);kd/=np.linalg.norm(kd)
kx=np.cross([0,1,0],kd);kx/=np.linalg.norm(kx)
ring=[]
for side in (-1,1):
    r=[]
    for k in range(6):
        a=2*math.pi*k/6;p=kc+kx*0.026*math.cos(a)+np.array([0,0.016,0])*math.sin(a)+kd*0.009*side
        r.append(addv(p,(0.5+0.4*math.cos(a)/2,0.5+0.4*math.sin(a)/2),('knot',)))
    ring.append(r)
for k in range(6):
    a,b,c,d=ring[0][k],ring[0][(k+1)%6],ring[1][(k+1)%6],ring[1][k];F+=[(a,b,c),(a,c,d)]
for k in range(1,5): F+=[(ring[1][0],ring[1][k],ring[1][k+1]),(ring[0][0],ring[0][k+1],ring[0][k])]
V=np.array(V,np.float32);UV=np.array(UV,np.float32);F=np.array(F,np.uint16)
# 结退出间隙
for t in range(30):
    kv=[i for i,p in enumerate(PART) if p[0]=='knot']
    m=min(clr(V[i]) for i in kv)
    if m>=GAP: break
    V[kv]+=kd*0.001
# 法线
N=np.zeros_like(V)
for a,b,c in F:
    n=np.cross(V[b]-V[a],V[c]-V[a]);N[[a,b,c]]+=n
# 朝外检查：颈圈法线应远离颈心
N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-12
cen=np.array([0,1.42,cz]);flip=np.mean(np.sum(N*(V-cen),1))<0
if flip: F=F[:,::-1].copy();N=-N
# ---------- 骨骼 scarf.tail ----------
neck=J[nm.index('neck')];root_pt=(T1[0].mean(0)+T2[0].mean(0))/2
Ng=glob(j,neck);loc=(np.linalg.inv(Ng)@np.r_[root_pt,1])[:3]
nodes.append({'name':'scarf.tail','translation':[float(x) for x in loc],'extras':{'slot':29,'note':'围巾两条尾巴共用；父 neck；wind.mask scarf* 系数 0.5；摆幅上限 后≤35° 左右≤20°'}})
si=len(nodes)-1;nodes[neck].setdefault('children',[]).append(si)
newI=np.linalg.inv(glob(j,si)).astype(np.float32)
allI=np.concatenate([IB,newI[None]]).transpose(0,2,1).reshape(-1,16)
J.append(si);sk['inverseBindMatrices']=g.add(allI,'MAT4',5126);SLOT=len(J)-1;assert SLOT==29
iN,iC,iH=nm.index('neck'),nm.index('chest'),nm.index('head')
JW=np.zeros((len(V),4),np.uint8);WW=np.zeros((len(V),4),np.float32)
NECKMAX=float(os.environ.get("NECKMAX","0.6"))
def neckw(y): return float(np.clip((y-1.385)/0.05,0,1))*NECKMAX
for i,p in enumerate(PART):
    y=V[i,1]
    if p[0] in('collar','knot'):
        wn=neckw(y);wh=HEADW*float(np.clip((y-1.400)/0.035,0,1));JW[i]=[iN,iC,iH,0];WW[i]=[wn*(1-wh),(1-wn)*(1-wh),wh,0]
    else:
        s=p[3];L=0.18 if p[0]=='tail1' else 0.14;Wm=1.0 if p[0]=='tail1' else 0.7
        wt=Wm*min(1.0,s/(0.35*L));wt=wt*wt*(3-2*wt) if Wm==1 else Wm*(lambda u:u*u*(3-2*u))(min(1.0,s/(0.35*L)))
        rest=1-wt;wn=neckw(y)
        JW[i]=[SLOT,iN,iC,0];WW[i]=[wt,rest*wn,rest*(1-wn),0]
WW/=WW.sum(1,keepdims=True)
# ---------- 贴图：米白底 + 淡黄细条纹（沿长度方向）+ 内侧 AO 带 ----------
png=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'T_G2_SCARF_64.png'),'rb').read()  # 由 scarf_tex.py 生成
# 尾巴 uv：v 用截面厚度方向→放在 0.25~0.5（不压暗）
while len(g.b)%4: g.b.append(0)
j['bufferViews'].append({'buffer':0,'byteOffset':len(g.b),'byteLength':len(png)});g.b+=png
j['images'].append({'name':'T_G2_SCARF_64','mimeType':'image/png','bufferView':len(j['bufferViews'])-1})
j['textures'].append({'sampler':0,'source':len(j['images'])-1})
j['materials'].append({'name':'M_G2_SCARF','pbrMetallicRoughness':{'baseColorTexture':{'index':len(j['textures'])-1},'metallicFactor':0,'roughnessFactor':0.9}})
# uv：交换为 (u沿长, v截面)；颈圈已是；尾巴 uv 存的是 (v截面,u沿长) → 交换
for i,p in enumerate(PART):
    if p[0] in('tail1','tail2'): UV[i]=[UV[i,1],UV[i,0]]
prim={'attributes':{'POSITION':g.add(V,'VEC3',5126,34962,minmax=True),'NORMAL':g.add(N.astype(np.float32),'VEC3',5126,34962),'TEXCOORD_0':g.add(UV,'VEC2',5126,34962),
      'JOINTS_0':g.add(JW,'VEC4',5121,34962),'WEIGHTS_0':g.add(WW,'VEC4',5126,34962)},'indices':g.add(F.reshape(-1),'SCALAR',5123,34963),'material':len(j['materials'])-1}
j['meshes'].append({'name':'LOD0_G2_SCARF','primitives':[prim]})
bodyn=[i for i,n in enumerate(nodes) if n['name']=='LOD0_G2_BODY'][0]
par=[i for i,n in enumerate(nodes) if bodyn in n.get('children',[])][0]
nodes.append({'name':'LOD0_G2_SCARF','mesh':len(j['meshes'])-1,'skin':0});nodes[par]['children'].append(len(nodes)-1)
g.save(out)
info=dict(tris=int(len(F)),verts=int(len(V)),collar_tris=NS*NC*2,collar_gap_mm=[round(c*1000,2) for c in cmin],root=root_pt.tolist(),scarf_tail_local=loc.tolist(),
  tail1_len=0.18,tail2_len=0.14,png_bytes=len(png),flip=bool(flip),joints=len(J))
json.dump(info,open(out+'.build.json','w'),ensure_ascii=False,indent=1);print('SCARF',json.dumps(info))
