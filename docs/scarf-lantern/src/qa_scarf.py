# 围巾逐帧网格穿模 QA（30 fps，t=n/30）：单 clip(W=0) / 风强最大(walk*+idle，wind_flutter_loop 加法层权重 1，两种相位) / crossfade(0.2 s，CharacterMotion 同法：出 1-k/6，逐骨 lerp/slerp，morph 同权混合)
# blender -b --python qa_scarf.py -- char.glb meta.json out.json      分类器与 角色建模bot qa_acc.py 相同
import bpy,sys,os,json,math,numpy as np
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
glb,metap,out=sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=glb)
META=json.load(open(metap));meta=META['clips'];O={o.name:o for o in bpy.data.objects}
arm=[o for o in O.values() if o.type=='ARMATURE'][0];M={k[8:]:o for k,o in O.items() if k.startswith('LOD0_G2_') and o.type=='MESH'}
if arm.animation_data is None: arm.animation_data_create()
for t in arm.animation_data.nla_tracks: t.mute=True
PB=arm.pose.bones
B=M['BODY'];gi={g.index:g.name for g in B.vertex_groups}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in B.data.vertices]
mn=[m.name if m else '' for m in B.data.materials];BV=B.data.vertices
def cls(p):
    mat=mn[p.material_index];ds=[D[v] for v in p.vertices];d=max(set(ds),key=ds.count);c=sum((BV[v].co for v in p.vertices),Vector())/len(p.vertices)
    if 'HAIR' in mat: return 'HAIR'
    if 'HEAD' in mat: return 'HAT'
    if d=='head': return 'CHIN' if (c.z<1.50 and -c.y>0.0) else 'FACE'
    if d.startswith(('upper_arm','forearm','hand')): return 'ARM'
    if d.startswith(('thigh','shin','foot')): return 'LEG'
    return 'TORSO'
PC=[cls(p) for p in B.data.polygons]
def wm(o):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    vs=[Mw@v.co for v in me.vertices];me.calc_loop_triangles();t=[(tuple(x.vertices),x.polygon_index) for x in me.loop_triangles];oe.to_mesh_clear();return vs,t
def interp(tab,t): return float(np.interp(t,[a for a,_ in tab],[b for _,b in tab]))
def setclip(c):
    act=[a for a in bpy.data.actions if a.name==c or a.name.startswith(c+'_')];act=sorted(act,key=lambda a:len(a.name))[0];arm.animation_data.action=act
    try: arm.animation_data.action_slot=act.slots[0]
    except Exception: pass
    return act
def N_(c): return max(1,int(round(meta[c]['duration_s']*30)))
CACHE={}
def pose(c,f):   # 第 f 帧（t=f/30），循环 clip 取模，非循环钳到末帧
    N=N_(c);loop=meta[c].get('loop',False) or c=='wind_flutter_loop'
    f=f%N if loop else min(f,N)
    k=(c,f)
    if k in CACHE: return CACHE[k]
    act=setclip(c);f0,f1=act.frame_range;fr=f0+(f1-f0)*f/N
    for b in PB: b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
    sc.frame_set(int(fr),subframe=fr-int(fr));bpy.context.view_layer.update()
    P={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in PB}
    cur=meta[c].get('morph',{}).get('curves',{});W={k_:interp(v,f/30) for k_,v in cur.items()}
    CACHE[k]=(P,W);return P,W
MASK=tuple(m.rstrip('*') for m in META['wind']['mask'])
def add_wind(P,fw):
    Pw,_=pose('wind_flutter_loop',fw);P0,_=pose('wind_flutter_loop',0);R={}
    for k,(l,q,s) in P.items():
        if k.startswith(MASK):
            dq=P0[k][1].inverted()@Pw[k][1];R[k]=(l+(Pw[k][0]-P0[k][0]),q@dq,s)
        else:R[k]=(l,q,s)
    return R
def blend(Po,Pi,fo):
    R={}
    for k in Pi:
        qo,qi=Po[k][1],Pi[k][1]
        if qo.dot(qi)<0:qo=-qo
        R[k]=(Pi[k][0].lerp(Po[k][0],fo),qi.slerp(qo,fo),Pi[k][2].lerp(Po[k][2],fo))
    return R
