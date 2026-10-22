# 手提灯 prop_lantern_v1.glb：独立道具，无骨骼。原点 = 握把中心（= socket.lantern 挂点，也是钟摆轴心），+Y 上，灯向 -Y 下垂。
# 环境变量 BAIL（吊环长，默认 0.06 m）可在穿模修正时缩短。
import json,struct,math,os,sys,numpy as np
BAIL=float(os.environ.get('BAIL','0.06'));H=0.16;GR=0.006  # 灯身高 16cm，握把半径 0.6cm（直径 1.2cm）
V=[];F=[];part=[]
def prism(c,r,y0,y1,n=6,rot=0.0,caps=True,tag='frame',sub=1,axis='y',r1=None):
    r1=r if r1 is None else r1;base=len(V);rows=sub+1
    for s in range(rows):
        t=s/sub;y=y0+(y1-y0)*t;rr=r+(r1-r)*t
        for k in range(n):
            a=rot+2*math.pi*k/n;x,z=rr*math.cos(a),rr*math.sin(a)
            p=[c[0]+x,c[1]+y,c[2]+z] if axis=='y' else [c[0]+x,c[1]+z,c[2]+y]
            V.append(p);part.append(tag)
    for s in range(sub):
        for k in range(n):
            a=base+s*n+k;b=base+s*n+(k+1)%n;c2=a+n;d=b+n;F.extend([(a,c2,d),(a,d,b)])
    if caps:
        for k in range(1,n-1):
            F.append((base,base+k+1,base+k));tt=base+sub*n;F.append((tt,tt+k,tt+k+1))
def tube(path,r,n=4,tag='bail'):
    base=len(V);path=np.array(path)
    for i,p in enumerate(path):
        t=path[min(i+1,len(path)-1)]-path[max(i-1,0)];t/=np.linalg.norm(t)
        u=np.cross(t,[0,0,1]) if abs(t[2])<0.9 else np.cross(t,[1,0,0]);u/=np.linalg.norm(u);w=np.cross(t,u)
        for k in range(n):
            a=2*math.pi*k/n+math.pi/4;V.append(list(p+r*(u*math.cos(a)+w*math.sin(a))));part.append(tag)
    for i in range(len(path)-1):
        for k in range(n):
            a=base+i*n+k;b=base+i*n+(k+1)%n;F.extend([(a,a+n,b+n),(a,b+n,b)])
# 握把：沿 Z 的 6 棱柱，长 3.6cm
prism([0,0,0],GR,-0.018,0.018,n=6,axis='z',tag='grip')
# 吊环：U 形，从握把两端下到灯顶钮（总下垂 BAIL）
top=-BAIL;path=[]
for i in range(9):
    s=i/8;a=math.pi*s;path.append([0.0,top*0.5+(-top*0.5+0.004)*math.sin(a)*0+0,0])
path=[]
for i in range(7):  # 半椭圆环：顶在握把内（y=+0.003），两脚落到灯顶钮 y=top
    a=math.pi*i/6;path.append([0,top+(0.003-top)*math.sin(a),0.016*math.cos(a)])
tube(path,0.0022,4,'bail')
y0=top  # 灯顶
# 顶钮
prism([0,y0,0],0.008,-0.008,0.0,n=6,tag='frame')
# 屋顶：六角锥台
prism([0,y0,0],0.050,-0.032,-0.008,n=6,tag='frame',r1=0.010,rot=math.pi/6)
# 屋檐带 / 上框带
prism([0,y0,0],0.052,-0.038,-0.032,n=6,tag='frame',rot=math.pi/6)
prism([0,y0,0],0.046,-0.046,-0.038,n=6,tag='frame',rot=math.pi/6)
gy0,gy1=y0-0.046,y0-H+0.030
# 6 根立柱（4 棱）
for k in range(6):
    a=math.pi/6+2*math.pi*k/6;c=[0.046*math.cos(a),0,0.046*math.sin(a)]
    prism(c,0.0045,gy1,gy0,n=4,rot=a+math.pi/4,tag='frame')
# 中腰装饰带
prism([0,0,0],0.0465,(gy0+gy1)/2-0.003,(gy0+gy1)/2+0.003,n=6,tag='frame',rot=math.pi/6,caps=False)
# 下框带 + 底座台
prism([0,0,0],0.048,gy1-0.012,gy1,n=6,tag='frame',rot=math.pi/6)
prism([0,0,0],0.040,y0-H,gy1-0.012,n=6,tag='frame',rot=math.pi/6,r1=0.046)
# 玻璃：六角柱侧面，竖向 5 段（双面材质）
gbase=len(F);prism([0,0,0],0.042,gy1,gy0,n=6,tag='glass',rot=math.pi/6,caps=False,sub=5)
V=np.array(V,np.float32);F=np.array(F,np.uint16)
coreY=(gy0+gy1)/2
def tris(tag):
    idx=np.array([i for i,t in enumerate(F) if part[t[0]]==tag]);return F[idx]
