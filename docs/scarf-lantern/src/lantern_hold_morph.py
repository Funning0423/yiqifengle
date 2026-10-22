# lantern_hold 手型（她的右手 = hand.L）：骨架已满 30 关节、无手指骨 → 只能做 BODY 形变层（morph target），只动手指顶点。
# 方法：hand.L 局部(glTF)里按手指长轴 d / 掌心法线 n / 手宽 w 建系，MCP/PIP/DIP 三段折叠绕 w 轴卷向掌心，包住 socket.lantern 处 φ12 mm 握把；拇指单独压在食指外侧。
# 输出：delta（glTF BODY 各 primitive 顶点序，bind 空间 POSITION 位移）+ Blender 预览渲染 + 握把间隙/自穿检查
# blender -b --python lantern_hold_morph.py -- char.glb outdir
import bpy,sys,os,json,math,numpy as np
sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
GLB,OUT=sys.argv[-2:];os.makedirs(OUT,exist_ok=True)
J,Bn=load(GLB);m=[x for x in J['meshes'] if x['name']=='LOD0_G2_BODY'][0];sk=J['skins'][0]
IB=acc(J,Bn,sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);HJ=[J['nodes'][i]['name'] for i in sk['joints']].index('hand.L')
S=np.array([0.010,0.080,0.006]);RH=0.006
CURL=json.loads(os.environ.get('CURL','[62,92,55]'));SEG=json.loads(os.environ.get('SEG','[0.0,0.024,0.042]'))
def frame(L):
    F=L[L[:,1]>0.095];c=F.mean(0);_,sv,vt=np.linalg.svd(F-c);d=vt[0]*np.sign(vt[0][1]);n=vt[2]*np.sign(vt[2][0]);w=np.cross(n,d);return d,n,w
out={};info={}
for pi,p in enumerate(m['primitives']):
    P=acc(J,Bn,p['attributes']['POSITION']);Jn=acc(J,Bn,p['attributes']['JOINTS_0']).astype(int);W=acc(J,Bn,p['attributes']['WEIGHTS_0'])
    wh=(W*(Jn==HJ)).sum(1);sel=wh>0.5
    if not sel.any():continue
    L=(IB[HJ]@np.c_[P,np.ones(len(P))].T).T[:,:3]
    if pi==0:d,n,w=frame(L[sel])
    K=S-n*0.010                                         # 指根掌面（握把中心往掌心内 1 cm）
    s=(L-K)@d;lat=(L-K)@w
    lw=lat[sel&(s>0)];thumb_cut=np.percentile(lw,97) if pi==0 and 'TCUT' not in os.environ else float(os.environ.get('TCUT',info.get('tcut',0.02)))
    if pi==0:info['tcut']=float(thumb_cut)
    fing=sel&(s>-0.004)
    Q=L.copy()
    for k in range(2,-1,-1):                             # 远端先折，再整体绕近端关节折（层级 FK）
        piv=K+d*SEG[k];msk=fing&(((L-K)@d)>SEG[k]-0.004)
        a=math.radians(CURL[k])
        # 关节附近 4 mm 平滑过渡，避免折痕
        t=np.clip(((L-K)@d-(SEG[k]-0.004))/0.008,0,1);t=t*t*(3-2*t)
        for i in np.where(msk)[0]:
            ang=a*t[i];R=np.array(Matrix.Rotation(ang,3,Vector(-w)))   # 绕 -w 转：d 往 n(掌心) 方向卷
            Q[i]=piv+R@(Q[i]-piv)
    wgt=np.clip(wh,0,1)[:,None];Q=L+(Q-L)*wgt               # 腕部过渡按 hand.L 权重淡出
    Mb=np.linalg.inv(IB[HJ]);dl=(Mb[:3,:3]@(Q-L).T).T      # 回到 bind 空间
    out[pi]=dl
    info['p%d'%pi]=dict(moved=int((np.abs(dl).max(1)>1e-6).sum()),max_mm=round(float(np.abs(dl).max()*1000),1))
    if pi==0:
        # 握把间隙：手指顶点到握把轴（过 S、沿 w）的距离
        rel=Q[fing]-S;rad=np.linalg.norm(rel-np.outer(rel@w,w),axis=1);inl=np.abs(rel@w)<0.05
        info['handle_min_clear_mm']=round(float((rad[inl]-RH).min()*1000),2)
        sf=s[fing];r0=rel=L[fing]-S;rad0=np.linalg.norm(r0-np.outer(r0@w,w),axis=1)
        info['handle_min_clear_rest_mm']=round(float((rad0[inl]-RH).min()*1000),2)   # 不加形变时（socket 位置本身）
        info['handle_min_clear_curled_mm']=round(float((rad[inl&(sf>0.012)]-RH).min()*1000),2)
        info['frame']=dict(d=d.round(3).tolist(),n=n.round(3).tolist(),w=w.round(3).tolist(),K=K.round(4).tolist())
