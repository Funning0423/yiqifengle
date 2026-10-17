import numpy as np,subprocess,json
SR=24000;meta=json.load(open('synth_meta.json'));N=int(SR*meta['loopS'])
def dec(p,raw):
    a=['ffmpeg','-loglevel','error']+(['-flags2','+skip_manual'] if raw else [])+['-i',p,'-f','f32le','-ac','1','-'];return np.frombuffer(subprocess.run(a,capture_output=True).stdout,'<f4').astype(float)
raw=dec('amb_lake_loop.mp3',True);g=dec('amb_lake_loop.mp3',False)
D=int(np.argmax([np.dot(raw[d:d+20000],g[:20000]) for d in range(0,2000)]))
XF=0.15;x=int(XF*SR)
def lvl(sig,w=int(.01*SR)):return 10*np.log10(np.convolve(sig**2,np.ones(w)/w,'same')+1e-12)
H=int(.005*SR)
def step(sig,a,b):
    L=lvl(sig)[::H];d=np.abs(np.diff(L));return float(np.max(d[a//H:b//H])),float(np.percentile(d,99.5))
res={'rawSamples':len(raw),'gaplessSamples':len(g),'encoderDelaySamples':D,'encoderDelayS':round(D/SR,5),'circularLoopS':meta['loopS']}
# LakeAmbience cross-loop: partner B plays at wall N; crossfade (linear: identical material) wall N+D .. N+D+XF; A stops after.
B0=N;out=raw.copy();out=np.concatenate([out,np.zeros(len(raw))])
Bw=np.concatenate([np.zeros(B0),raw]);Bw=np.pad(Bw,(0,len(out)-len(Bw)))
a=N+D;u=np.clip((np.arange(len(out))-a)/x,0,1)
for curve in ['linear','equal-power']:
    ga,gb=(1-u,u) if curve=='linear' else (np.cos(u*np.pi/2),np.sin(u*np.pi/2))
    o=out*ga+Bw*gb;o=o[:N+len(raw)-200]
    mx,p=step(o,a-int(.1*SR),a+x+int(.1*SR))
    err=10*np.log10(np.mean((raw[a:a+x]-raw[D:D+x])**2)/np.mean(raw[D:D+x]**2))
    res['crossloop_'+curve]={'maxLevelStepAtSeam_dB':round(mx,2),'p99.5StepWholeLoop_dB':round(p,2),'overlapMismatch_dB':round(float(err),1)}
    if curve=='linear':np.save('xloop.npy',o)
# fallback: platform loop of raw (gap = delay+padding)
o=np.concatenate([raw,raw]);mx,p=step(o,len(raw)-int(.1*SR),len(raw)+int(.1*SR));res['platformLoopFallback_maxStep_dB']=round(mx,2)
o=np.concatenate([g[:N],g[:N]]);mx,_=step(o,N-int(.1*SR),N+int(.1*SR));res['gaplessCircularWrap_maxStep_dB']=round(mx,2)
json.dump(res,open('seam.json','w'),indent=1);print(json.dumps(res,indent=1))
o=np.load('xloop.npy');a=N+D
def win(sig,c,w):return 10*np.log10(np.mean(sig[c-w:c]**2)+1e-12)-10*np.log10(np.mean(sig[c:c+w]**2)+1e-12)
for wms in (20,50):
    w=int(wms/1000*SR);seam=max(abs(win(o,a+k,w)) for k in range(0,x,w//2))
    rng=np.random.default_rng(1);ref=[abs(win(g,int(c),w)) for c in rng.integers(w,len(g)-w,2000)]
    res[f'crossloop_levelJump_{wms}ms_dB']={'seamMax':round(float(seam),2),'elsewhereP50':round(float(np.median(ref)),2),'elsewhereP95':round(float(np.percentile(ref,95)),2)}
json.dump(res,open('seam.json','w'),indent=1);print({k:v for k,v in res.items() if 'levelJump' in k})
