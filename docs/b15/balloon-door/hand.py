import bpy, numpy as np
G='/workspace/yiqifengle/previews/角色动画bot/planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb'
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=G)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute=True
a=bpy.data.actions['door_reach']; arm.animation_data.action=a
try: arm.animation_data.action_slot=a.slots[0]
except: pass
body=bpy.data.objects['LOD0_G2_BODY']; g={x.index:x.name for x in body.vertex_groups}
HV=[v.index for v in body.data.vertices if v.groups and g[max(v.groups,key=lambda q:q.weight).group]=='hand.L']
for f in range(8,34,2):
    sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get(); oe=body.evaluated_get(dg); me=oe.to_mesh()
    V=np.array([tuple(oe.matrix_world@me.vertices[i].co) for i in HV]); oe.to_mesh_clear()
    i=V[:,1].argmin(); print('H',f,'front y',V[:,1].min().round(4),'at',V[i].round(3),'centroid',V.mean(0).round(3),'zrange',V[:,2].min().round(3),V[:,2].max().round(3),'xrange',V[:,0].min().round(3),V[:,0].max().round(3))
