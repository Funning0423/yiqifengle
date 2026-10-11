# 灯塔目标格：用 (b) v3.1 的 compose.py（原样读入，只插两个钩子）重排棋盘，在目标格下垫暖光 + 金色灯座框，
# 格子右上角立一座小灯塔，HUD 目标换成灯塔。python3 beacon.py <c-popups 目录>
import sys, os, math
HERE=os.path.dirname(os.path.abspath(__file__)); CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..'))
ROOT=os.path.dirname(CP); BSRC=os.path.join(ROOT,'b-board/src')
OUT=os.path.join(CP,'r2'); R2=os.path.join(HERE,'raw')
src=open(os.path.join(BSRC,'compose.py')).read()
src=src[:src.index('os.makedirs(OUT,exist_ok=True)\nA=frame')]
src=src.replace("    # pieces\n","    if BEACON: beacon_under(img)\n    # pieces\n",1)
src=src.replace("    icons=[(scaled(PIECE['strawberry'],0.50),'15'),(scaled(OBS['moss'],0.36),'4')]","    icons=HUD_ICONS()")
sys.path.insert(0,BSRC)
G={'__name__':'bcompose','__file__':os.path.join(BSRC,'compose.py')}
sys.argv=['compose.py',os.path.join(CP,'src/inputs/b_raw'),os.path.join(CP,'src/inputs/bg_raw_v31.jpg'),'/tmp/fang_bb']
G['BEACON']=None
exec(compile(src,'bcompose','exec'),G)
from PIL import Image, ImageDraw, ImageFilter
L2=lambda n: Image.open(os.path.join(R2,n+'.png')).convert('RGBA')
focus_grade=G['focus_grade']; scaled=G['scaled']; paste_c=G['paste_c']; cell_xy=G['cell_xy']; PITCH=G['PITCH']; shadow_of=G['shadow_of']; pad=G['pad']
RING=L2('beacon_ring'); RING=scaled(RING.crop(RING.getbbox()),(PITCH*1.04)/RING.crop(RING.getbbox()).width)
LH=focus_grade(L2('beacon_lighthouse')); LH=LH.crop(LH.getbbox())
def lh_icon(h): return scaled(LH,h/LH.height)
def HUD_ICONS():
    if G['BEACON']: return [(scaled(G['PIECE']['strawberry'],0.50),'15'),(lh_icon(46),'3')]
    return [(scaled(G['PIECE']['strawberry'],0.50),'15'),(scaled(G['OBS']['moss'],0.36),'4')]
