# silhouette jaggedness (v3.1: search window restricted outward of the panel boundary so the inner highlight line is ignored): per frame, locate the outer silhouette edge to subpixel precision along many rays
# (top/bottom: rays at each local x; sides: radial rays on the semicircle ends) via max luminance gradient
# (parabolic refine); fit smooth poly; residual RMS = stair-step/alias error (px).
import json,sys,numpy as np
from PIL import Image
R='/tmp/wte32/rec/';SUF='_dpr2';S=2.0
def bil(img,u,v):
  x0=np.floor(u).astype(int);y0=np.floor(v).astype(int);fx=u-x0;fy=v-y0
  g=lambda y,x:img[np.clip(y,0,img.shape[0]-1),np.clip(x,0,img.shape[1]-1)]
  return g(y0,x0)*(1-fx)*(1-fy)+g(y0,x0+1)*fx*(1-fy)+g(y0+1,x0)*(1-fx)*fy+g(y0+1,x0+1)*fx*fy
def H(h,x,y):
  w=h[6]*x+h[7]*y+1;return S*(h[0]*x+h[1]*y+h[2])/w,S*(h[3]*x+h[4]*y+h[5])/w
def edge_pos(img,p0,n,span=4.0,st=0.1):
  st*=S
  t=np.arange(-0.4*S,3.0*S+st,st);u=p0[0][:,None]+n[0][:,None]*t;v=p0[1][:,None]+n[1][:,None]*t
  L=bil(img,u,v);g=np.abs(np.gradient(L,axis=1));k=np.clip(g.argmax(1),1,len(t)-2);ii=np.arange(len(k))
  a,b,c=g[ii,k-1],g[ii,k],g[ii,k+1];den=a-2*b+c;off=np.where(np.abs(den)>1e-6,0.5*(a-c)/den,0)
  return t[k]+off*st
def rays(h,edge):
  if edge in('top','bottom'):
    xs=np.linspace(60,220,161);y=0.0 if edge=='top' else 100.0;yi=8.0 if edge=='top' else 92.0
    P=H(h,xs,np.full_like(xs,y));Q=H(h,xs,np.full_like(xs,yi))
  else:
    cx=50 if edge=='left' else 230;a=np.linspace(np.pi/2+0.3,1.5*np.pi-0.3,121) if edge=='left' else np.linspace(-np.pi/2+0.3,np.pi/2-0.3,121)
    P=H(h,cx+50*np.cos(a),50+50*np.sin(a));Q=H(h,cx+42*np.cos(a),50+42*np.sin(a))
  P=np.array(P);n=P-np.array(Q);n/=np.linalg.norm(n,axis=0);return P,n
out={}
for W,rt in [x for x in((360,'0.46'),(390,'0.75')) if str(x[0]) in sys.argv[1:]]:
  out[rt]={}
  for v in('v4','v4r2','v4r31','v4r32'):
    t=f'{v}_{W}_float'+SUF;log=json.load(open(R+t+'/framelog.json'));res={e:[] for e in('top','bottom','left','right')}
    for i in range(0,len(log),2):
      img=np.asarray(Image.open(f'{R}{t}/frames/{i:05d}.png').convert('L'),np.float32);h=log[i]['h']
      for e in res:
        P,n=rays(h,e);d=edge_pos(img,P,n);k=np.arange(len(d))
        r=d-np.polyval(np.polyfit(k,d,4),k);res[e].append(float(np.sqrt(np.mean(r**2)))/S)
    out[rt][v]={e:{'stair_rms_px_mean':float(np.mean(x)),'stair_rms_px_p95':float(np.percentile(x,95))} for e,x in res.items()}
print(json.dumps(out,indent=1))
