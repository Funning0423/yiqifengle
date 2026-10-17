import sys,json;sys.path.insert(0,'.')
import fit_r4 as F,fit_r4b as FB
from fit_r4 import *
def shade_f(V,phases=PHASES):
  ims=[]
  for t in phases:
    P=P_of(V,'day',t=t);P['float_out']=True;ims.append(emu.shade(GS,P))
  return np.mean(np.stack(ims),0)[0]
def resid3(x,base):
  V=FB.r4Vz(x,base);im=shade_f(V);r=[]
  for n in B: r+=list((1.6 if n=='bridge_stone_left' else 1.0)*(sample(im,n).reshape(-1,3).mean(0)-TG[n])/12)
  for n in BX: r+=list(0.08*(sample(im,n).reshape(-1,3).mean(0)-TX[n])/12)
  r+=list((np.array(x[8:11])-np.array([215,170,150]))/60)
  st=float(sample(im,'_stripe').mean(1).std(0).mean());r.append(max(0,st-10)/2)
  return np.array(r)
if __name__=='__main__':
  base=copy.deepcopy(R3);base['vc_linear']=True
  x0=json.load(open('fit_r4c.json'))['x'];lo=F.LO+[0.003]*3;hi=F.HI+[1]*3
  print('start',0.5*np.sum(resid3(np.array(x0),base)**2),flush=True)
  r=least_squares(resid3,x0,args=(base,),bounds=(lo,hi),diff_step=1e-2,x_scale='jac',max_nfev=int(sys.argv[1]),verbose=2)
  print('end',r.cost);json.dump(dict(x=list(map(float,r.x)),cost=float(r.cost)),open('fit_r4e.json','w'),indent=1);print(np.round(r.x,4).tolist())
