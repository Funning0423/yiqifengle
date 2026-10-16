from projlib import *
ti=[i for i,n in enumerate(N) if n.get('name')=='meadow_terrain'][0]
TV=(wm(ti,0)@np.c_[acc(J['meshes'][N[ti]['mesh']]['primitives'][0]['attributes']['POSITION']),np.ones(6561)].T).T[:,:3]
def gh(x,z):
  d=(TV[:,0]-x)**2+(TV[:,2]-z)**2;k=np.argsort(d)[:4];w=1/(d[k]+1e-6);return (TV[k,1]*w).sum()/w.sum()
P0=np.array([0,24,45.]);T0=np.array([0,4,4.]);FOV=49.42635311494791
def ray(sx,sy,W=375,H=812):
  f=T0-P0;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);th=math.tan(math.radians(FOV)/2)
  return f+r*((sx/W*2-1)*th*W/H)+u*((1-sy/H*2)*th)
def hit(sx,sy):
  d=ray(sx,sy);t=0
  while t<300:
    p=P0+d*t
    if p[1]<gh(p[0],p[2]):return p,t
    t+=0.1
