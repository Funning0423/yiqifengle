import bpy,sys,glob,os
for f in sorted(glob.glob(os.path.dirname(bpy.data.filepath or __file__)+'/src/*.bvh')) if False else sorted(glob.glob('src/*.bvh')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_anim.bvh(filepath=f,global_scale=1.0,axis_forward='-Z',axis_up='Y',update_scene_fps=False,update_scene_duration=True)
    a=bpy.context.object; sc=bpy.context.scene
    fs,fe=int(a.animation_data.action.frame_range[0]),int(a.animation_data.action.frame_range[1])
    pb=a.pose.bones
    hl=[];lf=[];rf=[];hz=[]
    for fr in range(fs,fe+1,4):
        sc.frame_set(fr)
        g=lambda n:(a.matrix_world@pb[n].head)
        lf.append(g('LeftToeBase').z); rf.append(g('RightToeBase').z); hz.append(g('Hips').z)
    sc.frame_set(fs); leg=(a.matrix_world@pb['Hips'].head).z
    flo=min(min(lf),min(rf))
    print(f"SURV {os.path.basename(f)} frames={fe-fs+1} dur={(fe-fs)/120:.1f}s hip0={hz[0]-flo:.2f} maxL={max(lf)-flo:.2f} maxR={max(rf)-flo:.2f} hipmax={max(hz)-flo:.2f} ratioL={(max(lf)-flo)/(hz[0]-flo):.2f} ratioR={(max(rf)-flo)/(hz[0]-flo):.2f}")
