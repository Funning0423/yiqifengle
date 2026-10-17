import sys,json;sys.path.insert(0,'.')
from opt_land4 import *
best=json.load(open('opt_land4.json'))
for s in (0.5,0.7):
  f=lambda v:loss4([s]+list(v))
  r=minimize(f,best[1:],method='Nelder-Mead',options=dict(maxiter=700,xatol=1e-4,fatol=0.2,adaptive=True))
  v=[s]+list(map(float,r.x)); print(s,np.round(v,4),round(r.fun,1)); json.dump(v,open(f'opt_s{s}.json','w'))
