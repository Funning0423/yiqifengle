import sys,os,json
sys.path.insert(0,'/workspace/wt-coast/tools/coast-transition-draft');sys.path.insert(0,'/workspace/tmp-exp/wt-coast-scene/tools/coast-scene')
import reanchor as R, aabb_gate as G
B=G.load('/workspace/tmp-exp/coast-build-r4b/coast_aabbs.json')
def frame(f,mode,skip=()):
  p,l,fov=R.CAM[f];per={};bad=False
  for (w,h) in G.SCREENS:
    a,res=G.check(B,list(p),list(l),fov,w/h,0.1,400,mode,quiet=True,skip=skip)
    per['%dx%d'%(w,h)]=res;bad|=a
  return bad,per
def windows(rng,mode,skip):
  ok=[f for f in rng if not frame(f,mode,skip)[0]];segs=[];s=None;prev=None
  for f in ok:
    if s is None:s=f
    elif f!=prev+1:segs.append((s,prev));s=f
    prev=f
  if s is not None:segs.append((s,prev))
  return segs
d=os.environ.get('DIR','out');out={'dir':d,'frames':len(R.CAM)}
keys=[220,196,248] if d=='out' else [1044,1040,1048]
rng=range(150,320) if d=='out' else range(980,1110)
# boat is still during the coast transition (speed 0) -> conditional wake_trail is off (SailWakeCore.ts:15/:38)
for mode in ('auto','vertical'):
  out['%s_windows'%mode]=windows(rng,mode,())
for f in keys:
  bad,per=frame(f,'auto',());out['frame_%d'%f]={'clean':not bad,'per_box_any_screen':{k:any(per[s][k] for s in per) for k in B},'cam':[list(map(float,R.CAM[f][0])),list(map(float,R.CAM[f][1])),float(R.CAM[f][2])]}
print(json.dumps(out,indent=1))
