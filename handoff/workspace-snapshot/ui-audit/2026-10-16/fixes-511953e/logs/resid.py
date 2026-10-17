import sys;sys.path.insert(0,'logs');from aud import *
import numpy as np
from numpy.fft import rfft,irfft
def seg(d,f,show,off,a0,a1):
  a,sr=load(f'{d}/audio/{f}.wav');ts=show-off;return a[int((ts+a0)*sr):int((ts+a0)*sr)+int((a1-a0)*sr)],sr
for tag,X,R in [('NEW',('.','ib_day_390_vis18000',31.627,0.635),('.','ib_day_390_vis3000',16.455,0.616)),('OLD',('../fixes-1bf0bfa','ib_day_390_vis18000',31.468,0.632),('../fixes-1bf0bfa','ib_day_390_vis3000',16.519,0.628))]:
  x,sr=seg(*X,-0.3,4.3);r,_=seg(*R,-0.3,4.3)
  n=len(x);c=irfft(rfft(x,2*n)*np.conj(rfft(r,2*n)));lag=int(np.argmax(np.abs(c)));lag=lag if lag<n else lag-2*n
  r2=np.roll(r,lag);g=np.dot(x,r2)/np.dot(r2,r2);res=x-g*r2
  print(tag,'lag ms %.1f gain %.3f'%(lag/sr*1000,g))
  out=[];out2=[]
  for k in np.arange(0.3,4.3,0.25):
    i0,i1=int(k*sr),int((k+0.25)*sr);out.append('%5.0f'%(10*np.log10(np.mean(res[i0:i1]**2)+1e-24)));out2.append('%5.0f'%(10*np.log10(np.mean(x[i0:i1]**2)+1e-24)))
  print(tag,'residual',' '.join(out));print(tag,'total   ',' '.join(out2))
print('cols show+0..+3.75 step .25')
