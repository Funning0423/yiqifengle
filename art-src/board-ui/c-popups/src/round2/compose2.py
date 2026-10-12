# 下一轮界面（r2）：750×1624 全屏图。python3 compose2.py <c-popups 目录>
#   NIGHT=1 只出夜间版「海岛小憩」（主按钮「迎接晴昼」）。其余界面白天。
import sys, os, math
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
CP=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..'); sys.argv=[sys.argv[0],CP]
import compose as C
from ui_kit import *
from ui_kit import _three
R2=os.path.join(HERE,'raw'); OUT=os.path.join(CP,'r2'); os.makedirs(OUT,exist_ok=True)
C.OUT=OUT
_C2={}
def warm(im,g=(1.045,1.02,0.95)):
    r,gc,b,a=im.split(); return Image.merge('RGBA',(r.point(lambda v:min(255,int(v*g[0]))),gc.point(lambda v:min(255,int(v*g[1]))),b.point(lambda v:min(255,int(v*g[2]))),a))
def A2(n):
    if n not in _C2:
        im=crop(Image.open(os.path.join(R2,n+'.png')).convert('RGBA'))
        if n in ('card_frame','slot_frame','sign_plank'): im=warm(im)
        if n.startswith('tool_') or n.startswith('beacon') or n.startswith('icon_'): im=focus_grade(im)
        _C2[n]=mul(im,K_UI) if NIGHT else im
    return _C2[n]
def TOOL(n):
    # 道具图标：(b) v3.1 的三件用 b_raw（192px，(b) 同一张渲染），三件地区道具用本轮补的模型（同机位同灯光）
    return A(n) if n in ('tool_starlight','tool_windbell','tool_tidebottle') else A2(n)
CARD_INS=(64,64,64,64)
def card(w,h,kind='card_frame',sc=0.62): return nine(A2(kind),CARD_INS,round(w),round(h),sc*0.8)
def gray(im,a=0.55,tint=(214,206,186)):
    g=ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g=Image.blend(g,Image.new('RGBA',g.size,tint+(255,)),0.35)
    g.putalpha(im.getchannel('A').point(lambda v:int(v*a))); return g
def pill(d,cx,cy,txt,f,fg,bg,ol):
    tw=d.textlength(txt,font=f); h=f.size+18
    d.rounded_rectangle((cx-tw/2-20,cy-h/2,cx+tw/2+20,cy+h/2),radius=h/2,fill=bg,outline=ol,width=2); d.text((cx,cy),txt,font=f,fill=fg,anchor='mm')
def close_btn(ui,x1,top): cl=fitw(A('btn_close'),80); drop(ui,cl,x1-32,top+24,blur=4,alpha=0.30,dy=4)
def sparkle(ui,x,y,s_,col=(255,246,210,230)):
    sp=Image.new('RGBA',(4*s_,4*s_),(0,0,0,0)); sd=ImageDraw.Draw(sp); c=2*s_
    sd.polygon([(c,c-2*s_),(c+s_*0.35,c-s_*0.35),(c+2*s_,c),(c+s_*0.35,c+s_*0.35),(c,c+2*s_),(c-s_*0.35,c+s_*0.35),(c-2*s_,c),(c-s_*0.35,c-s_*0.35)],fill=col)
    paste_c(ui,sp,x,y)
GOLD_T=(150,104,40) if not NIGHT else (70,46,14)
GREY_T=(150,140,124) if not NIGHT else (60,54,46)

