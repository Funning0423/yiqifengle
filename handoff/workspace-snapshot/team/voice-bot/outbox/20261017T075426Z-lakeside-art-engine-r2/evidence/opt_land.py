import sys;sys.path.insert(0,'.')
import emu,regions,tune_light as T,p33,numpy as np,json
from scipy.optimize import minimize
from PIL import Image
G=T.G; Gs={k:(v[::4,::4] if isinstance(v,np.ndarray) else v) for k,v in G.items()}
ref=Image.open('/workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_lastframe.png').convert('RGB')
x=np.load('opt_w33.npy');WA=dict(p33.W33,main=float(x[0]),amb=float(x[1]),sky_strength=float(x[2]),floor=float(x[3]))
LK=['bridge_deck','grass_L','far_trees','roof']
TG={k:np.array(regions.med(ref,regions.R[k]),float) for k in LK}
lum=lambda c:0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
lin255=lambda c:tuple(int(round(min(1,max(0,v))*255)) for v in c)
def P_of(v,water=WA):
  s,k,sr,sg,sb,gg,gb=v
  P=T.P_light(s,k,True,water=water); P.update(sky_byte=lin255([sr,sg,sb]),ground_byte=lin255([1.0,gg,gb])); return P
def loss(v,full=False):
  s,k,sr,sg,sb,gg,gb=v
  if not(0.7<=s<=0.8 and 0.05<=k<=3 and all(0<=q<=1 for q in (sr,sg,sb,gg,gb))): return 1e4
  img=emu.shade(Gs,P_of(v)); L=0
  for kk in LK:
    m=np.array(regions.med(img,regions.R[kk]),float); t=TG[kk]
    L+=(np.abs(m-t)/np.maximum(t,25)).sum()*100
    if kk in('far_trees','roof') and lum(m)<lum(t): L+=(lum(t)-lum(m))*20
  return L
if __name__=='__main__':
  best=None
  for x0 in ([0.75,0.4,0.0116,0.2747,0.4793,0.5457,0.1441],[0.75,0.8,0.05,0.2,0.3,0.4,0.05],[0.8,1.2,0.1,0.15,0.2,0.3,0.0],[0.7,0.6,0.2,0.25,0.25,0.5,0.1]):
    r=minimize(loss,x0,method='Nelder-Mead',options=dict(maxiter=900,xatol=1e-4,fatol=0.2)); print(np.round(r.x,4),round(r.fun,1),flush=True)
    if best is None or r.fun<best.fun: best=r
  v=best.x; json.dump(list(map(float,v)),open('opt_land.json','w'))
  img=emu.shade(G,P_of(v)); print({k:regions.med(img,regions.R[k]) for k in LK},{k:tuple(TG[k].astype(int)) for k in LK})
