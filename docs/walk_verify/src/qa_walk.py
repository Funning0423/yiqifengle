# 提灯 v2 逐帧 QA（30 fps，t=n/30）+ 渲染。blender -b --python qa_v2.py -- dense.glb meta.json out.json
# 环境：CLIPS=walk_loop,...（基础名，取 <c>_lantern）；XF=1 加 crossfade(0.2 s, 出 1-k/6)；WIND=1 风强最大(两相位)；RENDER=dir 渲染正面/侧面；BASELINE=1 用原 clip（对照）
import bpy,sys,os,json,math,numpy as np
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import load,acc
GLB,METAP,OUT=sys.argv[-3:]
PROP='/workspace/yiqifengle/previews/角色建模bot/accessories/prop_lantern_v2.glb'
NPZ=os.environ['NPZ']
os.environ.setdefault('SOCK','[0.0138,0.0803,0.0073]');os.environ['CHARGLB']=GLB;os.environ['LMODE']='hang'
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=GLB)
META=json.load(open(METAP));meta=META['clips'];O={o.name:o for o in bpy.data.objects}
arm=[o for o in O.values() if o.type=='ARMATURE'][0];PB=arm.pose.bones
if arm.animation_data is None:arm.animation_data_create()
for t in arm.animation_data.nla_tracks:t.mute=True
M={k[8:]:o for k,o in O.items() if k.startswith('LOD0_G2_') and o.type=='MESH'}
exec(open('/workspace/yiqifengle/previews/角色建模bot/accessories/src/lantern_attach.py').read())
LOBJ=attach_lantern(arm,PROP);LM=[o for o in LOBJ if o.type=='MESH']
# 手型草案 lantern_hold_R
J,Bn=load(GLB);m=[x for x in J['meshes'] if x['name']=='LOD0_G2_BODY'][0];Z=np.load(NPZ)
allP=np.concatenate([acc(J,Bn,p['attributes']['POSITION']) for p in m['primitives']]);allD=np.concatenate([Z['prim%d'%i] if 'prim%d'%i in Z else np.zeros_like(acc(J,Bn,p['attributes']['POSITION'])) for i,p in enumerate(m['primitives'])])
Bo=M['BODY'];kd=KDTree(len(allP))
for i,x in enumerate(allP):kd.insert(Vector((x[0],-x[2],x[1])),i)
kd.balance();Bo.data.shape_keys or Bo.shape_key_add(name='Basis');kb=Bo.shape_key_add(name='lantern_hold_R')
for v in Bo.data.vertices:
    co,i,dd=kd.find(v.co);d=allD[i];kb.data[v.index].co=v.co+Vector((d[0],-d[2],d[1]))
HOLD_ON=1.0
gi={g.index:g.name for g in Bo.vertex_groups}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in Bo.data.vertices]
mn=[mm.name if mm else '' for mm in Bo.data.materials];BV=Bo.data.vertices
def cls(p):
    mat=mn[p.material_index];ds=[D[v] for v in p.vertices];d=max(set(ds),key=ds.count);c=sum((BV[v].co for v in p.vertices),Vector())/len(p.vertices)
    if 'HAIR' in mat:return 'HAIR'
    if 'HEAD' in mat:return 'HAT'
    if d=='head':return 'HEAD'
    if d=='hand.L':return 'HANDR'
    if d in('upper_arm.L','forearm.L'):return 'ARMR' if c.z<1.25 else 'SHOULDER'
    if d.startswith(('upper_arm','forearm','hand')):return 'ARML'
    if d.startswith(('thigh','shin','foot')):return 'LEG'
    return 'TORSO'
PC=[cls(p) for p in Bo.data.polygons]
def wm(o):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    vs=[Mw@v.co for v in me.vertices];me.calc_loop_triangles();t=[(tuple(x.vertices),x.polygon_index) for x in me.loop_triangles];oe.to_mesh_clear();return vs,t
def interp(tab,t):return float(np.interp(t,[a for a,_ in tab],[b for _,b in tab]))
BASELINE=os.environ.get('BASELINE')
def cname(c):return c if BASELINE else c+'_lantern'
def setclip(c):
    act=[a for a in bpy.data.actions if a.name==c or a.name.startswith(c+'_Arm')];act=sorted(act,key=lambda a:len(a.name))[0];arm.animation_data.action=act
    try:arm.animation_data.action_slot=act.slots[0]
    except Exception:pass
    return act
