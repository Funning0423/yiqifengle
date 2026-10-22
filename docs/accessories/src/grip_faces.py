# 握把面级检查（静态：握把刚性跟手）。手部三角密采样，算到握把轴的径向距离；同时量手掌沿握把轴的宽度。
# blender -b --python grip_faces.py -- char.glb out.json   环境：LANTERN、SOCK、LMODE=hinge、HOLD=1、DELTA_K=可选 npz(K,bas) 覆盖形态键
import bpy,sys,os,json,math,numpy as np
from mathutils import Vector
glb,out=sys.argv[-2:];os.environ['CHARGLB']=glb;os.environ.setdefault('LMODE','hinge');os.environ.setdefault('SOCK','[0.0138,0.0803,0.0073]')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=glb)
O={o.name:o for o in bpy.data.objects};arm=[o for o in O.values() if o.type=='ARMATURE'][0];B=O['LOD0_G2_BODY']
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
for t in arm.animation_data.nla_tracks: t.mute=True
CLIP='idle_breathing_loop_lantern';a=sorted([x for x in bpy.data.actions if x.name.startswith(CLIP)],key=lambda a:len(a.name))[0]
arm.animation_data.action=a
try: arm.animation_data.action_slot=a.slots[0]
except Exception: pass
bpy.context.scene.frame_set(int(a.frame_range[0]))
kb=B.data.shape_keys.key_blocks
if os.environ.get('DELTA_K'):
    K=np.load(os.environ['DELTA_K'])['K'];kb['lantern_hold_R'].data.foreach_set('co',K.ravel())
for x in kb[1:]: x.value=float(os.environ.get('HOLD','1')) if x.name=='lantern_hold_R' else 0
attach_lantern(arm,os.environ.get('LANTERN','prop_lantern_v2.glb'));place_lantern(arm);bpy.context.view_layer.update()
Jw,sp=socket_world(arm);R3=LROOT.matrix_world.to_3x3();ax=(R3@Vector((0,1,0))).normalized()
dg=bpy.context.evaluated_depsgraph_get();oe=B.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world
P=np.array([list(Mw@v.co) for v in me.vertices]);me.calc_loop_triangles();T=np.array([tuple(t.vertices) for t in me.loop_triangles]);TP=np.array([t.polygon_index for t in me.loop_triangles]);oe.to_mesh_clear()
# 局部柱坐标：u 沿轴，(x,y) 横截面；x = 灯“下”方向
dn=np.array(R3@Vector((0,0,-1)));A=np.array(ax);Bx=dn-A*(dn@A);Bx/=np.linalg.norm(Bx);By=np.cross(A,Bx);S=np.array(sp)
def cyl(X): Q=X-S;u=Q@A;x=Q@Bx;y=Q@By;return u,np.hypot(x,y),np.degrees(np.arctan2(y,x))
u,r,ph=cyl(P)
# 采样
bw=[(i/7,j/7) for i in range(8) for j in range(8-i)]
W=np.array([[1-a-b,a,b] for a,b in bw])
near=np.where((np.min(r[T],1)<0.03)&(np.abs(u[T]).min(1)<0.03))[0]
GL=float(os.environ.get('GRIPL','0.036'))/2;R=0.006;bad=[]
for ti in near:
    X=W@P[T[ti]];uu,rr,_=cyl(X);m=(np.abs(uu)<GL)
    if m.any() and rr[m].min()<R: bad.append(dict(t=int(ti),poly=int(TP[ti]),depth_mm=round((R-rr[m].min())*1000,2),v=[int(x) for x in T[ti]],r_mm=[round(r[x]*1000,1) for x in T[ti]],phi=[round(ph[x]) for x in T[ti]],u_mm=[round(u[x]*1000,1) for x in T[ti]]))
gi={g.index:g.name for g in B.vertex_groups};HD=np.array([bool(v.groups) and gi[max(v.groups,key=lambda g:g.weight).group]=='hand.L' for v in B.data.vertices])
hand=HD&(r<0.030)
from mathutils.bvhtree import BVHTree
HT=[tuple(t) for t in T if HD[t].any()];HB=BVHTree.FromPolygons(P.tolist(),HT)
lv=[];lt=[];lp=[]
for o in [x for x in bpy.data.objects if x.type=='MESH' and x.name.startswith('lantern.body')]:
    oe=o.evaluated_get(dg);m2=oe.to_mesh();Mi=LROOT.matrix_world.inverted();b0=len(lv)
    lv+=[list(oe.matrix_world@v.co) for v in m2.vertices];loc=[Mi@(oe.matrix_world@v.co) for v in m2.vertices];m2.calc_loop_triangles()
    for t in m2.loop_triangles:
        q=[loc[i] for i in t.vertices];lt.append(tuple(b0+i for i in t.vertices))
        zs=[p.z for p in q]   # Blender 局部 z = prop +Y（上）
        lp.append('grip' if min(zs)>-0.0061 and max(abs(p.x) for p in q)<0.0075 else ('bail' if min(zs)>-0.0351 else 'body'))
    oe.to_mesh_clear()
lv=np.array(lv);ov={}
for part in ('grip','bail','body'):
    ts=[t for t,p in zip(lt,lp) if p==part];ov[part]=len(HB.overlap(BVHTree.FromPolygons(lv.tolist(),ts))) if ts else 0
res=dict(hand_x_lantern_tri_pairs=ov,bad_tris=len(bad),max_depth_mm=max([b['depth_mm'] for b in bad],default=0),bad=bad,
  palm_u_mm=[round(float(np.percentile(u[hand]*1000,q)),1) for q in (0,1,99,100)],
  hand_u_in_r20=[round(float(u[HD&(r<0.02)].min()*1000),1),round(float(u[HD&(r<0.02)].max()*1000),1)],hand_u_all=[round(float(u[HD].min()*1000),1),round(float(u[HD].max()*1000),1)],sock=list(S),axis=list(A),down=list(Bx))
np.savez(out+'.npz',P=P,T=T,u=u,r=r,ph=ph,HD=HD);json.dump(res,open(out,'w'),indent=1);print('GF',json.dumps({k:v for k,v in res.items() if k!='bad'}))
