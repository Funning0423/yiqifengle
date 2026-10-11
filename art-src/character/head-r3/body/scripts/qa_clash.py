# blender -b body_r1_work.blend --python qa_clash.py -- <walk_v2_glb> <out.json>
# Overlap (triangle pairs) + min gap QA for head-r2 + body-r1 parts over every clip (e60 clips + walk_loop v2).
import bpy, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index("--")+1:]; W2,OUT=a[0],a[1]; BASE=a[2] if len(a)>2 else None
if BASE:
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=BASE)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=bpy.data.objects['LOD0_G2_BODY']; dress=bpy.data.objects['LOD0_G2_DRESS']; apron=bpy.data.objects['LOD0_G2_APRON']
acts_before=set(bpy.data.actions.keys())
keep={arm,body,dress,apron}|set(bpy.data.objects['LOD0_G2_BOW:'.rstrip(':')] for _ in [0] if 'LOD0_G2_BOW' in bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=W2)
w2=[x for x in bpy.data.actions if x.name not in acts_before and x.name.startswith('walk_loop')][0]
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o)
me=body.data; gi={g.name:g.index for g in body.vertex_groups}; gn={v:k for k,v in gi.items()}
def grp(v):
    tags=[gn[g.group] for g in v.groups if g.weight>0.5]
    for t,n in (('_tag_skull','skull'),('_tag_neck','neck'),('_tag_collar','collar'),('_tag_hair_shell','hair_shell'),('_tag_hat','hat'),('hair.fringe','bangs'),('hair.back','tips')):
        if t in tags: return n
    if BASE and True:
        d=max(((g.weight,gn[g.group]) for g in v.groups),default=(0,'-'))[1]; side='L' if v.co.x<0 else 'R'
        if d.startswith('hand'): return 'hand_'+side
        if d.startswith(('upper_arm','forearm')): return 'sleeve_'+side
        if d in('chest','spine','neck'): return 'torso'
        if d=='head': return 'skull'
        return 'legs'
    if any(gn[g.group]=='_tag_body_r1' for g in v.groups):
        d=max(((g.weight,gn[g.group]) for g in v.groups if not gn[g.group].startswith('_')),default=(0,'-'))[1]
        side='L' if v.co.x<0 else 'R'
        if d.startswith('hand'): return 'hand_'+side
        if d.startswith(('upper_arm','forearm')): return 'sleeve_'+side
        return 'torso'
    return 'legs'
cls=[grp(v) for v in me.vertices]
parts={}
for p in me.polygons:
    if BASE and cls[p.vertices[0]]=='skull': continue
    parts.setdefault(cls[p.vertices[0]],[]).append(list(p.vertices))
print('PARTS',{k:len(v) for k,v in parts.items()})
PAIRS=[('skull','hair_shell'),('skull','bangs'),('skull','tips'),('skull','hat'),('hair_shell','hat'),('bangs','hat'),
 ('skull','collar'),('skull','torso'),('hair_shell','torso'),('tips','torso'),('tips','collar'),('hair_shell','collar'),('hat','torso'),
 ('sleeve_L','dress'),('sleeve_R','dress'),('sleeve_L','apron'),('sleeve_R','apron'),('hand_L','dress'),('hand_R','dress'),('hand_L','apron'),('hand_R','apron'),
 ('hand_L','legs'),('hand_R','legs'),('sleeve_L','hair_shell'),('sleeve_R','hair_shell'),('hand_L','torso'),('hand_R','torso')]
GAPS=[('sleeve_L','apron'),('sleeve_R','apron'),('hand_L','apron'),('hand_R','apron'),('sleeve_L','dress'),('sleeve_R','dress'),('hand_L','dress'),('hand_R','dress'),
      ('tips','collar'),('tips','torso'),('hair_shell','torso'),('hair_shell','sleeve_L'),('hair_shell','sleeve_R')]
def evm(o):
    dg=bpy.context.evaluated_depsgraph_get(); ev=o.evaluated_get(dg); m=ev.to_mesh()
    V=[o.matrix_world@x.co for x in m.vertices]; F=[list(p.vertices) for p in m.polygons]; ev.to_mesh_clear(); return V,F
def check():
    V,_=evm(body); T={k:BVHTree.FromPolygons(V,ps) for k,ps in parts.items()}
    VS={k:sorted({i for ps in parts[k] for i in ps}) for k in parts}
    for nm,o in (('dress',dress),('apron',apron)):
        Vo,Fo=evm(o); T[nm]=BVHTree.FromPolygons(Vo,Fo)
    ov={f'{x}-{y}':len(T[x].overlap(T[y])) for x,y in PAIRS if x in T and y in T}
    gp={}
    for x,y in GAPS:
        if x not in T or y not in T: continue
        best=9
        for i in VS[x][::2]:
            h=T[y].find_nearest(V[i],0.2)
            if h[0] is not None: best=min(best,h[3])
        gp[f'{x}->{y}']=round(best*1000,1)
    return ov,gp,V
sc=bpy.context.scene; res={}
clips=[x for x in bpy.data.actions if x.name in('idle_breathing_loop','wind_sway_loop','walk_loop','sit_hold','stand_up','sit_down','door_reach')]+[w2]
if arm.animation_data is None: arm.animation_data_create()
for t in arm.animation_data.nla_tracks: t.mute=True
hi=[i for i,c in enumerate(cls) if c=='hand_L'][0]
for act in clips:
    arm.animation_data.action=act
    if getattr(act,'slots',None) and len(act.slots): arm.animation_data.action_slot=act.slots[0]
    f0,f1=[int(x) for x in act.frame_range]
    worst={}; wg={}; hp=[]
    for fr in range(f0,f1+1,2):
        sc.frame_set(fr); ov,gp,V=check(); hp.append(V[hi][:])
        for k,v in ov.items():
            if v>worst.get(k,(0,0))[0]: worst[k]=(v,fr)
        for k,v in gp.items():
            if k not in wg or v<wg[k][0]: wg[k]=(v,fr)
    name='walk_loop_v2' if act==w2 else act.name
    hp=np.array(hp); res[name]=dict(frames=[f0,f1],hand_L_travel_mm=round(float(np.ptp(hp,0).max())*1000,1),overlap_max=worst,min_gap_mm=wg)
    print('CLIP',name,json.dumps(res[name]))
arm.animation_data.action=None
for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.frame_set(0); ov,gp,_=check(); res['rest']=dict(overlap=ov,min_gap_mm=gp); print('REST',ov,gp)
json.dump(res,open(OUT,'w'),indent=1)
