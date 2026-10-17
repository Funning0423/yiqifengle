import sys,json,numpy as np,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
from kin import kin
A=kin('frames_B4.json');B=kin('frames_B5.json');tcB=float(sys.argv[1]) if len(sys.argv)>1 else 2.54
fig,ax=plt.subplots(4,2,figsize=(14,15))
def pl(a,k,lab,f):
  for K,c,n in ((A,'tab:red','B4'),(B,'tab:blue','B5')): a.plot(K['t'],f(K),c,label=n)
  a.set_title(lab);a.grid(alpha=.3);a.legend();a.set_xlabel('t since crossing-out start (s)')
pl(ax[0,0],0,'horizontal position x,z (m) [solid x, dashed z]',lambda K:K['P'][:,0]);
for K,c in ((A,'tab:red'),(B,'tab:blue')): ax[0,0].plot(K['t'],K['P'][:,2],c,ls='--')
pl(ax[0,1],0,'height y (m)',lambda K:K['P'][:,1])
pl(ax[1,0],0,'speed |v| (m/s)',lambda K:np.linalg.norm(K['V'],axis=1))
pl(ax[1,1],0,'vertical speed vy (m/s)',lambda K:K['V'][:,1])
pl(ax[2,0],0,'acceleration |a| (m/s²)',lambda K:np.linalg.norm(K['A'],axis=1))
pl(ax[2,1],0,'vertical accel ay (m/s²)',lambda K:K['A'][:,1])
pl(ax[3,0],0,'jerk |j| (m/s³)',lambda K:np.linalg.norm(K['J'],axis=1))
pl(ax[3,1],0,'horizontal speed (m/s)',lambda K:np.hypot(K['V'][:,0],K['V'][:,2]))
for a in ax.flat: a.axvline(tcB,color='gray',ls=':')
fig.suptitle('Exit camera B4 (red) vs B5 (blue) — flow_sim 60 fps, raw finite differences; dotted = doorway key (B5 starts)')
fig.tight_layout();fig.savefig(sys.argv[2] if len(sys.argv)>2 else 'curves.png',dpi=90)
