# 湖畔运行时后处理的离线近似（COCOS_HANDOFF §6）：饱和度 ×1.35、对比度 ×1.12（以 0.5 为中心）、vignette 0.28；不做 bloom
import sys,numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)/255
g=(a*[0.2126,0.7152,0.0722]).sum(2,keepdims=True); a=g+(a-g)*1.35; a=(a-0.5)*1.12+0.5
H,W=a.shape[:2]; y,x=np.mgrid[0:H,0:W]; d=np.sqrt(((x-W/2)/(W/2))**2+((y-H/2)/(H/2))**2)/np.sqrt(2)
a=a*(1-0.28*np.clip((d-0.55)/0.45,0,1)**2)[...,None]
Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(sys.argv[2])
