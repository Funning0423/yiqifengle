import sys,json,numpy as np,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
from kin import kin
exec(open('stats3.py').read().split('out={}')[0].split('from kin import kin')[1])
R=[('B4','frames_B4.json','tab:red'),('B5','frames_B5orig.json','tab:blue'),('B5.1','frames_B51.json','tab:green')]
fig,ax=plt.subplots(3,1,figsize=(12,13))
for n,fn,c in R:
  k=kin(fn);t=k['t'];Ps=sm(k['P']);V=np.gradient(Ps,t,axis=0);A=np.gradient(V,t,axis=0);J=np.gradient(A,t,axis=0)
  ax[0].plot(t,np.linalg.norm(k['V'],axis=1),c,label=n);ax[1].plot(t,np.linalg.norm(A,axis=1),c,label=n);ax[2].plot(t,np.linalg.norm(J,axis=1),c,label=n)
for a,l,lim in ((ax[0],'speed |v| (m/s), raw',4),(ax[1],'accel |a| (m/s²), 9-tap binomial smoothed',4),(ax[2],'jerk |j| (m/s³), 9-tap smoothed',40)):
  a.axhline(lim,color='k',ls='--',lw=.8,label=f'test cap {lim}');a.axvline(2.5409,color='gray',ls=':');a.set_title(l);a.grid(alpha=.3);a.legend();a.set_xlabel('t since crossing-out start (s)')
ax[1].set_ylim(0,12);ax[2].set_ylim(0,80)
fig.suptitle('Exit camera B4 / B5 / B5.1 (flow_sim 60 fps; dotted = doorway key). B4 peaks off-scale: a 52, j 657');fig.tight_layout();fig.savefig(sys.argv[1],dpi=90)
