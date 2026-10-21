import bpy,sys
f=sys.argv[-1]
bpy.ops.import_anim.bvh(filepath=f,global_scale=1.0,axis_forward='-Z',axis_up='Y',update_scene_fps=False)
a=bpy.context.object;sc=bpy.context.scene;pb=a.pose.bones
fe=int(a.animation_data.action.frame_range[1])
for fr in range(1,fe+1,12):
    sc.frame_set(fr);g=lambda n:a.matrix_world@pb[n].head
    h=g('Hips');l=g('LeftToeBase');r=g('RightToeBase');hd=g('Head');lh=g('LeftHand');rh=g('RightHand')
    print(f"TL {fr/120:5.2f} hip({h.x:6.1f},{h.y:6.1f},{h.z:5.1f}) L({l.x:6.1f},{l.y:6.1f},{l.z:5.1f}) R({r.x:6.1f},{r.y:6.1f},{r.z:5.1f}) hands z {lh.z:5.1f} {rh.z:5.1f}")
