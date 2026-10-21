import json,sys,numpy as np
for tag in sys.argv[1:]:
    d=json.load(open(f'qa_{tag}.json'));R=d['rows'];print('==',tag,{k:(round(v,3) if isinstance(v,float) else v) for k,v in d['timeline'].items() if k not in('P0','A','S')})
    segs=[]
    for r in R:
        if not segs or segs[-1][0]!=r['seg']: segs.append([r['seg'],[]])
        segs[-1][1].append(r)
    for n,rs in segs:
        sl=[r.get('slide'+s) for r in rs for s in 'LR' if r.get('slide'+s) is not None]
        kn=np.array([[r['kneeL'],r['kneeR']] for r in rs])
        print(f"{n:16s} f{rs[0]['f']}-{rs[-1]['f']} slide max {max(sl) if sl else '-'} p95 {np.percentile(sl,95).round(1) if sl else '-'} med {np.median(sl).round(2) if sl else '-'} | minSole {min(min(r['soleL'],r['soleR']) for r in rs)} | knee min {kn.min().round(1)} | bk {sum(r['basket_x_body']+r['basket_x_dress']+r['basket_x_apron'] for r in rs)} leafX {sum(r['leafX_body']+r['leafX_dress']+r['leafX_apron'] for r in rs)} door_in {sum(r['door_in_body']+r['door_in_dress']+r['door_in_apron'] for r in rs)} min gap body/cloth {min(r['door_gap_body_mm'] for r in rs)}/{min(r['door_gap_cloth_mm'] for r in rs)} hand {min(r['hand_door_gap_mm'] for r in rs)} yaw {rs[0]['yaw']}->{rs[-1]['yaw']}")
    for s in 'LR':
        k=np.array([r['knee'+s] for r in R]); dk=np.abs(np.diff(k)); print(' knee',s,'max dθ/frame',dk.max().round(1),'at f',int(dk.argmax()))
    big=[(r['f'],r['seg'],r.get('slideL'),r.get('slideR')) for r in R if max(r.get('slideL') or 0,r.get('slideR') or 0)>8]; print(' frames slide>8mm',big)
