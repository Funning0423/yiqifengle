# Compose (b) board full-screen previews from Blender renders. python3 compose.py <raw_dir> <bg_raw.png> <outdir>
import sys, os, math, json
sys.path.insert(0,os.path.dirname(__file__)); from boardpost import focus_grade, background as bg_post
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance, ImageOps, ImageChops
RAW,BGRAW,OUT=sys.argv[1:4]   # BGRAW: src/bg_raw.jpg (render_bg.py output)
W,H=750,1624; S=W/390.0           # px per logical pt (390x844 design)
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(px,idx=2): return ImageFont.truetype(FB,int(px),index=idx)
BROWN=(99,63,33); CREAM=(248,242,226)
# 空道具位「+」：禁用态灰青。r6-fix v2 压到 #56706a（夜间乘 #b8bfd6 后给 4.5 留余量），笔画 +1px@750。旧 #78968c 只有 2.87 / 2.58
PLUS_DIM=(86,112,106)
WARM_RIM=(176,138,92,255)   # 空道具底座描边：托盘木边同色系
def L(n): return Image.open(os.path.join(RAW,n+'.png')).convert('RGBA')
def scaled(im,f): return im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
def paste_c(dst,im,cx,cy): dst.alpha_composite(im,(round(cx-im.width/2),round(cy-im.height/2)))
def shadow_of(im,blur,alpha,grow=0):
    a=im.getchannel('A').point(lambda v:255 if v>8 else 0)
    if grow: a=a.filter(ImageFilter.MaxFilter(grow*2+1))
    a=a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v:int(v*alpha))
    sh=Image.new('RGBA',im.size,(40,30,20,0)); sh.putalpha(a); return sh
def pad(im,p):
    o=Image.new('RGBA',(im.width+2*p,im.height+2*p),(0,0,0,0)); o.alpha_composite(im,(p,p)); return o

# ---------------- layout (logical pt -> px) ----------------
PITCH=82                                   # cell pitch px (42.6 pt)
CAPSULE=(297,51,384,83)                    # WeChat menu button rect (iPhone 390x844 typical, pt)
SYS_ICON=(253,51,293,83)                   # system icon left of capsule (IslandHomeInteraction rule: left-(h)-12)
PAUSE_C=(38,67); PAUSE_D=44
PLATE_TOP=96; PLATE_H=60
TRAY_CY=770                                # px
TOOLS_Y=1404; TOOL_STEP=158
# ---------------- background ----------------
def background(): return bg_post(BGRAW,W,H)
# ---------------- assets ----------------
f_piece=PITCH/(192/1.12); f_tile=PITCH/(160/1.16); f_spec=PITCH/(308/1.80); f_tray=PITCH/(1080/8.30)
LEAFV=os.environ.get('LEAF','')   # '' = leaf A (default v3); 'B' = succulent candidate
PIECE={k:focus_grade(scaled(L('piece_leaf_B' if (k=='leaf' and LEAFV=='B') else 'piece_'+k),f_piece*1.08)) for k in ['strawberry','leaf','blueberry','flower','acorn','shell']}
TYPES=['strawberry','leaf','blueberry','flower','acorn','shell']
TILE={k:scaled(L('tile_'+k),f_tile) for k in 'ab'}
OBS={k:scaled(L('obstacle_'+k),f_tile) for k in ['moss','roots','shell_2','shell_1']}
SPEC={k:focus_grade(scaled(L('special_'+k),f_spec)) for k in ['line_h','line_v','bomb']}
tr=L('tray'); tr=tr.resize((round(tr.width*f_tray),round(tr.height*f_tray/math.sin(math.radians(72)))),Image.LANCZOS)
TRAY=tr
DECO_SHELL=scaled(L('deco_shell'),f_piece*1.9); DECO_STAR=scaled(L('deco_star'),f_tile*1.5)
def piece_shadow(w=60,h=16,a=0.30):
    im=Image.new('RGBA',(w+40,h+40),(0,0,0,0)); d=ImageDraw.Draw(im); d.ellipse((20,20,20+w,20+h),fill=(60,40,20,int(255*a)))
    return im.filter(ImageFilter.GaussianBlur(5))
