import bpy
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; sc.render.fps=30
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb')
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]; PB=arm.pose.bones
for t in arm.animation_data.nla_tracks: t.mute=True
import os; a=bpy.data.actions[os.environ['CL']]; arm.animation_data.action=a
try: arm.animation_data.action_slot=a.slots[0]
except: pass
for f in range(0,int(a.frame_range[1])+1,3):
    sc.frame_set(f); g=lambda n:arm.matrix_world@PB[n].head; L=g('foot.L');R=g('foot.R');H=g('hips')
    print('WS',f,'hips',round(-H.y,3),round(H.z,3),'L',round(-L.y,3),round(L.z,3),'R',round(-R.y,3),round(R.z,3))
