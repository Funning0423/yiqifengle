from mk_shot import *
def bird(x):
    x=hp(x,1200,4); x=deharsh(x,-3.5); x=lp(x,6500,4)
    return reverb(x,wet_db=-7,rt=1.5,lpf=3000,pre=0.04)
for i,(ss,t) in enumerate([(9.3,2.0),(12.3,1.9),(19.72,1.8)],1):
    make_shot(f'sfx_meadow_bird_{i}','src/birds-isaiah658_0.ogg',ss,t,bird,-27.0,tail=1.2)
def creak(x):
    x=hp(x,110,2); x=lp(x,3200,4); x=deharsh(x,-3)
    return reverb(x,wet_db=-9,rt=1.3,lpf=2400,pre=0.03)
make_shot('sfx_windmill_creak_1','src/tree_creak.flac',3.55,1.8,creak,-28.0,tail=1.0,fi=0.08,fo=0.7,rate=0.72)
make_shot('sfx_windmill_creak_2','src/tree_creak.flac',3.55,1.8,creak,-29.0,tail=1.0,fi=0.08,fo=0.7,rate=0.60)
