"""Outward binary64 interval polynomial / dyadic Bernstein sufficient proofs.
Inputs denote exact real numbers enclosed by endpoints. No sampling-based PASS.
"""
import math,time
from fractions import Fraction as F
import numpy as np

def I(x):x=np.asarray(x,dtype=float);return x,x

def rat(q):
 q=F(q);x=float(q);return np.asarray(np.nextafter(x,-np.inf)if F(x)>q else x),np.asarray(np.nextafter(x,np.inf)if F(x)<q else x)

def add(a,b):return np.nextafter(a[0]+b[0],-np.inf),np.nextafter(a[1]+b[1],np.inf)
def neg(a):return -a[1],-a[0]
def sub(a,b):return add(a,neg(b))
def mul(a,b):
 v=np.array([a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]]);return np.nextafter(v.min(0),-np.inf),np.nextafter(v.max(0),np.inf)
def div(a,b):
 assert np.all(b[0]>0);return mul(a,(np.nextafter(1/b[1],-np.inf),np.nextafter(1/b[0],np.inf)))
def sqrt(a):
 assert np.all(a[0]>=0);return np.nextafter(np.sqrt(a[0]),-np.inf),np.nextafter(np.sqrt(a[1]),np.inf)
def take(a,index):return a[0][index],a[1][index]
def stack(items,axis=-1):return np.stack([x[0]for x in items],axis),np.stack([x[1]for x in items],axis)
def dot(a,b):
 return add(add(mul(take(a,(...,0)),take(b,(...,0))),mul(take(a,(...,1)),take(b,(...,1)))),mul(take(a,(...,2)),take(b,(...,2))))
def cross(a,b):
 return stack([sub(mul(take(a,(...,j)),take(b,(...,k))),mul(take(a,(...,k)),take(b,(...,j))))for j,k in[(1,2),(2,0),(0,1)]])
def pmul(a,b):
 n=a[0].shape[-1];m=b[0].shape[-1];out=I(np.zeros(a[0].shape[:-1]+(n+m-1,)))
 out=(out[0].copy(),out[1].copy())
 for i in range(n):
  for j in range(m):
   v=add(take(out,(...,i+j)),mul(take(a,(...,i)),take(b,(...,j))));out[0][...,i+j]=v[0];out[1][...,i+j]=v[1]
 return out
def pdot(a,b):return add(add(pmul(take(a,(...,0,slice(None))),take(b,(...,0,slice(None)))),pmul(take(a,(...,1,slice(None))),take(b,(...,1,slice(None))))),pmul(take(a,(...,2,slice(None))),take(b,(...,2,slice(None)))))
def pcross(a,b):return stack([sub(pmul(take(a,(...,j,slice(None))),take(b,(...,k,slice(None)))),pmul(take(a,(...,k,slice(None))),take(b,(...,j,slice(None)))))for j,k in[(1,2),(2,0),(0,1)]],axis=-2)
def constant_shift(p,c):
 o=(p[0].copy(),p[1].copy());v=add(take(o,(...,0)),c);o[0][...,0]=v[0];o[1][...,0]=v[1];return o
def pad(p,n):return np.pad(p[0],[(0,0)]*(p[0].ndim-1)+[(0,n+1-p[0].shape[-1])]),np.pad(p[1],[(0,0)]*(p[1].ndim-1)+[(0,n+1-p[1].shape[-1])])
def bernstein(p):
 n=p[0].shape[-1]-1;out=(np.zeros_like(p[0]),np.zeros_like(p[1]))
 for i in range(n+1):
  v=I(np.zeros(p[0].shape[:-1]))
  for k in range(i+1):v=add(v,mul(take(p,(...,k)),rat(F(math.comb(i,k),math.comb(n,k)))))
  out[0][...,i]=v[0];out[1][...,i]=v[1]
 return out
def split(b):
 n=b[0].shape[-1]-1;left=(np.empty_like(b[0]),np.empty_like(b[1]));right=(np.empty_like(b[0]),np.empty_like(b[1]));q=b
 for i in range(n+1):
  left[0][...,i]=q[0][...,0];left[1][...,i]=q[1][...,0];right[0][...,n-i]=q[0][...,-1];right[1][...,n-i]=q[1][...,-1]
  if i<n:q=mul(add(take(q,(...,slice(None,-1))),take(q,(...,slice(1,None)))),I(.5))
 return left,right

def certify(p,bound=None,max_depth=20,max_cells=100000,budget_s=90):
 """All features start at [0,1]; only proven leaves are removed.
 Every remaining leaf is split into exact dyadic halves, or explicitly unresolved.
 """
 b=bernstein(p);ids=np.arange(len(b[0]));indices=np.zeros(len(ids),dtype=np.int64);start=time.time();accepted=0;failures=[];unresolved=[];min_lower=float('inf');worst=None;depth=0
 if bound is None:bound=lambda b,ids:(b[0].min(-1),b[1].max(-1))
 while len(ids):
  lo,hi=bound(b,ids);ok=lo>0;bad=hi<0
  if ok.any():
   j=np.flatnonzero(ok)[np.argmin(lo[ok])]
   if lo[j]<min_lower:min_lower=float(lo[j]);worst=dict(feature=int(ids[j]),dyadic_depth=depth,dyadic_index=int(indices[j]))
  accepted+=int(ok.sum())
  for j in np.flatnonzero(bad):failures.append(dict(feature=int(ids[j]),dyadic_depth=depth,dyadic_index=int(indices[j]),upper_bound=float(hi[j])))
  keep=~(ok|bad);ids=ids[keep];indices=indices[keep];b=(b[0][keep],b[1][keep])
  if not len(ids):break
  if depth>=max_depth or len(ids)*2>max_cells or time.time()-start>budget_s:
   unresolved=[dict(feature=int(f),dyadic_depth=depth,dyadic_index=int(k))for f,k in zip(ids,indices)];break
  left,right=split(b);b=(np.concatenate([left[0],right[0]]),np.concatenate([left[1],right[1]]));ids=np.r_[ids,ids];indices=np.r_[2*indices,2*indices+1];depth+=1
 return dict(status='FAIL'if failures else'UNRESOLVED'if unresolved else'CERTIFIED_IDEAL_POLYNOMIAL',feature_count=len(p[0]),certified_leaf_count=accepted,failed_leaf_count=len(failures),unresolved_leaf_count=len(unresolved),failed_leaves=failures[:200],unresolved_leaves=unresolved[:200],min_certified_lower_bound=min_lower if np.isfinite(min_lower)else None,worst_certified_leaf=worst,max_depth=depth,elapsed_s=time.time()-start,coverage='Every feature starts on [0,1]; unresolved parents split into their exact dyadic halves; no omitted leaves when failed/unresolved counts are zero.')

def cos25_interior():
 # Known enclosing decimal rationals for pi; alternating cos series at x<1.
 pl=F('3.14159265358979323846264338327950288419716939937510');pu=F('3.14159265358979323846264338327950288419716939937511');al=pl*25/180-F('1e-10');au=pu*25/180-F('1e-10')
 def series(x,n):return sum((-1)**k*x**(2*k)/math.factorial(2*k)for k in range(n+1))
 return rat(series(au,19))[0],rat(series(al,20))[1]
