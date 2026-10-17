import sys,json;sys.path.insert(0,'.')
import fit_r4b as FB
from r4p import *;from boxes import *;from PIL import Image
lum=lambda c:0.2126*c[0]+0.7152*c[1]+0.0722*c[2];hemi=lambda m:0.5*(lum(m['ambientSkyColorLinear'])+lum(m['ambientGroundColorLinear']))
MAC={md:np.asarray(Image.open('/workspace/wechat-game/ui-audit/2026-10-17/next-r3-f3d3614/r3/raw/lk_%s_bgonly_360.png'%md).convert('RGB')).astype(float) for md in ('day','night')}
def build(x,night_water):
  base=copy.deepcopy(R3);base['vc_linear']=True;V=FB.r4Vz(np.array(x),base);d,n=V['day'],V['night']
  n['sunIlluminanceScale']=0.857*lum(d['sunColorLinear'])*d['sunIlluminanceScale']/lum(n['sunColorLinear'])
  n['ambientSkyIllumToSun']=0.219*hemi(d)*d['ambientSkyIllumToSun']/hemi(n)
  n.update(night_water);return V
def render(V,md,t=None,pose='360x640'):
  ts=[t] if t is not None else [0,1.5,3,4.5]
  return np.median(np.stack([emu.shade(gb(pose),P_of(V,md,pose,t=tt)).astype(float) for tt in ts]),0)
if __name__=='__main__':
  x=json.load(open(sys.argv[1]))['x'];NW=json.load(open(sys.argv[2]))
  V=build(x,NW);im=render(V,'night',5.25);mac=MAC['night']
  print('night sun %.4f amb %.4f'%(V['night']['sunIlluminanceScale'],V['night']['ambientSkyIllumToSun']))
  for nm,b in B.items():
    v=smed(im,b);print('%-18s r4 %s macr3 %s  hue %s'%(nm,np.round(v).astype(int),np.round(smed(mac,b)).astype(int),'ok' if (v[2]>=v[1]-2 and v[1]>v[0]) or nm.startswith('bridge') else 'WARM'))
  print('stripe',round(stripe(im),2),'macr3',round(stripe(mac),2))
  Image.fromarray(im.astype(np.uint8)).save(sys.argv[3] if len(sys.argv)>3 else 'night_r4.png')
