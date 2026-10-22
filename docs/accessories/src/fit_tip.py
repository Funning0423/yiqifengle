# v3b：离线估算指尖弯曲缩放 f(|d|) 后的握把穿入（蒙皮对形态键线性：W=W0+f·(W1−W0)）
import numpy as np,sys
D={m:np.load(f'dump_{m}.npz') for m in ('hang','rigid','swing')}
def ev(fac):
    out={}
    for m,z in D.items():
        W=z['w0']+fac[None,:,None]*(z['w1']-z['w0']);e0=z['e0'][:,None];e1=z['e1'][:,None];a=e1-e0
        u=((W-e0)*a).sum(-1)/(a*a).sum(-1);uc=np.clip(u,0,1);d=np.linalg.norm(W-(e0+a*uc[...,None]),axis=-1)
        ins=(d<0.006)&(u>0)&(u<1);out[m]=dict(nin=int(ins.sum(1).max()),dep=float(((0.006-d)*ins).max()*1000),gap=float((d-0.006)[(u>0)&(u<1)].min()*1000) if True else 0,frames=int(ins.any(1).sum()),bad=ins.any(0))
    return out
if __name__=='__main__':
    dm=D['hang']['dmag'];o=ev(np.ones_like(dm))
    for m,r in o.items(): print(m,{k:v for k,v in r.items() if k!='bad'},'bad verts',np.where(r['bad'])[0].size,'dmag of bad',np.round(dm[r['bad']]*1000,1))
    print('dmag pct',np.round(np.percentile(dm[dm>0]*1000,[50,75,90,99,100]),1), (dm>0).sum(), len(dm))
