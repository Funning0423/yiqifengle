import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D='/workspace/wechat-game/team/cinematic/work/slim-room-recheck-edc65d5/'
before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=D+'input/room_slim_edc65d5.glb')
prop=[o for o in bpy.data.objects if o not in before and o.name.startswith('env_interior_props_merged')][0]
sc=bpy.context.scene; arm=bpy.data.objects['R5G2_RIG_22P4']; arm.animation_data.action=bpy.data.actions['cine_open_stand']
T=Vector((0.16,4.575,0.647)); pt=BVHTree.FromObject(prop,bpy.context.evaluated_depsgraph_get())
b=bpy.data.objects['B_ANATOMICAL_VERTICAL_SLENDER_R5']; print('VIS',b.hide_render,b.hide_viewport,[m.type for m in b.modifiers])
for f in (64,65,69,71):
    sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get(); e=b.evaluated_get(dg); m=e.to_mesh()
    L=[]
    for v in m.vertices:
        p=b.matrix_world@v.co
        if (p-T).length>0.12: continue
        h=pt.find_nearest(p); L.append((h[3],v.index,tuple(round(x,4) for x in p),tuple(round(x,4) for x in h[0])))
    L.sort(); print('N',f,len(L),[(round(a*1000,2),i,p,q) for a,i,p,q in L[:3]])
    vg=[b.vertex_groups[g.group].name for g in b.data.vertices[L[0][1]].groups]; print('G',vg)
    e.to_mesh_clear()