# 精简规则（Funning 确认，全部面板）：外框一层浅木（无钉）、宽 680；无副标题 / 小节标签 / 虚线 / 小装饰；
# 内容直接放在底板上，最多一层很浅的平底；间距 8 的倍数；字号最多三级。
import numpy as np
from ui_kit import PW
WELL=(236,224,196) if not NIGHT else tuple(round(c*k) for c,k in zip((236,224,196),K_UI))
WELL_ZERO=(232,226,212) if not NIGHT else tuple(round(c*k) for c,k in zip((232,226,212),K_UI))
def well(w,h,col=None,r=24): im=Image.new('RGBA',(w,h),(0,0,0,0)); ImageDraw.Draw(im).rounded_rectangle((0,0,w-1,h-1),radius=r,fill=(col or WELL)+(255,)); return im
def count_tag(n):
    f=font(22); t='×%d'%n; d0=ImageDraw.Draw(Image.new('RGB',(1,1))); tw=d0.textlength(t,font=f)
    w,h=round(tw+24),32; im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,w-1,h-1),radius=16,fill=(250,245,232) if n else (238,234,224),outline=(201,177,133) if n else (214,206,190),width=2)
    d.text((w/2,h/2),t,font=f,fill=BROWN if n else (164,154,138),anchor='mm'); return im
def frame(top,ph,title,base='board'):
    bg=C.base(base); ui=Image.new('RGBA',(W,H),(0,0,0,0)); x0,y0,x1,y1=C.put_panel(ui,375,top,PW,ph,title); return bg,ui,x0,x1,ImageDraw.Draw(ui)
def ctop(ph,dy=0): return round(((H-ph)/2+dy)/8)*8

# ================= 1. 首次获得道具 =================
INTRO={'tool_starlight':('星光','轻点任意一格，','星光会清掉它和四周一圈（3×3）。'),
       'tool_windbell':('风语铃','轻点一格，','风铃声沿着这一行和这一列吹开。'),
       'tool_tidebottle':('潮汐瓶','轻点一格，','潮水漫过以它为中心的 5×5。')}
def item_intro(tool='tool_starlight'):
    name,l1,l2=INTRO[tool]; ph=792; top=ctop(ph,16)
    bg,ui,x0,x1,d=frame(top,ph,name)
    hero=fitw(A2(tool+'_hero'),360); hy=top+96+176
    r=C.rays(440); r=mul(r,K_HALF) if NIGHT else r; paste_c(ui,r,375,hy-24); paste_c(ui,hero,375,hy)
    f=font(30,False); d.text((375,top+512),l1,font=f,fill=BROWN,anchor='mm'); d.text((375,top+560),l2,font=f,fill=BROWN,anchor='mm')
    b=button('primary','知道了',400,104,None,38); drop(ui,b,375,top+668,blur=6,alpha=0.3,dy=8)
    return C.finish_frame('item_intro_'+tool.split('_')[1],bg,ui)

# ================= 2. 行囊 =================
TOOLS=[('tool_windbell','风语铃',2),('tool_tidebottle','潮汐瓶',1),('tool_tidenet','潮汐网',1),('tool_sunseed','日光籽',0),('tool_starshears','星剪',0)]
def tool_grid(ui,d,y):
    CW,CH,G=160,192,16
    for row in (TOOLS[:3],TOOLS[3:]):
        n=len(row); sx=375-(n*CW+(n-1)*G)/2
        for i,(tn,lab,c) in enumerate(row):
            cx=sx+i*(CW+G)+CW/2; zero=c==0
            ui.alpha_composite(well(CW,CH,WELL_ZERO if zero else WELL),(round(cx-CW/2),y))
            ic=fitw(TOOL(tn),136)
            if zero: ic=gray(ic,0.5)
            else: paste_c(ui,shadow_of(pad(ic,8),6,0.16),cx+2,y+86)
            paste_c(ui,ic,cx,y+80)
            d.text((cx,y+CH-32),lab,font=font(26),fill=GREY_T if zero else BROWN,anchor='mm')
            tg=count_tag(c); ui.alpha_composite(tg,(round(cx+CW/2-tg.width-8),y+8))
        y+=CH+G
    return y-G
def charm_empty(ui,d,y):
    bow=fith(A2('icon_charm'),112); g=bow.copy(); g.putalpha(bow.getchannel('A').point(lambda v:int(v*0.5)))
    sh=Image.new('RGBA',(200,40),(0,0,0,0)); ImageDraw.Draw(sh).ellipse((40,8,160,32),fill=(120,96,60,60)); sh=sh.filter(ImageFilter.GaussianBlur(6))
    paste_c(ui,sh,375,y+120); paste_c(ui,g,375,y+60)
    d.text((375,y+172),'还没有装扮',font=font(26,False),fill=BROWN2,anchor='mm'); return y+192
