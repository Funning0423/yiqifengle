from PIL import Image,ImageDraw,ImageFont
import numpy as np
O='/workspace/wechat-game/product/2026-10-29/coast-port/scene-r5b/'
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22);f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
sc=Image.open('/workspace/wechat-game/product/2026-10-29/coast-port/style-audit/style_compare.png').convert('RGB');W,H=sc.size;pw=W//5
def stats(im):
  a=np.asarray(im.convert('HSV')).astype(float)/255;return a[...,1].mean(),a[...,2].mean()
raw=[];pan=[];labs=['Island home','Island board L13','Meadow']
for i in range(3):cr=sc.crop((i*pw+4,40,(i+1)*pw-4,H));pan.append((cr,labs[i]));raw.append(cr)
for p,l in [('r5b/G.png','Coast r5b game'),('r5b/AR.png','Coast r5b arrival')]:
  im=Image.open(p).convert('RGB');h=H-40;w=int(im.width*h/im.height);c=Image.new('RGB',(pw,h),'white');c.paste(im.resize((w,h)),((pw-w)//2,0));pan.append((c,l));raw.append(im)
out=Image.new('RGB',(pw*5,H+60),'white');d=ImageDraw.Draw(out);rows=[]
for i,(im,l) in enumerate(pan):
  out.paste(im,(i*pw,40));d.text((i*pw+8,8),l,fill='black',font=F);s,v=stats(raw[i]);rows.append((l,s,v));d.text((i*pw+8,H+12),'mean S %.2f  V %.2f'%(s,v),fill='black',font=f2)
out.save(O+'style_compare_r5b.png')
print('|panel|mean S|mean V|');print('|---|---|---|')
for r in rows:print('|%s|%.2f|%.2f|'%r)
