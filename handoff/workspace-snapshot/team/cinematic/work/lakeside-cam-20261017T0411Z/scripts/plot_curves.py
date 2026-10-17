import json,sys
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
c=json.load(open(sys.argv[1]));fig,ax=plt.subplots(4,1,figsize=(11,11),sharex=True)
for k,col in (('fallback','#d0573a'),('new','#2a7ab8')):
    r=c['variants'][k]['rows'];t=[x['t'] for x in r]
    ax[0].plot(t,[x['camV'] for x in r],col,lw=1.4,label=k);ax[1].plot(t,[x['camA'] for x in r],col,lw=1.2,label=k);ax[2].plot(t,[x['camJ'] for x in r],col,lw=1.0,label=k);ax[3].plot(t,[x['turnDegS'] for x in r],col,lw=1.2,label=k)
r=c['variants']['new']['rows'];ax[0].plot([x['t'] for x in r],[x['herV'] for x in r],'#555',lw=.8,ls='--',label='her (walk driver)')
ax[0].set_ylabel('lens speed m/s');ax[1].set_ylabel('|accel| m/s²');ax[2].set_ylabel('|jerk| m/s³');ax[3].set_ylabel('view turn °/s');ax[3].set_xlabel('t (s), lakeside journey, her distance = journeyDistanceAt (17 s S-curve), 60 Hz')
ax[1].set_yscale('symlog',linthresh=1);ax[2].set_yscale('symlog',linthresh=5)
for a in ax:a.grid(alpha=.3);a.legend(loc='upper left',fontsize=8)
sn=c['variants']['new']['summary'];sf=c['variants']['fallback']['summary']
fig.suptitle('Lakeside lens ('+(sys.argv[3] if len(sys.argv)>3 else '?')+', 17 s timed walk): new peak |a| %.2f m/s², |j| %.2f m/s³ (after 0.6 s set-off fade) vs fallback %.1f / %.0f'%(sn['peakCamA']['camA'],sn['peakCamJ']['camJ'],sf['peakCamA']['camA'],sf['peakCamJ']['camJ']))
plt.tight_layout();plt.savefig(sys.argv[2],dpi=110)
