# 三区域并排：1x 原图 / 灰度 / 眯眼（缩到 25% + 高斯模糊）；并量托盘框、格子、背景的平均色（CIELAB）和区域之间的 ΔE
import sys,json,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageOps
F=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',s,index=2)
def lab(rgb):
    c=np.asarray(rgb,float)/255; c=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
    X=c@np.array([[0.4124,0.2126,0.0193],[0.3576,0.7152,0.1192],[0.1805,0.0722,0.9505]]); X=X/np.array([0.95047,1,1.08883])
    f=np.where(X>0.008856,np.cbrt(X),7.787*X+16/116); return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
items=json.loads(sys.argv[1]); out=sys.argv[2]; title=sys.argv[3] if len(sys.argv)>3 else ''
ims=[Image.open(p).convert('RGB') for _,p in items]; w,h=375,812
rows=[('1x 原图',lambda im:im.resize((w,h),Image.LANCZOS)),('灰度（只看明暗结构）',lambda im:ImageOps.grayscale(im).convert('RGB').resize((w,h))),
      ('眯眼（25% 后模糊 6px 再放大）',lambda im:im.resize((188,406),Image.LANCZOS).filter(ImageFilter.GaussianBlur(6)).resize((w,h)))]
S=Image.new('RGB',(40+len(ims)*(w+20),120+len(rows)*(h+50)+260),(250,246,236)); d=ImageDraw.Draw(S)
d.text((20,20),title,font=F(30),fill=(63,94,99))
# regions in 750x1624 design px: tray rim strip, tile area, background (top band above plate)
BOX={'托盘框':(32,520,52,1020),'格子+棋子':(90,500,660,1040),'背景':(0,330,750,360)}
stats={}
for i,((name,_),im) in enumerate(zip(items,ims)):
    a=np.asarray(im.resize((750,1624))).astype(float); st={}
    for k,(x0,y0,x1,y1) in BOX.items(): st[k]=lab(a[y0:y1,x0:x1].reshape(-1,3).mean(0)).round(1).tolist()
    stats[name]=st
    for j,(lb,fn) in enumerate(rows):
        x=20+i*(w+20); y=110+j*(h+50); S.paste(fn(im),(x,y)); d.text((x,y-34),f'{name} · {lb}',font=F(18),fill=(99,63,33))
y=110+len(rows)*(h+50)
names=[n for n,_ in items]
lines=[]
for k in BOX:
    for a_ in range(len(names)):
        for b_ in range(a_+1,len(names)):
            de=float(np.linalg.norm(np.array(stats[names[a_]][k])-np.array(stats[names[b_]][k])))
            lines.append(f'{k}  {names[a_]}↔{names[b_]}  ΔE {de:.1f}')
stats['deltaE']=lines
for n,l in enumerate(lines): d.text((20+(n%3)*((S.width-40)//3),y+(n//3)*30),l,font=F(18),fill=(40,40,40))
S.save(out,quality=85,optimize=True); json.dump(stats,open(out.rsplit('.',1)[0]+'_stats.json','w'),ensure_ascii=False,indent=1); print('\n'.join(lines))