PSH=piece_shadow(62,16,0.38)
def cell_xy(r,c): return 375+(c-3)*PITCH, TRAY_CY+(r-3)*PITCH

# demo board (7x7 type ids), specials & obstacles — illustrative, not real level data
B=[[1,2,3,4,0,2,4],
   [3,0,3,1,2,3,5],
   [1,5,5,1,4,3,1],
   [0,0,2,0,4,2,2],
   [1,4,5,1,1,5,2],
   [3,2,5,5,3,5,5],
   [0,2,3,0,2,0,3]]
SPECIALS={(3,1):'line_h',(1,4):'line_v',(4,3):'bomb'}
MOSS={(6,1),(6,2),(5,0),(6,0)}; ROOTS={(0,6),(1,6)}; SHELLS={(6,5):'shell_2',(6,6):'shell_1'}
HINT=[(2,0),(2,1)]

def draw_board(img,hint=False):
    # tray + drop shadow
    sh=shadow_of(pad(TRAY,60),22,0.16,4); img.alpha_composite(sh,(round(375-TRAY.width/2)+6-60,round(TRAY_CY-TRAY.height/2)+16-60))   # v3: padded so the soft shadow is not clipped into a hard edge
    paste_c(img,TRAY,375,TRAY_CY)
    # corner decorations on the rim
    hw=4.14*PITCH
    if False: paste_c(img,DECO_SHELL,375-2.3*PITCH,TRAY_CY-3.93*PITCH-30)
    if False: paste_c(img,DECO_STAR,375+2.6*PITCH,TRAY_CY+3.78*PITCH)
    # tiles
    tl=Image.new('RGBA',(W,H),(0,0,0,0))
    for r in range(7):
        for c in range(7):
            x,y=cell_xy(r,c); paste_c(tl,TILE['a' if (r+c)%2==0 else 'b'],x,y)
    img.alpha_composite(shadow_of(tl,3,0.12),(1,3)); img.alpha_composite(tl)
    # moss under
    for (r,c) in MOSS:
        x,y=cell_xy(r,c); paste_c(img,OBS['moss'],x,y-2)
    # hint glow
    if hint:
        g=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(g)
        for (r,c) in HINT:
            x,y=cell_xy(r,c); d.rounded_rectangle((x-42,y-42,x+42,y+42),radius=16,outline=(255,226,140,255),width=6)
        g2=g.filter(ImageFilter.GaussianBlur(6)); img.alpha_composite(g2); img.alpha_composite(g2)
        d=ImageDraw.Draw(img)
        for (r,c) in HINT:
            x,y=cell_xy(r,c); d.rounded_rectangle((x-41,y-41,x+41,y+41),radius=15,outline=(255,240,196,230),width=2)
    # pieces
    for r in range(7):
        for c in range(7):
            if (r,c) in SHELLS: continue
            x,y=cell_xy(r,c)
            sp=SPECIALS.get((r,c))
            if sp=='bomb': paste_c(img,scaled(SPEC['bomb'],1.05),x,y-4)
            pass  # v2: contact shadow is baked in the Blender render (shadow catcher)
            p=PIECE[TYPES[B[r][c]]]
            if sp=='bomb': p=scaled(p,0.80)
            lift=-8 if (hint and (r,c) in HINT) else 0
            paste_c(img,p,x,y-4+lift)
            if sp in('line_h','line_v'): paste_c(img,SPEC[sp],x,y-4)
    for (r,c) in ROOTS:
        x,y=cell_xy(r,c); paste_c(img,OBS['roots'],x,y-6)
    for (r,c),k in SHELLS.items():
        x,y=cell_xy(r,c); paste_c(img,OBS[k],x,y-4)