def bag(where='island'):
    if where=='island': ph=104+400+64+192+72
    else: ph=104+400+48+(2*96+16)+48+192+72
    top=ctop(ph,16); bg,ui,x0,x1,d=frame(top,ph,'旅人的行囊','island' if where=='island' else 'board'); close_btn(ui,x1,top)
    y=tool_grid(ui,d,top+104)
    if where=='island': y+=64
    else:
        y+=48
        # 宝箱：每条只放宝箱图标、关卡名、「打开」
        for lv in ('01 露珠问候','02 风车小路'):
            ui.alpha_composite(well(528,96),(375-264,y))
            ch=fitw(A('chest_body'),88); paste_c(ui,shadow_of(pad(ch,6),5,0.18),375-264+72+2,y+52); paste_c(ui,ch,375-264+72,y+48)
            d.text((375-264+136,y+48),lv,font=font(26),fill=BROWN,anchor='lm')
            b=button('primary','打开',144,64,None,26); paste_c(ui,b,375+264-24-72,y+48)
            y+=96+16
        y+=48-16
    charm_empty(ui,d,y)
    return C.finish_frame('bag_'+where,bg,ui)

# ================= 3. 旅程册（每章一扇地区之窗） =================
REG=os.path.join(HERE,'raw','regions')
REG_CROP={'tide':(150,96,610,400),'meadow':(40,24,680,446),'sky':(16,0,704,440)}
REG_SKY={'meadow':((172,214,232),(246,239,217))}
def region_window(rid,w,h,lock=False,placeholder=False):
    src=Image.open(os.path.join(REG,'region_%s.png'%rid)).convert('RGBA')
    if rid in REG_SKY:
        top,hor=REG_SKY[rid]; g=Image.new('RGBA',src.size)
        for y_ in range(src.height):
            t=min(1,y_/(src.height*0.7)); g.paste(tuple(round(top[i]*(1-t)+hor[i]*t) for i in range(3))+(255,),(0,y_,src.width,y_+1))
        g.alpha_composite(src); src=g
    im=src.crop(REG_CROP[rid]).convert('RGB').resize((w,h),Image.LANCZOS)
    im=im.filter(ImageFilter.GaussianBlur(1.1)); im=ImageEnhance.Color(im).enhance(0.82)
    im=Image.blend(im,Image.new('RGB',im.size,(246,238,218)),0.16)
    if lock:
        im=ImageOps.grayscale(im).convert('RGB'); im=Image.blend(im,Image.new('RGB',im.size,(236,232,224)),0.12)
        fog=Image.new('L',im.size,0); fd=ImageDraw.Draw(fog)
        for y_ in range(h): fd.line((0,y_,w,y_),fill=round(110*(1-y_/h)+40))
        im=Image.composite(Image.new('RGB',im.size,(244,242,238)),im,fog.filter(ImageFilter.GaussianBlur(6)))
    if NIGHT: im=Image.fromarray((np.asarray(im).astype(float)*np.array(K_UI)).clip(0,255).astype('uint8'))
    im=im.convert('RGBA'); m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=16,fill=255); im.putalpha(m)
    o=Image.new('RGBA',(w+8,h+8),(0,0,0,0)); od=ImageDraw.Draw(o); od.rounded_rectangle((0,0,w+7,h+7),radius=20,fill=(196,166,118,255) if not lock else (198,190,176,255))
    o.alpha_composite(im,(4,4)); od=ImageDraw.Draw(o); od.rounded_rectangle((4,4,w+3,h+3),radius=16,outline=(255,250,236,90),width=1)
    if placeholder:
        f=font(20,False); tw=od.textlength('占位',font=f)
        od.rounded_rectangle((w-tw-20,h-26,w+2,h+0),radius=11,fill=(255,250,238,200)); od.text((w-tw/2-9,h-13),'占位',font=f,fill=(140,124,100),anchor='mm')
    return o
