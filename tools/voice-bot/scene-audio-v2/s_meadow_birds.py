from mk_loop import *
def chain(x):
    x=hp(x,900,4); x=deharsh(x,-2.5); x=lp(x,7000,2)
    return reverb(x,wet_db=-16,rt=1.3,lpf=3200,pre=0.035)
make_loop('amb_meadow_birds_loop','src/park_ambience_birds.wav',203.0,30.0,3.0,chain,-26.0)
