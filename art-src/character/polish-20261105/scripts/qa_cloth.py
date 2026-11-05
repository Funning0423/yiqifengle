# blender -b -P qa_cloth.py -- <glb> <out.json> : apron<->dress / dress<->legs overlap + seated skirt reach, sit_hold & walk_loop
import bpy,sys,json
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; glb,out=a
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
O=bpy.data.objects; arm=[o for o in O if o.type=='ARMATURE'][0]; sc=bpy.context.scene
body,dress,apron=O['LOD0_G2_BODY'],O['LOD0_G2_DRESS'],O['LOD0_G2_APRON']
gi={g.index:g.name for g in body.vertex_groups}
legv={v.index for v in body.data.vertices if max(((g.weight,gi[g.group]) for g in v.groups),default=(0,''))[1].startswith(('thigh','shin'))}
legf=[list(p.vertices) for p in body.data.polygons if p.vertices[0] in legv]
def ev(o):
    dg=bpy.context.evaluated_depsgraph_get(); e=o.evaluated_get(dg); m=e.to_mesh(); V=[o.matrix_world@x.co for x in m.vertices]; F=[list(p.vertices) for p in m.polygons]; e.to_mesh_clear(); return V,F
res={}
for name in ('sit_hold','walk_loop','sit_down','stand_up'):
    act=[x for x in bpy.data.actions if x.name.startswith(name)][0]
    arm.animation_data.action=act
    if act.slots: arm.animation_data.action_slot=act.slots[0]
    for t in arm.animation_data.nla_tracks: t.mute=True
    f0,f1=[int(x) for x in act.frame_range]; r=dict(apron_dress=0,dress_legs=0,reach_fwd_m=0)
    for fr in range(f0,f1+1,max(1,(f1-f0)//8)):
        sc.frame_set(fr); Vd,Fd=ev(dress); Va,Fa=ev(apron); Vb,_=ev(body)
        Td=BVHTree.FromPolygons(Vd,Fd); Ta=BVHTree.FromPolygons(Va,Fa); Tl=BVHTree.FromPolygons(Vb,legf)
        r['apron_dress']=max(r['apron_dress'],len(Td.overlap(Ta))); r['dress_legs']=max(r['dress_legs'],len(Td.overlap(Tl)))
        r['reach_fwd_m']=max(r['reach_fwd_m'],-min(v.y for v in Vd+Va))
    r['reach_fwd_m']=round(r['reach_fwd_m'],3); res[name]=r; print('QA',name,r)
json.dump(res,open(out,'w'),indent=1)
