import sys,json;sys.path.insert(0,'.')
import wref_fit as F
from wref_fit import *
def W3(x):
  W=F.W_of(x[:4]);W['tint']=[x[4],x[5],x[6]];return W
def loss3(x):
  if not(all(0<=v<=1.5 for v in x[4:]) and 0.1<=x[0]<=4 and 0.1<=x[1]<=6 and 0<=x[2]<=3 and 0<=x[3]<=0.85): return 1e5
  P=P_now();P['water']=W3(x);img=emu.shade(Gh,P).astype(float);L=0
  for n in WATER:
    d=np.abs(smed(img,Bh[n])-TG[n]);L+=(np.maximum(d-12,0)**2).sum()*3+d.sum()*(3 if n.startswith('near') else 1)
  return L
best=None
for x0 in ([1.37,1.85,0.35,0.31,0.4,1,1],[2.26,4.0,0.1,0.5,0.5,1.0,1.1],[1.0,3.0,0.3,0.3,0.3,0.9,1.0]):
  r=minimize(loss3,x0,method='Nelder-Mead',options=dict(maxiter=500,xatol=1e-3,fatol=1,adaptive=True));print(r.x.round(3),round(r.fun),flush=True)
  if best is None or r.fun<best.fun: best=r
x=[round(float(v),3) for v in best.x];json.dump(x,open('wref_c1t.json','w'))
P=P_now();P['water']=W3(x);img=emu.shade(G2,P).astype(float)
for n in WATER+['bridge_rail_top']: m=smed(img,B[n]);print(n,m.astype(int),TG[n].astype(int),int(np.abs(m-TG[n]).max()))
print('stripe',round(stripe(img),1));np.save('wref_c1t_img.npy',img)
