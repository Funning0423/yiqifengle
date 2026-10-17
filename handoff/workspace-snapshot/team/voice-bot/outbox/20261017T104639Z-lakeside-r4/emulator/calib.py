import sys;sys.path.insert(0,'.');from r4p import *;from boxes import *;from PIL import Image
M='/workspace/wechat-game/ui-audit/2026-10-17/next-r3-f3d3614/r3/raw/lk_%s_bgonly_360.png'
MAC={md:np.asarray(Image.open(M%md).convert('RGB')).astype(float) for md in ('day','night')}
WN=['far_water','mid_water','mid_water_R','under_bridge','near_mid_water','near_water_bottom','near_water_L']
def err(V,mod=lambda P:P,verbose=False,pts=WN):
  tot=[]
  for md in ('day','night'):
    P=mod(P_of(V,md));em=emu.shade(gb('360x640'),P).astype(float)
    for n in pts:
      d=np.abs(smed(MAC[md],B[n])-smed(em,B[n]));tot.append(d.max())
      if verbose: print(md,n,smed(MAC[md],B[n]).astype(int),smed(em,B[n]).astype(int),int(d.max()))
  return np.mean(tot),np.max(tot)
def r3mode(P,t):
  P['water']['t']=t
  for k in ('horizon','low','zenith','tint'): P['water'][k]=list(np.square(P['water'][k]))   # Cocos 3.8.8 Material._uploadProperty: linear:true props get SRGBToLinear (x*x)
  return P
def per_mode(md,t,V=None,decode=True):
  V=V or R3;P=P_of(V,md);P=r3mode(P,t) if decode else (P['water'].update(t=t),P)[1];em=emu.shade(gb('360x640'),P).astype(float)
  return {n:(smed(MAC[md],B[n]),smed(em,B[n])) for n in B},stripe(MAC[md]),stripe(em),em
