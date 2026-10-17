import bpy,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D='/workspace/wechat-game/team/cinematic/work/slim-room-recheck-edc65d5/'
for o in bpy.data.objects:
    if o.type=='MESH' and (o.name.startswith(('env_','ENV_','col_','REF_','CHAIR_VARIANT'))): o.hide_render=True
before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=D+'input/room_slim_edc65d5.glb')
new=[o for o in bpy.data.objects if o not in before]
keep=('env_interior_shell','env_interior_props_merged','env_lighthouse_door')
for o in new: o.hide_render = not (o.type=='MESH' and o.name.split('.')[0] in keep)
prop=[o for o in new if o.name.startswith('env_interior_props_merged')][0]
sc=bpy.context.scene; arm=bpy.data.objects['R5G2_RIG_22P4']; act=bpy.data.actions['cine_open_stand']; arm.animation_data.action=act
for ob in ('G2_DRESS_R5G2','G2_APRON_R5G2'):
    o=bpy.data.objects[ob]; sk=bpy.data.actions.get('cine_open_stand__'+ob+'_sk')
    if sk and o.data.shape_keys: o.data.shape_keys.animation_data_create(); o.data.shape_keys.animation_data.action=sk
sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='OBJECT'
sc.render.resolution_x=900; sc.render.resolution_y=900
prop.color=(0.9,0.6,0.2,1)
T=Vector((0.16,4.575,0.647))
cam=bpy.data.objects.new('CU',bpy.data.cameras.new('CU')); sc.collection.objects.link(cam); sc.camera=cam; cam.data.lens=50; cam.data.clip_start=0.01
mk=bpy.data.objects.new('mk',bpy.data.meshes.new('mk')); 
import bmesh; bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=8,radius=0.004); bm.to_mesh(mk.data); sc.collection.objects.link(mk); mk.location=T; mk.color=(1,0,0,1)
pt=BVHTree.FromObject(prop,bpy.context.evaluated_depsgraph_get())
rep=[]
for f in (64,65,69,71):
    sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get()
    best=(9,None,None)
    for n in ('B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_HAIR_BOB_R5G2'):
        o=bpy.data.objects[n]; e=o.evaluated_get(dg); m=e.to_mesh()
        for v in m.vertices:
            p=o.matrix_world@v.co
            if (p-T).length>0.12: continue
            h=pt.find_nearest(prop.matrix_world.inverted()@p)
            if h[0] is not None and h[3]<best[0]:
                side=(p-prop.matrix_world@h[0]).dot(prop.matrix_world.to_3x3()@h[1])
                best=(h[3],n,side)
        e.to_mesh_clear()
    rep.append((f,round(best[0]*1000,2),best[1],round(best[2]*1000,2) if best[2] is not None else None)); print('R',rep[-1],flush=True)
    for i,(off) in enumerate([Vector((-0.45,-0.35,0.15)),Vector((0.0,0.0,0.55)),Vector((0.45,-0.3,0.1))]):
        cam.location=T+off; cam.rotation_euler=(T-cam.location).to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=D+f'renders/stand_f{f:03d}_v{i}.png'; bpy.ops.render.render(write_still=True)
open(D+'out/prop_closeup_distances.txt','w').write('\n'.join(map(str,rep)))
