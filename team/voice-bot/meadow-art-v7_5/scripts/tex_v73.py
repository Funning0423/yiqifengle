# v7.3 sky: the big cloud seen from meadowScenePose (sky texture x~900-1335, flat cut bottom at y~847) gets a scalloped round underside. Input = sky_v72.jpg.
import numpy as np
from PIL import Image
sky=np.asarray(Image.open('sky_v72.jpg').convert('RGB')).astype(np.float32)
X0,X1,Y0,Y1=895,1338,775,880
rowsky=np.median(sky[Y0:Y1,1342:1354],axis=1)            # clear sky colour per row, right of the cloud
rng=np.random.default_rng(73)
bumps=[]; x=902
for cx,r,bot in [(908,13,826),(930,15,831),(952,12,827),(1000,34,832),(1052,38,846),(1108,34,834),(1160,40,848),(1214,34,836),(1258,32,830),(1290,18,810)]:
    bumps.append((cx,bot-r,r))
xs=np.arange(X0,X1)+0.5; ys=np.arange(Y0,Y1)+0.5
bottom=np.full(xs.shape,-1e9)
for cx,cy,r in bumps:
    d=r*r-(xs-cx)**2; m=d>0; bottom[m]=np.maximum(bottom[m],cy+np.sqrt(d[m]))
yy=ys[:,None]; cov=np.clip(bottom[None,:]-yy+0.5,0,1)        # 1 = keep cloud, 0 = sky ; 1px AA
reg=sky[Y0:Y1,X0:X1]
# only touch pixels that were cloud-grey (not the clear sky between clouds) : luminance diff from row sky
diff=np.abs(reg-rowsky[:,None,:]).sum(-1)>18
newc=reg.copy()
# soft rim light just inside each scallop so the bumps read as round
rim=np.clip(1-(bottom[None,:]-yy)/6,0,1)*cov*0.18
newc=newc*(1-rim[...,None])+np.array([200,212,222.])*rim[...,None]
diff&=(bottom>0)[None,:]
out=np.where(diff[...,None], newc*cov[...,None]+rowsky[:,None,:]*(1-cov[...,None]), reg)
sky[Y0:Y1,X0:X1]=out
Image.fromarray(np.clip(sky,0,255).round().astype(np.uint8)).save('sky_v73.jpg','JPEG',quality=85,optimize=True)
print('bumps',len(bumps))
