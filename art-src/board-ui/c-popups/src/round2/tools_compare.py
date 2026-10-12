# 三件地区道具对比图。python3 tools_compare.py <c-popups>
#   r2/region_tools_compare.png         每件：上一轮精修（raw_round3）↔ 本轮加圆（raw），1x / 放大 2.5x / 灰度
#   r2/region_tools_vs_board.png        和已定稿的星光 / 风语铃 / 潮汐瓶（b-board/slices）并排：1x + 2.5x
import sys, os, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); sys.argv=[sys.argv[0],CP]
from ui_kit import font, focus_grade
from PIL import Image, ImageDraw, ImageOps
BG=(246,240,226); INK=(70,52,34); TILE=(232,224,206)
BOARD=os.path.join(CP,'..','b-board','slices')
T=[('tool_tidenet','潮汐网','网圈 40 段，网线四边管，浮漂 16 段','网圈 280×24，网线圆管，浮漂 72 段'),
   ('tool_sunseed','日光籽','籽 24 段，白纹四边管，光线是扁棱柱','籽 144 段，光线是圆头水滴'),
   ('tool_starshears','星剪','指环 40 段 × 14 边，剪影是多边形','指环 128 段 × 24 边，剪影是圆的')]
def tile(img,col=TILE):
    t=Image.new('RGBA',img.size,col+(255,)); t.alpha_composite(img); return t.convert('RGB')
def save_q(im,p,q='80-95'):
    im.save(p,optimize=True); subprocess.run(['pngquant','--force','--skip-if-larger','--quality',q,'--output',p,p]); print(p,im.size,os.path.getsize(p))
def load(dirn,n): return focus_grade(Image.open(os.path.join(HERE,dirn,n+'.png')).convert('RGBA'))

# ---------- 1. 旧 ↔ 新 ----------
Z=2.5; cw=192+24+round(192*Z)+24+192+24
W=40+cw*2+60; Hrow=round(192*Z)+150
out=Image.new('RGB',(W,90+Hrow*3),BG); d=ImageDraw.Draw(out)
d.text((40,24),'三件地区道具：上一轮精修 ↔ 本轮加圆　　每组：1x（192 px）· 放大 2.5x · 灰度（看剪影）',font=font(28),fill=INK)
for col,(lab,dirn) in enumerate((('上一轮精修（剪影仍是多边形）','raw_round3'),('本轮（圆环 / 网线 / 籽 / 光线 / 指环加圆）','raw'))):
    x0=40+col*(cw+60)
    d.text((x0,64),lab,font=font(26),fill=(150,60,40) if col==0 else (38,98,104))
    for r,(n,cn,o,nw) in enumerate(T):
        y0=100+r*Hrow; im=load(dirn,n)
        out.paste(tile(im),(x0,y0+round(192*Z)-192))
        big=im.resize((round(192*Z),)*2,Image.LANCZOS); out.paste(tile(big),(x0+216,y0))
        g=ImageOps.grayscale(tile(im)).convert('RGB'); out.paste(g,(x0+216+round(192*Z)+24,y0+round(192*Z)-192))
        d.text((x0,y0+round(192*Z)+14),cn,font=font(26),fill=INK)
        txt=o if col==0 else nw
        for k,line in enumerate([txt[i:i+32] for i in range(0,len(txt),32)]): d.text((x0+100,y0+round(192*Z)+18+k*26),line,font=font(20,False),fill=INK)
save_q(out,os.path.join(CP,'r2','region_tools_compare.png'))

# ---------- 2. 和棋盘道具并排 ----------
REF=[('tool_starlight','星光'),('tool_windbell','风语铃'),('tool_tidebottle','潮汐瓶')]
def ref(n): return Image.open(os.path.join(BOARD,n+'.png')).convert('RGBA')
NEW=[(n,cn) for n,cn,_,_ in T]
Z=2.5; S1=192; G=16; BIG=round(192*Z)
W=40+9*(S1+G)+60+20; W=max(W,40+3*(BIG+G)+40)
H1=70+S1+90; H2=60+3*(BIG+70)
out=Image.new('RGB',(W,H1+H2+30),BG); d=ImageDraw.Draw(out)
d.text((40,20),'对比 · 已定稿的棋盘道具（星光 / 风语铃 / 潮汐瓶）与三件地区道具　　同机位、同灯光、同调色（focus_grade）',font=font(28),fill=INK)
d.text((40,62),'1x · 192 px（道具栏实际尺寸）',font=font(24),fill=INK)
groups=[('已定稿，本轮不改',[(ref(n),cn) for n,cn in REF],(80,110,80)),('上一轮精修',[(load('raw_round3',n),cn) for n,cn in NEW],(150,60,40)),('本轮加圆',[(load('raw',n),cn) for n,cn in NEW],(38,98,104))]
x=40
for gl,items,colr in groups:
    d.text((x,100),gl,font=font(22),fill=colr)
    for im,cn in items:
        out.paste(tile(im),(x,130)); d.text((x+S1/2,130+S1+16),cn,font=font(22),fill=INK,anchor='mt'); x+=S1+G
    x+=20
y=H1+30
d.text((40,y-6),'2.5x · 480 px',font=font(24),fill=INK); y+=34
for gl,items,colr in groups:
    d.text((40,y),gl,font=font(22),fill=colr); y+=30
    x=40
    for im,cn in items:
        big=im.resize((BIG,BIG),Image.LANCZOS); out.paste(tile(big),(x,y)); d.text((x+BIG/2,y+BIG+8),cn,font=font(22),fill=INK,anchor='mt'); x+=BIG+G
    y+=BIG+44
out=out.crop((0,0,W,y))
save_q(out,os.path.join(CP,'r2','region_tools_vs_board.png'))
