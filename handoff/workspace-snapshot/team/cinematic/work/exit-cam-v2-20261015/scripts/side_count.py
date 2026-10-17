import json,math,sys
for f in sys.argv[1:]:
  d=json.load(open(f));F=[x for x in d['frames'] if x['phase']=='outbound'];c={'right':0,'left':0};sd=[]
  for a,b in zip(F,F[1:]):
    h=[b['root'][0]-a['root'][0],b['root'][2]-a['root'][2]]
    if math.hypot(*h)<1e-5: continue
    o=[b['position'][0]-b['root'][0],b['position'][2]-b['root'][2]];k='right' if o[0]*-h[1]+o[1]*h[0]>0 else 'left';c[k]+=1;sd.append((b['t'],k))
  ch=[sd[0]]+[sd[i] for i in range(1,len(sd)) if sd[i][1]!=sd[i-1][1]]
  print(f.split('/')[-1],c,'switches',ch,'events',d['events'][:2],'outbound s %.2f'%(F[-1]['t']-F[0]['t']))
