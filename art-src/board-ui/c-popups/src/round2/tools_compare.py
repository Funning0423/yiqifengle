# 三件地区道具 旧版(r2 v1) vs 新版(v2)：每件 1x / 放大 2.5x / 灰度。python3 tools_compare.py <c-popups>
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..'))
from ui_kit import font, focus_grade
from PIL import Image, ImageDraw, ImageOps
BG=(246,240,226); INK=(70,52,34); TILE=(232,224,206)
T=[('tool_tidenet','潮汐网','旧：木圈 + 平网，像球拍','新：短柄小抄网侧躺；网兜镂空下垂，兜里扇贝 + 海螺，网圈系红白浮漂'),
   ('tool_sunseed','日光籽','旧：金色蛋形 + 浮空光点','新：深色葵花籽（白纵纹）插在土堆里冒芽，背后立一枚小太阳'),
   ('tool_starshears','星剪','旧：刃短、指环小，挤成一团','新：张开成 X 的剪刀，两片长刃 + 刃口亮线，两只大金指环，轴心金星螺丝')]
Z=2.5; cw=192+24+round(192*Z)+24+round(192*Z)*0+192+24
W=40+cw*2+60; Hrow=round(192*Z)+120
out=Image.new('RGB',(W,90+Hrow*3),BG); d=ImageDraw.Draw(out)
d.text((40,24),'三件地区道具：旧版（r2 第一版）↔ 新版　每组：1x（192 px，行囊 / 道具栏实际尺寸）· 放大 2.5x · 灰度',font=font(28),fill=INK)
for col,(lab,dirn) in enumerate((('旧版','raw_v1'),('新版','raw'))):
    x0=40+col*(cw+60)
    d.text((x0,64),lab,font=font(26),fill=(150,60,40) if col==0 else (38,98,104))
    for r,(n,cn,o,nw) in enumerate(T):
        y0=100+r*Hrow
        im=focus_grade(Image.open(os.path.join(HERE,dirn,n+'.png')).convert('RGBA'))
        def tile(img):
            t=Image.new('RGBA',img.size,TILE+(255,)); t.alpha_composite(img); return t.convert('RGB')
        out.paste(tile(im),(x0,y0+round(192*Z)-192))
        big=im.resize((round(192*Z),)*2,Image.LANCZOS); out.paste(tile(big),(x0+216,y0))
        g=ImageOps.grayscale(tile(im)).convert('RGB'); out.paste(g,(x0+216+round(192*Z)+24,y0+round(192*Z)-192))
        d.text((x0,y0+round(192*Z)+14),cn,font=font(26),fill=INK)
        d.text((x0+80,y0+round(192*Z)+18),o if col==0 else nw,font=font(20,False),fill=INK)
p=os.path.join(CP,'r2','region_tools_compare.png'); out.save(p,optimize=True)
import subprocess; subprocess.run(['pngquant','--force','--skip-if-larger','--quality','80-95','--output',p,p])
print(out.size,os.path.getsize(p))
