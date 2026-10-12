# blender -b body_r4_work.blend --python qa_clash.py -- <runtime_glb> <walk_v2_glb> <out.json> [step]
# Overlap (triangle pairs) + min gap QA for the head-hy + body-r4 parts over EVERY clip of the runtime GLB (all 14 today)
# plus walk_loop v2. Actions are matched by bone name, so the 28-bone skeleton of the .blend plays them unchanged.
import bpy, sys, json, math, re
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index("--")+1:]; RT,W2,OUT=a[0],a[1],a[2]; STEP=int(a[3]) if len(a)>3 else 2
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=bpy.data.objects['LOD0_G2_BODY']; dress=bpy.data.objects['LOD0_G2_DRESS']; apron=bpy.data.objects['LOD0_G2_APRON']
keep={arm,body,dress,apron}|({bpy.data.objects['LOD0_G2_BOW']} if 'LOD0_G2_BOW' in bpy.data.objects else set())
clips=[]
for path,tag in ((RT,''),(W2,'_v2')):
    before=set(bpy.data.actions.keys()); bpy.ops.import_scene.gltf(filepath=path)
    for act in bpy.data.actions:
        if act.name in before: continue
        base=re.sub(r'\.\d{3}$','',act.name)
        if tag and not base.startswith('walk_loop'): continue
        clips.append((base+tag,act))
    for o in list(bpy.data.objects):
        if o not in keep: bpy.data.objects.remove(o)
me=body.data; gi={g.name:g.index for g in body.vertex_groups}; gn={v:k for k,v in gi.items()}
def grp(v):
    tags=[gn[g.group] for g in v.groups if g.weight>0.5]
    for t,n in (('_tag_skull','skull'),('_tag_eyes','skull'),('_tag_neck','neck'),('_tag_collar','collar'),('_tag_hair_shell','hair_shell'),('_tag_hat','hat'),('hair.fringe','bangs'),('hair.back','tips')):
        if t in tags: return n
    if '_tag_legs_r2' in gi and any(g.group==gi['_tag_legs_r2'] for g in v.groups): return 'legs'
    if any(gn[g.group]=='_tag_body_r1' for g in v.groups):
        d=max(((g.weight,gn[g.group]) for g in v.groups if not gn[g.group].startswith('_')),default=(0,'-'))[1]
        side='L' if v.co.x<0 else 'R'
        if d.startswith('hand'): return 'hand_'+side
        if d.startswith(('upper_arm','forearm')): return 'sleeve_'+side
        return 'torso'
    return 'legs'
cls=[grp(v) for v in me.vertices]
parts={}
for p in me.polygons: parts.setdefault(cls[p.vertices[0]],[]).append(list(p.vertices))
print('PARTS',{k:len(v) for k,v in parts.items()})
PAIRS=[('skull','hair_shell'),('skull','bangs'),('skull','tips'),('skull','hat'),('hair_shell','hat'),('bangs','hat'),('tips','hat'),
 ('skull','collar'),('skull','torso'),('hair_shell','torso'),('tips','torso'),('tips','collar'),('hair_shell','collar'),('hat','torso'),
 ('sleeve_L','dress'),('sleeve_R','dress'),('sleeve_L','apron'),('sleeve_R','apron'),('hand_L','dress'),('hand_R','dress'),('hand_L','apron'),('hand_R','apron'),
 ('hand_L','legs'),('hand_R','legs'),('legs','dress'),('legs','apron'),('sleeve_L','hair_shell'),('sleeve_R','hair_shell'),('hand_L','torso'),('hand_R','torso')]
GAPS=[('sleeve_L','apron'),('sleeve_R','apron'),('hand_L','apron'),('hand_R','apron'),('sleeve_L','dress'),('sleeve_R','dress'),('hand_L','dress'),('hand_R','dress'),
      ('legs','dress'),('collar','skull'),('tips','collar'),('tips','torso'),('hair_shell','torso'),('hair_shell','sleeve_L'),('hair_shell','sleeve_R'),('hat','torso')]
def evm(o):
    dg=bpy.context.evaluated_depsgraph_get(); ev=o.evaluated_get(dg); m=ev.to_mesh()
    V=[o.matrix_world@x.co for x in m.vertices]; F=[list(p.vertices) for p in m.polygons]; ev.to_mesh_clear(); return V,F
VS={k:sorted({i for ps in parts[k] for i in ps}) for k in parts}
def check():
    V,_=evm(body); T={k:BVHTree.FromPolygons(V,ps) for k,ps in parts.items()}
    VA=None
    for nm,o in (('dress',dress),('apron',apron)):
        Vo,Fo=evm(o); T[nm]=BVHTree.FromPolygons(Vo,Fo)
        if nm=='apron': VA=Vo
    ov={f'{x}-{y}':len(T[x].overlap(T[y])) for x,y in PAIRS if x in T and y in T}
    ov['apron-dress']=len(T['apron'].overlap(T['dress']))
    gp={}
    for x,y in GAPS:
        if x not in T or y not in T: continue
        best=9
        for i in VS[x][::2]:
            h=T[y].find_nearest(V[i],0.2)
            if h[0] is not None: best=min(best,h[3])
        gp[f'{x}->{y}']=round(best*1000,1)
    NP=int(apron.get('n_panel',len(VA)))
    for key,rng in (('apron->dress',range(0,NP)),('belt->dress',range(NP,len(VA)))):
        ds=[T['dress'].find_nearest(VA[i],0.2) for i in rng]
        gp[key]=round(min((h[3] for h in ds if h[0] is not None),default=9)*1000,1)
    # apron panel max gap (layer spacing upper bound 12 mm) over the panel rows away from the waistband
    ds=[T['dress'].find_nearest(VA[i],0.2) for i in range(0,NP)]
    gp['apron->dress_max']=round(max((h[3] for h in ds if h[0] is not None),default=0)*1000,1)
    return ov,gp,V
sc=bpy.context.scene; res={}
if arm.animation_data is None: arm.animation_data_create()
for t in arm.animation_data.nla_tracks: t.mute=True
for name,act in clips:
    arm.animation_data.action=act
    if getattr(act,'slots',None) and len(act.slots): arm.animation_data.action_slot=act.slots[0]
    f0,f1=[int(round(x)) for x in act.frame_range]
    worst={}; wg={}
    for fr in list(range(f0,f1+1,STEP))+([f1] if (f1-f0)%STEP else []):
        sc.frame_set(fr); ov,gp,V=check()
        for k,v in ov.items():
            if v>worst.get(k,(0,0))[0]: worst[k]=(v,fr)
        for k,v in gp.items():
            if k not in wg or v<wg[k][0]: wg[k]=(v,fr)
    res[name]=dict(frames=[f0,f1],overlap_max=worst,min_gap_mm=wg)
    print('CLIP',name,json.dumps(res[name]))
arm.animation_data.action=None
for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.frame_set(0); ov,gp,_=check(); res['rest']=dict(overlap=ov,min_gap_mm=gp); print('REST',ov,gp)
json.dump(res,open(OUT,'w'),indent=1)
