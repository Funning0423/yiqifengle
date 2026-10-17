import sys,json;sys.path.insert(0,'.')
from opt_land import *
v=json.load(open('opt_s0.7.json'))
for k in (0.70,0.72,0.75,0.78):
  vv=list(v);vv[1]=k;img=emu.shade(Gs,P_of(vv))
  print(k,{kk:round(lum(np.array(regions.med(img,regions.R[kk]),float))/lum(TG[kk]),3) for kk in LK})
