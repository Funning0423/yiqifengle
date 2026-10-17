#!/usr/bin/env python3
# mux4.py <run_dir> [fps]: VFR screencast frames + gapless AudioWorklet tap -> mp4 (CFR fps, AAC) on the video epoch timeline.
# ctx->epoch map: MAP=markers (piecewise-linear through the flash+beep markers, mux3 method) or MAP=gos (getOutputTimestamp
# samples every 250 ms, median-of-5, piecewise; robust to AudioContext suspend/resume) shifted by the median marker residual.
import json,sys,subprocess,os,numpy as np,wave
d=sys.argv[1];FPS=int(sys.argv[2]) if len(sys.argv)>2 else 60;MAP=os.environ.get('MAP','markers')
M=json.load(open(d+'/meta.json'));E0=M['perfEpoch']/1000.0
fr=sorted(M['frames']);T=np.array([t for _,t in fr]);v0=T[0]
with open(d+'/list.txt','w') as f:
  for i,(k,t) in enumerate(fr):
    dur=(T[i+1]-t) if i+1<len(T) else 1/30
    f.write(f"file 'frames/{k:06d}.jpg'\nduration {max(dur,0.001):.6f}\n")
  f.write(f"file 'frames/{fr[-1][0]:06d}.jpg'\n")
m=[x for x in M['audio']['tap'] if x.get('wlBlocks')][0];sr=m['sr'];f0=np.array(m['wlF0'],dtype=float)
pcm=np.fromfile(f"{d}/audio_wl{m['i']}.pcm",dtype=np.int16).astype(np.float32).reshape(len(f0),4096,2)
gaps=np.diff(f0)-4096;ctx=((f0[:,None]+np.arange(4096)[None,:])/sr).ravel();pcm=pcm.reshape(-1,2)
mk=[json.loads(l) for l in open(d+'/markers.jsonl') if l.strip() and l.strip()!='null']
mp=np.array(m['maps']);c0,p0=mp[:,0],mp[:,1];off=p0-1000*c0
med=np.array([np.median(off[max(0,i-2):i+3]) for i in range(len(off))])
def gosmap(c): return E0+(1000*c+np.interp(c,c0,med))/1000.0
if MAP=='markers':
  ac=np.array([x['ctxTime'] for x in mk]);ae=np.array([E0+x['beepPerf']/1000 for x in mk])
  sl0=(ae[1]-ae[0])/(ac[1]-ac[0]);sl1=(ae[-1]-ae[-2])/(ac[-1]-ac[-2])
  cmap=lambda c:np.where(c<ac[0],ae[0]+(c-ac[0])*sl0,np.where(c>ac[-1],ae[-1]+(c-ac[-1])*sl1,np.interp(c,ac,ae)))
else:
  res=[E0+x['beepPerf']/1000-gosmap(x['ctxTime']) for x in mk];corr=float(np.median(res))
  cmap=lambda c:gosmap(c)+corr
ep=cmap(ctx)
grid=v0+np.arange(int((T[-1]-v0)*sr))/sr
order=np.argsort(ep,kind='stable');eps=ep[order];L=pcm[order,0];R=pcm[order,1]
A=np.stack([np.interp(grid,eps,L,left=0,right=0),np.interp(grid,eps,R,left=0,right=0)],1)
# zero any grid sample that falls in a hole of the stream (ctx suspended / tap gap > 2 samples)
idx=np.searchsorted(eps,grid);idx=np.clip(idx,1,len(eps)-1);hole=(eps[idx]-eps[idx-1])>2.5/sr;A[hole]=0
out=subprocess.run(['ffmpeg','-loglevel','error','-f','concat','-safe','0','-i',d+'/list.txt','-vf','signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-','-f','null','-'],capture_output=True,text=True).stdout
Y=[float(l.split('=')[1]) for l in out.splitlines() if 'YAVG' in l]
w=int(sr*.0025);k=np.arange(w);bas=np.exp(-2j*np.pi*1000*k/sr);mono=A[:,0];r=[]
for x in mk:
  e=E0+x['beepPerf']/1000;fi=next((i for i in range(len(Y)) if T[i]>e-0.5 and Y[i]>200),None);fe=T[fi] if fi is not None else None
  s0=max(0,int((e-.5-v0)*sr));seg=mono[s0:s0+sr];P=np.array([abs(np.dot(seg[s:s+w],bas)) for s in range(0,len(seg)-w,w)])
  on=v0+(s0+int(np.argmax(P>.25*P.max()))*w)/sr if len(P) and P.max()>0 else None
  r.append({'beepExpectedEpoch':e,'beepOnsetEpoch':on,'beepMinusExpectedMs':(on-e)*1000 if on else None,'flashFrameEpoch':fe,'flashMinusBeepMs':(fe-on)*1000 if fe and on else None,'frameDtAtFlashMs':(T[fi]-T[fi-1])*1000 if fi else None,
           'gosMinusMarkerMs':(gosmap(x['ctxTime'])-e)*1000})
wv=wave.open(d+'/audio_aligned.wav','wb');wv.setnchannels(2);wv.setsampwidth(2);wv.setframerate(sr);wv.writeframes(np.clip(A,-32768,32767).astype(np.int16).tobytes());wv.close()
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',d+'/list.txt','-i',d+'/audio_aligned.wav','-map','0:v','-map','1:a','-vf',f'fps={FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest',d+'/video.mp4'],check=True)
dts=np.diff(T)
tl={'tap':'audioworklet','clockMap':MAP,'videoEpoch0':float(v0),'videoFrames':int(len(T)),'videoFpsMean':float((len(T)-1)/(T[-1]-v0)),'frameDtMedianMs':float(np.median(dts)*1000),'frameDtP95Ms':float(np.percentile(dts,95)*1000),'maxFrameGapS':float(dts.max()),
 'audioSeconds':float(len(ctx)/sr),'audioBlockGaps':int((gaps!=0).sum()),'audioGapFrames':[int(g) for g in gaps[gaps!=0]][:20],'gosOffsetSpanMs':float(med.max()-med.min()),'sr':sr,'markers':r}
json.dump(tl,open(d+'/timeline.json','w'),indent=1)
print(json.dumps({k:tl[k] for k in ('videoFpsMean','frameDtMedianMs','audioSeconds','audioBlockGaps','gosOffsetSpanMs')}),[(round(x['beepMinusExpectedMs'] or 0,1),round(x['flashMinusBeepMs'] or 0,1),round(x['gosMinusMarkerMs'],1)) for x in r])
