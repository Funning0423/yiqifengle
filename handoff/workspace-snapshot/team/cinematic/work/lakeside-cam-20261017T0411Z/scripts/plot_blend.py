# Landing -> board blend (lakesideLandingBlend) per-frame plots at 60 Hz, joined to the last 1 s of the journey lens
# (curves_new_vs_fallback.json) so the seam at the stop is visible. usage: plot_blend.py lakeside-camera.json curves.json out.png sha
import json,sys
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
r=json.load(open(sys.argv[1]));k8=[x for x in r['results'] if x['id'].startswith('K8')][0];c=json.load(open(sys.argv[2]))
rows=c['variants']['new']['rows'];D=c['variants']['new']['summary']['durationS'];pre=[x for x in rows if D-1-1e-9<=x['t']<=D+1e-9]
fig,ax=plt.subplots(4,1,figsize=(10,11),sharex=True);cols={'360x780':'#2a7ab8','390x520':'#d0573a'}
ax[0].plot([x['t']-D for x in pre],[x['camV'] for x in pre],'#555',lw=1.2,label='journey lens (last 1 s)');ax[1].plot([x['t']-D for x in pre],[x['turnDegS'] for x in pre],'#555',lw=1.2,label='journey lens (last 1 s)')
for sz,b in k8['blends'].items():
  F=b['perFrame'];t=[f['t'] for f in F];col=cols.get(sz,'k')
  ax[0].plot(t,[f['speedMps'] for f in F],col,lw=1.4,label=f'blend {sz} lens speed (move {b["moveM"]} m)')
  ax[1].plot(t,[f['angVelDegS'] for f in F],col,lw=1.4,marker='.',ms=3,label=f'blend {sz} turn rate (total {b["turnDeg"]}°, peak {b["peakTurnDegS"]}°/s)')
  ax[2].plot(t,[f['angFromStartDeg'] for f in F],col,lw=1.4,label=f'{sz} view angle from landing view (°)');ax[2].plot(t,[f['dispM'] for f in F],col,lw=1,ls='--',label=f'{sz} displacement from landing pos (m)')
  ax[3].plot(t,[f['fov'] for f in F],col,lw=1.4,label=f'{sz} FOV {b["from"]["fov"]}→{b["to"]["fov"]}°');ax3=ax[3]
for a in ax:a.axvline(0,color='#999',lw=.8,ls=':');a.axvline(1,color='#999',lw=.8,ls=':');a.grid(alpha=.3);a.legend(loc='upper left',fontsize=8)
ax[0].set_ylabel('lens speed m/s');ax[1].set_ylabel('view turn °/s (per 1/60 s frame)');ax[2].set_ylabel('progress');ax[3].set_ylabel('FOV °');ax[3].set_xlabel('t (s) after she stops (0 = landing end, 1 = board camera), 60 Hz frames')
fig.suptitle('Lakeside landing → board blend (%s): one smootherstep for position / view slerp / FOV; rates 0 at both ends, monotonic, no overshoot'%sys.argv[4],fontsize=10)
plt.tight_layout();plt.savefig(sys.argv[3],dpi=110);print('ok')
