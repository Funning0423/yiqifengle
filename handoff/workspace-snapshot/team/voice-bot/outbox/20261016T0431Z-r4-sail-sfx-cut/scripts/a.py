import numpy as np, soundfile as sf, json, glob, os
from scipy.signal import fftconvolve
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
def env(x,sr,w=0.01):
    n=int(sr*w); m=len(x)//n; r=np.sqrt((x[:m*n].reshape(m,n)**2).mean(1)+1e-12); return 20*np.log10(r)
ref,sr=sf.read('ref.wav'); E=env(ref,sr); t=np.arange(len(E))*0.01
out={'ref_dur':len(ref)/sr}
d=E[8:]-E[:-8]  # 80ms drop
i=np.argsort(d)[:5]; out['ref_worst_80ms_drops']=[(round(float(t[k]),2),round(float(d[k]),1)) for k in i]
w=(t>=2.6)&(t<=3.1); out['ref_2.6_3.1']=[round(float(v),1) for v in E[w]]
res={}
fig,ax=plt.subplots(5,1,figsize=(13,16))
ax[0].plot(t,E);ax[0].set_title('source mp3 10ms RMS dBFS');ax[0].axvspan(2.8,2.9,color='r',alpha=.2)
for k,f in enumerate(sorted(glob.glob('/workspace/wechat-game/ui-audit/2026-10-15/pr56-recordings-r4/wav/*.wav'))):
    x,_=sf.read(f); nm=os.path.basename(f)[:12]
    seg=x[int(24*sr):int(31*sr)]
    c=fftconvolve(seg,ref[::-1][:int(2*sr)][::-1][::-1],mode='valid') if False else None
    # correlate first 2s of ref against segment
    r2=ref[:int(2*sr)]
    c=fftconvolve(seg,r2[::-1],mode='valid'); c/=np.linalg.norm(r2)*np.sqrt(fftconvolve(seg**2,np.ones(len(r2)),mode='valid')+1e-12)
    p=int(np.argmax(c)); onset=24+p/sr
    Ex=env(x,sr); tx=np.arange(len(Ex))*0.01
    dd=Ex[8:]-Ex[:-8]; ww=(tx>27)&(tx<30); ww=ww[:len(dd)]
    j=np.where(ww)[0][np.argmin(dd[ww])]
    # least squares gain of ref at onset over windows
    def g(a,b):
        s=x[int((onset+a)*sr):int((onset+b)*sr)]; q=ref[int(a*sr):int(b*sr)]; return 20*np.log10(abs(np.dot(s,q))/np.dot(q,q)+1e-9)
    res[nm]=dict(onset_wav=round(onset,3),corr=round(float(c[p]),2),drop_wav=round(float(tx[j]),2),drop_db=round(float(dd[j]),1),drop_minus_onset=round(float(tx[j]-onset),2),
      gain_db_0_0p8=round(g(0,.8),1),gain_db_0p8_1p6=round(g(.8,1.6),1),gain_db_1p6_2p6=round(g(1.6,2.6),1),gain_db_3_4=round(g(3,4),1))
    a=ax[k+1]; a.plot(tx,Ex,lw=.7,label='rec'); a.plot(t+onset,E+res[nm]['gain_db_0_0p8'] if 'skip' not in nm else E,lw=.7,alpha=.7,label='ref@onset');
    a.axvline(onset,color='m');a.axvline(tx[j],color='r',ls='--');a.set_xlim(25,32);a.set_ylim(-70,0);a.set_title(f'{nm} wav-time; onset {onset:.2f} drop {tx[j]:.2f} ({dd[j]:.1f}dB)');a.legend()
plt.tight_layout();plt.savefig('envelopes.png',dpi=90)
out['recordings']=res;print(json.dumps(out,indent=1));json.dump(out,open('findings.json','w'),indent=1)
