import sys;sys.path.insert(0,'.')
import emu, regions, params, tune_light as T, p33, numpy as np
from scipy.optimize import minimize
G=T.G; Gs={k:(v[::4,::4] if isinstance(v,np.ndarray) else v) for k,v in G.items()}
ref=np.asarray(regions.Image.open('/workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_lastframe.png').convert('RGB').resize((180,320))).astype(float)
def med(a,k): return np.array(regions.med(a,regions.R[k]),float)
TGT={'near_water_L':np.array([66,152,146.]),'near_water_R':med(ref,'near_water_R'),'mid_water':med(ref,'mid_water')}
def W_of(x):
    mn,am,ss,fl=x; return dict(p33.W33,main=mn,amb=am,sky_strength=ss,floor=fl)
def P_of(x): return dict(T.P_light(0.5,0.4,True),water=W_of(x))
def loss(x):
    mn,am,ss,fl=x
    if not(0.2<=mn<=3 and 0.2<=am<=4 and 0.1<=ss<=2 and 0.0<=fl<=0.6): return 1e4
    img=emu.shade(Gs,P_of(x)).astype(float)
    return sum(np.abs(med(img,k)-TGT[k]).sum()*w for k,w in (('near_water_L',3),('near_water_R',1),('mid_water',1)))
if __name__=='__main__':
    best=None
    for x0 in ([1.0,1.0,1.0,0.25],[1.5,2.0,0.8,0.25],[0.8,1.5,1.2,0.35]):
        r=minimize(loss,x0,method='Nelder-Mead',options=dict(maxiter=300,xatol=1e-3,fatol=0.5))
        print(r.x.round(3),r.fun)
        if best is None or r.fun<best.fun: best=r
    x=best.x.round(2); img=emu.shade(G,P_of(x)); print('rounded',x,{k:regions.med(img,regions.R[k]) for k in TGT})
    np.save('opt_w33.npy',x)
