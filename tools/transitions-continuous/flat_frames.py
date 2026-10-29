#!/usr/bin/env python3
"""full9c flat-frame checker (Grok Bot): in a Mac screenshot sequence (shots/NNN-<tag>.jpg), transition frames ("-tr-" in the
name) may contain at most MAX_RUN (1) consecutive frames whose full-screen luminance std is < STD_MIN (10, 0..255 scale).
Usage: flat_frames.py <shots-dir> [--json out.json]   exit 0 PASS, 1 FAIL, 2 BLOCKED (no PIL / no frames)."""
import sys,os,re,json
STD_MIN=10.0;MAX_RUN=1
def main(a):
  try:
    from PIL import Image,ImageStat
  except Exception as e:
    print(json.dumps({'test':'flat-frames','status':'BLOCKED','reason':'PIL missing: '+str(e)}));return 2
  d=a[0];out=a[a.index('--json')+1] if '--json' in a else None
  fr=[]
  for f in os.listdir(d):
    m=re.match(r'^(\d+)-(.*)\.(jpg|jpeg|png)$',f,re.I)
    if m:fr.append((int(m.group(1)),f,'-tr-' in '-'+m.group(2)))
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
  ok=len(worst)<=MAX_RUN
  res={'test':'flat-frames','status':'PASS' if ok else 'FAIL','frames':len(rows),'flatFrames':flat,'stdMin':STD_MIN,'maxRun':MAX_RUN,'worstRun':[f for _,f in worst]}
  if out:json.dump({**res,'rows':rows},open(out,'w'),indent=1)
  print(json.dumps(res));return 0 if ok else 1
if __name__=='__main__':sys.exit(main(sys.argv[1:]))
