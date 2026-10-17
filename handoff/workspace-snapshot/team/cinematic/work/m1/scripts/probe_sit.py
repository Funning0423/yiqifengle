import bpy, sys, json, numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1/scripts')
import poselib as P
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1/scene/cine_m1_base.blend')
a=P.arm(); P.reset(); 
for n in ['thigh.L','shin.L','foot.L','hips','upper_arm.L','hand.L']: print('REST',n,[round(x,4) for x in P.head(n)],[round(x,4) for x in P.tail(n)])
P.apply_list(P.SIT); P.set_sk(1)
for n in ['root','hips','thigh.L','shin.L','foot.L','foot.R']: print('SIT',n,[round(x,4) for x in P.head(n)],[round(x,4) for x in P.tail(n)])
dg=bpy.context.evaluated_depsgraph_get()
def ev(n,solid=True):
    o=bpy.data.objects[n]
    for m in o.modifiers:
        if m.type=='SOLIDIFY': m.show_viewport=solid
    dg.update(); oe=o.evaluated_get(dg); me=oe.to_mesh()
    co=np.array([o.matrix_world@v.co for v in me.vertices]); oe.to_mesh_clear(); return co
for n in [P.BODY,P.DRESS,P.APRON]:
    co=ev(n)
    # char frame: facing -Y. seat region: |x|<0.25, y in [-0.35,0.15]
    m=(np.abs(co[:,0])<0.25)&(co[:,1]>-0.35)&(co[:,1]<0.15)&(co[:,2]<0.6)&(co[:,2]>0.2)
    print('LOW',n,'minz_seatregion',round(co[m,2].min(),4) if m.any() else None,'minz_all',round(co[:,2].min(),4),'y range',round(co[:,1].min(),3),round(co[:,1].max(),3),'x',round(co[:,0].min(),3),round(co[:,0].max(),3))
