"""per-frame bone world pose dump: head position (m) + armature-space rotation; angular velocity (deg/frame) and linear velocity computed offline.
usage: blender -b --python joint_vel.py -- <blend> <checker_scripts_dir> <out.json>"""
import bpy, sys, json
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out=a[:3]; sys.path.insert(0,sdir); import clips
bpy.ops.wm.open_mainfile(filepath=blend); arm=bpy.data.objects['R5G2_RIG_22P4']; res={}
for clip,n in clips.CLIPS.items():
    clips.activate(clip); rows=[]
    for f in range(n+1):
        bpy.context.scene.frame_set(f); bpy.context.view_layer.update(); r={}
        for pb in arm.pose.bones:
            M=arm.matrix_world@pb.matrix; q=M.to_quaternion(); r[pb.name]=[*M.to_translation()]+[q.w,q.x,q.y,q.z]
        sk={}
        for on in ('G2_DRESS_R5G2','G2_APRON_R5G2'):
            k=bpy.data.objects[on].data.shape_keys
            if k: sk[on]={kb.name:round(kb.value,5) for kb in k.key_blocks[1:] if kb.value>1e-5}
        rows.append({'bones':r,'sk':sk})
    res[clip]=rows
json.dump(res,open(out,'w')); print('JDONE')
