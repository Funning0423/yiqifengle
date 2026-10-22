# r6-fix：在渲染截图上采「+」与角标底色的实际像素，按 WCAG 2.x 相对亮度公式算对比度。
# 角标中心 = 第 3 个道具 (375+158+42, 1404-40) @750×1624，半径 21px。圆内 r≤15 的像素按亮度排序：
#   「+」= 最暗 12% 像素的中位色（笔画芯，避开抗锯齿边）；底色 = 最亮 50% 像素的中位色。
# python3 measure_plus.py IMG.png [...]
import sys,numpy as np
from PIL import Image
def lin(c):
    c=c/255.0; return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def Y(rgb): r,g,b=lin(np.asarray(rgb,float)); return 0.2126*r+0.7152*g+0.0722*b
def ratio(a,b): ya,yb=sorted((Y(a),Y(b)),reverse=True); return (ya+0.05)/(yb+0.05)
CX,CY,R=375+158+42,1404-40,15
for p in sys.argv[1:]:
    a=np.asarray(Image.open(p).convert('RGB')).astype(float)
    yy,xx=np.mgrid[0:a.shape[0],0:a.shape[1]]; m=(xx-CX)**2+(yy-CY)**2<=R*R
    px=a[m]; lum=px@[0.2126,0.7152,0.0722]; o=np.argsort(lum); n=len(o)
    fg=np.median(px[o[:max(3,int(n*0.12))]],0); bg=np.median(px[o[n//2:]],0)
    print('%-40s plus %3d/%3d/%3d  badge %3d/%3d/%3d  contrast %.2f'%(p.split('/')[-1],*fg,*bg,ratio(fg,bg)))
