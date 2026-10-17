"""Voice Bot r4: lakeside params -> emulator P (Cocos 3.8.8 HDR + ACES, exposure from camera F16 / 1/125 / ISO100)."""
import numpy as np, json, copy, emu
lin255=lambda c:tuple(int(round(min(1,max(0,v))*255)) for v in c)
POSE={k:json.load(open(f'/workspace/wechat-game/work/vb-lakeside-r4/pose_{k}.json')) for k in ('360x640','390x844')}
BASE_ILLUM={'day':125000.0,'night':125000.0*0.35}
# f3d3614 (r3) values = LakesideSceneData.ts on f3d3614
R3=dict(
 sunForward=[-0.4182,-0.3983,0.8164],
 day=dict(sunColorLinear=[1.0,0.6,0.32],sunIlluminanceScale=0.7,ambientSkyColorLinear=[0.0107,0.0656,0.1106],ambientGroundColorLinear=[0.9095,0.83,0.4439],
  ambientSkyIllumToSun=0.49,clear=(28,143,184),fogColorSrgb=(215,170,150),waterMainLightScale=1.37,waterAmbientScale=1.85,waterSkyStrength=0.35,
  waterSkyZenithLinear=[0.0116,0.2747,0.4793],waterSkyLowLinear=[0.9216,0.5776,0.2705],waterSkyHorizonLinear=[1.0,0.5457,0.1441]),
 night=dict(sunColorLinear=[0.36,0.46,0.78],sunIlluminanceScale=0.864,ambientSkyColorLinear=[0.012,0.03,0.09],ambientGroundColorLinear=[0.02,0.022,0.04],
  ambientSkyIllumToSun=1.76,clear=(0x1c,0x27,0x40),fogColorSrgb=(44,54,84),waterMainLightScale=0.8,waterAmbientScale=0.6,waterSkyStrength=0.12,
  waterSkyZenithLinear=[0.0116,0.2747,0.4793],waterSkyLowLinear=[0.9216,0.5776,0.2705],waterSkyHorizonLinear=[1.0,0.5457,0.1441]),
 water=dict(tint=[0.9,1.0,1.0],F0=0.02,power=5,fmax=0.85,floor=0.31,spec_exp=300,spec_int=1.6,waves=True,wave_tilt=0.06,wave_freq=0.9,wave_speed=0.7,wave_fade=(12,35)),
 fog=dict(mode='layered',top=1.5,range=30,atten=17),
 vc_linear=False)   # r3 = double decode (f3d3614); f492dc1 onward = True
def P_of(V,mode='day',pose='360x640',t=0.0):
  m=V[mode]; bi=BASE_ILLUM[mode]
  W=dict(V['water']); W.update(main=m['waterMainLightScale'],amb=m['waterAmbientScale'],sky_strength=m['waterSkyStrength'],
    zenith=m['waterSkyZenithLinear'],low=m['waterSkyLowLinear'],horizon=m['waterSkyHorizonLinear'],vc_linear=V['vc_linear'],t=t)
  if 'waterTintLinear' in m: W['tint']=m['waterTintLinear']
  if 'waterSkyReflectFloor' in m: W['floor']=m['waterSkyReflectFloor']
  F=dict(V['fog']); F['color']=m['fogColorSrgb']
  if 'fog' in m: F.update(m['fog'])
  return dict(sun_forward=V['sunForward'],cam=POSE[pose]['position'],sun_illum=bi*m['sunIlluminanceScale'],sun_color_byte=lin255(m['sunColorLinear']),
    amb_illum=bi*m['ambientSkyIllumToSun'],sky_byte=lin255(m['ambientSkyColorLinear']),ground_byte=lin255(m['ambientGroundColorLinear']),
    water=W,fog=F,clear_byte=m['clear'])
G={}
def gb(pose):
  if pose not in G: G[pose]=emu.load(f'/workspace/wechat-game/work/vb-lakeside-r4/gb_{"640" if pose=="360x640" else "844"}.npz')
  return G[pose]
