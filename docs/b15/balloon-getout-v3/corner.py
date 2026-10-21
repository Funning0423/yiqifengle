import json,sys,numpy as np
for tag in sys.argv[1:]:
    R=json.load(open(f'qa_{tag}.json'))['rows']; y=np.array([r['yaw'] for r in R])
    idx=[i for i in range(1,len(R)) if abs(y[i]-y[i-1])>0.05 and R[i]['seg']=='walk_loop']
    a,b=idx[0],idx[-1]; sl=[R[i].get('slide'+s) for i in range(a,b+1) for s in 'LR' if R[i].get('slide'+s) is not None]
    st=[R[i].get('slide'+s) for i in range(121,a) for s in 'LR' if R[i].get('slide'+s) is not None and R[i]['seg']=='walk_loop']
    print(tag,'corner f',a,b,len(range(a,b+1)),'max/p95/med',max(sl),np.percentile(sl,95).round(1),np.median(sl).round(2),'| straight',max(st),np.percentile(st,95).round(1),np.median(st).round(2))
    hc=[(r['f'],r['hand_door_gap_mm'],r['door_deg']) for r in R if r['hand_door_gap_mm']<20]; print(' hand<20mm',hc)
    print(' door deg f25..50',[R[f]['door_deg'] for f in range(24,52,3)])
