import json,csv,numpy as np,sys
B=json.load(open('../sit-drape-stool/arm_seam/q5_v4.json'))
R={k:json.load(open(f'q_{k}.json')) for k in ('fixed','gameAsIs')}
IX=['DRESSxStool','APRONxStool','BOWxStool','BODYxStool','HANDxAPRON','HANDxDRESS','HANDxBODY','DRESSxBODY','APRONxBODY','DRESSxAPRON']
def kin(rows,c):
    x=[r for r in rows if r['clip']==c];o={}
    for s in 'LR':
        for k in ('ankle','toe','knee','wrist'):
            p=np.array([r[k+s] for r in x]);o[k+s]=np.linalg.norm(np.diff(p,axis=0),axis=1)*1000
        p=np.array([r['wrist'+s] for r in x]);v=np.diff(p,axis=0)*30;a=np.diff(v,axis=0)*30;o['acc'+s]=np.linalg.norm(a,axis=1);o['spd'+s]=np.linalg.norm(v,axis=1)
    return o
S={}
w=csv.writer(open('perframe_clips.csv','w'));w.writerow(['cfg','clip','f','t_s']+IX+['clearL_mm','clearR_mm','wristL_step_mm','wristR_step_mm','ankleL_step','ankleR_step','toeL_step','toeR_step','kneeL_step','kneeR_step'])
O=json.load(open('q_orig.json'))
for cfg,rows in list(R.items())+[('v4_baseline',B),('orig_prodclips',O)]:
    S[cfg]={}
    for c in ('sit_down','sit_hold','stand_up'):
        x=[r for r in rows if r['clip']==c];K=kin(rows,c)
        for i,r in enumerate(x):
            st=lambda k:round(float(K[k][i-1]),2) if i>0 else 0
            w.writerow([cfg,c,r['f'],round(r['f']/30,4)]+[r.get(k,'') for k in IX]+[r['clearL_mm'],r['clearR_mm']]+[st(k) for k in ('wristL','wristR','ankleL','ankleR','toeL','toeR','kneeL','kneeR')])
        d={k:(max(r[k] for r in x),sum(r[k] for r in x)) for k in IX if k in x[0]}
        d.update({k+'_maxstep_mm':round(float(K[k].max()),2) for k in K if not k.startswith(('acc','spd'))})
        d.update({k+'_peak':round(float(K[k].max()),3) for k in K if k.startswith(('acc','spd'))})
        d['clearL_mm']=(min(r['clearL_mm'] for r in x),max(r['clearL_mm'] for r in x));d['clearR_mm']=(min(r['clearR_mm'] for r in x),max(r['clearR_mm'] for r in x))
        S[cfg][c]=d
        if c=='sit_down': S[cfg]['sd_landing_wrist_steps']={s:[round(float(v),2) for v in K['wrist'+s][-8:]] for s in 'LR'}
json.dump(S,open('summary_clips.json','w'),indent=1)
for c in ('sit_down','sit_hold','stand_up'):
    print('==',c)
    for k in S['fixed'][c]: print(f'{k:22s}', 'fixed',S['fixed'][c][k],' asIs',S['gameAsIs'][c].get(k),' v4',S['v4_baseline'][c].get(k))
print('landing',{k:S[k]['sd_landing_wrist_steps'] for k in S})
