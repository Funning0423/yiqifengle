# 格子尺寸标注版：python3 annotate.py <graded_main.png> <cells.json> <out.png> <title>
import sys,json
from PIL import Image,ImageDraw,ImageFont
src,cj,dst,title=sys.argv[1:5]
im=Image.open(src).convert('RGB'); ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
cells=json.load(open(cj))
import glob
fp=(glob.glob('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc')+glob.glob('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'))[0]
f=ImageFont.truetype(fp,15,index=2); ft=ImageFont.truetype(fp,22,index=2)
for c in cells:
    cs=[tuple(p) for p in c['corners']]
    ok=c['w']>=88 and c['h']>=88 and abs(c['w']-c['h'])<=0.08*max(c['w'],c['h'])
    d.polygon(cs,outline=(255,255,255,235) if ok else (255,40,40,255),width=2)
    cx=sum(p[0] for p in cs)/4; cy=sum(p[1] for p in cs)/4
    t='%d×%d'%(round(c['w']),round(c['h']))
    bb=d.textbbox((0,0),t,font=f); w=bb[2]-bb[0]; h=bb[3]-bb[1]
    d.rectangle((cx-w/2-4,cy+18,cx+w/2+4,cy+22+h+4),fill=(0,0,0,150))
    d.text((cx-w/2,cy+19),t,font=f,fill=(255,255,255,255))
ws=[c['w'] for c in cells]; hs=[c['h'] for c in cells]
line='%s  格宽 %.1f–%.1f px，格高 %.1f–%.1f px（全部 ≥88）'%(title,min(ws),max(ws),min(hs),max(hs))
bb=d.textbbox((0,0),line,font=ft); d.rectangle((0,0,im.size[0],bb[3]+18),fill=(0,0,0,170)); d.text((12,6),line,font=ft,fill=(255,255,255,255))
Image.alpha_composite(im.convert('RGBA'),ov).convert('RGB').save(dst)
print('ANNOT',dst,min(ws),max(ws),min(hs),max(hs))
