from mk_loop import *
def chain(x):
    x=hp(x,70,2); x=deharsh(x,-3); x=lp(x,9000,2)
    return reverb(x,wet_db=-16,rt=1.8,lpf=3000,pre=0.04)
make_loop('amb_island_shore_loop','src/VistulaShort_0.mp3',200.5,24.0,3.0,chain,-22.0)
