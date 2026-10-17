import sys;sys.path.insert(0,'fixes-511953e/logs');from aud import *
import numpy as np
R=[('a4a1041 normal(A1c ref)','fixes-a4a1041','ib_day_390',19.081,7440),('1bf0bfa normal','fixes-1bf0bfa','ib_day_390',19.015,7419),('1bf0bfa vis3000 re-exit','fixes-1bf0bfa','ib_day_390_vis3000',27.318,7391),('1bf0bfa vis18000 re-exit','fixes-1bf0bfa','ib_day_390_vis18000',42.263,7363),
   ('511953e normal','fixes-511953e','ib_day_390',19.03,7378),('511953e vis3000 re-exit','fixes-511953e','ib_day_390_vis3000',27.24,7347),('511953e vis18000 re-exit','fixes-511953e','ib_day_390_vis18000',42.403,7500),('511953e night normal','fixes-511953e','ib_night_390',19.196,7556)]
for lab,d,f,co,fm in R:
  a,sr=load(f'{d}/audio/{f}.wav');off=fm/1000-first(a,sr)
  L=lambda t0,t1:db(a,sr,t0-off,t1-off)
  ind=L(co-8,co-2);out=L(co+7,co+14);amb=10*np.log10(max(10**(out/10)-10**(ind/10),1e-12))
  print('%-26s indoor %.1f  outdoor %.1f  ambience %.1f  amb-BGM %+.1f dB'%(lab,ind,out,amb,amb-ind))
