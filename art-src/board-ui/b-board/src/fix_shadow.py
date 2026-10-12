# Post step after Blender: baked contact shadows (shadow-catcher pixels = near-black, partial alpha)
# are feathered to zero toward the frame border so they never show a square edge, and softened ×0.85.
# python3 fix_shadow.py <rawdir>
import sys,glob,os
import numpy as np
from PIL import Image
for f in sorted(glob.glob(os.path.join(sys.argv[1],'*.png'))):
    n=os.path.basename(f)
    if not (n.startswith('piece_') or n.startswith('tool_')): continue
    a=np.asarray(Image.open(f).convert('RGBA')).astype(float); H,W=a.shape[:2]
    lum=a[...,:3].mean(2); sh=(a[...,3]<250)&(lum<60)
    yy,xx=np.mgrid[0:H,0:W]; d=np.minimum.reduce([xx,yy,W-1-xx,H-1-yy]).astype(float)
    fall=np.clip(d/(0.16*W),0,1)**1.5
    a[...,3]=np.where(sh,a[...,3]*fall*0.85,a[...,3])
    Image.fromarray(a.clip(0,255).astype(np.uint8)).save(f)
print('fixed')