def apply(P,W):
    arm.animation_data.action=None
    for b in PB:b.location,b.rotation_quaternion,b.scale=P[b.name]
    for o in M.values():
        sk=o.data.shape_keys
        if sk:
            for kb in sk.key_blocks[1:]:kb.value=min(1,max(0,W.get(kb.name,0.0)))
    bpy.context.view_layer.update()
def measure():
    bv,bt=wm(B);T={k:BVHTree.FromPolygons(bv,[x for x,pi in bt if PC[pi]==k]) for k in ('FACE','CHIN','HAIR','HAT','ARM','TORSO','LEG')}
    X={}
    for n in ('APRON','DRESS','BOW','SCARF'):
        v,t=wm(M[n]);X[n]=BVHTree.FromPolygons(v,[x for x,_ in t])
    S=X['SCARF'];r={('S_'+k):len(S.overlap(T[k])) for k in ('FACE','CHIN','HAIR','HAT','ARM','TORSO','LEG')}
    r['S_RIBBON']=len(S.overlap(X['BOW']));r['S_APRON']=len(S.overlap(X['APRON']));r['S_DRESS']=len(S.overlap(X['DRESS']))
    q=PB['scarf.tail'].rotation_quaternion;r['scarf_deg']=round(math.degrees(2*math.acos(min(1,abs(q.w)))),1)
    return r
CL=[c for c in meta if c!='wind_flutter_loop' and c!='apron_lift' and c in [a.name.split('_Armature')[0] for a in bpy.data.actions] or c in ('walk_start_stepdown',)]
CL=[c for c in meta if c not in ('wind_flutter_loop','apron_lift')]
WINDY=[c for c in CL if c.startswith('walk') or c=='idle_breathing_loop']
XF=[('idle_breathing_loop','walk_start'),('walk_start','walk_loop'),('walk_loop','walk_stop_bodyL'),('walk_loop','walk_stop_bodyR'),('walk_stop_bodyL','idle_breathing_loop'),('walk_stop_bodyR','idle_breathing_loop'),
    ('walk_loop','walk_turn_90_bodyL'),('walk_loop','walk_turn_90_bodyR'),('walk_loop','walk_turn_180'),('walk_loop','walk_turn_180_bodyR'),('walk_turn_90_bodyL','walk_loop'),('walk_turn_90_bodyR','walk_loop'),('walk_turn_180','walk_loop'),('walk_turn_180_bodyR','walk_loop'),
    ('idle_breathing_loop','sit_down'),('sit_down','sit_hold'),('sit_hold','stand_up'),('stand_up','idle_breathing_loop'),('idle_breathing_loop','door_reach'),('door_reach','walk_start_stepdown'),('walk_start_stepdown','walk_loop'),('door_reach','idle_breathing_loop')]
rows=[]
def run(tag,c,f,P,W,**kw):
    apply(P,W);r=dict(run=tag,clip=c,f=f,**kw);r.update(measure());rows.append(r)
ONLY=os.environ.get('ONLY')
for c in CL:
    if ONLY and c not in ONLY.split(','):continue
    for f in range(N_(c)+1):
        P,W=pose(c,f)
        if not os.environ.get('WONLY'):run('W0',c,f,P,W)
        if c in WINDY:
            for ph in json.loads(os.environ.get('PHASES','[0,30]')):   # 风层 2 s 前扬周期 / 1 s 左右周期：0 与 30 帧(半个前扬周期)两种相位
                run('Wmax_ph%d'%ph,c,f,add_wind(P,f+ph),W)
    print('done',c,flush=True)
if not ONLY and not os.environ.get('WONLY'):
  for a,b in XF:
    Na=N_(a);fa=0 if a=='walk_loop' else Na   # walk_loop 出：从相位 0 切；非循环出：在末帧（钳住）
    for k in range(7):
        fo=max(0,1-k/6);Po,Wo=pose(a,fa+k);Pi,Wi=pose(b,k);P=blend(Po,Pi,fo);W={x:Wi.get(x,0)*(1-fo)+Wo.get(x,0)*fo for x in set(Wo)|set(Wi)}
        run('XF',a+'>'+b,k,P,W,fo=round(fo,3))
        if a in WINDY and b in WINDY: run('XF_Wmax',a+'>'+b,k,add_wind(P,k),W,fo=round(fo,3))
    print('xf',a,b,flush=True)
json.dump(rows,open(out,'w'))