# ---------------- HUD ----------------
def hud(img):
    p=scaled(L('hud_pause'),(PAUSE_D*S*1.18)/160)
    img.alpha_composite(shadow_of(p,5,0.30),(round(PAUSE_C[0]*S-p.width/2)+2,round(PAUSE_C[1]*S-p.height/2)+5))
    paste_c(img,p,PAUSE_C[0]*S,PAUSE_C[1]*S)
    # level plate
    pl=L('hud_levelplate'); bb=pl.getbbox(); pl=pl.crop(bb)
    tw=round(214*S); pl=pl.resize((tw,round(pl.height*tw/pl.width)),Image.LANCZOS)
    cx=195*S; cy=(PLATE_TOP+PLATE_H/2)*S
    img.alpha_composite(shadow_of(pl,6,0.32),(round(cx-pl.width/2)+3,round(cy-pl.height/2)+7))
    paste_c(img,pl,cx,cy)
    d=ImageDraw.Draw(img); top=cy-pl.height/2
    f1=font(26); txt='01  露珠问候'; w1=d.textlength(txt,font=f1)
    d.text((cx-w1/2,top+17),txt,font=f1,fill=BROWN)
    # stats row: [piece]15  [moss]3  |  [hourglass]22
    rowy=top+pl.height*0.66
    icons=[(scaled(PIECE['strawberry'],0.50),'15'),(scaled(OBS['moss'],0.36),'4')]
    f2=font(32); x=cx-pl.width*0.36
    for ic,n in icons:
        paste_c(img,ic,x+ic.width/2,rowy); x+=ic.width+2
        d.text((x,rowy-21),n,font=f2,fill=BROWN); x+=d.textlength(n,font=f2)+20
    # divider
    dx=cx+pl.width*0.17; d.line((dx,rowy-18,dx,rowy+18),fill=(196,166,120),width=3)
    hg=scaled(L('icon_moves'),0.32); paste_c(img,hg,dx+30,rowy)
    d.text((dx+52,rowy-21),'22',font=f2,fill=(47,120,128))
def badge(img,x,y,n,dim=False):
    d=ImageDraw.Draw(img); r=21
    d.ellipse((x-r+1,y-r+3,x+r+1,y+r+3),fill=(60,40,20,70))
    d.ellipse((x-r,y-r,x+r,y+r),fill=(248,242,226),outline=(149,103,55),width=3)
    f=font(26); t=str(n) if not dim else '+'
    w=d.textlength(t,font=f)
    if not dim: d.text((x-w/2,y-19),t,font=f,fill=(99,63,33))
    else:   # 「+」笔画在 750 宽下加粗 1px：横竖各偏 1px 再画一遍
        for ox,oy in ((0,0),(1,0),(0,1),(1,1)): d.text((x-w/2+ox-0.5,y-19+oy-0.5),t,font=f,fill=PLUS_DIM)
def tools(img,state):
    names=[('tool_starlight',2),('tool_windbell',1),('tool_tidebottle',0)]
    sc=(60*S)/(192/1.25)
    for i,(n,cnt) in enumerate(names):
        t=focus_grade(scaled(L(n),sc)); x=375+(i-1)*TOOL_STEP; y=TOOLS_Y
        dim=cnt==0
        if dim:
            g=ImageOps.grayscale(t.convert('RGB')).convert('RGBA'); g=Image.blend(g,Image.new('RGBA',g.size,(200,214,206,255)),0.25); g.putalpha(t.getchannel('A').point(lambda v:int(v*0.55))); t=g
        img.alpha_composite(shadow_of(t,7,0.25 if not dim else 0.20),(round(x-t.width/2)+4,round(y-t.height/2)+10))
        if dim:   # v2.2：空道具底座在灰背景上看不见 → 1pt（750 宽 2px）暖木色描边，抗锯齿
            a=t.getchannel('A').point(lambda v:255 if v>40 else 0); ring=a.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
            o=Image.new('RGBA',t.size,WARM_RIM); o.putalpha(ImageChops.subtract(ring,a.filter(ImageFilter.GaussianBlur(0.6))).point(lambda v:min(255,int(v*0.85))))
            paste_c(img,o,x,y)
        paste_c(img,t,x,y)
        badge(img,x+42,y-40,cnt,dim)
