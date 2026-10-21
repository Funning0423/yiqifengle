# walk-family QA with additive wind (CharacterMotion), every 30fps frame of 10 clips + crossfades (0.2 s, lerp/slerp bones + morph weights)
import bpy,sys,json,os,fnmatch,numpy as np
from mathutils import Quaternion as Q
from mathutils.bvhtree import BVHTree
glb,metap,out=sys.argv[-3:]
W=float(os.environ.get('WIND_W','0'));PH=[float(x) for x in os.environ.get('PHASES','0').split(',')];WS=json.loads(os.environ.get('WS','{}'))
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=glb)
meta=json.load(open(metap))['clips'];O={o.name:o for o in bpy.data.objects}
arm=[o for o in O.values() if o.type=='ARMATURE'][0];M={k[8:]:o for k,o in O.items() if k.startswith('LOD0_G2_') and o.type=='MESH'}
B=M['BODY'];gi={g.index:g.name for g in B.vertex_groups}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in B.data.vertices]
HV=set(i for i,d in enumerate(D) if d.startswith(('hand.','forearm.')))
for t in arm.animation_data.nla_tracks: t.mute=True
PB=arm.pose.bones
def setact(n):
    a=bpy.data.actions[n];arm.animation_data.action=a
    try: arm.animation_data.action_slot=a.slots[0]
    except Exception: pass
def pose(n,t):
    setact(n);a=bpy.data.actions[n];f=min(t*30,a.frame_range[1]);sc.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
    return {b.name:(b.location.copy(),b.rotation_quaternion.copy()) for b in PB}
WN=[b.name for b in PB if any(fnmatch.fnmatchcase(b.name,m) for m in ['skirt*','apron*','hair*','ribbon*'])]
wa=bpy.data.actions['wind_flutter_loop'];WT=wa.frame_range[1]/30;WTAB=[pose('wind_flutter_loop',f/30) for f in range(int(round(wa.frame_range[1]))+1)]
def interp(tab,t): return float(np.interp(t,[a for a,_ in tab],[b for _,b in tab]))
def wts(n,t): return {k:interp(v,t) for k,v in meta.get(n,{}).get('morph',{}).get('curves',{}).items()}
def apply(P,Wm,tw,ph):
    arm.animation_data.action=None
    for b in PB: b.location,b.rotation_quaternion=P[b.name]
    if W>0:
        x=((tw+ph)%WT)*30;i=min(int(x),len(WTAB)-1);j=min(i+1,len(WTAB)-1);u=x-int(x)
        for n in WN:
            s=W*next((v for k_,v in WS.items() if fnmatch.fnmatchcase(n,k_)),1.0)
            if s<=0: continue
            lq=WTAB[i][n][1].slerp(WTAB[j][n][1],u);ll=WTAB[i][n][0].lerp(WTAB[j][n][0],u)
            d=WTAB[0][n][1].inverted()@lq;PB[n].rotation_quaternion=PB[n].rotation_quaternion@Q().slerp(d,s);PB[n].location=PB[n].location+(ll-WTAB[0][n][0])*s
    for o in M.values():
        sk=o.data.shape_keys
        if sk:
            for kb in sk.key_blocks[1:]: kb.value=min(1,max(0,Wm.get(kb.name,0.0)))
    bpy.context.view_layer.update()
def blend(Po,Pi,fo):
    R={}
    for k in Pi:
        qo,qi=Po[k][1],Pi[k][1]
        if qo.dot(qi)<0: qo=-qo
        R[k]=(Pi[k][0].lerp(Po[k][0],fo),qi.slerp(qo,fo))
    return R
def wm(o):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    vs=[Mw@v.co for v in me.vertices];me.calc_loop_triangles();t=[tuple(x.vertices) for x in me.loop_triangles];oe.to_mesh_clear();return vs,t
bo=M['BOW'].data;REST={tuple(e.vertices):(bo.vertices[e.vertices[0]].co-bo.vertices[e.vertices[1]].co).length for e in bo.edges if (bo.vertices[e.vertices[0]].co-bo.vertices[e.vertices[1]].co).length>1e-5}
def measure():
    bw=wm(M['BOW'])[0];return dict(S=round(max(abs((bw[a]-bw[b]).length/l-1) for (a,b),l in REST.items())*100,3))
def _old():
    Wd={n:wm(M[n]) for n in ('BODY','DRESS','APRON','BOW')};T={n:BVHTree.FromPolygons(*Wd[n]) for n in ('DRESS','APRON','BOW')}
    bv,bt=Wd['BODY'];bh=BVHTree.FromPolygons(bv,[x for x in bt if all(v in HV for v in x)]);BB=BVHTree.FromPolygons(bv,bt)
    return dict(HxA=len(bh.overlap(T['APRON'])),HxD=len(bh.overlap(T['DRESS'])),DxA=len(T['DRESS'].overlap(T['APRON'])),DxB=len(T['DRESS'].overlap(BB)),AxB=len(T['APRON'].overlap(BB)),
                WxD=len(T['BOW'].overlap(T['DRESS'])),WxA=len(T['BOW'].overlap(T['APRON'])),WxB=len(T['BOW'].overlap(BB)),WxH=len(bh.overlap(T['BOW'])))
CL=['walk_start','walk_loop','walk_stop_bodyL','walk_stop_bodyR','walk_turn_90_bodyL','walk_turn_90_bodyR','walk_turn_180','walk_turn_180_bodyR','idle_breathing_loop','door_reach']
dur={c:bpy.data.actions[c].frame_range[1]/30 for c in CL}
XF=[('walk_start',dur['walk_start']-0.2,'walk_loop',0),('walk_loop',0.7,'walk_stop_bodyL',0),('walk_loop',0,'walk_stop_bodyR',0)]+[('walk_loop',0,c,0) for c in CL[4:8]]+[(c,dur[c]-0.2,'walk_loop',0) for c in CL[4:8]]+[('walk_stop_bodyL',dur['walk_stop_bodyL']-0.2,'idle_breathing_loop',0),('idle_breathing_loop',0,'walk_start',0),('idle_breathing_loop',0,'door_reach',0),('door_reach',dur['door_reach']-0.2,'idle_breathing_loop',0)]
rows=[]
for ph in PH:
    for c in CL:
        for f in range(int(round(dur[c]*30))+1):
            t=f/30;apply(pose(c,t),wts(c,t),t,ph);r=measure();r.update(kind='clip',name=c,f=f,ph=ph);rows.append(r)
    for (a,ta,b,tb) in XF:
        for k in range(7):
            fo=max(0,1-k/6);Pa=pose(a,ta+k/30);Pb=pose(b,tb+k/30);wa_=wts(a,ta+k/30);wb_=wts(b,tb+k/30)
            Wm={x:wb_.get(x,0)*(1-fo)+wa_.get(x,0)*fo for x in set(wa_)|set(wb_)}
            apply(blend(Pa,Pb,fo),Wm,ta+k/30,ph);r=measure();r.update(kind='xf',name=f'{a}->{b}',f=k,ph=ph);rows.append(r)
json.dump(rows,open(out,'w'));print('DONE',len(rows))
