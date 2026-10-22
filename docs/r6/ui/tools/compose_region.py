# r6 区域全屏棋盘预览（390x844 → 750x1624，1pt = 1.923px）：复用 b-board/src/compose.py 的布局、HUD、道具栏、阴影和 focus_grade
# （exec 它 "frames" 之前的部分），只替换 区域背景 / 托盘 / 格子底座 / 障碍 / 盘面 / 信息牌文字。
# python3 compose_region.py LEVEL.json OUT.png [night]
import sys,os,json,random
LVPATH=sys.argv[1]; LV=json.load(open(sys.argv[1])); OUTP=sys.argv[2]; NIGHT=len(sys.argv)>3 and sys.argv[3]=='night'
_HERE=os.path.dirname(os.path.abspath(__file__))
CSRC=os.environ.get('BBOARD_COMPOSE',os.path.normpath(os.path.join(_HERE,'../../../../art-src/board-ui/b-board/src/compose.py')))
head=open(CSRC).read().split('# ---------------- frames ----------------')[0]
sys.argv=['compose.py',os.environ.get('R6_RAW','/workspace/r6/board/rawall'),LV['bg'],'/tmp']; sys.path.insert(0,os.path.dirname(CSRC))
exec(compile(head,'compose_head','exec'))
SPECIALS_ART=SPEC
_L=L
def L(n):   # 道具切图在 slices/ 里是 3x 高清（1440），compose.py 的缩放按 192 渲染写的，这里统一缩回 192 再走原逻辑
    im=_L(n)
    if n.startswith('tool_') and im.width!=192: im=im.resize((192,round(192*im.height/im.width)),Image.LANCZOS)
    return im
from boardpost import background as _bg_post
def _rel(p): return p if os.path.isabs(p) else os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1] if False else LVPATH)),p))
def bg_post(path,W=750,H=1624):
    # r6-fix：湖畔背景已由 lake_bg.py 按引擎场景配色生成（含轻模糊），这里不再叠 boardpost 的白雾/降饱和
    if LV['region']=='lake': return Image.open(_rel(path)).convert('RGB').resize((W,H),Image.LANCZOS)
    return _bg_post(path,W,H)
if LV['region']=='lake':
    tr=L('tray_lake'); TRAY=tr.resize((round(tr.width*f_tray),round(tr.height*f_tray/math.sin(math.radians(72)))),Image.LANCZOS)
    TILE={'a':scaled(L('tile_a_lake'),f_tile),'b':scaled(L('tile_b_lake'),f_tile)}
for k in ('full','hit','clear'): OBS['lily_'+k]=scaled(L('obstacle_lily_'+k),f_tile*1.06)
G=LV['grid']; rnd=random.Random(LV.get('seed',1)); Bd=[[0]*7 for _ in range(7)]
for r in range(7):
    for c in range(7):
        while True:
            t=rnd.randrange(6)
            if c>=2 and Bd[r][c-1]==t==Bd[r][c-2]: continue
            if r>=2 and Bd[r-1][c]==t==Bd[r-2][c]: continue
            break
        Bd[r][c]=t
def draw(img):
    sh=shadow_of(pad(TRAY,60),22,0.16,4); img.alpha_composite(sh,(round(375-TRAY.width/2)+6-60,round(TRAY_CY-TRAY.height/2)+16-60)); paste_c(img,TRAY,375,TRAY_CY)
    tl=Image.new('RGBA',(W,H),(0,0,0,0))
    for r in range(7):
        for c in range(7): x,y=cell_xy(r,c); paste_c(tl,TILE['a' if (r+c)%2==0 else 'b'],x,y)
    img.alpha_composite(shadow_of(tl,3,0.12),(1,3)); img.alpha_composite(tl)
    for r in range(7):
        for c in range(7):
            if G[r][c]=='M': x,y=cell_xy(r,c); paste_c(img,OBS['moss'],x,y-2)
    for r in range(7):
        for c in range(7):
            ch=G[r][c]
            if ch in 'Ll': continue
            x,y=cell_xy(r,c); p=PIECE[TYPES[Bd[r][c]]]
            if ch=='B': paste_c(img,scaled(SPECIALS_ART['bomb'],1.05),x,y-4); p=scaled(p,0.8)
            paste_c(img,p,x,y-4)
            if ch=='H': paste_c(img,SPECIALS_ART['line_h'],x,y-4)
            if ch=='V': paste_c(img,SPECIALS_ART['line_v'],x,y-4)
    for r in range(7):
        for c in range(7):
            ch=G[r][c]; x,y=cell_xy(r,c)
            if ch=='R': paste_c(img,OBS['roots'],x,y-6)
            if ch=='L': paste_c(img,OBS['lily_full'],x,y-3)
            if ch=='l': paste_c(img,OBS['lily_hit'],x,y-3)
