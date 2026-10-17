import bpy,sys,numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-truesize/scripts'); import clips, checker as C
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1v2-truesize/scene/cine_m1_anim.blend')
ck=C.Checker(); clips.activate(sys.argv[-2]); bpy.context.scene.frame_set(int(sys.argv[-1]))
co,T=ck.ev(C.BODY); E=bpy.data.objects['env_interior_shell']; dg=bpy.context.evaluated_depsgraph_get(); m=E.evaluated_get(dg).to_mesh(); m.calc_loop_triangles()
ec=np.array([E.matrix_world@v.co for v in m.vertices]); et=np.array([t.vertices[:] for t in m.loop_triangles])
ov=ck.tree(co,T).overlap(ck.tree(ec,et))
for i,j in ov: print('OV body tri',i,'z',co[T[i]][:,2].round(5).tolist(),'dom',ck.dom[T[i][0]],'env z',ec[et[j]][:,2].round(4).tolist(), 'env xy',ec[et[j]][:,:2].mean(0).round(3).tolist())
