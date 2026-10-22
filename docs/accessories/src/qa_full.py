# v2 正式整套 QA：烘好围巾通道的基底 + lantern_tuck_R / lantern_hold_R + 右臂摆幅 0.65（仅 QA 模拟）+ xfade 0.2 s + 钟摆
# blender -b --python qa_full.py -- char.glb meta.json out.json
# 环境：TAG, CLIPS(逗号), XF=1(加过渡), W(风层权重 0/1，仅 scarf.tail 取 wind_flutter_loop), ARMSCALE, MORPH_FORCE, LANTERN, LMODE, LSWING, SOCK
import bpy,sys,os,json,math,numpy as np
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
glb,metap,out=sys.argv[-3:];os.environ['CHARGLB']=glb
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=glb)
meta=json.load(open(metap))['clips'];O={o.name:o for o in bpy.data.objects}
arm=[o for o in O.values() if o.type=='ARMATURE'][0];M={k[8:]:o for k,o in O.items() if k.startswith('LOD0_G2_') and o.type=='MESH'}
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
LBODY=[]
if os.environ.get('LANTERN'): LBODY=[o for o in attach_lantern(arm,os.environ['LANTERN']) if o.type=='MESH' and not o.name.startswith('lantern.core')]
for t in arm.animation_data.nla_tracks: t.mute=True
B=M['BODY'];gi={g.index:g.name for g in B.vertex_groups}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in B.data.vertices]
mn=[m.name if m else '' for m in B.data.materials];BV=B.data.vertices
def cls(p):
    mat=mn[p.material_index];ds=[D[v] for v in p.vertices];d=max(set(ds),key=ds.count);c=sum((BV[v].co for v in p.vertices),Vector())/len(p.vertices)
    if 'HAIR' in mat: return 'HAIR'
    if 'HEAD' in mat: return 'HAT'
    if d=='head': return 'CHIN' if (c.z<1.50 and -c.y>0.0) else 'FACE'
    if d=='hand.L': return 'HANDR'
    if d.startswith(('upper_arm','forearm','hand')): return 'ARM'
    if d.startswith(('thigh','shin','foot')): return 'LEG'
    return 'TORSO'
PC=[cls(p) for p in B.data.polygons]
FORCE=json.loads(os.environ.get('MORPH_FORCE','{}'));AS=float(os.environ.get('ARMSCALE','1'));WW=float(os.environ.get('W','0'))
PB=arm.pose.bones;SB=PB['scarf.tail']
def interp(tab,t): return float(np.interp(t,[a for a,_ in tab],[b for _,b in tab]))
def act_of(c): a=[x for x in bpy.data.actions if x.name==c or x.name.startswith(c+'_')];return sorted(a,key=lambda a:len(a.name))[0]
def dur(c): return meta[c]['duration_s']
def pose_at(c,t):
    a=act_of(c);arm.animation_data.action=a
    try: arm.animation_data.action_slot=a.slots[0]
    except Exception: pass
    f0,f1=a.frame_range;fr=f0+(f1-f0)*min(1,t/dur(c));sc.frame_set(int(fr),subframe=fr-int(fr))
    P={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in PB}
    cur=meta[c].get('morph',{}).get('curves',{});W={}
    for o in M.values():
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]: W[(o.name,kb.name)]=interp(cur[kb.name],t) if kb.name in cur else 0.0
    return P,W
WF=None
if WW:
    wa=act_of('wind_flutter_loop');WF=(wa,[fc for fc in wa.fcurves if 'scarf.tail' in fc.data_path and 'rotation_quaternion' in fc.data_path])
def apply(P,W,t):
    arm.animation_data.action=None
    for n,(l,q,s) in P.items(): PB[n].location=l;PB[n].rotation_quaternion=q;PB[n].scale=s
    if AS!=1:
        for n in ('upper_arm.L','forearm.L'): PB[n].rotation_quaternion=Quaternion().slerp(P[n][1],AS)
    if WF:
        wa,fcs=WF;f0,f1=wa.frame_range;fr=f0+((t%dur('wind_flutter_loop'))/dur('wind_flutter_loop'))*(f1-f0)
        q=Quaternion([0,0,0,0]);
        for fc in fcs: q[fc.array_index]=fc.evaluate(fr)
        q.normalize();PB['scarf.tail'].rotation_quaternion=P['scarf.tail'][1]@Quaternion().slerp(q,WW)
    for o in M.values():
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]: kb.value=FORCE.get(kb.name,W.get((o.name,kb.name),0.0))
    bpy.context.view_layer.update()
def blend(A,Bp,w):
    P={}
    for n in A[0]:
        la,qa,sa=A[0][n];lb,qb,sb=Bp[0][n];P[n]=(la.lerp(lb,w),qa.slerp(qb,w),sa.lerp(sb,w))
    return P,{k:A[1][k]*(1-w)+Bp[1][k]*w for k in A[1]}