np.savez(OUT+'/lantern_hold_R_delta.npz',**{'prim%d'%k:v.astype(np.float32) for k,v in out.items()})
# ---------- Blender 预览：把 delta 做成 shape key（按顶点位置匹配 glTF 顶点） ----------
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=GLB);sc=bpy.context.scene
Bo=[o for o in bpy.data.objects if o.name=='LOD0_G2_BODY' or (o.type=='MESH' and o.name.endswith('G2_BODY'))][0]
from mathutils.kdtree import KDTree
allP=[];allD=[]
for pi,p in enumerate(m['primitives']):
    P=acc(J,Bn,p['attributes']['POSITION']);D=out.get(pi,np.zeros_like(P));allP.append(P);allD.append(D)
allP=np.concatenate(allP);allD=np.concatenate(allD)
kd=KDTree(len(allP))
for i,x in enumerate(allP):kd.insert(Vector((x[0],-x[2],x[1])),i)
kd.balance()
if not Bo.data.shape_keys:Bo.shape_key_add(name='Basis')
kb=Bo.shape_key_add(name='lantern_hold_R');nm=0
for v in Bo.data.vertices:
    co,i,dist=kd.find(v.co)
    if dist<1e-5:
        dd=allD[i];kb.data[v.index].co=v.co+Vector((dd[0],-dd[2],dd[1]));nm+=1
kb.value=1.0;info['blender_verts_matched']=nm;info['blender_verts']=len(Bo.data.vertices)
# 自穿：手指(形变后)与手掌/前臂三角对
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();oe=Bo.evaluated_get(dg);me=oe.to_mesh();me.calc_loop_triangles()
gi={g.index:g.name for g in Bo.vertex_groups};dom=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in Bo.data.vertices]
mov=set(i for i,v in enumerate(Bo.data.vertices) if (kb.data[i].co-v.co).length>1e-5)
H=[tuple(t.vertices) for t in me.loop_triangles if all(dom[x] in('hand.L',) for x in t.vertices)]
Fi=[t for t in H if any(x in mov for x in t)];Pa=[t for t in H if not any(x in mov for x in t)]
V=[v.co.copy() for v in me.vertices];oe.to_mesh_clear()
bf=BVHTree.FromPolygons(V,Fi);bp=BVHTree.FromPolygons(V,Pa);info['finger_x_palm_pairs']=len(bf.overlap(bp))
json.dump(info,open(OUT+'/lantern_hold_R_info.json','w'),indent=1);print('INFO',json.dumps(info))
# ---------- 渲染：握把圆柱（φ12 mm，沿 w）+ 手部近景 4 向 ----------
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
A=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));HB=A@Matrix(np.linalg.inv(IB[HJ]).tolist())@A.inverted()
def tob(x):return HB@Vector((x[0],-x[2],x[1]))
c0=tob(S);ax=(tob(S+info and np.array(info['frame']['w'])*0.01 if False else S+np.array(info['frame']['w'])*0.01)-c0).normalized()
bpy.ops.mesh.primitive_cylinder_add(radius=RH,depth=0.07,location=c0);cy=bpy.context.object;cy.rotation_euler=ax.to_track_quat('Z','Y').to_euler();cy.color=(0.9,0.5,0.1,1)
sc.render.engine='BLENDER_WORKBENCH';sh=sc.display.shading;sh.show_cavity=True;sh.color_type='OBJECT'
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.angle=math.radians(18);cd.clip_start=0.01
sc.render.resolution_x=sc.render.resolution_y=360
nb=tob(S+np.array(info['frame']['n'])*0.01)-c0;nb.normalize();wb=ax
for vv in (0.0,1.0):
    kb.value=vv
    for i,dv in enumerate([nb,-nb,wb,-wb]):
        cam.location=c0+dv*0.45+Vector((0,0,0.02));cam.rotation_euler=(c0-cam.location).to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=OUT+'/_r%d_%d.png'%(int(vv),i);bpy.ops.render.render(write_still=True)
