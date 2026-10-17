import sys;sys.path.insert(0,'.')
from opt_land import *
LK5=['bridge_deck','grass_L','far_trees','roof']
def loss3(v):
  s,k,sr,sg,sb,gg,gb=v
  if not(0.7<=s<=0.8 and 0.05<=k<=3 and all(0<=q<=1 for q in (sr,sg,sb,gg,gb))): return 1e4
  img=emu.shade(Gs,P_of(v)); L=0
  for kk in LK5:
    m=np.array(regions.med(img,regions.R[kk]),float); t=TG[kk]; r=lum(m)/lum(t)
    L+=abs(r-1)*300 + (np.abs(m/lum(m)-t/lum(t))).sum()*30
    if kk in('far_trees','roof') and r<1.0: L+=(1.0-r)*3000
  return L
if __name__=='__main__':
  best=None
  for x0 in ([0.75,0.4,0.0116,0.2747,0.4793,0.5457,0.1441],[0.75,0.6,0.0127,0.2828,0.1521,0.7802,0.1541],[0.72,0.8,0.05,0.2,0.2,0.5,0.05],[0.7,1.2,0.03,0.12,0.12,0.35,0.02]):
    r=minimize(loss3,x0,method='Nelder-Mead',options=dict(maxiter=2000,xatol=1e-4,fatol=0.1,adaptive=True)); print(np.round(r.x,4),round(r.fun,1),flush=True)
    if best is None or r.fun<best.fun: best=r
  v=best.x; json.dump(list(map(float,v)),open('opt_land3.json','w'))
  img=emu.shade(G,P_of(v))
  for k in LK5: m=regions.med(img,regions.R[k]); print(k,m,tuple(TG[k].astype(int)),round(lum(np.array(m,float))/lum(TG[k]),3))
