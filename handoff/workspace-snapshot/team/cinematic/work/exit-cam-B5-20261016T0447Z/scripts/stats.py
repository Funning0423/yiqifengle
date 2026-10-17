import json,numpy as np
from kin import kin
out={}
for n,fn,tc in (('B4','frames_B4.json',2.61),('B5','frames_B5.json',2.5409)):
  k=kin(fn);m=k['t']>=tc;sp=np.linalg.norm(k['V'],axis=1);a=np.linalg.norm(k['A'],axis=1);j=np.linalg.norm(k['J'],axis=1)
  y=k['P'][:,1];vy=k['V'][:,1];ay=k['A'][:,1]
  # rise window: vy>0.05 after tc
  idx=np.where(m&(vy>0.05))[0];rise=(float(k['t'][idx[0]]),float(k['t'][idx[-1]])) if len(idx) else None
  i=lambda arr:int(np.argmax(np.where(m,arr,-1)))
  out[n]=dict(doorKeyT=tc,end=float(k['t'][-1]),exitSeconds=float(k['t'][-1]-tc),maxSpeed=[float(sp[m].max()),float(k['t'][i(sp)])],maxAccel=[float(a[m].max()),float(k['t'][i(a)])],maxJerk=[float(j[m].max()),float(k['t'][i(j)])],
    p99Jerk=float(np.percentile(j[m],99)),maxVy=float(vy[m].max()),maxAbsAy=float(np.abs(ay[m]).max()),riseWindow=rise,riseSeconds=(rise[1]-rise[0]) if rise else None,
    wholeRunMaxAccel=float(a.max()),wholeRunMaxJerk=float(j.max()))
print(json.dumps(out,indent=1));json.dump(out,open('kin_summary.json','w'),indent=1)
