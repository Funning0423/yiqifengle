#!/usr/bin/env python3
# ana.py <run_dir> <table.csv|-> <anchorMark>: per-step log vs audio onset (matched filter with the exact decoded step buffer),
# step level vs bed, loudness, gating checks. Writes <run>/steps.csv + <run>/analysis.json
import json,sys,csv,wave,numpy as np,re
d,table,anchor=sys.argv[1],sys.argv[2],sys.argv[3]
M=json.load(open(d+'/meta.json'));E0=M['perfEpoch']/1000;TL=json.load(open(d+'/timeline.json'));v0=TL['videoEpoch0']
EV=json.load(open(d+'/events.json'));B=json.load(open(d+'/buffers.json'))
w=wave.open(d+'/audio_aligned.wav');sr=w.getframerate();X=np.frombuffer(w.readframes(w.getnframes()),np.int16).reshape(-1,2).astype(np.float64)/32768;mono=X.mean(1)
ep=lambda perf:E0+perf/1000
mk=[json.loads(l) for l in open(d+'/markers.jsonl') if l.strip() and l.strip()!='null']
ac=np.array([x['ctxTime'] for x in mk]);ae=np.array([E0+x['beepPerf']/1000 for x in mk])
def cmap(c):
  if TL['clockMap']!='markers': return None
  sl0=(ae[1]-ae[0])/(ac[1]-ac[0]);sl1=(ae[-1]-ae[-2])/(ac[-1]-ac[-2])
  return float(ae[0]+(c-ac[0])*sl0 if c<ac[0] else ae[-1]+(c-ac[-1])*sl1 if c>ac[-1] else np.interp(c,ac,ae))
marks={}
for t,s in EV['marks']: marks.setdefault(s,[]).append(ep(t))
A0=marks[anchor][0]
steps=[]
for t,s in EV['logs']:
  if '"event":"step"' not in s: continue
  j=json.loads(s[s.index('{'):]);j['logEpoch']=ep(t)
  if j['logEpoch']>=v0: steps.append(j)
starts=EV['src']['starts']
# start that belongs to a step log: first start of a short buffer within 0..100 ms after the log
used=set()
def vid(i): return 'video t=%.3f'%(i-v0)
rows=[]
for k,s in enumerate(steps):
  cand=[(i,st) for i,st in enumerate(starts) if i not in used and 0<=ep(st['perf'])-s['logEpoch']<0.1 and st['dur']<0.8]
  st=None
  if cand: i,st=cand[0];used.add(i)
  r={'n':k+1,'t_from_anchor_s':round(s['logEpoch']-A0,3),'video_t_s':round(s['logEpoch']-v0,3),'state':s.get('state'),'clip':s['clip'],'foot':s['bone'],'surface':s['surface'],'name':s['name'],'vol':s['volume'],'played_flag':s['loaded'],'source_started':st is not None}
  if st is not None:
    tpl=np.array(B[st['id']],float)/32768;n=len(tpl);c=max(st['when'],st['ct']);sched=cmap(c)
    r['sched_minus_log_ms']=round((sched-s['logEpoch'])*1000,1) if sched else None
    c0=int((s['logEpoch']-0.06-v0)*sr);c1=int((s['logEpoch']+0.30-v0)*sr)
    seg=mono[max(0,c0):c1+n];best=(-1,0,0)
    tn=tpl/np.linalg.norm(tpl);L=len(seg)-n
    if L<=0: continue
    F=int(2**np.ceil(np.log2(len(seg)+n)));num=np.fft.irfft(np.fft.rfft(seg,F)*np.conj(np.fft.rfft(tn,F)),F)[:L]
    cs=np.concatenate([[0],np.cumsum(seg**2)]);nx=np.sqrt(np.maximum(cs[n:n+L]-cs[:L],1e-18));v=num/nx;lag=int(np.argmax(v))
    best=(float(v[lag]),lag,float(np.dot(seg[lag:lag+n],tpl)/np.dot(tpl,tpl)))
    corr,lag,gain=best;on=v0+(max(0,c0)+lag)/sr
    r.update({'onset_video_t_s':round(on-v0,4),'onset_minus_log_ms':round((on-s['logEpoch'])*1000,1),'onset_minus_sched_ms':round((on-sched)*1000,1) if sched else None,'match_corr':round(corr,3),'gain_in_mix':round(gain,4)})
    s0=max(0,c0)+lag;win=mono[s0:s0+n];stp=gain*tpl[:len(win)];bed=win-stp
    rms=lambda a:20*np.log10(np.sqrt(np.mean(a**2))+1e-12)
    r['step_rms_dbfs']=round(rms(stp),1);r['bed_rms_dbfs']=round(rms(bed),1);r['step_minus_bed_db']=round(rms(stp)-rms(bed),1);r['step_peak_dbfs']=round(20*np.log10(np.max(np.abs(stp))+1e-12),1)
  rows.append(r)