def N_(c):return max(1,int(round(meta[c]['duration_s']*30)))
CACHE={}
def pose(c,f):
    Nn=N_(c);loop=meta[c].get('loop',False) or c=='wind_flutter_loop'
    f=f%Nn if loop else min(f,Nn);k=(c,f)
    if k in CACHE:return CACHE[k]
    act=setclip(c if c=='wind_flutter_loop' else cname(c));f0,f1=act.frame_range;fr=f0+(f1-f0)*f/Nn
    for b in PB:b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
    sc.frame_set(int(fr),subframe=fr-int(fr));bpy.context.view_layer.update()
    P={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in PB}
    cur=meta[c].get('morph',{}).get('curves',{});Wm={k_:interp(v,f/30) for k_,v in cur.items()}
    CACHE[k]=(P,Wm);return P,Wm
MASK=tuple(x.rstrip('*') for x in META['wind']['mask'])
def add_wind(P,fw):
    Pw,_=pose('wind_flutter_loop',fw);P0,_=pose('wind_flutter_loop',0);Rr={}
    for k,(l,q,s) in P.items():
        if k.startswith(MASK):dq=P0[k][1].inverted()@Pw[k][1];Rr[k]=(l+(Pw[k][0]-P0[k][0]),q@dq,s)
        else:Rr[k]=(l,q,s)
    return Rr
def blend(Po,Pi,fo):
    Rr={}
    for k in Pi:
        qo,qi=Po[k][1],Pi[k][1]
        if qo.dot(qi)<0:qo=-qo
        Rr[k]=(Pi[k][0].lerp(Po[k][0],fo),qi.slerp(qo,fo),Pi[k][2].lerp(Po[k][2],fo))
    return Rr
def apply(P,Wm):
    arm.animation_data.action=None
    for b in PB:b.location,b.rotation_quaternion,b.scale=P[b.name]
    for o in M.values():
        sk=o.data.shape_keys
        if sk:
            for kb_ in sk.key_blocks[1:]:kb_.value=HOLD_ON if kb_.name=='lantern_hold_R' else min(1,max(0,Wm.get(kb_.name,0.0)))
    bpy.context.view_layer.update()
# 钟摆：摆锤水平位移 u，u''=-w²u-2ζw u'-a_pivot,h；角度上限 AMAX
PEN=json.loads(os.environ.get('PEN','{"L":0.098,"zeta":0.8,"amax_deg":8,"acc_lp":0.35}'))
class Pend:
    def __init__(s):s.u=np.zeros(2);s.v=np.zeros(2);s.p=None;s.pv=None
    def step(s,p):
        p=np.array(p[:2]);L=PEN['L'];w=math.sqrt(9.81/L);z=PEN['zeta']
        if s.p is None:s.p=p;return s.u
        if s.pv is None:s.pv=(p-s.p)*30;s.p=p;return s.u   # 第 2 帧只取初速度，不产生虚假冲击
        vel=(p-s.p)*30;a0=(vel-s.pv)*30;s.p=p;s.pv=vel;dt=1/30/10
        s.a=a0 if not hasattr(s,'a') else s.a+(a0-s.a)*PEN['acc_lp'];a=s.a   # 支点加速度一阶低通
        for _ in range(10):
            acc_=-w*w*s.u-2*z*w*s.v-a;s.v=s.v+acc_*dt;s.u=s.u+s.v*dt
        # 软限幅：显示角 = amax·tanh(θ/amax)（不硬撞上限）
        n=np.linalg.norm(s.u);th=math.asin(min(1,n/L));am=math.radians(PEN['amax_deg'])
        if n<1e-12:return s.u
        ths=am*math.tanh(th/am);return s.u*(L*math.sin(ths)/n)
