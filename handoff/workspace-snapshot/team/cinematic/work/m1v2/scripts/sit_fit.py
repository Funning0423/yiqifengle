import bpy, sys, json, numpy as np, math
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2/scripts')
import poselib as P, checker as C
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1v2/scene/cine_m1_base.blend')
ch=bpy.data.objects['CHAIR_REAL_reading_chair']; cl=np.array([v.co[:] for v in ch.data.vertices])
hi=cl[cl[:,2]>0.45]; print('BACKREST front local y (min y of verts z>0.45)',hi[:,1].min(), 'x range',hi[:,0].min(),hi[:,0].max())
for zz in (0.42,0.5,0.6,0.7,0.8):
    s=cl[(np.abs(cl[:,2]-zz)<0.06)]; print(' z~',zz,'min y',round(s[:,1].min(),4) if len(s) else None)
SEAT=Vector((0.4203,4.2133,0.0)); YAW=-2.0
def place(off,dz):
    P.reset(); P.apply_list(P.SIT); P.set_sk(1)
    a=P.arm(); R=Matrix.Rotation(YAW,4,'Z'); org=SEAT-(R@Vector((0,off,0)))+Vector((0,0,dz))
    Wm=Matrix.Translation(org)@R; pb=a.pose.bones['root']; P.upd(); pb.matrix=Wm@pb.matrix; P.upd()
    return Wm
ck=C.Checker()
bc,_=ck.ev(C.BODY); 
for off in (-0.10,-0.08,-0.06):
    for dz in (-0.0255,):
        Wm=place(off,dz)
        bc,_=ck.ev(C.BODY); Wi=np.array(Wm.inverted())
        loc=bc@Wi[:3,:3].T+Wi[:3,3]
        tor=np.unique(C.np.array(ck.T[ck.parts['torso']]).ravel())
        print('OFF',off,'torso back-most y char',round(loc[tor,1].max(),4),'=> rel seat centre',round(loc[tor,1].max()-off,4))
        R=ck.run(garments_midsurface_too=False)
        bad={k:v for k,v in R.items() if (v.get('tri_pairs',0) or v.get('verts_inside',0) or v.get('verts_below',0)) and 'ctrl' not in k}
        print('  NONZERO',json.dumps(bad))