# compare to Voice Bot table (same order); constant offset removed for the spread
cmp=None
if table!='-':
  T=list(csv.DictReader(open(table)))
  if len(T)>=len(rows):
    for r,t in zip(rows,T): r['table_step_t_s']=float(t['step_t_s']);r['table_plant_t_s']=float(t['plant_t_s']);r['table_surface']=t['step_surface'];r['table_foot']=t['foot']
    dd=np.array([r['t_from_anchor_s']-r['table_step_t_s'] for r in rows]);off=float(np.median(dd))
    for r in rows: r['log_vs_table_ms']=round((r['t_from_anchor_s']-r['table_step_t_s']-off)*1000,1)
    on=[r for r in rows if 'onset_video_t_s' in r]
    ex=[(r['onset_video_t_s']+v0-A0-off-r['table_plant_t_s'])*1000 for r in on]
    cmp={'count_ours':len(rows),'count_table':len(T),'surface_match':sum(r['surface']==r['table_surface'] for r in rows),'foot_match':sum(r['foot']==r['table_foot'] for r in rows),
         'const_offset_ms(anchor->game leaveHome start)':round(off*1000,1),'log_vs_table_ms_range':[min(r['log_vs_table_ms'] for r in rows),max(r['log_vs_table_ms'] for r in rows)],
         'audible_onset_minus_table_plant_ms_range':[round(min(ex),1),round(max(ex),1)],'audible_onset_minus_table_plant_ms_mean':round(float(np.mean(ex)),1)}
on=[r for r in rows if 'onset_minus_log_ms' in r]
summ={'steps_logged':len(rows),'sources_started':sum(r['source_started'] for r in rows),'states':[[round(ep(t)-A0,3),s] for t,s in EV['states']],'marks':{k:[round(x-A0,3) for x in v] for k,v in marks.items()},
 'onset_minus_log_ms':[min(r['onset_minus_log_ms'] for r in on),max(r['onset_minus_log_ms'] for r in on),round(float(np.mean([r['onset_minus_log_ms'] for r in on])),1)] if on else None,
 'onset_minus_sched_ms':[min(r['onset_minus_sched_ms'] for r in on),max(r['onset_minus_sched_ms'] for r in on)] if on and on[0].get('onset_minus_sched_ms') is not None else None,
 'match_corr_min':min(r['match_corr'] for r in on) if on else None,'step_minus_bed_db':[min(r['step_minus_bed_db'] for r in on),max(r['step_minus_bed_db'] for r in on)] if on else None,
 'step_peak_dbfs_max':max(r['step_peak_dbfs'] for r in on) if on else None,'mix_peak_dbfs':round(20*np.log10(np.abs(X).max()+1e-12),1),'table_compare':cmp,
 'non_step_starts':[{'t':round(ep(st['perf'])-A0,3),'dur':round(st['dur'],3)} for i,st in enumerate(starts) if i not in used]}
# momentary loudness proxy: 400 ms RMS (unweighted) per 100 ms, and largest 50 ms peak jump
hop=int(sr*.1);win=int(sr*.4);mom=[(round((i+win/2)/sr+v0-A0,2),round(20*np.log10(np.sqrt(np.mean(mono[i:i+win]**2))+1e-12),1)) for i in range(0,len(mono)-win,hop)]
summ['rms400_max']=max(mom,key=lambda x:x[1]);json.dump(mom,open(d+'/rms400.json','w'))
with open(d+'/steps.csv','w',newline='') as f:
  keys=sorted({k for r in rows for k in r},key=lambda k:list(rows[0].keys()).index(k) if k in rows[0] else 99);wr=csv.DictWriter(f,fieldnames=keys);wr.writeheader();wr.writerows(rows)
json.dump({'summary':summ,'steps':rows},open(d+'/analysis.json','w'),indent=1)
print(json.dumps(summ,indent=1)[:4000])
