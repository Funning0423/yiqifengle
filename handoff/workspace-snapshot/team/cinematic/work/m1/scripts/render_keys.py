import bpy, sys, math
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1/scripts')
import render_lib as RL, clips
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1/scene/cine_m1_anim.blend')
args=sys.argv[sys.argv.index('--')+1:]; clip=args[0]; frames=[int(x) for x in args[1].split(',')]; tag=args[2]
views=args[3].split(',') if len(args)>3 else ['side','front']
clips.activate(clip); RL.setup((640,720))
R=Matrix.Rotation(-2.0,3,'Z'); fwd=R@Vector((0,-1,0)); right=R@Vector((-1,0,0))
c=Vector((0.25,4.33,0.75))
H=['env_interior_shell','env_interior_glass']
cams={'side':RL.cam('CS',c+right*2.4+Vector((0,0,0.2)),c,ortho=2.0),'front':RL.cam('CF',c+fwd*2.4+right*0.8+Vector((0,0,0.4)),c,ortho=2.0),
 'back':RL.cam('CB',c-fwd*2.2+right*0.6+Vector((0,0,0.6)),c,ortho=2.0),'left':RL.cam('CL',c-right*2.4+Vector((0,0,0.2)),c,ortho=2.0)}
O='/workspace/wechat-game/team/cinematic/work/m1/probe/keys/'
for f in frames:
    bpy.context.scene.frame_set(f)
    for v in views: RL.shoot(cams[v],O+'%s_%s_f%03d_%s.png'%(tag,clip,f,v),hide=H)
