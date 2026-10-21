import bpy
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb')
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
print('ARM',arm.name,arm.matrix_world.to_euler(), [ (a.name,tuple(a.frame_range)) for a in bpy.data.actions])
for b in arm.data.bones: print('B',b.name,b.parent.name if b.parent else None,[round(x,3) for x in arm.matrix_world@b.head_local],[round(x,3) for x in arm.matrix_world@b.tail_local])
print('MESH',[(o.name,len(o.data.vertices)) for o in bpy.data.objects if o.type=='MESH'])
