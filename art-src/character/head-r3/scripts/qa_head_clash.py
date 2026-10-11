# blender -b head_r1_work.blend --python qa_head_clash.py -- <walk_v2_glb> <out.json>
# Triangle-overlap + min-gap QA for the head parts over every clip (e60 clips in the .blend + walk_loop v2).
import bpy, sys, json, math
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index("--")+1:]; W2,OUT=a[0],a[1]
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=bpy.data.objects['LOD0_G2_BODY']; me=body.data
acts_before=set(bpy.data.actions.keys())
bpy.ops.import_scene.gltf(filepath=W2)
w2=[x for x in bpy.data.actions if x.name not in acts_before and x.name.startswith('walk_loop')][0]
for o in list(bpy.data.objects):
    if o not in (arm,body) and (o.type in('ARMATURE','MESH','EMPTY')) and o.name not in [x.name for x in arm.children]+[arm.name]:
        if o.name.startswith(('LOD0','R5G2','B_SINGLE','Icosphere')) and o!=body and o!=arm and o.parent!=arm.parent: bpy.data.objects.remove(o)
gi={g.name:g.index for g in body.vertex_groups}
mats=[m.name for m in me.materials]
def vin(v,g): return any(x.group==gi[g] and x.weight>0.5 for x in v.groups)
cls={}
for v in me.vertices:
    for g in ('_tag_skull','_tag_neck','_tag_collar','_tag_hair_shell','_tag_hat','hair.fringe','hair.back'):
        if vin(v,g): cls[v.index]=g; break
parts={k:[] for k in ('skull','neck','collar','hair_shell','hat','bangs','tips','torso')}
nm={'_tag_skull':'skull','_tag_neck':'neck','_tag_collar':'collar','_tag_hair_shell':'hair_shell','_tag_hat':'hat','hair.fringe':'bangs','hair.back':'tips'}
for p in me.polygons:
    c=cls.get(p.vertices[0])
    if c: parts[nm[c]].append(list(p.vertices))
    elif mats[p.material_index]=='M_G2_BODY': parts['torso'].append(list(p.vertices))
PAIRS=[('skull','hair_shell'),('skull','bangs'),('skull','tips'),('skull','hat'),('hair_shell','hat'),('bangs','hat'),('bangs','hair_shell'),
       ('skull','collar'),('skull','torso'),('hair_shell','torso'),('tips','torso'),('tips','collar'),('hair_shell','collar'),('neck','collar'),('hat','torso'),('neck','torso')]
GAPS=[('collar','skull'),('tips','collar'),('tips','torso'),('hair_shell','torso'),('bangs','skull')]
res={}
def evalp():
    dg=bpy.context.evaluated_depsgraph_get(); ev=body.evaluated_get(dg); m=ev.to_mesh()
    V=[body.matrix_world@x.co for x in m.vertices]; ev.to_mesh_clear(); return V
def check(V):
    T={k:BVHTree.FromPolygons(V,ps) for k,ps in parts.items() if ps}
    ov={f'{a}-{b}':len(T[a].overlap(T[b])) for a,b in PAIRS}
    gp={}
    for a_,b_ in GAPS:
        vs={i for ps in parts[a_] for i in ps}; best=9
        for i in vs:
            h=T[b_].find_nearest(V[i])
            if h[0] is not None: best=min(best,h[3])
        gp[f'{a_}->{b_}']=round(best*1000,2)
    return ov,gp
sc=bpy.context.scene
clips=[x for x in bpy.data.actions if x.name in('idle_breathing_loop','wind_sway_loop','walk_loop','sit_hold','stand_up','sit_down','door_reach')]+[w2]
for t in arm.animation_data.nla_tracks: t.mute=True
for act in clips:
    arm.animation_data.action=act
    f0,f1=[int(x) for x in act.frame_range]
    worst={}; wg={}
    for fr in range(f0,f1+1,2):
        sc.frame_set(fr); ov,gp=check(evalp())
        for k,v in ov.items():
            if v>worst.get(k,(0,0))[0]: worst[k]=(v,fr)
        for k,v in gp.items():
            if k not in wg or v<wg[k][0]: wg[k]=(v,fr)
    name='walk_loop_v2' if act==w2 else act.name
    res[name]=dict(frames=[f0,f1],overlap_max={k:v for k,v in worst.items()},min_gap_mm=wg)
    print('CLIP',name,json.dumps(res[name]))
arm.animation_data.action=None
for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.frame_set(0); ov,gp=check(evalp()); res['rest']=dict(overlap=ov,min_gap_mm=gp); print('REST',ov,gp)
json.dump(res,open(OUT,'w'),indent=1)
