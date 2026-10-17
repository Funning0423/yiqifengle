import numpy as np,sys
from PIL import Image
from glass import render
import os
SRC=os.environ.get('SRC','/workspace/wechat-game/ui-audit/2026-10-16/fixes-a4a1041/raw/ib_night_390_home_sign.png');TAG=os.environ.get('TAG','')
BOX=(336.5,915.5,264.0,-11.3,4.4,104.0)
im=np.asarray(Image.open(SRC).convert('RGB')).astype(float)/255
H,W=im.shape[:2]
r=264/2/123.2
DAY=dict(p0=(min(1,0.43*r**0.6),1.2*r**0.6*2,1.3*2,1.0),p1=(1,0,-1,0),p2=(0,0,0.35,2))
def crop(): return (150,800,530,1040)
x0,y0,x1,y1=crop()
sub=im[y0:y1,x0:x1]; box=(BOX[0]-x0,BOX[1]-y0)+BOX[2:]
g=render(y1-y0,x1-x0,box,DAY)
a=g[...,3:4]; bg=(sub-g[...,:3])/np.maximum(1-a,1e-3)
np.save(TAG+'sub.npy',sub);np.save(TAG+'bg_raw.npy',bg);np.save(TAG+'box.npy',np.array(box))
print('alpha max',a.max(),'bg range',bg.min(),bg.max())
# text/leaf mask: pixels whose recovered bg exceeds what neighbours imply -> bright outliers inside card
L=bg.mean(2)
from scipy.ndimage import median_filter,binary_dilation
med=median_filter(L,size=(1,41))
mask=((np.abs(L-med)>0.06)|(bg.max(2)>1.0))&(a[...,0]>0.3)
# only within caption/leaf band
ys,xs=np.mgrid[0:L.shape[0],0:L.shape[1]]
M=np.linalg.inv(np.array([[box[2],box[4]],[box[3],box[5]]]));dx=xs-box[0];dy=ys-box[1]
lx=(M[0,0]*dx+M[0,1]*dy+0.5)*280; ly=(M[1,0]*dx+M[1,1]*dy+0.5)*100
band=(ly>18)&(ly<82)&(lx>20)&(lx<262)
mask=binary_dilation(mask&band,iterations=3)&band
bgf=bg.copy()
for y in range(bgf.shape[0]):
  m=mask[y]
  if m.any() and (~m).any():
    for c in range(3): bgf[y,m,c]=np.interp(np.where(m)[0],np.where(~m)[0],bg[y,~m,c])
np.save(TAG+'bg.npy',np.clip(bgf,0,1));np.save(TAG+'mask.npy',mask)
Image.fromarray((np.clip(bgf,0,1)*255).astype(np.uint8)).resize(((x1-x0)*2,(y1-y0)*2)).save(TAG+'bg.png')
# --- v2 mask: edge band + caption/leaf, harmonic inpaint
from glass import sdcap
dpx=sdcap(lx,ly,140,50,50)
edge=(dpx>-5)&(dpx<6)
Ls=sub.mean(2)
txt=((Ls>0.70)|((sub[...,1]-sub[...,0])>0.06))&band
txt=binary_dilation(txt,iterations=4)
M2=edge|txt
f=bg.copy(); f[M2]=np.nan
f=np.where(np.isnan(f),np.nanmean(bg[~M2],0),f) if False else f
init=np.clip(bg,0,1).copy()
# init masked with row interp from unmasked
for y in range(init.shape[0]):
  m=M2[y]
  if m.any() and (~m).any():
    for c in range(3): init[y,m,c]=np.interp(np.where(m)[0],np.where(~m)[0],np.clip(bg[y,~m,c],0,1))
u=init
for it in range(1500):
  nb=(np.roll(u,1,0)+np.roll(u,-1,0)+np.roll(u,1,1)+np.roll(u,-1,1))/4
  u=np.where(M2[...,None],nb,init)
np.save(TAG+'bg.npy',np.clip(u,0,1));np.save(TAG+'mask.npy',M2)
Image.fromarray((np.clip(u,0,1)*255).astype(np.uint8)).resize(((x1-x0)*2,(y1-y0)*2)).save(TAG+'bg.png')