def wm(o):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    vs=[Mw@v.co for v in me.vertices];me.calc_loop_triangles();t=[(tuple(x.vertices),x.polygon_index) for x in me.loop_triangles];oe.to_mesh_clear();return vs,t
def measure(r):
    bv,bt=wm(B);T={k:BVHTree.FromPolygons(bv,[x for x,pi in bt if PC[pi]==k]) for k in ('FACE','CHIN','HAIR','HAT','ARM','HANDR','TORSO','LEG')}
    BF=BVHTree.FromPolygons(bv,[x for x,_ in bt])
    X={}
    for n in ('APRON','DRESS','BOW','SCARF'):
        v,t=wm(M[n]);X[n]=BVHTree.FromPolygons(v,[x for x,_ in t])
    S=X['SCARF']
    for k in ('FACE','CHIN','HAIR','HAT','ARM','HANDR','TORSO'): r['S_'+k]=len(S.overlap(T[k]))
    r['S_APRON']=len(S.overlap(X['APRON']));r['S_RIBBON']=len(S.overlap(X['BOW']));r['S_DRESS']=len(S.overlap(X['DRESS']))
    r['C_DRESSxBODY']=len(X['DRESS'].overlap(BF));r['C_APRONxBODY']=len(X['APRON'].overlap(BF));r['C_DRESSxAPRON']=len(X['DRESS'].overlap(X['APRON']))
    r['B_HAIRxTORSO']=len(T['HAIR'].overlap(T['TORSO']))
    if LBODY:
        globals()['LT']=r['t'];place_lantern(arm);bpy.context.view_layer.update()
        Jw,sp=socket_world(arm);V=[];TG=[];TL=[]
        for o in LBODY:
            v,t=wm(o);base=len(V);V+=v
            for x,_ in t:
                c=(V[base+x[0]]+V[base+x[1]]+V[base+x[2]])/3;(TG if (c-sp).length<0.022 else TL).append(tuple(i+base for i in x))
        L=BVHTree.FromPolygons(V,TL);G=BVHTree.FromPolygons(V,TG)
        r['L_LEG']=len(L.overlap(T['LEG']));r['L_DRESS']=len(L.overlap(X['DRESS']));r['L_APRON']=len(L.overlap(X['APRON']));r['L_TORSO']=len(L.overlap(T['TORSO']))
        r['L_BOW']=len(L.overlap(X['BOW']));r['L_SCARF']=len(L.overlap(S));r['L_ARM']=len(L.overlap(T['ARM']))+len(L.overlap(T['HANDR']))
        r['G_HAND']=len(G.overlap(T['HANDR']))
        hv=[bv[i] for x,pi in bt if PC[pi]=='HANDR' for i in x]
        r['G_clear_mm']=round(min(G.find_nearest(v)[3] for v in hv[::3])*1000,2) if TG else None
rows=[];TAG=os.environ.get('TAG','run')
CL=os.environ.get('CLIPS','walk_loop,walk_start,walk_stop_bodyL,walk_stop_bodyR,walk_turn_90_bodyL,walk_turn_90_bodyR,walk_turn_180,walk_turn_180_bodyR,idle_breathing_loop').split(',')
for c in CL:
    N=max(1,int(round(dur(c)*30)))
    for f in range(N+1):
        t=f/30;P,W=pose_at(c,t);apply(P,W,t);r=dict(run=TAG,clip=c,f=f,t=t);measure(r);rows.append(r)
    print('QA',TAG,c,flush=True)
XF=[('idle_breathing_loop','walk_start'),('walk_start','walk_loop'),('walk_loop','walk_stop_bodyL'),('walk_loop','walk_stop_bodyR'),('walk_stop_bodyL','idle_breathing_loop'),('walk_stop_bodyR','idle_breathing_loop'),
    ('walk_loop','walk_turn_90_bodyL'),('walk_loop','walk_turn_90_bodyR'),('walk_loop','walk_turn_180'),('walk_loop','walk_turn_180_bodyR'),
    ('walk_turn_90_bodyL','walk_loop'),('walk_turn_90_bodyR','walk_loop'),('walk_turn_180','walk_loop'),('walk_turn_180_bodyR','walk_loop')]
if os.environ.get('XF')=='1':
    for a,b in XF:
        for f in range(7):
            u=f/30;w=min(1,u/0.2);XA=pose_at(a,dur(a)-0.2+u);XB=pose_at(b,u);P,W=blend(XA,XB,w);apply(P,W,u)
            r=dict(run=TAG,clip=f'xf:{a}>{b}',f=f,t=u);measure(r);rows.append(r)
    print('QA',TAG,'xfades',flush=True)
json.dump(rows,open(out,'w'))
