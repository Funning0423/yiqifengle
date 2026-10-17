# 近景验收拼图：python3 closesheet.py <out.jpg> <title> img1 img2 ...
import sys
from PIL import Image,ImageDraw,ImageFont,ImageEnhance
import glob
dst,title,*imgs=sys.argv[1:]
fp=(glob.glob('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc')+glob.glob('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'))[0]
f=ImageFont.truetype(fp,22,index=2)
ims=[Image.open(p).convert('RGB').resize((480,480)) for p in imgs]
W=480*len(ims); out=Image.new('RGB',(W,520),(20,20,24)); d=ImageDraw.Draw(out)
for k,(im,p) in enumerate(zip(ims,imgs)):
    im=ImageEnhance.Color(im).enhance(1.22); out.paste(im,(k*480,40)); d.text((k*480+10,8),p.split('raw_close_')[-1].replace('.png',''),font=f,fill=(255,255,255))
d.text((W-10-d.textlength(title,font=f),8),title,font=f,fill=(255,220,150))
out.save(dst,quality=88); print('SHEET',dst)
