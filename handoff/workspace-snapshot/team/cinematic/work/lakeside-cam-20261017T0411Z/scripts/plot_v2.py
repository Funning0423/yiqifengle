import json,sys,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
r=json.load(open(sys.argv[1]));tag=sys.argv[2];out=sys.argv[3]
fig,ax=plt.subplots(2,2,figsize=(13,8))
for k,c in [('390x844','tab:blue'),('390x520','tab:red')]:
  R=r['runs'][k]
  for m,ls in [('constant','-'),('timed','--')]:
    F=[f for f in R['tail'][m] if f['t']>=-3.0001];t=[f['t'] for f in F]
    ax[0][0].plot(t,[f['fov'] for f in F],ls,color=c,label=f'{k} {m} walk');ax[0][1].plot(t,[f['angVelDegS'] for f in F],ls,color=c,label=f'{k} {m}')
  HF=R['hook'];t=[f['t'] for f in HF]
  ax[1][0].plot(t,[f['fov'] for f in HF],color=c,label=k);ax[1][1].plot(t,[f['angVelDegS'] for f in HF],color=c,label=k)
for a,tt in zip(sum(ax.tolist(),[]),['last 3 s of the walk: FOV (deg), t=0 she stops','last 3 s: turn rate (deg/s)','1 s hook: FOV (deg)','1 s hook: turn rate (deg/s)']):a.set_title(tt);a.grid(alpha=.3);a.legend(fontsize=7);a.set_xlabel('s')
fig.suptitle(f'lakeside landing (per-screen) + hook, 60 Hz, {tag}');fig.tight_layout();fig.savefig(out,dpi=110)
