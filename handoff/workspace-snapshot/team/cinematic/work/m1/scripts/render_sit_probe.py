import bpy, sys, numpy as np, math
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1/scripts')
import poselib as P, render_lib as RL
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1/scene/cine_m1_base.blend')
off=float(sys.argv[sys.argv.index('--')+1])
SEAT=Vector((0.4203,4.2133,0.0)); R=Matrix.Rotation(-2.0,4,'Z')
P.reset(); P.apply_list(P.SIT); P.set_sk(1)
org=SEAT-(R@Vector((0,off,0)))+Vector((0,0,-0.0255)); pb=P.arm().pose.bones['root']; pb.matrix=Matrix.Translation(org)@R@pb.matrix; P.upd()
RL.setup((800,800))
fwd=R@Vector((0,-1,0)); right=R@Vector((-1,0,0))
c=SEAT+Vector((0,0,0.55))
O='/workspace/wechat-game/team/cinematic/work/m1/probe/'
H=['env_interior_shell','ENV_props_merged_minus_chair','env_interior_glass']
RL.shoot(RL.cam('C1',c+right*1.6+Vector((0,0,0.1)),c,ortho=1.3),O+'sit_side_right_off%s.png'%off,hide=H)
RL.shoot(RL.cam('C2',c-fwd*1.4+right*0.5+Vector((0,0,0.6)),c,ortho=1.3),O+'sit_back_off%s.png'%off,hide=H)
RL.shoot(RL.cam('C3',c+fwd*1.6+right*0.4+Vector((0,0,0.3)),c,ortho=1.3),O+'sit_front_off%s.png'%off,hide=H)
