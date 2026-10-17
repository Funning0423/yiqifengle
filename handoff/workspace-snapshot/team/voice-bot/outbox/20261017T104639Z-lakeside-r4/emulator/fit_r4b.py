import sys,json;sys.path.insert(0,'.')
import fit_r4 as F
from fit_r4 import *
def r4Vz(x,base):
  V=F.r4V(x[:27],base);V['day']['waterSkyZenithLinear']=list(x[27:30]);return V
def resid2(x,base):
  F_r4V=F.r4V
  V=r4Vz(x,base);im=shade_sparse(V);r=[]
  for n in B: r+=list((np.median(sample(im,n).reshape(-1,3),0)-TG[n])/12)
  for n in BX: r+=list(0.2*(np.median(sample(im,n).reshape(-1,3),0)-TX[n])/12)
  st=float(sample(im,'_stripe').mean(1).std(0).mean());r.append(max(0,st-10)/2)
  return np.array(r)
if __name__=='__main__':
  base=copy.deepcopy(R3);base['vc_linear']=True
  x0=json.load(open('fit_r4.json'))['x']+list(base['day']['waterSkyZenithLinear'])
  lo=F.LO+[0.003]*3;hi=F.HI+[1]*3
  x0=list(np.clip(x0,np.array(lo)+1e-6,np.array(hi)-1e-6))
  print('start',0.5*np.sum(resid2(np.array(x0),base)**2),flush=True)
  r=least_squares(resid2,x0,args=(base,),bounds=(lo,hi),diff_step=3e-3,x_scale='jac',max_nfev=int(sys.argv[1]),verbose=1)
  print('end',r.cost);json.dump(dict(x=list(map(float,r.x)),cost=float(r.cost)),open('fit_r4b.json','w'),indent=1);print(np.round(r.x,4).tolist())
