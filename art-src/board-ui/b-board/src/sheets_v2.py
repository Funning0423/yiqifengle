# v2 checks: shell old/new, pieces+tools old/new (1x + grayscale), squint check.
# python3 sheets_v2.py <outdir> <raw_v1> <raw_v2> <old_board_png>
import sys,os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
sys.path.insert(0,os.path.dirname(__file__)); from boardpost import focus_grade
OUT,R1,R2,OLDB=sys.argv[1:5]
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(px): return ImageFont.truetype(FB,int(px),index=2)
BROWN=(99,63,33); BG=(244,236,218,255)
def L(d,n,grade=False):
    im=Image.open(os.path.join(d,n+'.png')).convert('RGBA'); return focus_grade(im) if grade else im
def sc(im,f): return im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
def pc(dst,im,x,y): dst.alpha_composite(im,(round(x-im.width/2),round(y-im.height/2)))
PU1=192/1.12; PUT=160/1.16
def cell(d,piece,cellpx,grade,tile_name='tile_a',ob=None):
    c=Image.new('RGBA',(round(cellpx*1.4),round(cellpx*1.4)),(0,0,0,0)); m=c.width/2
    pc(c,sc(L(d,tile_name),cellpx*1.16/160),m,m)
    if piece: pc(c,sc(L(d,piece,grade),cellpx*1.12*1.08/192),m,m-cellpx*0.05)
    if ob: pc(c,sc(L(d,ob),cellpx*1.16/160),m,m-cellpx*0.05)
    return c
# ---------------- shell compare ----------------
W=1500; img=Image.new('RGBA',(W,1340),BG); d=ImageDraw.Draw(img)
d.text((30,24),'扇贝棋子 type5：旧版（被看成珊瑚）→ 新版（规整扇贝）',font=font(34),fill=BROWN)
for i,(lab,dd,g) in enumerate([('旧版 v1',R1,False),('新版 v2',R2,True)]):
    x0=40+i*740; d.text((x0,90),lab+'  · 原尺寸 192px 渲染',font=font(26),fill=BROWN)
    big=sc(L(dd,'piece_shell',g),1.6); pc(img,big,x0+170,300)
    pc(img,cell(dd,'piece_shell',120,g),x0+470,300)
    d.text((x0+410,400),'放大格子',font=font(20),fill=(110,90,60))
d.text((40,500),'1x 实际尺寸（格距 42.6pt ≈ 43px，@1x 屏）',font=font(26),fill=BROWN)
for i,(dd,g) in enumerate([(R1,False),(R2,True)]):
    x0=40+i*740
    for k,n in enumerate(['piece_shell','piece_strawberry','piece_leaf','piece_blueberry','piece_flower','piece_acorn']):
        pc(img,cell(dd,n,43,g),x0+40+k*64,580)
    pc(img,sc(cell(dd,'piece_shell',43,g),3),x0+560,640)
    d.text((x0+500,740),'↑1x 放大 3 倍看像素',font=font(18),fill=(110,90,60))
d.text((40,780),'放进棋盘里的效果（同一区域裁切，左：v1 全屏图，右：v2 全屏图）',font=font(26),fill=BROWN)
oldb=Image.open(OLDB).convert('RGBA'); newb=Image.open(os.path.join(OUT,'board_final_tools.png')).convert('RGBA')
box=(60,690,470,1030)
for i,b in enumerate([oldb,newb]):
    cr=b.crop(box); cr=sc(cr,1.25); img.alpha_composite(cr,(40+i*740,830))
img.convert('RGB').save(os.path.join(OUT,'shell_compare_old_new.png'),optimize=True)
# ---------------- pieces + tools old/new ----------------
P=['piece_strawberry','piece_leaf','piece_blueberry','piece_flower','piece_acorn','piece_shell']
T=['tool_starlight','tool_windbell','tool_tidebottle']
def strip(dd,g,cellpx):
    w=round(cellpx*1.5)
    s=Image.new('RGBA',(w*9,round(cellpx*1.5)),(0,0,0,0))
    for k,n in enumerate(P): pc(s,cell(dd,n,cellpx,g),w*k+w/2,s.height/2)
    for k,n in enumerate(T): pc(s,sc(L(dd,n,g),cellpx*1.4/192*1.25*1.0),w*(6+k)+w/2,s.height/2)
    return s