# 法线（平滑），玻璃单独
def normals(Fs):
    N=np.zeros_like(V)
    for a,b,c in Fs: n=np.cross(V[b]-V[a],V[c]-V[a]);N[[a,b,c]]+=n
    return N/(np.linalg.norm(N,axis=1,keepdims=True)+1e-12)
# 打包
bin_=bytearray();bvs=[];accs=[]
def add(arr,typ,ct,target,mm=False):
    global bin_
    while len(bin_)%4: bin_.append(0)
    a=np.ascontiguousarray(arr);bvs.append({'buffer':0,'byteOffset':len(bin_),'byteLength':a.nbytes,'target':target});bin_+=a.tobytes()
    acc={'bufferView':len(bvs)-1,'componentType':ct,'count':len(a),'type':typ}
    if mm: acc['min']=a.min(0).tolist();acc['max']=a.max(0).tolist()
    accs.append(acc);return len(accs)-1
def prim(Fs,mat):
    used=np.unique(Fs);rm={o:n for n,o in enumerate(used)};P=V[used];N=normals(Fs)[used]
    Fi=np.vectorize(rm.get)(Fs).astype(np.uint16)
    return {'attributes':{'POSITION':add(P,'VEC3',5126,34962,True),'NORMAL':add(N.astype(np.float32),'VEC3',5126,34962)},'indices':add(Fi.reshape(-1),'SCALAR',5123,34963),'material':mat}
FR=np.concatenate([tris('frame'),tris('grip'),tris('bail')]);GL=tris('glass')
# 灯芯：两张十字交叉的发光面片（4 三角）
cw,ch=0.018,0.032
CV=np.array([[-cw,-ch,0],[cw,-ch,0],[cw,ch,0],[-cw,ch,0],[0,-ch,-cw],[0,-ch,cw],[0,ch,cw],[0,ch,-cw]],np.float32)
CF=np.array([[0,1,2],[0,2,3],[4,5,6],[4,6,7]],np.uint16)
core={'attributes':{'POSITION':add(CV,'VEC3',5126,34962,True),'NORMAL':add(np.tile([0,0,1],(8,1)).astype(np.float32),'VEC3',5126,34962)},'indices':add(CF.reshape(-1),'SCALAR',5123,34963),'material':2}
mats=[{'name':'M_LANTERN_COPPER','pbrMetallicRoughness':{'baseColorFactor':[0.50,0.30,0.17,1],'metallicFactor':0.55,'roughnessFactor':0.5}},
      {'name':'M_LANTERN_GLASS','alphaMode':'BLEND','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1.0,0.86,0.62,0.30],'metallicFactor':0,'roughnessFactor':0.1}},
      {'name':'M_LANTERN_CORE','doubleSided':True,'emissiveFactor':[1.0,0.62,0.25],'pbrMetallicRoughness':{'baseColorFactor':[1.0,0.70,0.35,1],'metallicFactor':0,'roughnessFactor':1}}]
meshes=[{'name':'lantern.body','primitives':[prim(FR,0),prim(GL,1)]},{'name':'lantern.core','primitives':[core]}]
nodes=[{'name':'prop_lantern','children':[1,2],'extras':{'origin':'握把中心 = socket.lantern 挂点 = 钟摆轴心','bail_m':BAIL,'height_m':H,'grip_diameter_m':2*GR}},
       {'name':'lantern.body','mesh':0},{'name':'lantern.core','mesh':1,'translation':[0,float(coreY),0],'extras':{'note':'发光面片，光晕由场景特效bot挂在此节点'}}]
j={'asset':{'version':'2.0','generator':'角色建模bot build_lantern.py'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':meshes,'materials':mats,'accessors':accs,'bufferViews':bvs,'buffers':[{'byteLength':0}]}
while len(bin_)%4: bin_.append(0)
j['buffers'][0]['byteLength']=len(bin_)
js=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode()
while len(js)%4: js+=b' '
out=sys.argv[1]
open(out,'wb').write(struct.pack('<III',0x46546C67,2,28+len(js)+len(bin_))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin_),0x004E4942)+bytes(bin_))
info=dict(tris=dict(frame=int(len(tris('frame'))),grip=int(len(tris('grip'))),bail=int(len(tris('bail'))),glass=int(len(GL)),core=4,total=int(len(FR)+len(GL)+4)),bail=BAIL,height=round(float(V[:,1].max()-0)*0+H,3),
  lamp_top_y=float(y0),lamp_bottom_y=float(V[:,1].min()),core_offset=[0,float(coreY),0],radius_max=float(np.linalg.norm(V[:,[0,2]],axis=1).max()))
json.dump(info,open(out+'.build.json','w'),indent=1);print('LANTERN',json.dumps(info))