# ---------------- frames ----------------
def frame(state,hint=False,guides=False):
    img=background().convert('RGBA')
    draw_board(img,hint)
    hud(img)
    if state=='tools': tools(img,state)
    # system UI mock (WeChat capsule + system icon) for context — not game art
    d=ImageDraw.Draw(img)
    x0,y0,x1,y1=[v*S for v in CAPSULE]
    d.rounded_rectangle((x0,y0,x1,y1),radius=(y1-y0)/2,fill=(30,50,60,120),outline=(255,255,255,90),width=2)
    d.ellipse((x0+22,(y0+y1)/2-6,x0+34,(y0+y1)/2+6),fill=(255,255,255,230)); d.ellipse((x0+40,(y0+y1)/2-6,x0+52,(y0+y1)/2+6),fill=(255,255,255,230))
    d.ellipse((x1-46,(y0+y1)/2-14,x1-18,(y0+y1)/2+14),outline=(255,255,255,230),width=4)
    sx0,sy0,sx1,sy1=[v*S for v in SYS_ICON]; d.ellipse((sx0+8,sy0,sx1+8-((sx1-sx0)-(sy1-sy0)),sy1),fill=(40,70,80,110))
    d.text((24,14),'9:41',font=font(28),fill=(255,255,255))
    d.rounded_rectangle((375-70,H-22,375+70,H-12),radius=5,fill=(30,30,30,170))
    if guides:
        g=ImageDraw.Draw(img); red=(230,60,60,255)
        g.rectangle((sx0-4*S,y0-4*S,x1+4*S,y1+4*S),outline=red,width=3)
        g.text((sx0-4*S,y1+6*S),'微信胶囊+系统图标 禁区',font=font(20),fill=red)
        g.line((0,47*S,W,47*S),fill=(255,160,0),width=2); g.text((W-170,47*S+2),'safe top 47pt',font=font(18),fill=(255,160,0))
        g.line((0,(844-34)*S,W,(844-34)*S),fill=(255,160,0),width=2); g.text((W-200,(844-34)*S-26),'safe bottom 34pt',font=font(18),fill=(255,160,0))
        def box(rect,lab):
            g.rectangle(rect,outline=(30,130,230),width=3); g.text((rect[0]+4,rect[3]+2),lab,font=font(18),fill=(30,90,200))
        box((16*S,45*S,60*S,89*S),'暂停 44×44pt @(16,45)')
        box(((195-107)*S,PLATE_TOP*S,(195+107)*S,(PLATE_TOP+PLATE_H)*S),'关卡信息牌 214×60pt @(88,96)')
        th=4.14*PITCH; box((375-th,TRAY_CY-th,375+th,TRAY_CY+th),f'木托盘 外框 {2*th/S:.0f}pt，格距 {PITCH/S:.1f}pt，中心 y={TRAY_CY/S:.0f}pt')
        for i in range(3):
            x=375+(i-1)*TOOL_STEP; box((x-32*S,TOOLS_Y-32*S,x+32*S,TOOLS_Y+32*S),'道具 64pt' if i==0 else '')
        g.text((20,TOOLS_Y+40*S),f'道具栏中心 y={TOOLS_Y/S:.0f}pt，间距 {TOOL_STEP/S:.0f}pt；无道具时整栏收起',font=font(18),fill=(30,90,200))
    return img
os.makedirs(OUT,exist_ok=True)
A=frame('tools',hint=True)
if LEAFV:
    A.convert('RGB').save(os.path.join(OUT,f'board_final_tools_{LEAFV}.png'),optimize=True); sys.exit(0)
A.convert('RGB').save(os.path.join(OUT,'board_final_tools.png'),optimize=True)
Bn=frame('notools'); Bn.convert('RGB').save(os.path.join(OUT,'board_final_notools.png'),optimize=True)
Gd=frame('tools',guides=True); Gd.convert('RGB').save(os.path.join(OUT,'board_layout_guides.png'),optimize=True)
print('ok')
