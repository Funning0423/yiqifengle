import bpy,sys,json,math
from mathutils import Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]; sc=bpy.context.scene
d=arm.data.bones
print('foot.L head,tail',tuple(round(x,3) for x in d['foot.L'].head_local),tuple(round(x,3) for x in d['foot.L'].tail_local))
for b in ['skirt.front','skirt.front.low','skirt.front.mid','skirt.front.low.mid','thigh.L','shin.L']: print(b,[round(x,3) for x in d[b].head_local],[round(x,3) for x in d[b].tail_local])
acts={a.name.replace('_R5G2_RIG_22P4',''):a for a in bpy.data.actions}
out={}
for clip in ['walk_loop','door_reach','stand_up','walk_turn_90_bodyL','idle_breathing_loop']:
    arm.animation_data.action=acts[clip]; rows=[]
    for f in range(0,int(acts[clip].frame_range[1])+1):
        sc.frame_set(f); r={'f':f}
        for b in ['skirt.front','skirt.front.low','thigh.L','thigh.R']:
            pb=arm.pose.bones[b]; q=pb.matrix_basis.to_quaternion(); r[b]=round(math.degrees(q.angle),1)
            e=pb.matrix_basis.to_euler(); r[b+'_x']=round(math.degrees(e.x),1)
        # tail direction world of skirt.front.low vs rest
        pb=arm.pose.bones['skirt.front.low']; v=(pb.tail-pb.head).normalized(); r['sfl_dir']=[round(x,2) for x in v]
        rows.append(r)
    out[clip]=rows
json.dump(out,open('/tmp/skirt/ang.json','w'))
