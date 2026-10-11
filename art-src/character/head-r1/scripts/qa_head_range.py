# blender -b head_r1_work.blend --python qa_head_range.py : how far can head/neck rotate before collar/torso clash (rest body)
import bpy, math
from mathutils.bvhtree import BVHTree
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]; body=bpy.data.objects['LOD0_G2_BODY']; me=body.data
if arm.animation_data: arm.animation_data.action=None
for t in (arm.animation_data.nla_tracks if arm.animation_data else []): t.mute=True
gi={g.name:g.index for g in body.vertex_groups}
def part(g): return [list(p.vertices) for p in me.polygons if any(x.group==gi[g] and x.weight>0.5 for x in me.vertices[p.vertices[0]].groups)]
S=part('_tag_skull')+part('_tag_hair_shell')+part('hair_tips_back')+part('_tag_hat'); Cc=part('_tag_collar')
Tor=[list(p.vertices) for p in me.polygons if me.materials[p.material_index].name=='M_G2_BODY']
pb=arm.pose.bones['head']; pb.rotation_mode='XYZ'
for ax,name in ((0,'pitch(X)'),(1,'yaw(Y)'),(2,'roll(Z)')):
  for sgn in (1,-1):
    lim=None
    for deg in range(0,61,2):
        r=[0,0,0]; r[ax]=math.radians(deg*sgn); pb.rotation_euler=r
        bpy.context.view_layer.update()
        dg=bpy.context.evaluated_depsgraph_get(); ev=body.evaluated_get(dg); m=ev.to_mesh(); V=[x.co.copy() for x in m.vertices]; ev.to_mesh_clear()
        hs=BVHTree.FromPolygons(V,S)
        n=len(hs.overlap(BVHTree.FromPolygons(V,Cc)))+len(hs.overlap(BVHTree.FromPolygons(V,Tor)))
        if n>0: lim=deg; break
    print('RANGE head',name,'+' if sgn>0 else '-','first clash at',lim,'deg' if lim else '(none up to 60)')
pb.rotation_euler=(0,0,0)
