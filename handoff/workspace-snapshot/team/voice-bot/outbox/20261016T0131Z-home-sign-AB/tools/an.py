import json,sys,numpy as np
def metrics(base):
    ids=np.load(base+'_ids.npy'); beh=np.load(base+'_behind.npy'); m=json.load(open(base+'_meta.json')); N=m['names']; H,W=ids.shape
    def mask(pred): 
        sel=[i for i,n in enumerate(N) if pred(n)]; return np.isin(ids,sel)
    sg=mask(lambda n:n=='signpost'); cols=np.where(sg.any(0))[0]; rows=np.where(sg.any(1))[0]
    palm=mask(lambda n:n.startswith('beach_palm_tall'))
    palms_all=mask(lambda n:'palm' in n)
    door=N.index('env_lighthouse_door'); ext=N.index('env_lighthouse_ext')
    r=dict(W=W,H=H,sign_w_px=int(np.ptp(cols)+1) if len(cols) else 0,sign_w_frac=round((np.ptp(cols)+1)/W,4) if len(cols) else 0,
      sign_bbox=[int(cols.min()),int(rows.min()),int(cols.max()),int(rows.max())] if len(cols) else None,
      sign_touches_edge=bool(len(cols) and (cols.min()==0 or cols.max()==W-1 or rows.min()==0 or rows.max()==H-1)),
      palm_tall_cov=round(palm.mean(),4),palm_tall_cov_bottom40=round(palm[int(H*.6):].mean(),4),all_palm_cov=round(palms_all.mean(),4),
      door_px_visible=int((ids==door).sum()),door_px_hidden_by_sign=int((beh==door).sum()),lighthouse_px_hidden_by_sign=int((beh==ext).sum()),
      sign_cam_min_m=round(m['sign_cam_min_m'],2),feet=m['feet'],names=[n for n in N])
    hid=[N[i] for i in np.unique(beh[beh>=0])]; r['behind_sign']=hid
    return r
if __name__=='__main__': print(json.dumps(metrics(sys.argv[1]),indent=1))
