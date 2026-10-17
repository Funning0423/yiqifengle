import json,sys,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
r=json.load(open(sys.argv[1]));sha=sys.argv[2];runs=r['runs']
fig,ax=plt.subplots(2,2,figsize=(12,8))
for k,v in runs.items():
  F=v['perFrame'];t=[f['t'] for f in F]
  ax[0][0].plot(t,[f['angVelDegS'] for f in F],label=k);ax[0][1].plot(t,[f['fov'] for f in F],label=k)
  ax[1][0].plot(t,[f['angFromStartDeg'] for f in F],label=k);ax[1][1].plot(t,[f['dispM'] for f in F],label=k)
for a,tt in zip(sum(ax.tolist(),[]),['turn rate deg/s','FOV deg','view angle from landing deg','displacement m (≈0: same position)']):a.set_title(tt);a.legend(fontsize=7);a.grid(alpha=.3);a.set_xlabel('s')
fig.suptitle(f'landing→board hook per frame (60 Hz, {sha})');fig.tight_layout();fig.savefig(sys.argv[3],dpi=110)
g={k:{'gap':v['gap'],'frames':v['frames'],'peakTurnDegS':v['peakTurnDegS'],'peakFovRateDegS':v['peakFovRateDegS']} for k,v in runs.items()};json.dump(g,open(sys.argv[4],'w'),indent=1);print(json.dumps(g))
