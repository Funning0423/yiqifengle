"""Preview video frames from the delivered .blend: cine_open_stand f0-90 then cine_open_turn f1-45 (136 frames, 30 fps), two fixed views."""
import bpy, sys, os
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts')
import render_lib as RL, clips
from mathutils import Vector, Matrix
blend,out=sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.open_mainfile(filepath=blend); os.makedirs(out,exist_ok=True)
RL.setup((540,720)); sc=bpy.context.scene; sc.render.resolution_percentage=100
H=['env_interior_shell','env_interior_glass','ENV_props_merged_minus_chair','env_cat','CHAIR_VARIANT_arms_NOT_IN_GAME']
for n in H:
    o=bpy.data.objects.get(n)
    if o: o.hide_render=True
R=Matrix.Rotation(-2.0,3,'Z'); fwd=R@Vector((0,-1,0)); right=R@Vector((-1,0,0))
c=Vector((0.2,4.32,0.75))
cams={'right34':RL.cam('VR',c+right*2.6+fwd*1.2+Vector((0,0,0.5)),c,lens=40),'front':RL.cam('VF',c+fwd*3.0+Vector((0,0,0.6)),c,lens=40)}
seq=[('cine_open_stand',f) for f in range(0,91)]+[('cine_open_turn',f) for f in range(1,46)]
for v,cm in cams.items():
    sc.camera=cm; cur=None
    for i,(clip,f) in enumerate(seq):
        if clip!=cur: clips.activate(clip); cur=clip
        sc.frame_set(f); sc.render.filepath=f'{out}/{v}_{i:04d}.png'; bpy.ops.render.render(write_still=True)
print('VDONE')
