# 配件穿模 QA（qa3 同法：30 fps 逐帧、anim_meta morph 曲线、BVH 三角对计数）。blender -b --python qa_acc.py -- char.glb meta.json out.json
# 环境：RUNS=json [[tag,W,windDir,staticBack,staticLat,clips]]；LANTERN=prop.glb
import bpy,sys,os,json,math,numpy as np
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
glb,metap,out=sys.argv[-3:]
os.environ['CHARGLB']=glb
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=glb)
meta=json.load(open(metap))['clips'];O={o.name:o for o in bpy.data.objects}
arm=[o for o in O.values() if o.type=='ARMATURE'][0];M={k[8:]:o for k,o in O.items() if k.startswith('LOD0_G2_') and o.type=='MESH'}
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
LOBJ=[]
if os.environ.get('LANTERN'):
    LOBJ=[o for o in attach_lantern(arm,os.environ['LANTERN']) if o.type=='MESH']
LBODY=[o for o in LOBJ if not o.name.startswith('lantern.core')]
if arm.animation_data is None: arm.animation_data_create()
for t in arm.animation_data.nla_tracks: t.mute=True
B=M['BODY'];gi={g.index:g.name for g in B.vertex_groups}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in B.data.vertices]
mn=[m.name if m else '' for m in B.data.materials];BV=B.data.vertices
def cls(p):
    mat=mn[p.material_index];ds=[D[v] for v in p.vertices];d=max(set(ds),key=ds.count);c=sum((BV[v].co for v in p.vertices),Vector())/len(p.vertices)
    if 'HAIR' in mat: return 'HAIR'
    if 'HEAD' in mat: return 'HAT'
    if d=='head': return 'CHIN' if (c.z<1.50 and -c.y>0.0) else 'FACE'   # blender: y=-gltfZ, z=gltfY
    if d.startswith(('upper_arm','forearm','hand')): return 'ARM'
    if d.startswith(('thigh','shin','foot')): return 'LEG'
    return 'TORSO'
PC=[cls(p) for p in B.data.polygons]
print('PARTS',{k:PC.count(k) for k in set(PC)})
def wm(o,cl=None):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    vs=[Mw@v.co for v in me.vertices];me.calc_loop_triangles()
    t=[tuple(x.vertices) for x in me.loop_triangles if cl is None or PC[x.polygon_index] in cl];oe.to_mesh_clear();return vs,t
def lantern_bvh():
    V=[];T=[]
    for o in LBODY:
        v,t=wm(o);T+=[tuple(i+len(V) for i in x) for x in t];V+=v
    return BVHTree.FromPolygons(V,T),V
def interp(tab,t): return float(np.interp(t,[a for a,_ in tab],[b for _,b in tab]))
SB=arm.pose.bones.get('scarf.tail');NB=arm.pose.bones['neck']
GRAV=float(os.environ.get('GRAV','0'))  # QA：scarf.tail 重力补偿（尾巴朝世界下垂，限幅 后/前35° 左右20°）
def scarf_rot(back_deg,lat_deg):
    if SB is None: return (0,0)
    SB.rotation_quaternion=(1,0,0,0);SB.location=(0,0,0);bpy.context.view_layer.update()
    Q=((arm.matrix_world@NB.matrix)@(arm.matrix_world@NB.bone.matrix_local).inverted()).to_3x3().normalized()
    if GRAV:
        d=Q.inverted()@Vector((0,0,-1));ga=math.degrees(math.atan2(d.y,-d.z));gb=-math.degrees(math.atan2(d.x,-d.z))*0
        back_deg+=GRAV*ga;lat_deg+=0
    back_deg=max(-35,min(35,back_deg));lat_deg=max(-20,min(20,lat_deg))
    if back_deg==0 and lat_deg==0: return (0,0)
    R=Q@(Matrix.Rotation(math.radians(back_deg),3,'X')@Matrix.Rotation(math.radians(-lat_deg),3,'Y'))@Q.inverted()
    Ms=SB.matrix.copy();h=(arm.matrix_world@Ms).translation.copy();W=arm.matrix_world
    SB.matrix=W.inverted()@Matrix.Translation(h)@R.to_4x4()@Matrix.Translation(-h)@W@Ms;bpy.context.view_layer.update()
    return (back_deg,lat_deg)