CHAPTERS=[('tide','潮汐小径','reward_seal_tide',10,1,False,False),('meadow','花粉草甸','reward_seal_meadow',3,0,False,True),('sky','天空回声','reward_seal_sky',0,0,True,False)]
def journey():
    src=A2('sign_plank_clean'); SW,SH_,G=544,176,32; sign=_three(src,round(src.width*0.16),SW,SH_)
    ph=104+3*SH_+2*G+72; top=ctop(ph); bg,ui,x0,x1,d=frame(top,ph,'旅程册','island'); close_btn(ui,x1,top)
    IW,IH=200,128; y=top+104
    for rid,name,seal,stars,chal,lock,ph_ in CHAPTERS:
        s=sign if not lock else gray(sign,1.0,(228,220,204)); cy=y+SH_/2; cx0=375-SW/2
        drop(ui,s,375,cy,blur=6,alpha=0.20,dy=8)
        win=region_window(rid,IW,IH,lock,ph_); ix=cx0+24; ui.alpha_composite(win,(round(ix),round(cy-win.height/2)))
        se=fith(A(seal),64); se=gray(se,0.6) if lock else se
        drop(ui,se,ix+12,cy-win.height/2+12,blur=3,alpha=0.25,dy=3)
        if lock: lk=fith(A2('icon_lock'),64); drop(ui,lk,ix+win.width/2,cy,blur=4,alpha=0.30,dy=4)
        tx=ix+win.width+24; t=baked_title(name,40); t=gray(t,0.8,(170,160,140)) if lock else t
        ui.alpha_composite(t,(round(tx),round(cy-40-t.height/2)))
        if not lock:
            sf=fith(A('star_full'),32); paste_c(ui,sf,tx+16,cy+8); d.text((tx+40,cy+8),'%d/12'%stars,font=font(24),fill=BROWN,anchor='lm')
            px=tx; fy=cy+52; tw=d.textlength('挑战 %d/4'%chal,font=font(24)); w_=round(tw+44)
            d.rounded_rectangle((px,fy-18,px+w_,fy+18),radius=18,outline=(100,168,164),width=2,fill=(236,244,240))
            fx=px+16; d.line((fx,fy-10,fx,fy+10),fill=(58,120,118),width=3); d.polygon([(fx+1,fy-10),(fx+13,fy-6),(fx+1,fy-1)],fill=(58,120,118))
            d.text((px+30,fy),'挑战 %d/4'%chal,font=font(24),fill=TEAL,anchor='lm')
        else: d.text((tx,cy+16),'主线解锁后开启',font=font(24,False),fill=GREY_T,anchor='lm')
        y+=SH_+G
    return C.finish_frame('journey_book',bg,ui)

