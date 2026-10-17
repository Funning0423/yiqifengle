import numpy as np,subprocess,wave,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
S=44100
def dec(f):return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-flags2','+skip_manual','-i',f,'-f','f32le','-ac','2','-'],capture_output=True).stdout,np.float32).reshape(-1,2)
def render(f,dur):  # in-game: partner from 0 at T0, 150 ms equal-power
    x=dec(f);T0=int(round((dur-0.225)*S));X=int(0.15*S);th=np.linspace(0,np.pi/2,X)[:,None]
    return np.concatenate([x[T0-3*S:T0],x[T0:T0+X]*np.cos(th)+x[:X]*np.sin(th),x[X:X+3*S-X]]),3*S
fig,ax=plt.subplots(3,2,figsize=(14,9))
for j,(f,t) in enumerate([('m40.mp3','before (current 40k)'),('new.mp3','after')]):
    r,c=render(f,72.672653);m=r.mean(1);s=m[c-int(.5*S):c+int(.5*S)];tt=np.arange(len(s))/S-.5
    ax[0,j].plot(tt,s,lw=.4);ax[0,j].axvspan(0,.15,color='orange',alpha=.3);ax[0,j].set_title(t+' — in-game seam (orange = 150 ms xfade)')
    w=441;rm=[20*np.log10(np.sqrt(np.mean(s[i:i+w]**2))+1e-9) for i in range(0,len(s)-w,w)];ax[1,j].plot(np.arange(len(rm))*.01-.5,rm);ax[1,j].set_ylim(-45,-15);ax[1,j].set_ylabel('10 ms RMS dBFS');ax[1,j].axvspan(0,.15,color='orange',alpha=.3)
    ax[2,j].specgram(s,NFFT=1024,Fs=S,noverlap=768,xextent=(-.5,.5));ax[2,j].set_ylim(0,16000)
    y=np.clip(r*32767,-32768,32767).astype('<i2');wv=wave.open(f[:-4]+'_seam6s.wav','wb');wv.setnchannels(2);wv.setsampwidth(2);wv.setframerate(S);wv.writeframes(y.tobytes());wv.close()
plt.tight_layout();plt.savefig('seam.png',dpi=90)
