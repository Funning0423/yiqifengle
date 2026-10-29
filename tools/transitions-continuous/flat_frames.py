#!/usr/bin/env python3
"""full9c flat-frame checker (Grok Bot): in a Mac screenshot sequence (shots/NNN-<tag>.jpg), transition frames ("-tr-" in the
name, or region-travel / region-loading / finale steps) may contain at most MAX_RUN (1) consecutive frames whose full-screen luminance std is < STD_MIN (10, 0..255 scale).
Usage: flat_frames.py <shots-dir> [--json out.json]   exit 0 PASS, 1 FAIL, 2 BLOCKED (no PIL / no frames)."""
import sys,os,re,json
STD_MIN=10.0;MAX_RUN=1
TR=re.compile(r'-tr-|region-travel|region-loading|finale',re.I)
def main(a):
  try:
    from PIL import Image,ImageStat
  except Exception as e:
    print(json.dumps({'test':'flat-frames','status':'BLOCKED','reason':'PIL missing: '+str(e)}));return 2
  d=a[0];out=a[a.index('--json')+1] if '--json' in a else None
  fr=[]
  for f in os.listdir(d):
    m=re.match(r'^(\d+)-(.*)\.(jpg|jpeg|png)$',f,re.I)
    if m:fr.append((int(m.group(1)),f,bool(TR.search('-'+m.group(2)))))
  fr.sort()
  if not fr:print(json.dumps({'test':'flat-frames','status':'BLOCKED','reason':'no frames'}));return 2
  rows=[];run=[];worst=[];flat=0
  for i,f,tr in fr:
    im=Image.open(os.path.join(d,f)).convert('L');im.thumbnail((256,256));sd=ImageStat.Stat(im).stddev[0]
    isflat=sd<STD_MIN
    if isflat:flat+=1
    rows.append({'i':i,'file':f,'tr':tr,'std':round(sd,2),'flat':isflat})
    if tr and isflat and (run and run[-1][0]==i-1 or not run):run.append((i,f))
    elif tr and isflat:run=[(i,f)]
    else:run=[]
    if len(run)>len(worst):worst=list(run)
  # every flat transition run, singletons included (reported; only runs > MAX_RUN fail)
  runs=[];cur=[]
  for r in rows:
    if r['tr'] and r['flat'] and cur and cur[-1]['i']==r['i']-1:cur.append(r)
    elif r['tr'] and r['flat']:
      if cur:runs.append(cur)
      cur=[r]
    else:
      if cur:runs.append(cur)
      cur=[]
  if cur:runs.append(cur)
  ok=len(worst)<=MAX_RUN
  res={'test':'flat-frames','status':'PASS' if ok else 'FAIL','frames':len(rows),'flatFrames':flat,'stdMin':STD_MIN,'maxRun':MAX_RUN,'worstRun':[f for _,f in worst],'flatRuns':[{'from':x[0]['i'],'to':x[-1]['i'],'n':len(x),'minStd':min(y['std'] for y in x),'fail':len(x)>MAX_RUN} for x in runs]}
  if out:json.dump({**res,'rows':rows},open(out,'w'),indent=1)
  print(json.dumps(res));return 0 if ok else 1
if __name__=='__main__':sys.exit(main(sys.argv[1:]))
