# v3b：握把刚性跟手后是静态问题。在静止姿态下把 lantern_hold_R 里穿进握把的顶点沿径向推到 R+GAP，推动量在手部网格上做拉普拉斯平滑（只影响指根和近节，包紧程度不变），迭代收敛
# blender -b --python fix_hold.py -- char.glb out.npz
import bpy,sys,os,json,numpy as np
from mathutils import Vector
glb,out=sys.argv[-2:];os.environ['CHARGLB']=glb;os.environ['LMODE']='hinge'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=glb)
O={o.name:o for o in bpy.data.objects};arm=[o for o in O.values() if o.type=='ARMATURE'][0];B=O['LOD0_G2_BODY']
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
for t in arm.animation_data.nla_tracks: t.mute=True
arm.animation_data.action=None;arm.data.pose_position='REST';bpy.context.view_layer.update()
attach_lantern(arm,os.environ.get('LANTERN','prop_lantern_v2.glb'));place_lantern(arm);bpy.context.view_layer.update()
Jw,sp=socket_world(arm);ax=(LROOT.matrix_world.to_3x3()@Vector((0,1,0))).normalized()
Bi=B.matrix_world.inverted();e0=np.array(Bi@(sp-ax*0.018));e1=np.array(Bi@(sp+ax*0.018))
gi={g.index:g.name for g in B.vertex_groups};V=B.data.vertices
HV=np.array([v.index for v in V if v.groups and gi[max(v.groups,key=lambda g:g.weight).group]=='hand.L'])
kb=B.data.shape_keys.key_blocks;bas=np.array([list(kb[0].data[i].co) for i in range(len(V))]);K0=np.array([list(kb['lantern_hold_R'].data[i].co) for i in range(len(V))])
R=0.006;GAP=float(os.environ.get('GAP','0.0005'));a=e1-e0
def dist(P):
    u=((P-e0)@a)/(a@a);uc=np.clip(u,0,1);q=e0+np.outer(uc,a);d=np.linalg.norm(P-q,axis=1);return d,u,q
# 手部邻接
hs=set(HV.tolist());nb={i:set() for i in HV}
for e in B.data.edges:
    x,y=e.vertices
    if x in hs and y in hs: nb[x].add(y);nb[y].add(x)
d0,_,_=dist(bas[HV]);region=HV[d0<0.035]   # 只在握把 35 mm 内调整（指根、近节、掌心一侧）
K=K0.copy();rep={};hix={i:k for k,i in enumerate(HV)};C=set()
for it in range(80):
    P=K[HV];d,u,q=dist(P);bad=(d<R+GAP-1e-6)&(u>0)&(u<1);rep[it]=int(bad.sum())
    for k in np.where(bad)[0]:
        n=(P[k]-q[k]);n/=np.linalg.norm(n)+1e-12;K[HV[k]]=q[k]+n*(R+GAP);C.add(int(HV[k]))
    if not bad.any() and it>3: break
    Dl=K-K0   # 约束点（接触点）固定，其余修正量平滑扩散
    for _ in range(3):
        D2=Dl.copy()
        for i in region:
            if i not in C and nb[i]: D2[i]=0.5*Dl[i]+0.5*np.mean([Dl[j] for j in nb[i]],axis=0)
        Dl=D2
    K=K0+Dl
d,u,q=dist(K[HV]);inside=(d<R)&(u>0)&(u<1);on=(u>0)&(u<1)
corr=np.linalg.norm(K-K0,axis=1)
print('FIX',json.dumps(dict(iters=it,remaining_lt_R=int(inside.sum()),min_gap_mm=round(float((d[on]-R).min()*1000),3),max_corr_mm=round(float(corr.max()*1000),2),n_corr=int((corr>1e-5).sum()),hist=rep,contacts=len(C))))
np.savez(out,idx=np.arange(len(V)),bas=bas,K0=K0,K=K,e0=e0,e1=e1,HV=HV)
