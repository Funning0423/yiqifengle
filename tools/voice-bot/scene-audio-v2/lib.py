import subprocess,numpy as np,json,re,os
from scipy.signal import butter,sosfiltfilt,sosfilt,fftconvolve,resample_poly
SR=48000
def load(f,sr=SR,ss=None,t=None,ch=2):
    cmd=['ffmpeg','-v','error']
    if ss is not None: cmd+=['-ss',str(ss)]
    if t is not None: cmd+=['-t',str(t)]
    cmd+=['-i',f,'-ac',str(ch),'-ar',str(sr),'-f','f32le','-']
    b=subprocess.run(cmd,capture_output=True,check=True).stdout
    return np.frombuffer(b,np.float32).reshape(-1,ch).astype(np.float64).copy()
def save(f,x,sr=SR):
    x=np.atleast_2d(x.T).T if x.ndim==1 else x
    p=subprocess.run(['ffmpeg','-v','error','-y','-f','f64le','-ar',str(sr),'-ac',str(x.shape[1]),'-i','-','-c:a','pcm_s24le',f],input=x.astype(np.float64).tobytes(),check=True)
def hp(x,f,o=2,sr=SR): return sosfiltfilt(butter(o,f,'hp',fs=sr,output='sos'),x,axis=0)
def lp(x,f,o=2,sr=SR): return sosfiltfilt(butter(o,f,'lp',fs=sr,output='sos'),x,axis=0)
def biquad(kind,f0,gain_db,q,sr=SR):
    A=10**(gain_db/40);w=2*np.pi*f0/sr;al=np.sin(w)/(2*q);c=np.cos(w)
    if kind=='peak':
        b=[1+al*A,-2*c,1-al*A];a=[1+al/A,-2*c,1-al/A]
    elif kind=='hshelf':
        s=2*np.sqrt(A)*al
        b=[A*((A+1)+(A-1)*c+s),-2*A*((A-1)+(A+1)*c),A*((A+1)+(A-1)*c-s)]
        a=[(A+1)-(A-1)*c+s,2*((A-1)-(A+1)*c),(A+1)-(A-1)*c-s]
    elif kind=='lshelf':
        s=2*np.sqrt(A)*al
        b=[A*((A+1)-(A-1)*c+s),2*A*((A-1)-(A+1)*c),A*((A+1)-(A-1)*c-s)]
        a=[(A+1)+(A-1)*c+s,-2*((A-1)+(A+1)*c),(A+1)+(A-1)*c-s]
    b=np.array(b)/a[0];a=np.array(a)/a[0]
    return np.concatenate([b,a])[None,:]
def eq(x,kind,f0,g,q=0.707,sr=SR): return sosfiltfilt(biquad(kind,f0,g,q,sr),x,axis=0)
def deharsh(x,amt=-3.0): # gentle cut in 2-6 kHz presence + soft top shelf
    x=eq(x,'peak',3500,amt,0.7); return eq(x,'hshelf',7000,-4,0.7)
def ir(rt=1.6,sr=SR,lpf=3500,pre=0.03,seed=1,stereo=True):
    rng=np.random.default_rng(seed);n=int(rt*1.2*sr)
    t=np.arange(n)/sr;env=np.exp(-6.9*t/rt)
    h=rng.standard_normal((n,2))*env[:,None];h=lp(h,lpf);h[:int(.004*sr)]*=np.linspace(0,1,int(.004*sr))[:,None]
    h=np.vstack([np.zeros((int(pre*sr),2)),h]);return h/np.sqrt((h**2).sum(0))
def reverb(x,wet_db=-12,rt=1.6,lpf=3500,pre=0.03,circular=False,seed=1):
    h=ir(rt,lpf=lpf,pre=pre,seed=seed)
    if x.ndim==1:x=np.stack([x,x],1)
    if circular:
        N=len(x);y=np.zeros_like(x)
        for c in range(2):
            Y=np.fft.irfft(np.fft.rfft(x[:,c],N)*np.fft.rfft(h[:,c],N) if len(h)<=N else None,N) if len(h)<=N else None
            y[:,c]=Y
    else:
        y=np.stack([fftconvolve(x[:,c],h[:,c]) for c in range(2)],1)
        x=np.vstack([x,np.zeros((len(y)-len(x),2))])
    return x+y*10**(wet_db/20)
def circ_loop(x,L,X,sr=SR,lin=False):
    """x has >= L+X samples-worth; returns loop of L s whose end flows into its start. equal-power xfade (uncorrelated beds)."""
    nL=int(round(L*sr));nX=int(round(X*sr));seg=x[:nL+nX].copy()
    t=np.linspace(0,np.pi/2,nX)[:,None]
    a,b=(np.sin(t),np.cos(t)) if not lin else (t/(np.pi/2),1-t/(np.pi/2))
    head=seg[:nX]*a+seg[nL:nL+nX]*b
    out=seg[:nL].copy();out[:nX]=head;return out
def lufs(f):
    r=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',f,'-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True).stderr
    I=float(re.findall(r'I:\s+(-?[\d.]+) LUFS',r)[-1]);tp=re.findall(r'Peak:\s+(-?[\d.inf]+) dBFS',r)
    LRA=float(re.findall(r'LRA:\s+(-?[\d.]+) LU',r)[-1])
    return I,float(tp[-1]) if tp else None,LRA
def norm_to(x,target,tmp='/tmp/_n.wav',sr=SR,tp_max=-3.0):
    for _ in range(3):
        save(tmp,x,sr);I,tp,_=lufs(tmp);g=target-I
        x=x*10**(g/20)
        if abs(g)<0.1:break
    pk=20*np.log10(np.abs(x).max()+1e-12)
    if pk>tp_max: # soft limit via tanh knee above
        lim=10**(tp_max/20);x=np.where(np.abs(x)>lim*0.7,np.sign(x)*(lim*0.7+lim*0.3*np.tanh((np.abs(x)-lim*0.7)/(lim*0.3))),x)
    return x
def encode(wav,mp3,kbps=32,sr=32000,ch=2):
    args=['ffmpeg','-v','error','-y','-i',wav,'-ac',str(ch),'-ar',str(sr),'-c:a','libmp3lame','-b:a',f'{kbps}k']
    if ch==2: args+=['-joint_stereo','1']
    subprocess.run(args+[mp3],check=True);return os.path.getsize(mp3)
def fade(x,fi=0.0,fo=0.0,sr=SR):
    x=x.copy()
    if fi>0:n=int(fi*sr);x[:n]*=(np.sin(np.linspace(0,np.pi/2,n))**2)[:,None]
    if fo>0:n=int(fo*sr);x[-n:]*=(np.cos(np.linspace(0,np.pi/2,n))**2)[:,None]
    return x
def seam_report(loop,sr=SR):
    """compare the jump across the circular seam vs the typical sample-to-sample step, and RMS of 50ms windows each side."""
    d=np.abs(np.diff(loop,axis=0)).max(1);j=np.abs(loop[0]-loop[-1]).max()
    p999=np.percentile(d,99.9);n=int(.05*sr)
    r=lambda s:20*np.log10(np.sqrt((s**2).mean())+1e-12)
    return dict(seam_jump=float(j),step_p99_9=float(p999),ratio=float(j/(p999+1e-12)),rms_end_db=round(r(loop[-n:]),1),rms_start_db=round(r(loop[:n]),1))
