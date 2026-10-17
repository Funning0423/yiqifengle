import sys,numpy as np
import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from zones_r3 import *
def lab(c):
  c=np.array(c)/255.;c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92)
  M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]]);x,y,z=M@c/np.array([0.95047,1,1.08883])
  f=lambda t:t**(1/3) if t>0.008856 else 7.787*t+16/116
  return np.array([116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))])
if __name__=='__main__':
  pts=dict(B10);pts['bridge_rail']=BX['bridge_rail'];tg=dict(T10);tg['bridge_rail']=TX['bridge_rail']
  for p in sys.argv[1:]:
    a=load(p);print('==',p.split('/')[-1],'stripe std',stripe(a))
    ok=0
    for n,b in pts.items():
      m=med(a,b);t=tg[n];dm=max(abs(x-y) for x,y in zip(m,t));de=float(np.linalg.norm(lab(m)-lab(t)));ok+=dm<=12
      print('  %-18s 实测 %3d/%3d/%3d 参考 %3d/%3d/%3d RGB最大差 %3d ΔE76 %5.1f %s'%(n,*m,*t,dm,de,'OK' if dm<=12 else 'FAIL'))
    print('  pass %d/10'%ok)
    annotate(p,p.replace('.png','_zones.png'))
