import sys,json;sys.path.insert(0,'.')
from wref_base import *
from scipy.optimize import minimize
gm=np.load('graded_tmed.npy');TG={n:smed(gm,b) for n,b in B.items()}
WATER=['far_water','mid_water','mid_water_R','under_bridge','near_mid_water','near_water_bottom','near_water_L']
Gh={k:(v[::2,::2] if isinstance(v,np.ndarray) else v) for k,v in G2.items()}
Bh={n:tuple(v//2 for v in b) for n,b in B.items()}
def W_of(x,sky=None):
  mn,am,ss,fl=x[:4];W=dict(WA2,main=mn,amb=am,sky_strength=ss,floor=fl,tint=[1,1,1],vc_linear=True)
  if sky: W.update(horizon=sky[0],low=sky[1])
  return W
def shade(x,sky=None,g=Gh): P=P_now();P['water']=W_of(x,sky);return emu.shade(g,P).astype(float)
def loss(x,sky=None):
  if not(0.1<=x[0]<=4 and 0.1<=x[1]<=6 and 0.0<=x[2]<=3 and 0<=x[3]<=0.85): return 1e5
  img=shade(x,sky);L=0
  for n in WATER:
    d=np.abs(smed(img,Bh[n])-TG[n]);L+=(np.maximum(d-12,0)**2).sum()*3+d.sum()*(3 if n.startswith('near') else 1)
  return L
def run(sky=None,tag=''):
  best=None
  for x0 in ([1.37,1.85,0.35,0.31],[3.0,4.0,0.5,0.3],[2.0,3.0,1.0,0.5]):
    r=minimize(loss,x0,args=(sky,),method='Nelder-Mead',options=dict(maxiter=250,xatol=1e-3,fatol=1)); print(tag,r.x.round(3),round(r.fun),flush=True)
    if best is None or r.fun<best.fun: best=r
  return [round(float(v),2) for v in best.x]
if __name__=='__main__':
  x1=run(None,'c1');json.dump(x1,open('wref_c1.json','w'));print('c1',x1)
  SKY=([0.107,0.102,0.089],[0.093,0.171,0.181])
  x2=run(SKY,'c2');json.dump(x2,open('wref_c2.json','w'));print('c2',x2)