def board_sheet(gray):
    img=Image.new('RGBA',(1500,440 if not gray else 400),BG); d=ImageDraw.Draw(img)
    d.text((30,20),('灰度图' if gray else '1x 实际尺寸')+'：旧版 v1（上）／新版 v2（下）— 6 种棋子 + 3 个道具',font=font(32),fill=BROWN)
    y=90
    for lab,dd,g in [('旧版 v1',R1,False),('新版 v2',R2,True)]:
        d.text((30,y),lab+('（2x 放大，方便看明暗）' if gray else '（@1x：格距 43px）'),font=font(22),fill=BROWN); y+=36
        st=strip(dd,g,86 if gray else 43)
        if gray:
            a=st.getchannel('A'); gimg=ImageOps.grayscale(st.convert('RGB')).convert('RGBA'); gimg.putalpha(a); st=gimg
        img.alpha_composite(st,(30,y)); y+=st.height+20
        if not gray:
            st3=sc(strip(dd,g,43),2.0); img.alpha_composite(st3,(30,y)); d.text((30+st3.width+10,y+40),'↑ 同一行 1x 再放大 2 倍',font=font(18),fill=(110,90,60)); y+=st3.height+30
        else: y+=40
    if gray:
        d.text((30,y),'看点：新版每个棋子都有明确的亮面 → 暗面 → 高光点和落地接触影；格子底和道具底座更浅，值域让给棋子。',font=font(22),fill=(110,90,60))
    return img
board_sheet(False).convert('RGB').save(os.path.join(OUT,'pieces_tools_old_new_1x.png'),optimize=True)
board_sheet(True).convert('L').save(os.path.join(OUT,'pieces_tools_old_new_gray.png'),optimize=True)
# ---------------- squint check ----------------
def squint(b):
    sm=b.convert('RGB').resize((188,406),Image.LANCZOS)
    bl=sm.filter(ImageFilter.GaussianBlur(3.2))
    return bl.resize((375,812),Image.BILINEAR), ImageOps.grayscale(bl).convert('RGB').resize((375,812),Image.BILINEAR)
o1,o2=squint(oldb); n1,n2=squint(newb)
img=Image.new('RGB',(375*4+100,812+130),(250,246,236)); d=ImageDraw.Draw(img)
d.text((24,20),'眯眼测试：整盘缩到 25% + 高斯模糊（右两栏再去色）。第一眼应落在棋子上，而不是木框上。',font=font(28),fill=BROWN)
for k,(im,lab) in enumerate([(o1,'旧版 v1 · 模糊'),(n1,'新版 v2 · 模糊'),(o2,'旧版 v1 · 模糊+灰度'),(n2,'新版 v2 · 模糊+灰度')]):
    x=20+k*(375+20); img.paste(im,(x,110)); d.text((x,72),lab,font=font(24),fill=BROWN)
img.save(os.path.join(OUT,'board_squint_check.png'),optimize=True)
# numeric: mean luminance contrast of pieces area vs frame area in blurred gray
def stats(b):
    g=np.asarray(ImageOps.grayscale(b.convert('RGB')).filter(ImageFilter.GaussianBlur(6))).astype(float)
    return g
def metric(b):
    g=np.asarray(ImageOps.grayscale(b.convert('RGB')).resize((188,406),Image.LANCZOS).filter(ImageFilter.GaussianBlur(3.2))).astype(float)
    sx=188/750; sy=406/1624
    inner=g[int(500*sy):int(1040*sy),int(110*sx):int(640*sx)]
    rim=np.concatenate([g[int(450*sy):int(490*sy),int(60*sx):int(690*sx)].ravel(),g[int(450*sy):int(1090*sy),int(50*sx):int(95*sx)].ravel()])
    return dict(pieces_local_std=round(float(inner.std()),1),rim_mean=round(float(rim.mean()),1),inner_mean=round(float(inner.mean()),1))
print('squint metric v1',metric(oldb)); print('squint metric v2',metric(newb))
# append squint strip to compare_current_new_T9.jpg (run sheets.py first; it regenerates the base)
cp=os.path.join(OUT,'compare_current_new_T9.jpg'); base=Image.open(cp).convert('RGB')
sq=Image.open(os.path.join(OUT,'board_squint_check.png')).convert('RGB'); sq=sq.resize((base.width,round(sq.height*base.width/sq.width)),Image.LANCZOS)
outi=Image.new('RGB',(base.width,base.height+sq.height+10),(250,246,236)); outi.paste(base,(0,0)); outi.paste(sq,(0,base.height+10))
outi.save(cp,quality=88,optimize=True)
print('ok')
