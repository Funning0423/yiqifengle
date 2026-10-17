import sys,json,numpy as np
sys.argv=['x','meadow'];sys.path.insert(0,'.');import cand as C
V=json.loads(open('V.json').read());V=[[0,20]]+V;pts=[]
for a,b in zip(V,V[1:]):
  n=int(np.ceil(np.hypot(b[0]-a[0],b[1]-a[1])/0.8))
  for s in range(1,n+1):
    x=a[0]+(b[0]-a[0])*s/n;z=a[1]+(b[1]-a[1])*s/n;pts.append([round(x,3),round(float(C.ground(x,z)[0]),3),round(z,3)])
allp=[[0,1.21,20]]+pts;worst=0
for a,b in zip(allp,allp[1:]):
  for t in np.linspace(0,1,11):
    x=a[0]+(b[0]-a[0])*t;z=a[2]+(b[2]-a[2])*t;y=a[1]+(b[1]-a[1])*t;worst=max(worst,abs(C.ground(x,z)[0]-y))
json.dump(pts,open('line_try.json','w'));print(len(pts),'worstfoot',round(worst,3),file=sys.stderr)
