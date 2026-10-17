import sys;sys.path.insert(0,'build05-v3-764dcd8')
from sea import fr
import numpy as np
def grey(a):
  top=a[70:420]/255;mx=top.max(2);mn=top.min(2);s=(mx-mn)/(mx+1e-6)
  m=(s<0.16)&(mx>0.45)&(mx<0.85);return round(m.mean()*100,1)
V3='build05-v3-764dcd8/raw/';OLD='build05-journey-a373227-4c30cf7/raw/'
for name,p,t0 in [('old day',OLD+'25_b05_day_p750.webm',59.45),('v3 day',V3+'25_v3_day_p750.webm',62.53),('old night',OLD+'25_b05_night_p750.webm',59.30),('v3 night',V3+'25_v3_night_p750.webm',59.48)]:
  v=[grey(fr(p,t0+dt)) for dt in range(10,30)]
  print(name,'travel+10..29s 上半屏灰色占比%:',v,'max',max(v),'at +%ds'%(10+int(np.argmax(v))))
