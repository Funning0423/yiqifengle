# v3 checks: pieces+tools v2 vs v3 (1x + gray), leaf A/B vs v2 (1x + gray)
# python3 sheets_v3.py <outdir> <raw_v2> <raw_v3>
import sys,os
from PIL import Image, ImageDraw, ImageFont, ImageOps
sys.path.insert(0,os.path.dirname(__file__)); from boardpost import focus_grade
OUT,R2,R3=sys.argv[1:4]
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(px): return ImageFont.truetype(FB,int(px),index=2)
BROWN=(99,63,33); BG=(244,236,218,255); NOTE=(110,90,60)
def L(d,n): return focus_grade(Image.open(os.path.join(d,n+'.png')).convert('RGBA')) if not n.startswith('tile') else Image.open(os.path.join(d,n+'.png')).convert('RGBA')
def sc(im,f): return im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
def pc(dst,im,x,y): dst.alpha_composite(im,(round(x-im.width/2),round(y-im.height/2)))
def gray(im):
    a=im.getchannel('A'); g=ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(a); return g
def cell(d,piece,cp):
    c=Image.new('RGBA',(round(cp*1.4),)*2,(0,0,0,0)); m=c.width/2
    pc(c,sc(L(d,'tile_a'),cp*1.16/160),m,m)
    pc(c,sc(L(d,piece),cp*1.12*1.08/192),m,m-cp*0.05); return c
def tool(d,n,cp): return sc(L(d,n),cp*1.4*1.25/192)
P=['piece_strawberry','piece_leaf','piece_blueberry','piece_flower','piece_acorn','piece_shell']
T=['tool_starlight','tool_windbell','tool_tidebottle']
LAB=['草莓','青叶','蓝莓','白花','橡果','扇贝','星光','风语铃','潮汐瓶']
def strip(d,cp,g=False,pieces=P):
    w=round(cp*1.5); s=Image.new('RGBA',(w*9,round(cp*1.5)),(0,0,0,0))
    for k,n in enumerate(pieces): pc(s,cell(d,n,cp),w*k+w/2,s.height/2)
    for k,n in enumerate(T): pc(s,tool(d,n,cp),w*(6+k)+w/2,s.height/2)
    return gray(s) if g else s
def labels(d,x0,y,w):
    for k,l in enumerate(LAB): tw=d.textlength(l,font=font(18)); d.text((x0+w*k+w/2-tw/2,y),l,font=font(18),fill=BROWN)
def compare(isgray,fn):
    img=Image.new('RGBA',(1500,10),BG); rows=[]
    H=0; parts=[]
    def add(fnp,h): parts.append((fnp,h))
    img=Image.new('RGBA',(1500,1100),BG); d=ImageDraw.Draw(img)
    d.text((30,18),('灰度' if isgray else '1x 实际尺寸')+'：v2（上）／v3（下，含 v3.1 青叶 A 加强 + 白花）— 6 种棋子 + 3 个道具',font=font(30),fill=BROWN)
    y=74
    for lab,dd in [('v2',R2),('v3',R3)]:
        d.text((30,y),lab+('（2x 渲染尺寸去色，看明暗结构）' if isgray else '（@1x 格距 43px）'),font=font(22),fill=BROWN); y+=34
        if isgray:
            st=strip(dd,86,True); img.alpha_composite(st,(30,y)); y+=st.height+2; labels(d,30,y,round(86*1.5)); y+=40
        else:
            st=strip(dd,43); img.alpha_composite(st,(30,y)); y+=st.height+8
            z=sc(strip(dd,43),2.2); img.alpha_composite(z,(30,y)); y+=z.height+2; labels(d,30,y,round(43*1.5)*2.2); y+=40
    d.text((30,y),'v3：按草莓/橡果的做法——立起来的体积、侧面和背光面露出来、落在格子里的接触影；青叶改成加厚 V 形卷叶，白花改成杯状花 + 凸起花心。',font=font(20),fill=NOTE); y+=40
    img.crop((0,0,1500,y+10)).convert('RGB').save(os.path.join(OUT,fn),optimize=True)
compare(False,'pieces_tools_v2_v3_1x.png'); compare(True,'pieces_tools_v2_v3_gray.png')
# ---- leaf A / B vs v2 ----
def leaf_sheet(isgray,fn):
    img=Image.new('RGBA',(1600,1300),BG); d=ImageDraw.Draw(img)
    d.text((30,18),'青叶两个方案'+('（灰度）' if isgray else '（1x）')+'：v2 原版 ｜ 方案 A 加厚卷曲叶 ｜ 方案 B 多肉小盆',font=font(30),fill=BROWN)
    rows=[('v2 原版',R2,'piece_leaf'),('方案 A：加厚卷曲叶（V 形对折、凸叶脉、落地叶柄）',R3,'piece_leaf'),('方案 B：多肉小盆（三圈肉质叶 + 奶油陶盆）',R3,'piece_leaf_B')]
    y=76; G=(lambda im: gray(im)) if isgray else (lambda im: im)
    for lab,dd,n in rows:
        d.text((30,y),lab,font=font(22),fill=BROWN); y+=34
        one=G(cell(dd,n,43)); img.alpha_composite(one,(40,y+30))
        big=G(cell(dd,n,43)).resize((180,180),Image.NEAREST) if not isgray else G(cell(dd,n,130))
        img.alpha_composite(big,(140,y))
        ps=[('piece_strawberry',R3 if dd==R3 else R2),(n,dd),('piece_blueberry',dd),('piece_flower',dd),('piece_acorn',dd),('piece_shell',dd)]
        w=round(43*1.5); s=Image.new('RGBA',(w*6,round(43*1.5)),(0,0,0,0))
        for k,(pn,pd) in enumerate(ps): pc(s,cell(pd,pn,43),w*k+w/2,s.height/2)
        s=G(s); img.alpha_composite(s,(380,y+20)); z=G(sc(s,2.0)) ; img.alpha_composite(z,(380+s.width+30,y-10))
        y+=max(190,z.height)+20
    d.text((30,y),'左：1x 单格；中：'+('同一格放大（灰度）' if isgray else '1x 放大（最近邻）')+'；右：和其他 5 种棋子摆一排（1x 与 2x），看能不能一眼分开。',font=font(20),fill=NOTE)
    img.crop((0,0,1600,y+50)).convert('RGB').save(os.path.join(OUT,fn),optimize=True)
if os.environ.get('LEAF_AB'):   # decision record from v3 (A vs B); B rejected, its raw is in slices/_rejected/
    leaf_sheet(False,'leaf_AB_1x.png'); leaf_sheet(True,'leaf_AB_gray.png')
print('ok')
