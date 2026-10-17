import bpy,sys,numpy as np,math
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts'); import clips
from mathutils import Matrix
blend,out=sys.argv[sys.argv.index('--')+1:][:2]; bpy.ops.wm.open_mainfile(filepath=blend); arm=bpy.data.objects['R5G2_RIG_22P4']
names=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2']
for o in names:
    for m in bpy.data.objects[o].modifiers:
        if m.type in ('SOLIDIFY','TRIANGULATE','NODES'): m.show_viewport=False
Mc=Matrix.Rotation(2.0,4,'Z')@Matrix.Translation((-0.43273,-4.20761,0)); R={}
for pn,clip,f in [('m1s_f0','cine_open_stand',0),('m1s_f25','cine_open_stand',25),('m1s_f60','cine_open_stand',60),('m1t_f20','cine_open_turn',20)]:
    clips.activate(clip); bpy.context.scene.frame_set(f); dg=bpy.context.evaluated_depsgraph_get()
    for n in names:
        o=bpy.data.objects[n]; e=o.evaluated_get(dg); m=e.to_mesh(); R[pn+'|'+n]=np.array([Mc@o.matrix_world@v.co for v in m.vertices]); e.to_mesh_clear()
    R[pn+'|bones']=np.array([list(Mc@arm.matrix_world@b.matrix) for b in arm.pose.bones]); R[pn+'|skw']=np.array([kb.value for kb in bpy.data.objects[names[1]].data.shape_keys.key_blocks])
R['bone_names']=np.array([b.name for b in arm.pose.bones]); R['dress_keys']=np.array([kb.name for kb in bpy.data.objects[names[1]].data.shape_keys.key_blocks])
np.savez(out,**R); print('DONE')
