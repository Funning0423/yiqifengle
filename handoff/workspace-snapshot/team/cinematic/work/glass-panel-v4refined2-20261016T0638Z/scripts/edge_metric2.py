# bottom-edge stability: sample along the panel's bottom straight edge (local x 60..220) via each frame's homography,
# per column take the peak luminance over local y 95..102 (the stroke), giving a 1D edge profile per frame.
import json,numpy as np
from PIL import Image
R='/tmp/wte/rec8/'
xs=np.linspace(60,220,321);EDGES={'bottom':np.linspace(95,102,57),'top':np.linspace(-2,5,57)}
def bil(img,u,v):
  x0=np.floor(u).astype(int);y0=np.floor(v).astype(int);fx=u-x0;fy=v-y0
  g=lambda y,x:img[np.clip(y,0,img.shape[0]-1),np.clip(x,0,img.shape[1]-1)]
  return g(y0,x0)*(1-fx)*(1-fy)+g(y0,x0+1)*fx*(1-fy)+g(y0+1,x0)*(1-fx)*fy+g(y0+1,x0+1)*fx*fy
out={}
import sys
for W,rt in [x for x in((360,'0.46'),(390,'0.75')) if str(x[0]) in sys.argv[1:]]:
  out[rt]={}
  for v in('v4','v4r','v4r2'):
   for en,ys in EDGES.items():
    t=f'{v}_{W}_float';log=json.load(open(R+t+'/framelog.json'));P=[]
    for i,e in enumerate(log):
      h=e['h'];img=np.asarray(Image.open(f'{R}{t}/frames/{i:05d}.png').convert('L'),np.float32)
      X,Y=np.meshgrid(xs,ys);w=h[6]*X+h[7]*Y+1;u=(h[0]*X+h[1]*Y+h[2])/w;vv=(h[3]*X+h[4]*Y+h[5])/w
      P.append(bil(img,u,vv).max(0))
    P=np.array(P)
    cv=(P.std(1)/P.mean(1))
    # periodicity: detrend each profile (remove linear+quadratic), FFT power of top non-DC bin / total
    k=np.arange(P.shape[1]);pr=[]
    for p in P:
      r=p-np.polyval(np.polyfit(k,p,2),k);s=np.abs(np.fft.rfft(r))**2;s=s[2:];pr.append(float(s.max()/s.sum()) if s.sum()>0 else 0)
    ripple=[float((p-np.polyval(np.polyfit(k,p,2),k)).std()) for p in P]
    out[rt].setdefault(v,{})[en]={'frames':len(P),'edge_peak_luma_mean':float(P.mean()),
     'along_edge_ripple_std_mean':float(np.mean(ripple)),'along_edge_ripple_std_max':float(np.max(ripple)),
     'along_edge_cv_mean':float(cv.mean()),
     'frame_to_frame_mean_abs_diff':float(np.abs(np.diff(P,axis=0)).mean()),
     'per_frame_mean_luma_temporal_std':float(P.mean(1).std()),
     'fft_peak_power_fraction_mean':float(np.mean(pr))}
    np.save(f'/tmp/wte/rec8/{t}_{en}_profile.npy',P)
print(json.dumps(out,indent=1))
