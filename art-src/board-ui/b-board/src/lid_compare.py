# shell_lid_compare.png: old lid (v1) / new lid (v3, 2 layers + 1 layer cracked) / shell piece — 1x and grayscale
# python3 lid_compare.py <outdir> <raw_v1> <raw_new>
import sys,os
from PIL import Image, ImageDraw, ImageFont, ImageOps
sys.path.insert(0,os.path.dirname(__file__)); from boardpost import focus_grade
OUT,R1,R2=sys.argv[1:4]
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(px): return ImageFont.truetype(FB,int(px),index=2)
BROWN=(99,63,33); BG=(244,236,218,255)
def L(d,n): return Image.open(os.path.join(d,n+'.png')).convert('RGBA')
def sc(im,f): return im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
def pc(dst,im,x,y): dst.alpha_composite(im,(round(x-im.width/2),round(y-im.height/2)))
def cell(d,cellpx,piece=None,ob=None,tile_d=None):
    c=Image.new('RGBA',(round(cellpx*1.4),)*2,(0,0,0,0)); m=c.width/2
    pc(c,sc(L(tile_d or d,'tile_a'),cellpx*1.16/160),m,m)
    if piece: pc(c,sc(focus_grade(L(d,piece)),cellpx*1.12*1.08/192),m,m-cellpx*0.05)
    if ob: pc(c,sc(L(d,ob),cellpx*1.16/160),m,m)
    return c
items=[('旧贝壳盖 2 层',dict(d=R1,ob='obstacle_shell_2')),('旧贝壳盖 1 层',dict(d=R1,ob='obstacle_shell_1')),
       ('新贝壳盖 2 层',dict(d=R2,ob='obstacle_shell_2')),('新贝壳盖 1 层(裂)',dict(d=R2,ob='obstacle_shell_1')),
       ('扇贝棋子 type5',dict(d=R2,piece='piece_shell'))]
CW=290; X0=30
def put_row(img,y,cellpx,gray=False,zoom=1.0):
    h=0
    for k,(lab,kw) in enumerate(items):
        c=cell(kw['d'],cellpx,kw.get('piece'),kw.get('ob'))
        if zoom!=1.0: c=c.resize((round(c.width*zoom),)*2,Image.NEAREST)
        if gray:
            a=c.getchannel('A'); g=ImageOps.grayscale(c.convert('RGB')).convert('RGBA'); g.putalpha(a); c=g
        img.alpha_composite(c,(round(X0+CW*k+CW/2-c.width/2),y)); h=max(h,c.height)
    return h
def labels(img,d,y):
    for k,(lab,_) in enumerate(items):
        w=d.textlength(lab,font=font(20)); d.text((X0+CW*k+CW/2-w/2,y),lab,font=font(20),fill=BROWN)
img=Image.new('RGBA',(1500,1200),BG); d=ImageDraw.Draw(img)
d.text((30,20),'贝壳盖重做：旧 → 新（盖在格子上、只露上半边的大贝壳，偏灰浅色）｜对照扇贝棋子',font=font(30),fill=BROWN)
y=80; labels(img,d,y); y+=40
d.text((30,y),'① 1x 实际尺寸（格距 43px）',font=font(22),fill=BROWN); y+=36
y+=put_row(img,y,43)+14
d.text((30,y),'② 同一张 1x 放大 3 倍（最近邻，看像素）',font=font(22),fill=BROWN); y+=36
y+=put_row(img,y,43,zoom=3.0)+14
d.text((30,y),'③ 灰度（按 2x 渲染尺寸，看去掉颜色后能否分开）',font=font(22),fill=BROWN); y+=36
y+=put_row(img,y,86,gray=True)+10
labels(img,d,y); y+=44
d.text((30,y),'区分点：棋子 = 立着的小青色扇贝（铰合耳 + 落地影）；贝壳盖 = 平盖整格的大灰贝壳，只露上半边的波浪边，格子被盖满。\n灰度下靠外形和面积区分，不靠颜色；1 层 = 同一个盖子 + 两道裂纹。',font=font(20),fill=(110,90,60),spacing=6)
img=img.crop((0,0,1500,y+80))
img.convert('RGB').save(os.path.join(OUT,'shell_lid_compare.png'),optimize=True)
print('ok')
