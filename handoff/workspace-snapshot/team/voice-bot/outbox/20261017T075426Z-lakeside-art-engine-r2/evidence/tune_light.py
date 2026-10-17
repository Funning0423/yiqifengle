import sys;sys.path.insert(0,'.')
import emu,params,regions,numpy as np,itertools,json
from PIL import Image
G=emu.load('gb_board.npz')
ref=np.asarray(Image.open('/workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_lastframe.png').convert('RGB')).astype(float)
# Mac v3.2 'off' land correction (sRGB affine, fitted on all land pixels: slope/offset per channel) - see report
SL=np.array([0.750,0.533,0.749]); OF=np.array([74.2,123.2,90.7])
oid=G['oid']; ids=G['ids']; W=oid==ids['LK_lake.glb']
def corr(img):
    a=img.astype(float); land=(oid>0)&~W
    a[land]=a[land]*SL+OF; return np.clip(a,0,255)
LANDR=['bridge_deck','bridge_side','grass_L','grass_R','far_trees','roof']
def score(img,keys=LANDR):
    return sum(np.abs(np.array(regions.med(img,regions.R[k]))-np.array(regions.med(ref,regions.R[k]))).sum() for k in keys)
lin255=lambda c:tuple(int(round(x*255)) for x in c)
def P_light(sun_scale,amb_ratio,linear=True,water=params.WATER_V32,fog=params.FOG):
    P=dict(params.V32); 
    if linear: P.update(sun_color_byte=lin255([1,.6,.32]),sky_byte=lin255([0.0116,0.2747,0.4793]),ground_byte=lin255([1.0,0.5457,0.1441]))
    P.update(sun_illum=125000*sun_scale,amb_illum=125000*sun_scale*amb_ratio,water=water,fog=fog); return P
if __name__=='__main__':
    rows=[]
    for lin in (False,True):
        for s,k in itertools.product([0.5,0.7,0.85,1.0,1.2],[0.15,0.25,0.35,0.5,0.75]):
            img=emu.shade(G,P_light(s,k,lin)); rows.append((score(corr(img)),score(img),lin,s,k))
    rows.sort(); 
    for r in rows[:8]: print('corr %.0f raw %.0f linear=%s sun=%.2f amb=%.2f'%r)
    base=[r for r in rows if r[2]==False and r[3]==1.0 and r[4]==0.75][0]; print('v3.2 baseline corr %.0f raw %.0f'%base[:2])
    rr=sorted(rows,key=lambda r:r[1])[:5]
    for r in rr: print('RAWBEST corr %.0f raw %.0f linear=%s sun=%.2f amb=%.2f'%r)
