# temporal edge-flicker metric: |f[t+1]-2f[t]+f[t-1]| in panel edge band during static (no camera pan) frames
import json,sys,numpy as np
from PIL import Image
R='/tmp/wte/rec7/'
static=[i for i in range(1,169) if not(15<=i<45 or 60<=i<105 or 120<=i<150)]
def load(t,i): return np.asarray(Image.open(f'{R}{t}/frames/{i:05d}.png').convert('L'),dtype=np.float32)
out={}
for W in (360,390):
  res={}
  for v in ('v4','v4r'):
    t=f'{v}_{W}';log=json.load(open(R+t+'/framelog.json'))
    vals=[];inner=[];boxes=[]
    for i in static:
      if i+1>=len(log) or i-1<0: continue
      b=log[i]['box'];boxes.append([b['l'],b['t'],b['r'],b['b']])
      f0,f1,f2=load(t,i-1),load(t,i),load(t,i+1);d=np.abs(f2-2*f1+f0)
      H,Wd=d.shape;m=np.zeros_like(d,bool);L,T,Rr,B=int(b['l'])-4,int(b['t'])-4,int(b['r'])+5,int(b['b'])+5
      m[max(T,0):B,max(L,0):Rr]=True;n=m.copy();n[T+10:B-10,L+10:Rr-10]=False
      vals.append(d[n].mean());o=np.zeros_like(m);o[max(T-14,0):B+14,max(L-14,0):Rr+14]=True;o[max(T-6,0):B+6,max(L-6,0):Rr+6]=False;inner.append(d[o].mean())
    res[v]={'edge_flicker_mean':float(np.mean(vals)),'edge_flicker_p95':float(np.percentile(vals,95)),'background_ring_flicker_mean':float(np.mean(inner)),'frames':len(vals),'boxes':boxes}
  bd=np.abs(np.array(res['v4']['boxes'])-np.array(res['v4r']['boxes'])).max()
  for v in res: res[v].pop('boxes')
  res['bbox_max_abs_diff_px_over_static_frames']=float(bd);res['edge_flicker_reduction_pct']=100*(1-res['v4r']['edge_flicker_mean']/res['v4']['edge_flicker_mean'])
  out[{360:'0.46',390:'0.75'}[W]]=res
print(json.dumps(out,indent=1))
