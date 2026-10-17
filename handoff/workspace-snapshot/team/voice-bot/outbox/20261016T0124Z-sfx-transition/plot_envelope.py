import numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
x=np.fromfile('/tmp/d.raw',np.float32); sr=44100; t=np.arange(len(x))/sr
w=int(sr/30); rms=np.sqrt(np.convolve(x**2,np.ones(w)/w,'same')); db=20*np.log10(rms+1e-9)
fig,(a,b)=plt.subplots(2,1,figsize=(12,6),sharex=True)
a.plot(t,x,lw=.3,color='#467'); a.set_ylabel('amplitude'); a.set_ylim(-1,1)
b.plot(t,db,color='#c63'); b.set_ylabel('RMS dBFS (1-frame win)'); b.set_ylim(-60,0); b.set_xlabel('s (30 fps frames marked)')
L={0:'sail',66:'cloud in',78:'full cover',81:'swap',84:'dissolve',96:'reveal end',156:'end'}
for k,v in L.items():
    for ax in (a,b): ax.axvline(k/30,color='k',ls='--',lw=.8)
    a.text(k/30,0.92,f' f{k} {v}',fontsize=8,rotation=90,va='top')
b.axvspan(78/30,84/30,color='orange',alpha=.2)
fig.suptitle('sfx_transition_island_to_meadow.mp3 (self-made original) 5.200 s')
plt.tight_layout(); plt.savefig('envelope_frames.png',dpi=110)