G['HUD_ICONS']=HUD_ICONS
def glow(w,h,col,a,blur):
    im=Image.new('RGBA',(w+4*blur,h+4*blur),(0,0,0,0)); ImageDraw.Draw(im).rounded_rectangle((2*blur,2*blur,2*blur+w,2*blur+h),radius=min(w,h)//4,fill=col+(a,))
    return im.filter(ImageFilter.GaussianBlur(blur))
PREV=False
def route_dots(img,r,c,under):
    # 后面几格的路线：很淡的暖色小点。under=格底一圈极淡暖光；over=压在棋子之上的小点（格子下沿中点）+ 格间两颗更淡的过渡点
    pts=[(r,c)]+ROUTE
    if under:
        for (a,b) in ROUTE:
            ax,ay=cell_xy(a,b); paste_c(img,glow(int(PITCH*0.50),int(PITCH*0.50),(255,214,130),80,10),ax,ay)
        return
    d=ImageDraw.Draw(img)
    for (a,b),(a2,b2) in zip(pts,pts[1:]):
        ax,ay=cell_xy(a,b); bx_,by_=cell_xy(a2,b2)
        for t in (0.42,0.58,0.74) if (a,b)!=(r,c) else (0.55,0.70):
            px,py=ax+(bx_-ax)*t,ay+(by_-ay)*t+PITCH*0.36; d.ellipse((px-3,py-3,px+3,py+3),fill=(255,236,190,130))
    for (a,b) in ROUTE:
        ax,ay=cell_xy(a,b); py=ay+PITCH*0.36
        paste_c(img,glow(10,10,(255,220,150),150,4),ax,py); d.ellipse((ax-5,py-5,ax+5,py+5),fill=(255,240,200,170),outline=(230,184,96,150),width=1)
def beacon_under(img):
    r,c=G['BEACON']; x,y=cell_xy(r,c)
    if PREV:
        paste_c(img,glow(int(PITCH*1.15),int(PITCH*1.15),(255,184,70),170,18),x,y); paste_c(img,glow(int(PITCH*0.86),int(PITCH*0.86),(255,196,92),255,4),x,y); paste_c(img,glow(int(PITCH*0.46),int(PITCH*0.46),(255,246,206),240,10),x,y+2); paste_c(img,RING,x,y); return
    # 1) 暖光池：格子底下一层柔和的暖黄（不是描边：和「提示」的金色描边脉冲区分开）
    if not PREV: route_dots(img,r,c,under=True)
    # 当前目标格（橡果格）暖光提亮一档：外溢更亮更大、格内暖金更浅、中心亮点更白
    paste_c(img,glow(int(PITCH*1.25),int(PITCH*1.25),(255,190,80),235,20),x,y)      # 溢到四周的暖光
    paste_c(img,glow(int(PITCH*0.90),int(PITCH*0.90),(255,222,140),255,4),x,y)       # 格内一整块暖金（提亮）
    paste_c(img,glow(int(PITCH*0.74),int(PITCH*0.74),(255,252,232),255,12),x,y+2)    # 中心亮点（更大更白）
    # 2) 金色灯座框（3D，四角四颗灯珠）
    paste_c(img,RING,x,y)
G['beacon_under']=beacon_under
ROUTE=[(4,5),(5,3)]   # 示意：本局灯塔目标还剩 2 格（beaconTarget.cursor/total），真实顺序由关卡数据给
def beacon_over(img,typed=None):
    r,c=G['BEACON']; x,y=cell_xy(r,c)
    if not PREV: route_dots(img,r,c,under=False)
    if not PREV:
        # 提亮一档：整格再罩一层「滤色」暖光（screen），橡果本身也被照亮一点，跟周围同色橡果拉开
        from PIL import ImageChops
        S_=int(PITCH*1.6); g=glow(int(PITCH*0.80),int(PITCH*0.80),(255,214,130),255,14).resize((S_,S_))
        bx0,by0=round(x-S_/2),round(y-S_/2); reg=img.crop((bx0,by0,bx0+S_,by0+S_))
        lit=ImageChops.screen(reg.convert('RGB'),Image.composite(g.convert('RGB'),Image.new('RGB',(S_,S_),(0,0,0)),g.getchannel('A').point(lambda v:int(v*0.18)))).convert('RGBA')
        lit.putalpha(reg.getchannel('A')); img.paste(lit,(bx0,by0))
        # 外圈暖光晕：压在棋子之上、只在格子外沿一圈（格内挖空），让这一格像被灯照着往外透光
        H_=Image.new('RGBA',(S_,S_),(0,0,0,0)); hd=ImageDraw.Draw(H_); hw=PITCH*0.50
        hd.rounded_rectangle((S_/2-hw-6,S_/2-hw-6,S_/2+hw+6,S_/2+hw+6),radius=18,outline=(255,206,96,235),width=12)
        H_=H_.filter(ImageFilter.GaussianBlur(9)); m=Image.new('L',(S_,S_),255); ImageDraw.Draw(m).rounded_rectangle((S_/2-hw+4,S_/2-hw+4,S_/2+hw-4,S_/2+hw-4),radius=14,fill=0)
        H_.putalpha(Image.composite(H_.getchannel('A'),Image.new('L',(S_,S_),0),m.filter(ImageFilter.GaussianBlur(3)))); img.alpha_composite(H_,(bx0,by0))
    lh=lh_icon(88); lx,ly=x+PITCH*0.42,y-PITCH*0.46
    # 灯室光晕 + 两道短光束（朝左上 / 右上），让灯塔“亮着”
    beam=Image.new('RGBA',(220,120),(0,0,0,0)); bd=ImageDraw.Draw(beam)
    bd.polygon([(110,40),(0,0),(0,40)],fill=(255,236,170,150)); bd.polygon([(110,40),(220,4),(220,46)],fill=(255,236,170,120))
    beam=beam.filter(ImageFilter.GaussianBlur(4)); lamp_y=ly-lh.height/2+lh.height*0.24
    img.alpha_composite(beam,(round(lx-110),round(lamp_y-40)))
    paste_c(img,glow(26,26,(255,226,140),255,10),lx,lamp_y)
    img.alpha_composite(shadow_of(pad(lh,10),4,0.35),(round(lx-lh.width/2-10+3),round(ly-lh.height/2-10+5)))
    paste_c(img,lh,lx,ly)
    if typed is not None:
        # 指定图案时：灯塔脚下一枚小圆牌，画上要消除的棋子
        d=ImageDraw.Draw(img); bx,by=x-PITCH*0.34,y-PITCH*0.36; rr=17
        d.ellipse((bx-rr+1,by-rr+3,bx+rr+1,by+rr+3),fill=(60,40,20,70)); d.ellipse((bx-rr,by-rr,bx+rr,by+rr),fill=(248,242,226),outline=(201,160,80),width=3)
        p=scaled(G['PIECE'][typed],0.36); paste_c(img,p,bx,by)
def frame_beacon(cell,typed=None,hint=False,name=None):
    G['BEACON']=cell
    img=G['frame']('tools',hint=hint); beacon_over(img,typed)
    G['BEACON']=None
    return img
def current_sim(cell):
    # 现状：代码里目标格只画一圈 2px 的 #ffe59c 圆角描边（ManagedMobileBoardUI.ts:262），HUD 用代码画的 lamp 小图标
    img=G['frame']('tools',hint=False); d=ImageDraw.Draw(img); x,y=cell_xy(*cell); h=PITCH/2
    d.rounded_rectangle((x-h,y-h,x+h,y+h),radius=15,outline=(255,229,156),width=4)
    return img
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True)
    CELL=(2,4)   # 橡果格（demo 棋盘 B[2][4]=acorn）
    A=frame_beacon(CELL); A.convert('RGB').save(os.path.join(OUT,'board_beacon.png'),optimize=True)
    import subprocess; subprocess.run(['pngquant','--force','--quality','80-95','--speed','1','--strip','--output',os.path.join(OUT,'board_beacon.png'),os.path.join(OUT,'board_beacon.png')])
    T=frame_beacon(CELL,typed='acorn'); T.convert('RGB').save('/tmp/fang_bb/board_beacon_typed.png')
    Hn=frame_beacon(CELL,hint=True); Hn.convert('RGB').save('/tmp/fang_bb/board_beacon_hint.png')
    globals()['PREV']=True; Pv=frame_beacon(CELL); Pv.convert('RGB').save('/tmp/fang_bb/board_beacon_prev.png'); globals()['PREV']=False
    Cu=current_sim(CELL); Cu.convert('RGB').save('/tmp/fang_bb/board_beacon_current.png')
    print('ok')
