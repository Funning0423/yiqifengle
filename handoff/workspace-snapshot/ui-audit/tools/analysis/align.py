import numpy as np,sys
from PIL import Image
def grad(a):
  g=a.mean(2);gx=np.abs(np.diff(g,axis=1))[:-1];gy=np.abs(np.diff(g,axis=0))[:,:-1];e=gx+gy;return (e-e.mean())/(e.std()+1e-6)
for n in sys.argv[1:]:
  im=Image.open(n);W=im.width//4
  A=np.asarray(im.crop((0,16,W,im.height))).astype(float);B=np.asarray(im.crop((W,16,2*W,im.height))).astype(float)
  y0,y1,x0,x1=0,int(A.shape[0]*0.17),70,W-10   # sky/mountain band above HUD, right of pause button
  a=grad(A[y0:y1,x0:x1]);best=None
  for dy in range(-12,13):
    for dx in range(-12,13):
      b=grad(B[max(0,y0+dy):y1+dy,x0+dx:x1+dx]) if y0+dy>=0 else None
      if b is None or b.shape!=a.shape:continue
      c=float((a*b).mean())
      if best is None or c>best[0]:best=(c,dx,dy)
  c0=float((a*grad(B[y0:y1,x0:x1])).mean())
  print(n,'band y<%d'%y1,'corr@0=%.3f'%c0,'best corr=%.3f shift dx=%d dy=%d'%best)
