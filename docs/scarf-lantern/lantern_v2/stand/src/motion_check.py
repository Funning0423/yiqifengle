import json,sys,numpy as np
r=json.load(open(sys.argv[1]))
for run in sorted({(x['run'],x['clip']) for x in r}):
    R_=[x for x in r if (x['run'],x['clip'])==run];R_.sort(key=lambda x:x['f'])
    F={s:np.array([x['feet'][s] for x in R_]) for s in 'LR'}
    drift={s:round(float(np.linalg.norm(F[s]-F[s][0],axis=1).max()*1000),2) for s in 'LR'}
    kd=max(max(abs(R_[i+1]['knee_'+s]-R_[i]['knee_'+s]) for i in range(len(R_)-1)) for s in 'LR') if len(R_)>1 else 0
    print(run,'frames',len(R_),'foot_drift_mm',drift,'max knee step deg/frame',round(kd,2),'lean max',max(x['lean_deg'] for x in R_),'abd max',max(x['abd'] for x in R_),'wrist_twist max',max(x['wrist_twist'] for x in R_),'pend max',max(abs(x.get('pend_deg') or 0) for x in R_))