WALK='walk_loop,walk_start,walk_stop_bodyL,walk_stop_bodyR,walk_turn_90_bodyL,walk_turn_90_bodyR,walk_turn_180,walk_turn_180_bodyR'
ALL=','.join(meta.keys())
RUNS=json.loads(os.environ.get('RUNS','[["W0",0,0,0,0,"ALL"]]'))
LCL=set((WALK+',idle_breathing_loop').split(','))
FORCE=json.loads(os.environ.get('MORPH_FORCE','{}'))
rows=[]
for tag,Wv,wdir,sback,slat,cl in RUNS:
  clips={'ALL':ALL,'WALK':WALK,'WALKIDLE':WALK+',idle_breathing_loop'}.get(cl,cl).split(',')
  for c in clips:
    act=[a for a in bpy.data.actions if a.name==c or a.name.startswith(c+'_')];act=sorted(act,key=lambda a:len(a.name))[0];arm.animation_data.action=act
    try: arm.animation_data.action_slot=act.slots[0]
    except Exception: pass
    f0,f1=act.frame_range;mc=meta[c];N=max(1,int(round(mc['duration_s']*30)));cur=mc.get('morph',{}).get('curves',{})
    for f in range(N+1):
        t=f/30
        for o in M.values():
            sk=o.data.shape_keys
            if sk:
                for kb in sk.key_blocks[1:]: kb.value=FORCE.get(kb.name,interp(cur[kb.name],t) if kb.name in cur else 0.0)
        fr=f0+(f1-f0)*f/N;SB and setattr(SB,'rotation_quaternion',(1,0,0,0));sc.frame_set(int(fr),subframe=fr-int(fr));bpy.context.view_layer.update()
        # 风：系数 0.5；顶风 wdir=+1 向后，顺风 -1 向前；左右摆
        back=sback+wdir*Wv*0.5*35*(0.5+0.5*math.sin(2*math.pi*t/1.0));lat=slat+Wv*0.5*20*math.sin(2*math.pi*t/0.7+1)
        back,lat=scarf_rot(back,lat)
        r=dict(run=tag,clip=c,f=f,back=round(back,1),lat=round(lat,1))
        bv,bt=wm(B);
        def sub(cls_): return BVHTree.FromPolygons(bv,[x for x,pi in zip(bt,PIDX) if PC[pi] in cls_])
        dg=bpy.context.evaluated_depsgraph_get();oe=B.evaluated_get(dg);me=oe.to_mesh();me.calc_loop_triangles();PIDX=[x.polygon_index for x in me.loop_triangles];oe.to_mesh_clear()
        T={k:sub({k}) for k in ('FACE','CHIN','HAIR','HAT','ARM','TORSO','LEG')}
        X={n:BVHTree.FromPolygons(*wm(M[n])) for n in ('APRON','DRESS','BOW') }
        r['B_HAIRxTORSO']=len(T['HAIR'].overlap(T['TORSO']));r['B_CHINxTORSO']=len(T['CHIN'].overlap(T['TORSO']))
        if 'SCARF' in M:
            S=BVHTree.FromPolygons(*wm(M['SCARF']))
            for k in ('FACE','CHIN','HAIR','HAT','ARM','TORSO'): r['S_'+k]=len(S.overlap(T[k]))
            sv,st=wm(M['SCARF']);ST=BVHTree.FromPolygons(sv,[x for x in st if min(x)>=133]);r['S_tail_APRON']=len(ST.overlap(X['APRON']));r['S_tail_DRESS']=len(ST.overlap(X['DRESS']));r['S_tail_TORSO']=len(ST.overlap(T['TORSO']))
            r['S_APRON']=len(S.overlap(X['APRON']));r['S_RIBBON']=len(S.overlap(X['BOW']));r['S_DRESS']=len(S.overlap(X['DRESS']))
        if LBODY and c in LCL:
            globals()['LT']=t;place_lantern(arm);bpy.context.view_layer.update();L,lv=lantern_bvh()
            r['L_LEG']=len(L.overlap(T['LEG']));r['L_DRESS']=len(L.overlap(X['DRESS']));r['L_APRON']=len(L.overlap(X['APRON']));r['L_TORSO']=len(L.overlap(T['TORSO']))
            BF=BVHTree.FromPolygons(bv,bt);r['C_DRESSxBODY']=len(X['DRESS'].overlap(BF));r['C_APRONxBODY']=len(X['APRON'].overlap(BF));r['C_DRESSxAPRON']=len(X['DRESS'].overlap(X['APRON']))
            r['L_BOW']=len(L.overlap(X['BOW']))
            if 'SCARF' in M: r['L_SCARF']=len(L.overlap(S))
            for nm_,TT in (('D',X['DRESS']),('A',X['APRON'])):
                dep=0.0
                for v in lv:
                    hit=TT.find_nearest(v)
                    if hit[0] is not None and (v-hit[0]).dot(hit[1])<0: dep=max(dep,hit[3])
                r['L_dep'+nm_+'_mm']=round(dep*1000,1)
            r['L_minY']=round(min(v.z for v in lv),3)
        rows.append(r)
    x=[r for r in rows if r['run']==tag and r['clip']==c]
    ks=[k for k in x[0] if k[:2] in('S_','L_','B_','C_') and k!='L_minY' and not k.startswith('L_dep')]
    print('QA',tag,c,len(x),{k:(max(r[k] for r in x),sum(r[k]>0 for r in x)) for k in ks},flush=True)
json.dump(rows,open(out,'w'))
