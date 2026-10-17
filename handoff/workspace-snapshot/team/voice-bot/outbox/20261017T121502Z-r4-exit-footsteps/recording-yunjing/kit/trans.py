import json,wave,numpy as np,sys
for d,anc in (('runs/A_exit','leave'),('runs/B_return','returnHome'),('runs/C_gating','leave')):
  S=json.load(open(d+'/analysis.json'))
  TL=json.load(open(d+'/timeline.json'));v0=TL['videoEpoch0'];M=json.load(open(d+'/meta.json'));E0=M['perfEpoch']/1000
  EV=json.load(open(d+'/events.json'));A0=E0+[t for t,s in EV['marks'] if s==anc][0]/1000
  w=wave.open(d+'/audio_aligned.wav');sr=w.getframerate();X=np.frombuffer(w.readframes(w.getnframes()),np.int16).reshape(-1,2).astype(float).mean(1)/32768
  mk=[x['beepExpectedEpoch']-A0 for x in TL['markers']]
  h=int(sr*.05);r=[];c=np.concatenate([[0],np.cumsum(X**2)]);W=int(sr*.4)
  for i in range(W,len(X)-h,h):
    t=i/sr+v0-A0
    if any(-0.3<t-m<0.6 for m in mk): continue
    a=np.sqrt((c[i+h]-c[i])/h);b=np.sqrt((c[i]-c[i-W])/W)+1e-9;r.append((round(20*np.log10(a/b+1e-9),1),round(t,2),round(20*np.log10(a+1e-9),1)))
  r.sort(reverse=True);s=S['summary']
  pk=max((20*np.log10(np.abs(X[int((t0)*sr):int((t0+0.5)*sr)]).max()+1e-9),t0+v0-A0) for t0 in np.arange(0,len(X)/sr-0.5,0.5) if not any(-0.6<t0+v0-A0-m<0.6 for m in mk))
  print(d,'\n top transients (50ms vs prev 400ms, dB / t / dBFS):',r[:5],'\n peak excl markers dBFS/t',[round(x,2) for x in pk])
  print(' steps',s['steps_logged'],'started',s['sources_started'],'onset-log',s['onset_minus_log_ms'],'corrmin',s['match_corr_min'],'step-bed',s['step_minus_bed_db'],'steppk',s['step_peak_dbfs_max'],'\n cmp',s['table_compare'])
  print(' states',s['states'],'\n marks',s['marks'])
  print(' non-step starts',s['non_step_starts'])
