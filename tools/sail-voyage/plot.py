# NOT_ENGINE before/after per beat on the option-E scene (CPU z-buffer, not renders). Bands: dock 2–4 %, approach 30–40 %.
import json,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
B=json.load(open('reports/sail-voyage-before.json'));A=json.load(open('reports/sail-voyage.json'))
fig,axs=plt.subplots(2,1,figsize=(10,7),sharex=True,sharey=True)
for ax,(lab,d) in zip(axs,[('BEFORE sailCamera (approved) on scene E',B),('AFTER SailVoyage on scene E',A)]):
  for k,s in d['screens'].items():ax.plot([x[0] for x in s['series']],[x[1] for x in s['series']],lw=1,label=k)
  ax.axhspan(0.30,0.40,color='g',alpha=.08);ax.axhspan(0.02,0.04,color='b',alpha=.08);ax.axvline(17.4,ls=':',c='r');ax.text(17.5,0.5,'swap 17.4 s',color='r',fontsize=7)
  for t,n in [(9.6,'S-c'),(11.6,'S-d'),(19.82,'S-e'),(22.02,'S-f')]:ax.axvline(t,c='k',lw=.4);ax.text(t+.1,0.6,n,fontsize=7)
  ax.set_title('NOT_ENGINE  '+lab,fontsize=9);ax.set_ylabel('meadow/stand-in height share')
axs[0].legend(fontsize=6,ncol=4);axs[1].set_xlabel('Build05 t (s)');plt.tight_layout();plt.savefig('reports/sail-voyage-before-after.png',dpi=90)
