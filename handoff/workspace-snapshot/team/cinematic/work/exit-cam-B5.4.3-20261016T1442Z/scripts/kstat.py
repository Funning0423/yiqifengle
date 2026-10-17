import json,numpy as np,sys
from kin import kin
def sm(P):
  w=np.array([1,8,28,56,70,56,28,8,1],float);w/=w.sum();Q=np.pad(P,((4,4),(0,0)),mode='edge');return np.stack([np.convolve(Q[:,i],w,'valid') for i in range(3)],1)
for fn in sys.argv[1:]:
  k=kin(fn);t=k['t'];tc=2.5409;m=t>=tc+.3;sp=np.linalg.norm(k['V'],axis=1)
  V=np.gradient(sm(k['P']),t,axis=0);A=np.gradient(V,t,axis=0);J=np.gradient(A,t,axis=0);a=np.linalg.norm(A,axis=1);j=np.linalg.norm(J,axis=1)
  med=np.array([np.median(j[max(0,i-15):i+16]) for i in range(len(j))]);kk=np.where(m&(j>3*med)&(j>5))[0]
  w=(t>6)&(t<9.5)
  print(json.dumps(dict(f=fn,T=round(float(t[-1]),2),peak=round(float(sp[t>=tc].max()),3),peakT=round(float(t[t>=tc][np.argmax(sp[t>=tc])]),2),maxA=round(float(a[m].max()),2),maxJ=round(float(j[m].max()),2),kinks=len(kk),kinkT=[round(float(t[i]),2) for i in kk[:6]],J6to9=round(float(j[w].max()),2),A6to9=round(float(a[w].max()),2))))
