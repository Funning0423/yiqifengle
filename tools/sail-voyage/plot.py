# NOT_ENGINE before/after plots (CPU z-buffer geometry, not renders)
import json,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
d=json.load(open('reports/sail-voyage.json'))
runs=[d['before']]+d['after']
fig,axs=plt.subplots(len(runs),1,figsize=(9,3*len(runs)),sharey=True)
for ax,r in zip(axs,runs):
  for k,s in r['screens'].items():
    t=[x[0] for x in s['series']];h=[x[1] for x in s['series']];ax.plot(t,h,label=k,lw=1)
  ax.axhline(0.03,ls=':',c='k');ax.axhline(0.35,ls='--',c='gray')
  ax.set_title(f"NOT_ENGINE  {r['scenario']} / {r['camera']}  sail {r['sailS']}s  whole {r['wholeS']}s  v {r['speedMps']}m/s",fontsize=9)
  ax.set_ylabel('meadow height share')
axs[0].legend(fontsize=6,ncol=4);axs[-1].set_xlabel('sail clock t (s)  [S-c start → S-g end]')
plt.tight_layout();plt.savefig('reports/sail-voyage-before-after.png',dpi=90)
