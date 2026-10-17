import sys,json;sys.path.insert(0,'.')
from opt_land import *
V=json.load(open('final_land.json'))
refd=np.asarray(ref.resize((180,320))).astype(float)
md=lambda a,k:np.array(regions.med(a,regions.R[k]),float)
TGT={'near_water_L':np.array([66,152,146.]),'near_water_R':md(refd,'near_water_R'),'mid_water':md(refd,'mid_water')}
def W_of(x): mn,am,ss,fl=x; return dict(p33.W33,main=mn,amb=am,sky_strength=ss,floor=fl)
def loss(x):
  mn,am,ss,fl=x
  if not(0.2<=mn<=3 and 0.1<=am<=4 and 0.05<=ss<=2 and 0.0<=fl<=0.6): return 1e4
  img=emu.shade(Gs,P_of(V,W_of(x))).astype(float)
  return sum(np.abs(md(img,k)-TGT[k]).sum()*w for k,w in (('near_water_L',3),('near_water_R',1),('mid_water',1)))
best=None
for x0 in ([1.67,1.27,0.8,0.3],[1.0,1.0,0.6,0.3],[2.0,2.0,0.4,0.25]):
  r=minimize(loss,x0,method='Nelder-Mead',options=dict(maxiter=300,xatol=1e-3,fatol=0.5)); print(r.x.round(3),round(r.fun,1),flush=True)
  if best is None or r.fun<best.fun: best=r
x=[round(float(q),2) for q in best.x]; json.dump(x,open('final_water.json','w')); print('water',x)
