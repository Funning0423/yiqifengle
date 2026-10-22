# v3b 第 2 轮：在实际 QA 姿态（idle_breathing_loop_lantern f0，握把相对手静止）里修正。
# 顶点集合与 qa_full 一致（HANDR 类多边形的全部顶点），蒙皮雅可比 J_v = Σw·(pose@rest⁻¹) 把世界修正量换回静止空间。
# blender -b --python fix_hold2.py -- char.glb out.npz
import bpy,sys,os,json,numpy as np
from mathutils import Vector,Matrix
glb,out=sys.argv[-2:];os.environ['CHARGLB']=glb;os.environ['LMODE']='hinge'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=glb)
O={o.name:o for o in bpy.data.objects};arm=[o for o in O.values() if o.type=='ARMATURE'][0];B=O['LOD0_G2_BODY']
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
for t in arm.animation_data.nla_tracks: t.mute=True
CLIP=os.environ.get('FCLIP','idle_breathing_loop_lantern');a=[x for x in bpy.data.actions if x.name==CLIP or x.name.startswith(CLIP+'_')];a=sorted(a,key=lambda a:len(a.name))[0]
arm.animation_data.action=a
try: arm.animation_data.action_slot=a.slots[0]
except Exception: pass
bpy.context.scene.frame_set(int(a.frame_range[0]))
attach_lantern(arm,os.environ.get('LANTERN','prop_lantern_v2.glb'));place_lantern(arm);bpy.context.view_layer.update()
Jw,sp=socket_world(arm);ax=(LROOT.matrix_world.to_3x3()@Vector((0,1,0))).normalized();GH=float(os.environ.get('GH','0.018'));e0=np.array(sp-ax*GH);e1=np.array(sp+ax*GH);av=e1-e0
gi={g.index:g.name for g in B.vertex_groups};V=B.data.vertices;PB=arm.pose.bones
S={n:np.array((arm.matrix_world@PB[n].matrix@arm.data.bones[n].matrix_local.inverted()@arm.matrix_world.inverted()@B.matrix_world).to_3x3()) for n in set(gi.values()) if n in PB}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in V]
mn=[m.name if m else '' for m in B.data.materials]
def cls(p):
    ds=[D[v] for v in p.vertices];d=max(set(ds),key=ds.count);return 'HAIR' not in mn[p.material_index] and 'HEAD' not in mn[p.material_index] and d=='hand.L'
HV=np.array(sorted({i for p in B.data.polygons if cls(p) for i in p.vertices}))
J=np.zeros((len(HV),3,3))
for k,i in enumerate(HV):
    ws=[(gi[g.group],g.weight) for g in V[i].groups if gi[g.group] in S];tw=sum(w for _,w in ws)
    J[k]=sum(w*S[n] for n,w in ws)/tw
kb=B.data.shape_keys.key_blocks;nV=len(V);bas=np.array([list(kb[0].data[i].co) for i in range(nV)]);K0=np.array([list(kb['lantern_hold_R'].data[i].co) for i in range(nV)])
if os.environ.get('START'): K0s=np.load(os.environ['START'])['K'];
else: K0s=K0
def wm(w):
    for x in kb[1:]: x.value=w if x.name=='lantern_hold_R' else 0
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();oe=B.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world
    r=np.array([list(Mw@me.vertices[i].co) for i in HV]);oe.to_mesh_clear();return r
W0=wm(0);W1=wm(1)
# 以 v3 原手型的世界位置校准：W(K)=W0+J·(K−bas)
pred=W0+np.einsum('kij,kj->ki',J,(K0-bas)[HV]);print('CAL err mm',round(float(np.abs(pred-W1).max()*1000),3))
R=0.006;GAP=float(os.environ.get('GAP','0.0005'))
def dist(P):
    u=((P-e0)@av)/(av@av);q=e0+np.outer(np.clip(u,0,1),av);return np.linalg.norm(P-q,axis=1),u,q
hs=set(HV.tolist());hix={i:k for k,i in enumerate(HV)};nb={i:set() for i in HV}
for e in B.data.edges:
    x,y=e.vertices
    if x in hs and y in hs: nb[x].add(y);nb[y].add(x)
Ji=np.linalg.inv(J);K=K0s.copy();C=set();rep={}
d00,_,_=dist(W0+np.einsum('kij,kj->ki',J,(K-bas)[HV]));reg=set(HV[d00<0.035].tolist())
for it in range(80):
    P=W0+np.einsum('kij,kj->ki',J,(K-bas)[HV]);d,u,q=dist(P);bad=(d<R+GAP-1e-6)&(u>0)&(u<1);rep[it]=int(bad.sum())
    for k in np.where(bad)[0]:
        n=(P[k]-q[k]);n/=np.linalg.norm(n)+1e-12;tgt=q[k]+n*(R+GAP);K[HV[k]]=bas[HV[k]]+Ji[k]@(tgt-W0[k]);C.add(int(HV[k]))
    if not bad.any() and it>3: break
    Dl=K-K0
    for _ in range(3):
        D2=Dl.copy()
        for i in reg:
            if i not in C and nb[i]: D2[i]=0.5*Dl[i]+0.5*np.mean([Dl[j] for j in nb[i]],axis=0)
        Dl=D2
    K=K0+Dl
P=W0+np.einsum('kij,kj->ki',J,(K-bas)[HV]);d,u,q=dist(P);on=(u>0)&(u<1);corr=np.linalg.norm(K-K0,axis=1)
print('FIX',json.dumps(dict(iters=it,inside=int(((d<R)&on).sum()),min_gap_mm=round(float((d[on]-R).min()*1000),3),max_corr_mm=round(float(corr.max()*1000),2),n_corr=int((corr>1e-5).sum()),contacts=len(C),hist={k:v for k,v in rep.items() if k<6})))
np.savez(out,bas=bas,K0=K0,K=K,HV=HV)
