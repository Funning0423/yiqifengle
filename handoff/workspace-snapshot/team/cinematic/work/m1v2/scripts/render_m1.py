"""M1 close-ups: args  clip:frame:label,...  outdir. Views: right side (her anatomical right), front 3/4, back 3/4, close-up hips/seat.
Props (side table etc.) and room shell hidden so the chair contact is visible; real chair stays."""
import bpy, sys
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2/scripts')
import render_lib as RL, clips
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1v2/scene/cine_m1_anim.blend')
args=sys.argv[sys.argv.index('--')+1:]; items=[x.split(':') for x in args[0].split(',')]; O=args[1].rstrip('/')+'/'
RL.setup((600,760))
H=['env_interior_shell','env_interior_glass','ENV_props_merged_minus_chair','env_cat','CHAIR_VARIANT_arms_NOT_IN_GAME']
a=bpy.data.objects['R5G2_RIG_22P4']
for clip,f,label in items:
    clips.activate(clip); f=int(f); bpy.context.scene.frame_set(f)
    rm=a.matrix_world@a.pose.bones['root'].matrix; yaw=rm.to_euler().z; pos=rm.to_translation()
    R=Matrix.Rotation(yaw,3,'Z'); fwd=R@Vector((0,-1,0)); right=R@Vector((-1,0,0))
    hip=a.matrix_world@a.pose.bones['hips'].matrix.to_translation()
    c=Vector((hip.x,hip.y,0.78))
    views={'right':RL.cam('V1',c+right*2.6+Vector((0,0,0.15)),c,ortho=1.9),
           'front34':RL.cam('V2',c+(fwd*2.2+right*1.2)+Vector((0,0,0.5)),c,ortho=1.9),
           'back34':RL.cam('V3',c+(-fwd*2.0+right*1.2)+Vector((0,0,0.6)),c,ortho=1.9),
           'closeup':RL.cam('V4',hip+(fwd*1.0+right*1.1)+Vector((0,0,0.25)),hip+Vector((0,0,-0.08)),ortho=0.75)}
    for v,cm in views.items(): RL.shoot(cm,O+'%s_%s_f%03d_%s.png'%(label,clip,f,v),hide=H)
print('DONE')
