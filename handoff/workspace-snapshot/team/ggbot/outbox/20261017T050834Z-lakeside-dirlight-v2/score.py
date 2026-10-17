import sys,numpy as np
from PIL import Image
def st(p):
    a=np.asarray(Image.open(p).convert('RGB').resize((720,1280))).astype(float)
    R=lambda y0,y1,x0,x1: np.median(a[y0:y1,x0:x1].reshape(-1,3),0).round()
    return {'top':R(0,120,0,720),'water_mid':R(380,470,250,470),'water_near':R(1150,1270,300,600),'trees':R(140,250,0,720),'all':a.reshape(-1,3).mean(0).round()}
for p in sys.argv[1:]: print(p,st(p))
