import sys,json,numpy as np
from PIL import Image
def stats(p,mask='/workspace/u3/work/mask.png'):
    a=np.asarray(Image.open(p).convert('RGB').resize((750,1624))).astype(float)
    m=np.asarray(Image.open(mask).convert('L').resize((750,1624)))>128
    r,g,b=a[...,0],a[...,1],a[...,2]; Y=0.299*r+0.587*g+0.114*b
    yel=m&(r>150)&(g>130)&(r-b>50)&(g-b>35)
    d=Y[yel]; mx=a[yel].max(1)
    return dict(file=p,yellow_px=int(yel.sum()),p5=round(float(np.percentile(d,5)),1),p50=round(float(np.percentile(d,50)),1),p95=round(float(np.percentile(d,95)),1),
      clip_any254=round(float((mx>=254).mean()*100),3),girl_p95=round(float(np.percentile(Y[m],95)),1),girl_clip=round(float((a[m].max(1)>=254).mean()*100),3),
      frame_p95=round(float(np.percentile(Y,95)),1))
print(json.dumps([stats(p) for p in sys.argv[1:]],ensure_ascii=False,indent=1))
