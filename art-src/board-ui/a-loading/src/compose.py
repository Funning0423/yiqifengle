import os, math, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import gen
O='/workspace/yiqifengle/previews/棋盘UI美术bot/a-loading'
S=O+'/slices'; os.makedirs(S,exist_ok=True)
W,H=750,1624
# ---- base placeholder: warm grade + soft bottom mist
b=np.array(Image.open('base_clean.png').convert('RGB')).astype(float)
cream=np.array([246,236,214.])
b=b*0.86+cream*0.14
y=np.linspace(0,1,H)[:,None,None]
mist=np.clip((y-0.70)/0.30,0,1)**1.4*0.42
b=b*(1-mist)+np.array([250,243,228.])*mist
base=Image.fromarray(np.clip(b,0,255).astype(np.uint8))
base.save(S+'/loading_bg_PLACEHOLDER.jpg',quality=72,optimize=True,progressive=True,subsampling=2)
# ---- slices
title=Image.open('out/title.png'); tw=470
title=title.resize((tw,round(title.height*tw/title.width)),Image.LANCZOS)
logo=Image.open('out/logo.png'); lh=124
logo=logo.resize((round(logo.width*lh/logo.height),lh),Image.LANCZOS)
track=Image.open('out/bar_track.png'); fill=Image.open('out/bar_fill.png'); pin=Image.open('out/pinwheel.png')
pin=pin.resize((60,60),Image.LANCZOS)
for n,im in [('title',title),('logo',logo),('bar_track',track),('bar_fill',fill),('pinwheel',pin)]:
    im.save(S+f'/{n}.png')
for f in os.listdir(S):
    if f.endswith('.png'):
        subprocess.run(['pngquant','--force','--skip-if-larger','--quality','40-85','--speed','1','--strip','--output',S+'/'+f,S+'/'+f])
title=Image.open(S+'/title.png').convert('RGBA'); logo=Image.open(S+'/logo.png').convert('RGBA')
track=Image.open(S+'/bar_track.png').convert('RGBA'); fill=Image.open(S+'/bar_fill.png').convert('RGBA'); pin=Image.open(S+'/pinwheel.png').convert('RGBA')
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',28,index=2)
tagf=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',18,index=2)
TIPS={0:'风从海上来……',50:'她在窗前坐下……',100:'灯塔小屋准备好了'}
BX=(W-track.width)//2; BY=1270; PAD=8
def frame(p,tag=True,angle=0):
    im=Image.open(S+'/loading_bg_PLACEHOLDER.jpg').convert('RGBA')
    im.alpha_composite(logo,((W-logo.width)//2+18,316-logo.height//2))
    im.alpha_composite(title,((W-title.width)//2,452-title.height//2))
    im.alpha_composite(track,(BX,BY))
    L=gen.BL; fx=PAD+round(L*p/100)
    if fx>0: im.alpha_composite(fill.crop((0,0,fx,fill.height)),(BX,BY))
    hx=BX+fx; hy=BY+gen.ribbon_y(L*p/100)
    pr=pin.rotate(angle,resample=Image.BICUBIC)
    im.alpha_composite(pr,(round(hx-pr.width/2),round(hy-pr.height/2)))
    d=ImageDraw.Draw(im)
    t=TIPS[p]; w=d.textlength(t,font=font)
    d.text(((W-w)/2+1,BY+70+1),t,font=font,fill=(255,250,238,180))
    d.text(((W-w)/2,BY+70),t,font=font,fill=(63,94,99,255))
    if tag:
        s='底图为占位：PM 概念图 A4 去字处理 · 正式底图待运镜bot 用自有房间模型渲染第一机位'
        d.text((18,H-34),s,font=tagf,fill=(63,94,99,150))
    return im.convert('RGB')
for p,a in [(0,0),(50,35),(100,70)]:
    frame(p,angle=a).save(O+f'/loading_final_{p:03d}.png')
# bar state slices (just the bar)
for p,a in [(0,0),(50,35),(100,70)]:
    c=Image.new('RGBA',(track.width+40,90),(0,0,0,0))
    c.alpha_composite(track,(20,20)); fx=PAD+round(gen.BL*p/100)
    c.alpha_composite(fill.crop((0,0,fx,fill.height)),(20,20))
    pr=pin.rotate(a,resample=Image.BICUBIC); c.alpha_composite(pr,(round(20+fx-pr.width/2),round(20+gen.ribbon_y(gen.BL*p/100)-pr.height/2)))
    c.save(O+f'/state_bar_{p:03d}.png')
print('ok')
