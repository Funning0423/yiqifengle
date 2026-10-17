import sys;sys.path.insert(0,'.')
import emu,params,regions,tune_light as T,numpy as np,itertools
from PIL import Image
ref=np.asarray(Image.open('/workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_lastframe.png').convert('RGB')).astype(float)
SUN,AMB=0.5,0.4
def midstd(frames):
    A=np.stack(frames); s=A.std(0); x0,y0,x1,y1=regions.R['mid_water']; return s[int(y0*640):int(y1*640),int(x0*360):int(x1*360)].mean()
def frames(P,ts=(0,2,4,6,8,10,12,14)):
    out=[]
    for t in ts:
        P2=dict(P); P2['water']=dict(P['water'],t=t); out.append(emu.shade(T.G,P2))
    return out
def gray(a): return np.asarray(Image.fromarray(a).convert('L').resize((360,640))).astype(float)
def P_w(**kw):
    W=dict(params.WATER_V32,waves=True,wave_tilt=0.06,wave_freq=0.9,wave_speed=0.7); W.update(kw)
    return dict(T.P_light(SUN,AMB,True),water=W)
WK=['near_water_L','near_water_R','mid_water']
def wscore(img): return sum(np.abs(np.array(regions.med(img,regions.R[k]))-np.array(regions.med(ref,regions.R[k]))).sum()*(2 if k=='near_water_L' else 1) for k in WK)
if __name__=='__main__':
    for nm,kw in (('v3.2 waves',{}),('fade12-35',dict(wave_fade=(12,35))),('fade+flatsky',dict(wave_fade=(12,35),flat_sky=True)),('fade8-24+flatsky',dict(wave_fade=(8,24),flat_sky=True))):
        fr=frames(P_w(**kw)); print(nm,'mid std %.2f'%midstd([gray(f) for f in fr]),' '.join(k+' '+'/'.join(map(str,regions.med(fr[0],regions.R[k]))) for k in WK))
