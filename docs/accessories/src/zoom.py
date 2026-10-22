# 局部放大（最近邻 ZOOM 倍）：左 = 原图，右 = 品红描出穿插三角的可见像素、绿色描出握把
import numpy as np,sys,json
from PIL import Image
raw,name,tod,zoom=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]);V=json.load(open(raw+'/visibility.json'))[name]
img=Image.open(f'{raw}/{name}_{tod}.png').convert('RGB');a=np.array(Image.open(f'{raw}/{name}_mask.png').convert('RGB')).astype(int)
m=(np.abs(a-[201,116,201]).sum(-1)<40);g=(np.abs(a-[110,196,80]).sum(-1)<40)
x0,y0,x1,y1=V['bbox'] or [img.width//2-20,img.height//2-20,img.width//2+20,img.height//2+20];cx,cy=(x0+x1)//2,(y0+y1)//2;h=max(40,int(max(x1-x0,y1-y0)*0.9))
box=(cx-h,cy-h,cx+h,cy+h);c=img.crop(box);ov=np.array(c).copy();mm=m[box[1]:box[3],box[0]:box[2]];gg=g[box[1]:box[3],box[0]:box[2]]
ov[gg]=(0.5*ov[gg]+[0,127,0]).astype(np.uint8);ov[mm]=[255,0,255]
L=c.resize((c.width*zoom,c.height*zoom),Image.NEAREST);R=Image.fromarray(ov).resize(L.size,Image.NEAREST)
o=Image.new('RGB',(L.width*2+8,L.height),(255,255,255));o.paste(L,(0,0));o.paste(R,(L.width+8,0));o.save(sys.argv[5])
