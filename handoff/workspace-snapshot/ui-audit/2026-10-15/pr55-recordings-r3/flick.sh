#!/bin/bash
# A-B-A flicker detector: frame i differs from i-1 and i+1 but i-1≈i+1
f=$1; h=$2
ffmpeg -loglevel error -i $f -vf "fps=30,crop=375:$h:0:0,scale=188:-1,format=gray" -f rawvideo - | python3 -c "
import sys,numpy as np
d=sys.stdin.buffer.read();w=188;hh=int($h*188/375)
n=len(d)//(w*hh);a=np.frombuffer(d[:n*w*hh],np.uint8).reshape(n,hh,w).astype(np.int16)
out=[]
for i in range(1,n-1):
  dp=np.abs(a[i]-a[i-1]).mean();dn=np.abs(a[i]-a[i+1]).mean();dx=np.abs(a[i-1]-a[i+1]).mean()
  if dp>6 and dn>6 and dx<min(dp,dn)/3: out.append((round(i/30,2),round(dp,1),round(dx,1)))
print('$f',n,'flicker',out[:12])
"
