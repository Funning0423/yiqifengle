import numpy as np
def l2s8(c): 
    c=np.clip(np.asarray(c,float),0,1); return tuple(int(round(255*(x*12.92 if x<=0.0031308 else 1.055*x**(1/2.4)-0.055))) for x in c)
SUN_F=[-0.4182,-0.3983,0.8164]
CAM=[0,13.2,26.5]
WATER_V32=dict(tint=[0.9,1,1],zenith=[0.0116,0.2747,0.4793],low=[0.9216,0.5776,0.2705],horizon=[1.0,0.5457,0.1441],F0=0.02,power=5,fmax=0.85,sky_strength=1.0,floor=0.25,spec_exp=300,spec_int=1.6)
FOG=dict(mode='layered',top=1.5,range=30,atten=17,color=(215,170,150))
V32=dict(sun_forward=SUN_F,cam=CAM,sun_illum=125000,sun_color_byte=l2s8([1,.6,.32]),amb_illum=125000*0.75,sky_byte=l2s8([0.0116,0.2747,0.4793]),ground_byte=l2s8([1.0,0.5457,0.1441]),water=WATER_V32,fog=FOG,clear_byte=l2s8([0.0116,0.2747,0.4793]))
