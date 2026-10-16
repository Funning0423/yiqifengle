# palette: paint new 8x8 cells ; ground: contact AO + soft cool shadow around windmill/house (input = v6 textures)
import json,numpy as np,sys
from PIL import Image
cells=json.load(open('b71/v71_cells.json'))
pal=np.array(Image.open('v6_meadow_palette_256.png').convert('RGBA')); orig_mode=Image.open('v6_meadow_palette_256.png').mode
for k,c in cells.items():
    x=c['block_px_x']; yb=c['block_px_y_from_bottom']; r0=256-(yb+8)
    pass
    pal[r0:r0+8,x:x+8,:3]=np.array([round(v*255) for v in c['rgb']]); pal[r0:r0+8,x:x+8,3]=255
Image.fromarray(pal,'RGBA').convert(orig_mode).save('pal_v71.png',optimize=True)
g=np.asarray(Image.open('v6_meadow_ground_v0_8_1024.jpg').convert('RGB')).astype(np.float32)
N=1024; cols=np.arange(N)+0.5; rows=np.arange(N)+0.5
X=cols[None,:]/N*160-80; Y=(1-rows[:,None]/N)*160-80
X=np.broadcast_to(X,(N,N)); Y=np.broadcast_to(Y,(N,N))
dt=np.hypot(X-0,Y-30); ao_t=0.44*np.exp(-np.maximum(0,dt-2.9)/1.2)*(dt>2.0)
dx=np.maximum(np.maximum(2.0-X,X-7.2),0); dy=np.maximum(np.maximum(28.5-Y,Y-32.7),0); dh=np.hypot(dx,dy); ao_h=0.26*np.exp(-dh/1.1)
L=np.array([0.5,0.866]); P=np.stack([X-0-3.5*L[0],Y-30-3.5*L[1]],-1); a=P@L; b=P@np.array([-L[1],L[0]])
sh=0.20*np.exp(-(a/6.0)**2-(b/3.2)**2)
D=1-(1-ao_t)*(1-ao_h)*(1-sh)
mult=1-D[...,None]*np.array([1.0,0.88,0.55])
out=np.clip(g*mult,0,255).round().astype(np.uint8)
Image.fromarray(out).save('ground_v71.jpg','JPEG',quality=80,optimize=True,subsampling=2)
print("max D",float(D.max()),"px affected(D>0.02)",int((D>0.02).sum()))
# ---- v7.1 sky: repaint the top cloud (flat cut bottom) in meadow_sky_4096x1024 as a puffy cloud with a round bottom ----
sky=np.asarray(Image.open('img_meadow_sky_4096x1024.jpg').convert('RGB')).astype(np.float32)
X0,X1,Y0,Y1=860,1060,535,630          # bbox of the old cloud (+margin), image pixels
# 1) erase: per-row sky colour interpolated between columns left/right of the box
L=sky[Y0:Y1,X0-12:X0-2].mean(1); R=sky[Y0:Y1,X1+2:X1+12].mean(1)
w=np.linspace(0,1,X1-X0)[None,:,None]; sky[Y0:Y1,X0:X1]=L[:,None]*(1-w)+R[:,None]*w
# 2) paint puffs (ellipses) top AND bottom; shading: white top, blue-grey bottom, soft 2px edge
rng=np.random.default_rng(71)
puffs0=[(905,585,26,20),(940,568,30,25),(960,566,26,24),(978,562,30,27),(1012,574,24,21),(1035,588,15,13),(925,598,24,15),(962,600,28,16),(1000,598,24,15),(885,595,15,12)]
puffs=[(960+(x-960)*0.84,590+(y-590)*0.84,rx*0.84,ry*0.84) for x,y,rx,ry in puffs0]
yy,xx=np.mgrid[Y0:Y1,X0:X1].astype(np.float32)
D=np.full(yy.shape,9.0); Hm=np.zeros(yy.shape)
for cx,cy,rx,ry in puffs:
    d=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2); D=np.minimum(D,d)
    Hm=np.maximum(Hm,np.clip(1-d,0,1)*(1-(yy-cy)/ry*0.6))
alpha=np.clip((1-D)*min(r for _,_,r,_ in puffs)/2.0,0,1)[...,None]
TOPc=np.array([246,249,248.]); SHDc=np.array([150,172,186.])
ytop,ybot=556,612; t=np.clip((yy-ytop)/(ybot-ytop),0,1); t=np.clip((t-0.30)/0.6,0,1); t=t*t*(3-2*t)
# local puff highlight keeps each bump readable
lt=np.clip(t-0.15*Hm,0,1)[...,None]
col=TOPc*(1-lt)+SHDc*lt
sky[Y0:Y1,X0:X1]=sky[Y0:Y1,X0:X1]*(1-alpha)+col*alpha
Image.fromarray(np.clip(sky,0,255).round().astype(np.uint8)).save('sky_v71.jpg','JPEG',quality=85,optimize=True)