def place(pen):
    Jw,p=socket_world(arm)
    H=arm.matrix_world@PB['hips'].matrix;fw=H.to_3x3()@Vector((0,0,1));fw.z=0
    yaw=math.atan2(fw.x,-fw.y) if fw.length>1e-6 else 0.0
    u=pen.step(p) if pen else np.zeros(2);L=PEN['L']
    if os.environ.get('PFORCE'):   # 压力测试：灯每帧都以 amax 朝身体（髋中心）方向倾
        hc=(arm.matrix_world@PB['hips'].head);dv_=np.array([hc.x-p.x,hc.y-p.y]);dv_/=np.linalg.norm(dv_)+1e-9;u=dv_*L*math.sin(math.radians(PEN['amax_deg']))
    dv=Vector((u[0],u[1],-math.sqrt(max(1e-9,L*L-u@u))))
    Rp=Vector((0,0,-1)).rotation_difference(dv).to_matrix().to_4x4()
    LROOT.matrix_world=Matrix.Translation(p)@Rp@Matrix.Rotation(yaw,4,'Z');bpy.context.view_layer.update()
    return math.degrees(math.asin(min(1,np.linalg.norm(u)/L)))
Bind={b.name:b for b in arm.data.bones}
def twist_deg(pb):
    q=pb.rotation_quaternion;tw=Quaternion((q.w,0,q.y,0));tw.normalize();return round(math.degrees(2*math.acos(min(1,abs(tw.w)))),2)
def angles():
    C=(arm.matrix_world@PB['chest'].matrix).to_3x3();U=arm.matrix_world@PB['upper_arm.L'].matrix;F=arm.matrix_world@PB['forearm.L'].matrix
    du=C.inverted()@(U.to_3x3()@Vector((0,1,0)));abd=math.degrees(math.atan2(-du.x,-du.y))   # chest 局部(骨 Y 向上)：外展=向她右(-X)；绑定姿态 ≈10°
    df=F.to_3x3()@Vector((0,1,0));pitch=math.degrees(math.asin(max(-1,min(1,df.z))))
    du2=U.to_3x3()@Vector((0,1,0));elbow=math.degrees(du2.angle(df))
    Hh=arm.matrix_world@PB['hips'].matrix;hl=Hh.inverted()@(arm.matrix_world@PB['hand.L'].head)
    return dict(abd=round(abd,2),fore_pitch=round(pitch,2),elbow_flex=round(elbow,1),fore_twist=twist_deg(PB['forearm.L']),wrist_twist=twist_deg(PB['hand.L']),
                hand_hips=[round(x,3) for x in hl])
def measure():
    bv,bt=wm(Bo);T={k:BVHTree.FromPolygons(bv,[x for x,pi in bt if PC[pi]==k]) for k in ('TORSO','LEG','ARMR','HANDR','ARML')}
    X={}
    for n in ('APRON','DRESS','BOW'):
        v,t=wm(M[n]);X[n]=BVHTree.FromPolygons(v,[x for x,_ in t])
    Lv=[];Lt=[]
    for o in LM:
        v,t=wm(o);b=len(Lv);Lv+=v;Lt+=[tuple(i+b for i in x) for x,_ in t]
    L=BVHTree.FromPolygons(Lv,Lt);r={}
    for k in ('LEG','TORSO','ARML'):r['L_'+k]=len(L.overlap(T[k]))
    for k in ('DRESS','APRON','BOW'):r['L_'+k]=len(L.overlap(X[k]))
    r['L_ARMR']=len(L.overlap(T['ARMR']));r['L_HANDR_grip']=len(L.overlap(T['HANDR']))
    for a in ('ARMR','HANDR'):
        for k in ('TORSO','LEG'):r[a+'_'+k]=len(T[a].overlap(T[k]))
        for k in ('DRESS','APRON','BOW'):r[a+'_'+k]=len(T[a].overlap(X[k]))
    # 灯与裙/围裙最小间隙（灯顶点到裙网格最近距离，mm）
    gap=1e9
    for k in ('DRESS','APRON'):
        for v in Lv[::3]:
            h=X[k].find_nearest(v)
            if h[0] is not None:gap=min(gap,h[3])
    r['L_cloth_gap_mm']=round(gap*1000,1)
    return r
