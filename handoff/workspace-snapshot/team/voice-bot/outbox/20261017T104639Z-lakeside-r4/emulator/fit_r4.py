import sys,json,copy;sys.path.insert(0,'.')
from r4p import *;from boxes import *
from scipy.optimize import least_squares
REF=np.load('ref/r640_graded_tmed.npy')
TG={n:smed(REF,b) for n,b in B.items()};TX={n:smed(REF,b) for n,b in BX.items()};TS=stripe(REF)
G0=gb('360x640')
# sparse G-buffer: only the pixels of the boxes (+ stripe band) -> shade as a 1xN strip
regions=dict(B);regions.update(BX);regions['_stripe']=STRIPE
idx={};allp=[]
for n,(x0,y0,x1,y1) in regions.items():
  yy,xx=np.mgrid[y0:y1,x0:x1];k=len(allp);p=list(zip(yy.ravel(),xx.ravel()));allp+=p;idx[n]=(k,len(p),(y1-y0,x1-x0))
ys=np.array([p[0] for p in allp]);xs=np.array([p[1] for p in allp])
GS={k:(v[ys,xs][None] if isinstance(v,np.ndarray) else v) for k,v in G0.items()}
PHASES=(0.0,1.5,3.0,4.5)
def r4V(x,base):
  V=copy.deepcopy(base);d=V['day']
  s,k,sr,sg,sb,gr_,gg,gb_,fr,fg,fb,ftop,frange,fatt,tr,tg,tb,wm,wa,ws,wf,hr,hg,hb,lr,lg,lb=x
  d.update(sunIlluminanceScale=s,ambientSkyIllumToSun=k,ambientSkyColorLinear=[sr,sg,sb],ambientGroundColorLinear=[gr_,gg,gb_],fogColorSrgb=(fr,fg,fb),
   waterTintLinear=[tr,tg,tb],waterMainLightScale=wm,waterAmbientScale=wa,waterSkyStrength=ws,waterSkyReflectFloor=wf,
   waterSkyHorizonLinear=[hr,hg,hb],waterSkyLowLinear=[lr,lg,lb])
  V['fog']=dict(V['fog'],top=ftop,range=frange,atten=fatt);return V
def shade_sparse(V,mode='day',phases=PHASES):
  ims=[emu.shade(GS,P_of(V,mode,t=t)).astype(float) for t in phases];return np.median(np.stack(ims),0)[0]
def sample(img,n):
  k,m,sh=idx[n];return img[k:k+m].reshape(sh+(3,))
def resid(x,base,w_land=0.35):
  V=r4V(x,base);im=shade_sparse(V);r=[]
  for n in B: r+=list((np.median(sample(im,n).reshape(-1,3),0)-TG[n])/12)
  for n in BX: r+=list(w_land*(np.median(sample(im,n).reshape(-1,3),0)-TX[n])/12)
  st=float(sample(im,'_stripe').mean(1).std(0).mean());r.append(max(0,st-10)/2)
  return np.array(r)
LO=[0.3,0.05,0,0,0,0,0,0, 20,20,20, 0.3,5,5, 0.3,0.3,0.3, 0.2,0.2,0.2,0.1, 0.003,0.003,0.003,0.003,0.003,0.003]
HI=[1.5,1.5,1,1,1,1,1,1, 255,255,255, 6,120,120, 1,1,1, 3,3,2,0.6, 1,1,1,1,1,1]
if __name__=='__main__':
  base=copy.deepcopy(R3);base['vc_linear']=True   # r4: f492dc1 vertex-colour fix + no linear:true squaring (uniforms as authored)
  d=base['day'];x0=[0.7,0.49,*d['ambientSkyColorLinear'],*d['ambientGroundColorLinear'],*d['fogColorSrgb'],1.5,30,17,0.9,1,1,1.37,1.85,0.35,0.31,
    0.05,0.08,0.06, 0.06,0.12,0.12]
  print('start cost',0.5*np.sum(resid(np.array(x0),base)**2),flush=True)
  r=least_squares(resid,x0,args=(base,),bounds=(LO,HI),diff_step=2e-2,max_nfev=int(sys.argv[1]) if len(sys.argv)>1 else 400,verbose=1)
  print('end cost',r.cost);json.dump(dict(x=list(map(float,r.x)),cost=float(r.cost)),open('fit_r4.json','w'),indent=1)
  print(np.round(r.x,4).tolist())
