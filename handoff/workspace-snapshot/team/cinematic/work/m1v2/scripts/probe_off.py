import bpy, sys, numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2/scripts')
import poselib as P, checker as C
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1v2/scene/cine_m1_base.blend')
ck=C.Checker()
P.reset(); rest,_=ck.ev(C.BODY)
P.apply_list(P.SIT); P.set_sk(1)
bc,_=ck.ev(C.BODY); hc,ht=ck.ev(C.HAIR); dc,dt=ck.ev(C.DRESS); ac,at=ck.ev(C.APRON)
u=ck.used
tails=u&(ck.dom=='hips')&(rest[:,2]<0.97)&(rest[:,1]>0.09)
print('TAILS n',tails.sum(),'rest z',rest[tails,2].min(),rest[tails,2].max(),'rest y',rest[tails,1].min())
np.save('probe/bow_tail_vidx.npy',np.where(tails)[0])
# rel-y of back-most points by height band (char frame; seat placed lower by 0.0255 later)
for nm,co,m in [('body_no_tails',bc,u&~tails),('hair',hc,np.ones(len(hc),bool)),('dress',dc,np.ones(len(dc),bool)),('apron',ac,np.ones(len(ac),bool))]:
    for lo,hi in [(0.40,0.55),(0.55,0.80),(0.80,0.92),(0.92,1.2)]:
        s=m&(co[:,2]-0.0255>lo)&(co[:,2]-0.0255<hi)
        if s.any(): print('BACK',nm,lo,hi,'max y',round(co[s,1].max(),4),'x at max',round(co[s][co[s,1].argmax(),0],3))
