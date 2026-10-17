# side count using walk heading when moving, else her yaw (facing (sin yaw, cos yaw)); every outbound frame counted
import json,math,sys
for f in sys.argv[1:]:
  d=json.load(open(f));F=d['frames'];c={'right':0,'left':0};sd=[];worst=None
  for i,b in enumerate(F):
    a=F[i-1] if i else b; h=[b['root'][0]-a['root'][0],b['root'][2]-a['root'][2]]
    if math.hypot(*h)<1e-5: h=[math.sin(b['yaw']),math.cos(b['yaw'])]
    n=math.hypot(*h); h=[h[0]/n,h[1]/n]
    o=[b['pos'][0]-b['root'][0],b['pos'][2]-b['root'][2]]; s=o[0]*-h[1]+o[1]*h[0]
    k='right' if s>0 else 'left'; c[k]+=1; sd.append((round(b['t'],3),k))
    if worst is None or s<worst[0]: worst=(round(s,3),b['t'])
  ch=[sd[0]]+[sd[i] for i in range(1,len(sd)) if sd[i][1]!=sd[i-1][1]]
  print(f.split('/')[-1],c,'switches',ch[:12],'min lateral (m, +=right)',worst)
