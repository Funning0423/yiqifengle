import sys,json;sys.path.insert(0,'.')
import fit_r4c as FC
from fit_r4 import *
base=copy.deepcopy(R3);base['vc_linear']=True
X=json.load(open('fit_r4e.json'))['x'];X[5]=0.97
IDX=[14,15,16,27,28,29]
def full(y):
  x=list(X)
  for i,v in zip(IDX,y):x[i]=v
  return np.array(x)
def res(y): return FC.resid3(full(y),base)
y0=[X[14],X[15],X[16],0.185,0.23,0.569]
r=least_squares(res,y0,bounds=([0.5,0.6,0.8,0.05,0.15,0.45],[1,1,1,0.3,0.4,0.7]),diff_step=1e-2,x_scale='jac',max_nfev=25)
x=full(r.x);json.dump(dict(x=list(map(float,x)),cost=float(r.cost)),open('fit_r4f.json','w'),indent=1);print(np.round(r.x,4).tolist(),r.cost)
