import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D='/workspace/wechat-game/team/cinematic/work/slim-room-recheck-edc65d5/'
before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=D+'input/room_slim_edc65d5.glb')
prop=[o for o in bpy.data.objects if o not in before and o.name.startswith('env_interior_props_merged')][0]
sc=bpy.context.scene; arm=bpy.data.objects['R5G2_RIG_22P4']; arm.animation_data.action=bpy.data.actions['cine_open_stand']
for ob in ('G2_DRESS_R5G2','G2_APRON_R5G2'):
    o=bpy.data.objects[ob]; sk=bpy.data.actions.get('cine_open_stand__'+ob+'_sk')
    if sk and o.data.shape_keys: o.data.shape_keys.animation_data_create(); o.data.shape_keys.animation_data.action=sk
pt=BVHTree.FromObject(prop,bpy.context.evaluated_depsgraph_get()); out=[]
CH=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_HAIR_BOB_R5G2']
used={n:set(v for p in bpy.data.objects[n].data.polygons for v in p.vertices) for n in CH}
for f in range(0,91):
    sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get(); best=(9,'',None,None)
    for n in CH:
        o=bpy.data.objects[n]; e=o.evaluated_get(dg); m=e.to_mesh()
        for v in m.vertices:
            if v.index not in used[n]: continue
            p=o.matrix_world@v.co; h=pt.find_nearest(p,0.2)
            if h[0] is not None and h[3]<best[0]: best=(h[3],n,(p-h[0]).dot(h[1]),tuple(round(x,4) for x in p))
        e.to_mesh_clear()
    out.append(f'f{f:03d} min_visible_dist_mm={best[0]*1000:.2f} mesh={best[1]} signed_mm={(best[2] or 0)*1000:.2f} at={best[3]}')
open(D+'out/prop_visible_distance_cine_open_stand.txt','w').write('\n'.join(out)); print('\n'.join(o for o in out if f' ' in o and o.startswith(('f064','f065','f069','f070','f071'))))
print('MIN',min(out,key=lambda s:float(s.split('=')[1].split()[0])))
