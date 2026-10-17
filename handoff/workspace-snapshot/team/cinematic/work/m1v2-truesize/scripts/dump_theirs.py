import bpy,sys,os,numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-truesize/theirs/scripts'); import p2c_poses as PZ
out=sys.argv[sys.argv.index('--')+1]; arm=bpy.data.objects['R5G2_RIG_22P4']
names=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2']
for o in names:
    for m in bpy.data.objects[o].modifiers:
        if m.type in ('SOLIDIFY','TRIANGULATE','NODES'): m.show_viewport=False
R={}
for pn in ['m1s_f0','m1s_f25','m1s_f60','m1t_f20']:
    PZ.apply(arm,pn); dg=bpy.context.evaluated_depsgraph_get()
    for n in names:
        o=bpy.data.objects[n]; e=o.evaluated_get(dg); m=e.to_mesh(); R[pn+'|'+n]=np.array([o.matrix_world@v.co for v in m.vertices]); e.to_mesh_clear()
    R[pn+'|bones']=np.array([list(arm.matrix_world@b.matrix) for b in arm.pose.bones]); R[pn+'|skw']=np.array([kb.value for kb in bpy.data.objects[names[1]].data.shape_keys.key_blocks])
R['bone_names']=np.array([b.name for b in arm.pose.bones]); R['dress_keys']=np.array([kb.name for kb in bpy.data.objects[names[1]].data.shape_keys.key_blocks])
R['arm_mw']=np.array(arm.matrix_world)
np.savez(out,**R); print('DONE')
