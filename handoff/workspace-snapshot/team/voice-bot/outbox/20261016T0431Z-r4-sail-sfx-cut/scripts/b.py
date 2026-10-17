import numpy as np, soundfile as sf, json
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
R='/workspace/wechat-game/ui-audit/2026-10-15/pr56-recordings-r4/wav/'
F=json.load(open('findings.json'))['recordings']
ref,sr=sf.read('ref.wav')
def env(x,w=0.01):
    n=int(sr*w); m=len(x)//n; return 20*np.log10(np.sqrt((x[:m*n].reshape(m,n)**2).mean(1)+1e-12))
E=env(ref); t=np.arange(len(E))*0.01
meta={'22_sail_day_':dict(f='22_sail_day_p750',sting=27.720,hold=30.527,summ=28.59),
 '22_sail_nigh':dict(f='22_sail_night_p750',sting=27.944,hold=30.750,summ=28.76),
 '23_sail_day_':dict(f='23_sail_day_p750',sting=27.775,skip=29.13),
 '23_sail_nigh':dict(f='23_sail_night_p750',sting=27.809,skip=29.16)}
fig,ax=plt.subplots(5,1,figsize=(13,17)); ax[0].plot(t,E);ax[0].axvspan(2.78,2.9,color='r',alpha=.2);ax[0].set_title('source sfx_transition_island_to_meadow.mp3, 10ms RMS (no drop at 2.8-2.9s; smooth decay to 5.2s)');ax[0].set_ylim(-70,0)
out={}
for k,(key,m) in enumerate(meta.items()):
    x,_=sf.read(R+m['f']+'.wav'); Ex=env(x); on=F[key]['onset_wav']
    off=m['sting']-on  # video = wav + off
    tv=np.arange(len(Ex))*0.01+off - m['sting']   # seconds after sting log
    # per-10ms residual: rec minus ref (in dB) to find where ref stops matching
    o=dict(onset_wav=on,implied_wav_to_video_offset=round(off,3),summary_assumed_offset='~0.13-0.19')
    # find first time after 0.5s where rec < ref-6dB for 5 consecutive bins
    i0=int(round(on/0.01)); seg=Ex[i0:i0+len(E)]; diff=seg-E[:len(seg)]
    bad=np.where(np.convolve(diff<-6,np.ones(5),'valid')==5)[0]; bad=bad[bad>50]
    o['sting_leaves_ref_after_s']=round(float(bad[0]*0.01),2) if len(bad) else None
    if 'hold' in m: o['hold_enter_after_sting_s']=round(m['hold']-m['sting'],3); o['summary_drop_video_mapped_after_sting']=round(m['summ']-0.17-on,2)
    if 'skip' in m: o['skip_tap_after_sting_s']=round(m['skip']-m['sting'],3)
    out[key]=o
    a=ax[k+1]; a.plot(tv,Ex,lw=.7,label='recording (aligned to sting log)'); a.plot(t,E,lw=.7,alpha=.7,label='source mp3')
    if 'hold' in m: a.axvline(m['hold']-m['sting'],color='r',ls='--',label='[sailboat] hold enter')
    if 'skip' in m: a.axvline(m['skip']-m['sting'],color='r',ls='--',label='skip tap')
    a.axvline(2.7,color='g',ls=':',label='tf81 sceneSwap');a.set_xlim(-1,6);a.set_ylim(-70,0);a.set_title(f"{m['f']}  offset wav->video {off:+.2f}s");a.legend(fontsize=8)
ax[-1].set_xlabel('seconds after [sailboat] sting start')
plt.tight_layout(); plt.savefig('envelopes_aligned.png',dpi=90); print(json.dumps(out,indent=1)); json.dump(out,open('aligned.json','w'),indent=1)