def hud2(img):
    p=scaled(L('hud_pause'),(PAUSE_D*S*1.18)/160)
    img.alpha_composite(shadow_of(p,5,0.30),(round(PAUSE_C[0]*S-p.width/2)+2,round(PAUSE_C[1]*S-p.height/2)+5)); paste_c(img,p,PAUSE_C[0]*S,PAUSE_C[1]*S)
    pl=L('hud_levelplate'); pl=pl.crop(pl.getbbox()); n=len(LV['goals'])
    tw=round(min(250,214+18*max(0,n-2))*S); pl=pl.resize((tw,round(pl.height*tw/pl.width)),Image.LANCZOS)
    cx=195*S; cy=(PLATE_TOP+PLATE_H/2)*S
    img.alpha_composite(shadow_of(pl,6,0.32),(round(cx-pl.width/2)+3,round(cy-pl.height/2)+7)); paste_c(img,pl,cx,cy)
    d=ImageDraw.Draw(img); top=cy-pl.height/2; f1=font(26); txt=LV['title']; w1=d.textlength(txt,font=f1); d.text((cx-w1/2,top+17),txt,font=f1,fill=BROWN)
    rowy=top+pl.height*0.66; f2=font(28 if n>2 else 32)
    icons=[]
    for k,v in LV['goals']:
        ic=OBS[k] if k in OBS else PIECE.get(k)
        icons.append((scaled(ic,0.36 if k in OBS else 0.46),str(v)))
    tot=sum(i.width+2+d.textlength(t,font=f2)+14 for i,t in icons)
    x=cx-pl.width*0.44+ (pl.width*0.60-tot)/2
    for ic,t in icons:
        paste_c(img,ic,x+ic.width/2,rowy); x+=ic.width+2; d.text((x,rowy-19),t,font=f2,fill=BROWN); x+=d.textlength(t,font=f2)+14
    dx=cx+pl.width*0.20; d.line((dx,rowy-18,dx,rowy+18),fill=(196,166,120),width=3)
    hg=scaled(L('icon_moves'),0.32); paste_c(img,hg,dx+28,rowy); d.text((dx+48,rowy-21),str(LV['moves']),font=font(32),fill=(24,76,84))
img=bg_post(LV['bg'],W,H).convert('RGBA'); draw(img); hud2(img)
if LV.get('tools',True): tools(img,'tools')
d=ImageDraw.Draw(img); x0,y0,x1,y1=[v*S for v in CAPSULE]
d.rounded_rectangle((x0,y0,x1,y1),radius=(y1-y0)/2,fill=(30,50,60,120),outline=(255,255,255,90),width=2)
d.ellipse((x0+22,(y0+y1)/2-6,x0+34,(y0+y1)/2+6),fill=(255,255,255,230)); d.ellipse((x0+40,(y0+y1)/2-6,x0+52,(y0+y1)/2+6),fill=(255,255,255,230))
d.ellipse((x1-46,(y0+y1)/2-14,x1-18,(y0+y1)/2+14),outline=(255,255,255,230),width=4); d.text((24,14),'9:41',font=font(28),fill=(255,255,255))
out=img.convert('RGB')
if NIGHT:   # 夜间：背景用夜间渲染；整盘 UI 按 b-board 约定乘 #b8bfd6（0.5 s 过渡），这里直接给终态
    from PIL import ImageChops
    ui=Image.new('RGB',(W,H),(0xb8,0xbf,0xd6)); bgn=bg_post(LV['bg_night'],W,H)
    mask=Image.new('L',(W,H),0); m=ImageDraw.Draw(mask); th=4.3*PITCH
    out=ImageChops.multiply(out,ui)
    # 背景部分换成夜间渲染（托盘外）：用 UI 层 alpha 近似 = 托盘框 + HUD + 道具区之外
    ov=Image.new('RGBA',(W,H),(0,0,0,0)); draw(ov); hud2(ov)
    if LV.get('tools',True): tools(ov,'tools')
    a=ov.getchannel('A').filter(ImageFilter.MinFilter(3)).point(lambda v:0 if v<60 else min(255,int((v-60)*255/80)))
    out=Image.composite(out,bgn,a)
out.save(OUTP,optimize=True); print('ok',OUTP)
