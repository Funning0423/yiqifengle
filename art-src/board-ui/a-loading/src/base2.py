from PIL import Image, ImageFilter
import numpy as np, cv2
a=np.array(Image.open('/workspace/yiqifengle/previews/pm-audit/A4_concept_loading_mock.jpg').convert('RGB'))
m=np.zeros(a.shape[:2],np.uint8)
for x0,y0,x1,y1 in [(262,206,418,288),(120,305,467,410),(90,980,500,1040),(190,1032,395,1075),(0,1228,586,1266)]:
    m[y0:y1,x0:x1]=255
r=cv2.inpaint(a,m,15,cv2.INPAINT_TELEA)
im=Image.fromarray(r)
bl=im.filter(ImageFilter.GaussianBlur(9))
mk=Image.fromarray(cv2.GaussianBlur(m,(0,0),10))
im=Image.composite(bl,im,mk)
im=im.resize((750,1621),Image.LANCZOS).resize((750,1624),Image.LANCZOS)
im.save('base_clean.png')