REND=os.environ.get('RENDER')
if REND:
    os.makedirs(REND,exist_ok=True);sc.render.engine='BLENDER_WORKBENCH';sh=sc.display.shading;sh.show_cavity=True;sh.color_type='OBJECT'
    for o in bpy.data.objects:
        if o.type=='MESH':o.color=(0.8,0.78,0.72,1)
    M['DRESS'].color=(0.55,0.65,0.85,1);M['APRON'].color=(0.95,0.95,0.92,1)
    for o in LM:o.color=(0.95,0.6,0.15,1)
    cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.angle=math.radians(30);cd.clip_start=0.01
    sc.render.resolution_x=360;sc.render.resolution_y=480
def render(tag):
    H=(arm.matrix_world@PB['hips'].head).copy();Hm=(arm.matrix_world@PB['hips'].matrix).to_3x3()
    fw=Hm@Vector((0,0,1));fw.z=0;fw.normalize() if fw.length>1e-6 else None
    yaw=math.atan2(fw.x,-fw.y)
    S=(arm.matrix_world@PB['hand.L'].tail)
    for v,ang,dist,tz in (('front',0.0,3.6,0.8),('side',-math.pi/2,3.6,0.8),('close',-math.pi/3,1.0,None)):   # side = 她的右侧（提灯侧）
        loc=Matrix.Rotation(yaw+ang,3,'Z')@Vector((0,-dist,0.1));tgt=Vector((H.x,H.y,tz)) if tz else S.copy()
        cam.location=tgt+loc;cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=f'{REND}/{v}/{tag}.png';bpy.ops.render.render(write_still=True)
exec(open('/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/src/lantern_hinge.py').read());exec(open('/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/qa_v3b/src/depth.py').read());exec(open('/workspace/yiqifengle/previews/角色动画bot/walk_verify/src/pen_depth.py').read())
rows=[]
def run(tag,c,f,P,Wm,pen,**kw):
    apply(P,Wm);ang=place(pen);r=dict(run=tag,clip=c,f=f,pend_deg=round(ang,2),sock=[round(x,4) for x in socket_world(arm)[1]],**kw);r.update(angles());r.update(LAST);r.update(measure());extra(r);rows.append(r)
    if REND and tag=='W0':render(f'{c}_{f:03d}')
CL=os.environ.get('CLIPS','walk_loop').split(',')
WINDY=('walk','idle')
for c in CL:
    Nn=N_(c);loop=meta[c].get('loop',False)
    # 钟摆预热：循环 clip 先跑 3 圈
    pen=Pend()
    if loop:
        for f in range(3*Nn):apply(*pose(c,f));place(pen)
    for f in range(Nn+1):
        P,Wm=pose(c,f);run('W0',c,f,P,Wm,pen)
    if os.environ.get('WIND') and c.startswith(WINDY):
        for ph in (0,30):
            pen=Pend()
            if loop:
                for f in range(3*Nn):apply(add_wind(pose(c,f)[0],f+ph),pose(c,f)[1]);place(pen)
            for f in range(Nn+1):P,Wm=pose(c,f);run('Wmax_ph%d'%ph,c,f,add_wind(P,f+ph),Wm,pen)
    print('done',c,flush=True)
XFL=[x.split('>') for x in os.environ.get('XF','').split(',') if x]
for a,b in XFL:
    Na=N_(a);fa=0 if meta[a].get('loop') else Na;pen=Pend()
    for f in range(max(0,fa-20),fa):apply(*pose(a,f));place(pen)   # 出 clip 末段预热
    for k in range(7):
        fo=max(0,1-k/6);Po,Wo=pose(a,fa+k);Pi,Wi=pose(b,k);P=blend(Po,Pi,fo);Wm={x:Wi.get(x,0)*(1-fo)+Wo.get(x,0)*fo for x in set(Wo)|set(Wi)}
        run('XF',a+'>'+b,k,P,Wm,pen,fo=round(fo,3))
        if os.environ.get('WIND'):run('XF_Wmax',a+'>'+b,k,add_wind(P,k),Wm,pen,fo=round(fo,3))
    print('xf',a,b,flush=True)
json.dump(rows,open(OUT,'w'))
