import json,numpy as np,sys
from kin import kin
def sm(P,n=9):
  w=np.array([1,8,28,56,70,56,28,8,1],float);w/=w.sum();Q=np.pad(P,((4,4),(0,0)),mode='edge');return np.stack([np.convolve(Q[:,i],w,'valid') for i in range(3)],1)
out={}
for n,fn,tc in (('B5.1','frames_B51_keep.json',2.5409),('B5.3','frames_B53.json',2.5409)):
  k=kin(fn);t=k['t'];m=t>=tc;sp=np.linalg.norm(k['V'],axis=1)
  Ps=sm(k['P']);V=np.gradient(Ps,t,axis=0);A=np.gradient(V,t,axis=0);J=np.gradient(A,t,axis=0)
  a=np.linalg.norm(A,axis=1);j=np.linalg.norm(J,axis=1);ar=np.linalg.norm(k['A'],axis=1);jr=np.linalg.norm(k['J'],axis=1)
  m2=m&(t>=tc+.3); w810=(t>=8)&(t<=10)
  # kink = local jerk spike: jerk > 3x its 0.5 s median neighbourhood and > 5 m/s^3
  med=np.array([np.median(j[max(0,i-15):i+16]) for i in range(len(j))]);kinks=[[round(float(t[i]),3),round(float(j[i]),2)] for i in np.where(m2&(j>3*med)&(j>5))[0]]
  out[n]=dict(doorKeyT=tc,exitSeconds=round(float(t[-1]-tc),3),totalT=float(t[-1]),peakSpeed=[round(float(sp[m].max()),3),round(float(t[m][np.argmax(sp[m])]),3)],
   smoothedMaxAccel=round(float(a[m2].max()),3),smoothedMaxJerk=round(float(j[m2].max()),3),rawMaxAccelAfterDoor=round(float(ar[m2].max()),3),rawMaxJerkAfterDoor=round(float(jr[m2].max()),2),
   accel8to10=[round(float(a[w810].min()),3),round(float(a[w810].max()),3)],jerk8to10max=round(float(j[w810].max()),3),kinkFrames=kinks[:20],kinkCount=len(kinks))
print(json.dumps(out,indent=1));json.dump(out,open('kin_summary_B51_B53.json','w'),indent=1)
