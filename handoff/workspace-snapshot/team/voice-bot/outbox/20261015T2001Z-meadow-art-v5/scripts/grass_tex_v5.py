# Warm/brighten green pixels of meadow_ground_v0_8_1024 (same 1024x1024 RGB JPEG). Non-green (path/sand/flowers) untouched via hue mask.
import sys,numpy as np
from PIL import Image
src,dst=sys.argv[1:3]
im=Image.open(src).convert('RGB'); hsv=np.asarray(im.convert('HSV')).astype(np.float32)
h,s,v=hsv[...,0]*360/255,hsv[...,1]/255,hsv[...,2]/255
m=np.clip(1-np.abs(h-95)/45,0,1)*np.clip((s-0.25)/0.2,0,1)   # green mask 50..140 deg, saturated only
h2=h-8*m                         # warmer (toward yellow-green)
s2=np.clip(s*(1+0.10*m),0,1)
v2=np.clip(v*(1+0.12*m),0,1)
out=np.stack([h2*255/360,s2*255,v2*255],-1).round().clip(0,255).astype(np.uint8)
Image.fromarray(out,'HSV').convert('RGB').save(dst,'JPEG',quality=int(sys.argv[3]) if len(sys.argv)>3 else 88,optimize=True,subsampling=2)
print("mask_mean",float(m.mean()))
