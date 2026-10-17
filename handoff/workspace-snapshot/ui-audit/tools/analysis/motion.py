import sys,json,numpy as np
sys.path.insert(0,'.');from lum import frames
t,a,b=sys.argv[1],float(sys.argv[2]),float(sys.argv[3])
pts,fr=frames(t,a,b)
win=np.outer(np.hanning(400),np.hanning(375)).astype(np.float32)
res=[]
for i in range(1,len(fr)):
  A=fr[i-1][60:460].astype(np.float32);B=fr[i][60:460].astype(np.float32)
  FA=np.fft.fft2(A*win);FB=np.fft.fft2(B*win);R=FB*np.conj(FA);R/=np.abs(R)+1e-9;c=np.real(np.fft.ifft2(R));k=np.unravel_index(np.argmax(c),c.shape);r=float(c[k]);dy,dx=[(k[j]+c.shape[j]//2)%c.shape[j]-c.shape[j]//2 for j in (0,1)]
  mad=float(np.mean(np.abs(B-A)))
  res.append((pts[i],dx,dy,r,mad))
r=np.array(res);sp=np.hypot(r[:,1],r[:,2])
out=[]
for i in range(len(r)):
  acc=abs(sp[i]-sp[i-1]) if i else 0
  out.append([round(r[i,0],2),round(sp[i],1),round(acc,1),round(r[i,3],2),round(r[i,4],1)])
json.dump(out,open(f'logs/motion_{t}.json','w'))
o=np.array(out)
print(t,'n',len(o),'mad median',np.median(o[:,4]),'p99',np.percentile(o[:,4],99))
for x in sorted(out,key=lambda x:-x[4])[:8]:print('  top mad',x)