# ================= 4. 海岛小憩（点小屋弹出；昼 / 夜两版） =================
def island_rest():
    night=NIGHT
    src=Image.open(C.ISLAND).convert('RGB').resize((W,H),Image.LANCZOS)
    bgsrc=src if not night else Image.fromarray((np.asarray(src).astype(float)*np.array(K_SEA)).clip(0,255).astype('uint8'))
    bg=mask(bgsrc); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    ph=104+200+24+40+48+104+72; top=ctop(ph); x0,y0,x1,y1=C.put_panel(ui,375,top,PW,ph,'海岛小憩'); d=ImageDraw.Draw(ui); close_btn(ui,x1,top)
    thumb=src.crop((90,470,690,946)); w,h=232,184
    for k,(lab,ic,isn) in enumerate((('晴昼','icon_sun',False),('夜色','icon_moon',True))):
        cx=375+(k-0.5)*264; cy=top+104+h/2+8; cur=(isn==night)
        t=thumb.resize((w,h),Image.LANCZOS)
        if isn: t=Image.fromarray((np.asarray(t).astype(float)*np.array(K_SEA)*0.9).clip(0,255).astype('uint8'))
        t=ImageEnhance.Color(t.filter(ImageFilter.GaussianBlur(0.8))).enhance(0.9).convert('RGBA')
        m=Image.new('L',t.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=20,fill=255); t.putalpha(m)
        o=Image.new('RGBA',(w+8,h+8),(0,0,0,0)); ImageDraw.Draw(o).rounded_rectangle((0,0,w+7,h+7),radius=24,fill=(240,196,96,255) if cur else (196,166,118,255)); o.alpha_composite(t,(4,4))
        if not cur: o=Image.blend(o,Image.new('RGBA',o.size,(0,0,0,0)),0.0); o.putalpha(o.getchannel('A').point(lambda v:int(v*0.72)))
        if NIGHT and not isn: pass
        drop(ui,o,cx,cy,blur=6,alpha=0.20 if cur else 0.10,dy=6)
        icn=fith(A(ic),40); tw=d.textlength(lab,font=font(26)); lx=cx-(tw+48)/2
        paste_c(ui,icn,lx+20,cy+h/2+40); d.text((lx+48,cy+h/2+40),lab,font=font(26),fill=BROWN if cur else BROWN2,anchor='lm')
    d.polygon([(375-12,top+204-12),(375+14,top+204),(375-12,top+204+12)],fill=(160,128,84))
    lab='迎接晴昼' if night else '看看夜色'
    b=button('primary',lab,440,104,'icon_sun' if night else 'icon_moon',36,0.56); drop(ui,b,375,top+104+200+24+40+48+52,blur=6,alpha=0.3,dy=8)
    return C.finish_frame('island_rest_night' if night else 'island_rest_day',bg,ui)

# ================= 5. 还没存上 / 旅途回顾（只读） =================
def unsaved():
    ph=880; top=ctop(ph); bg,ui,x0,x1,d=frame(top,ph,'还没存上')
    C.stars(ui,top+184,3)
    d.text((375,top+336),'630 分',font=font(64),fill=BROWN,anchor='mm')
    tl='成绩还没存进旅程册'; tw=d.textlength(tl,font=font(28,False)); lx=375-(tw+48)/2
    cl=Image.new('RGBA',(36,36),(0,0,0,0)); ImageDraw.Draw(cl).ellipse((0,0,35,35),fill=(232,150,70)); ImageDraw.Draw(cl).text((18,17),'!',font=font(26),fill=(255,250,240),anchor='mm')
    paste_c(ui,cl,lx+18,top+424); d.text((lx+48,top+424),tl,font=font(28,False),fill=BROWN,anchor='lm')
    ch=gray(fitw(A('chest_body'),144),0.6); tl='存好后就能打开'; tw=d.textlength(tl,font=font(28,False)); lx=375-(ch.width+24+tw)/2
    paste_c(ui,ch,lx+ch.width/2,top+536); d.text((lx+ch.width+24,top+536),tl,font=font(28,False),fill=BROWN2,anchor='lm')
    b1=button('primary','重试保存',480,104,None,36); drop(ui,b1,375,top+656,blur=6,alpha=0.3,dy=8)
    b2=button('secondary','返回海岛',320,88,'icon_home',30); drop(ui,b2,375,top+776,blur=5,alpha=0.25,dy=5)
    return C.finish_frame('result_unsaved',bg,ui)
def readonly():
    ph=680; top=ctop(ph); bg,ui,x0,x1,d=frame(top,ph,'旅途回顾')
    C.stars(ui,top+184,3)
    d.text((375,top+336),'630 分',font=font(64),fill=BROWN,anchor='mm')
    tl='记录暂时不能写入，这局只看不存'; tw=d.textlength(tl,font=font(28,False)); lk=fith(A2('icon_lock'),36); lx=375-(tw+48)/2
    paste_c(ui,lk,lx+18,top+424); d.text((lx+48,top+424),tl,font=font(28,False),fill=BROWN2,anchor='lm')
    b2=button('primary','返回海岛',440,104,'icon_home',36); drop(ui,b2,375,top+552,blur=6,alpha=0.3,dy=8)
    return C.finish_frame('result_readonly',bg,ui)
if __name__=='__main__':
    if NIGHT: island_rest()
    else:
        item_intro(); bag('island'); bag('level'); journey(); island_rest(); unsaved(); readonly()
    print('ok')
