from mk_loop import *
def insects(x):
    x=hp(x,1500,4); x=deharsh(x,-4); x=lp(x,5000,4)
    return reverb(x,wet_db=-8,rt=1.5,lpf=2800,pre=0.05)
make_loop('amb_meadow_insects_loop','src/cricketsounds090613.wav',9.0,19.25,1.0,insects,-30.0,kbps=24,sr_out=24000,ch=1,lin=True)
def sea(x):
    x=hp(x,55,2); x=lp(x,2400,4); x=eq(x,'lshelf',180,2.0)
    return reverb(x,wet_db=-18,rt=2.2,lpf=1800,pre=0.05)
make_loop('amb_sea_open_loop','src/VistulaShort_0.mp3',37.5,24.0,3.0,sea,-23.0)
