# v7.2 sky: top cloud = v7.1 puffs scaled x0.85 about (960,590), filled core (no blue gap), union-of-soft-masks alpha. Input = original sky.
import numpy as np
from PIL import Image
sky=np.asarray(Image.open('img_meadow_sky_4096x1024.jpg').convert('RGB')).astype(np.float32)
X0,X1,Y0,Y1=860,1060,535,630
L=sky[Y0:Y1,X0-12:X0-2].mean(1); R=sky[Y0:Y1,X1+2:X1+12].mean(1)
w=np.linspace(0,1,X1-X0)[None,:,None]; sky[Y0:Y1,X0:X1]=L[:,None]*(1-w)+R[:,None]*w
puffs0=[(905,585,26,20),(940,568,30,25),(960,566,26,24),(978,562,30,27),(1012,574,24,21),(1035,588,15,13),(925,598,24,15),(962,600,28,16),(1000,598,24,15),(885,595,15,12)]
S=0.84*0.85
puffs=[(960+(x-960)*S,590+(y-590)*S,rx*S,ry*S) for x,y,rx,ry in puffs0]
# core filler: wide ellipse through the middle so no sky shows between top and bottom puffs
puffs+= [(960,586,58*S/0.84*0.84,20*S),(950,592,40*S,16*S),(985,590,40*S,16*S)]
yy,xx=np.mgrid[Y0:Y1,X0:X1].astype(np.float32)
A=np.zeros(yy.shape); Hm=np.zeros(yy.shape)
for cx,cy,rx,ry in puffs:
    d=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2)
    A=np.maximum(A,np.clip((1-d)*min(rx,ry)/1.8,0,1))
    Hm=np.maximum(Hm,np.clip(1-d,0,1)*(1-(yy-cy)/ry*0.6))
ys=yy[A>0.5]; ytop,ybot=ys.min(),ys.max()
alpha=A[...,None]
TOPc=np.array([246,249,248.]); SHDc=np.array([150,172,186.])
t=np.clip((yy-ytop)/(ybot-ytop),0,1); t=np.clip((t-0.30)/0.6,0,1); t=t*t*(3-2*t)
lt=np.clip(t-0.15*Hm,0,1)[...,None]
col=TOPc*(1-lt)+SHDc*lt
sky[Y0:Y1,X0:X1]=sky[Y0:Y1,X0:X1]*(1-alpha)+col*alpha
Image.fromarray(np.clip(sky,0,255).round().astype(np.uint8)).save('sky_v72.jpg','JPEG',quality=85,optimize=True)
# hole check: pixels inside the cloud's filled hull that are still sky-blue
m=A>0.5
holes=sum(int((~m[r,np.where(m[r])[0].min():np.where(m[r])[0].max()+1]).sum()) for r in range(m.shape[0]) if m[r].any())
holes+=sum(int((~m[np.where(m[:,c])[0].min():np.where(m[:,c])[0].max()+1,c]).sum()) for c in range(m.shape[1]) if m[:,c].any())
print('holes',holes,'bbox x',xx[m].min(),xx[m].max(),'y',ytop,ybot)
