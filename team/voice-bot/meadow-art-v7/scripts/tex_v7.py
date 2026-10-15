# palette: paint new 8x8 cells ; ground: contact AO + soft cool shadow around windmill/house (input = v6 textures)
import json,numpy as np,sys
from PIL import Image
cells=json.load(open('b7/v7_cells.json'))
pal=np.array(Image.open('v6_meadow_palette_256.png').convert('RGBA')); orig_mode=Image.open('v6_meadow_palette_256.png').mode
for k,c in cells.items():
    x=c['block_px_x']; yb=c['block_px_y_from_bottom']; r0=256-(yb+8)
    pass
    pal[r0:r0+8,x:x+8,:3]=np.array([round(v*255) for v in c['rgb']]); pal[r0:r0+8,x:x+8,3]=255
Image.fromarray(pal,'RGBA').convert(orig_mode).save('pal_v7.png',optimize=True)
g=np.asarray(Image.open('v6_meadow_ground_v0_8_1024.jpg').convert('RGB')).astype(np.float32)
N=1024; cols=np.arange(N)+0.5; rows=np.arange(N)+0.5
X=cols[None,:]/N*160-80; Y=(1-rows[:,None]/N)*160-80
X=np.broadcast_to(X,(N,N)); Y=np.broadcast_to(Y,(N,N))
dt=np.hypot(X-0,Y-30); ao_t=0.34*np.exp(-np.maximum(0,dt-2.9)/1.5)*(dt>2.0)
dx=np.maximum(np.maximum(2.0-X,X-7.2),0); dy=np.maximum(np.maximum(28.5-Y,Y-32.7),0); dh=np.hypot(dx,dy); ao_h=0.26*np.exp(-dh/1.1)
L=np.array([0.5,0.866]); P=np.stack([X-0-3.5*L[0],Y-30-3.5*L[1]],-1); a=P@L; b=P@np.array([-L[1],L[0]])
sh=0.20*np.exp(-(a/6.0)**2-(b/3.2)**2)
D=1-(1-ao_t)*(1-ao_h)*(1-sh)
mult=1-D[...,None]*np.array([1.0,0.88,0.55])
out=np.clip(g*mult,0,255).round().astype(np.uint8)
Image.fromarray(out).save('ground_v7.jpg','JPEG',quality=80,optimize=True,subsampling=2)
print("max D",float(D.max()),"px affected(D>0.02)",int((D>0.02).sum()))
