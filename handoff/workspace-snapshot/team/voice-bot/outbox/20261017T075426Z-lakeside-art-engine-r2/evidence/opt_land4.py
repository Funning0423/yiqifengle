import sys;sys.path.insert(0,'.')
from opt_land import *
import opt_land3 as O3
def loss4(v):
  s=v[0]
  if not(0.3<=s<=0.9): return 1e4
  v2=list(v); 
  s,k,sr,sg,sb,gg,gb=v
  if not(0.05<=k<=4 and all(0<=q<=1 for q in (sr,sg,sb,gg,gb))): return 1e4
  img=emu.shade(Gs,P_of(v)); L=0
  for kk in O3.LK5:
    m=np.array(regions.med(img,regions.R[kk]),float); t=TG[kk]; r=lum(m)/lum(t)
    L+=max(0,abs(r-1)-0.08)*600+abs(r-1)*100 + (np.abs(m/lum(m)-t/lum(t))).sum()*20
    if kk in('far_trees','roof') and r<1.02: L+=(1.02-r)*3000
  return L
if __name__=='__main__':
  best=None
  for x0 in ([0.5,0.8,0.01,0.2,0.17,0.83,0.17],[0.4,1.5,0.01,0.1,0.1,0.6,0.05],[0.6,1.0,0.02,0.15,0.1,0.5,0.0]):
    r=minimize(loss4,x0,method='Nelder-Mead',options=dict(maxiter=1200,xatol=1e-4,fatol=0.2,adaptive=True)); print(np.round(r.x,4),round(r.fun,1),flush=True)
    if best is None or r.fun<best.fun: best=r
  json.dump(list(map(float,best.x)),open('opt_land4.json','w'))
