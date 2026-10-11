# 精简样张（Funning 精简原则）：行囊 · 岛上版、旅程册。python3 compose_lite.py <c-popups>
# 规则：只留一层浅木外框（无角钉）、标题木牌无绳无钉；没有副标题、小节标签、虚线；内容直接放在底板上，
#      道具格只给一层很浅的平底（无边框）；间距全部 8 的倍数；每张最多三级字号。
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE)); sys.path.insert(0,HERE)
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); sys.argv=[sys.argv[0],CP]
import compose as C
import compose2 as C2
from ui_kit import *
from ui_kit import _three
import numpy as np
OUT=os.path.join(CP,'r2','lite'); os.makedirs(OUT,exist_ok=True); C.OUT=OUT
A2=C2.A2
WELL=(236,224,196); WELL_ZERO=(232,226,212)        # 很浅的一层平底（比纸色深一档），无描边
def panel_lite(w,h): return nine(A2('panel_frame_clean'),FRAME_INS,round(w),round(h),FRAME_SCALE)
def plank_lite(txt):
    pl=A2('title_plank_clean'); h=round(pl.height*0.56); t=baked_title(txt); w=max(300,t.width+150); im=_three(pl,150,w,h)
    im.alpha_composite(t,(round(w/2-t.width/2),round(h*0.52-t.height/2))); return im
def put(ui,top,w,h,title):
    p=panel_lite(w,h); drop(ui,p,375,top+h/2,blur=16,alpha=0.45,dy=16)
    tp=plank_lite(title); drop(ui,tp,375,top,blur=8,alpha=0.30,dy=8)
    return 375-w/2,top,375+w/2,top+h
def close_btn(ui,x1,top): cl=fitw(A('btn_close'),80); drop(ui,cl,x1-32,top+24,blur=4,alpha=0.30,dy=4)
def count_tag(n):
    # 数量角标：小号平底胶囊，深棕数字；0 用浅灰
    f=font(22); t='×%d'%n; d0=ImageDraw.Draw(Image.new('RGB',(1,1))); tw=d0.textlength(t,font=f)
    w,h=round(tw+24),32; im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,w-1,h-1),radius=16,fill=(250,245,232) if n else (238,234,224),outline=(201,177,133) if n else (214,206,190),width=2)
    d.text((w/2,h/2),t,font=f,fill=BROWN if n else (164,154,138),anchor='mm'); return im
def well(w,h,col): im=Image.new('RGBA',(w,h),(0,0,0,0)); ImageDraw.Draw(im).rounded_rectangle((0,0,w-1,h-1),radius=24,fill=col+(255,)); return im

def bag_lite():
    bg=C.base('island'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    pw=680; CW,CH,G=160,192,16                          # 道具格 160×192，间距 16
    rows=[C2.TOOLS[:3],C2.TOOLS[3:]]
    top_pad=104; grid_h=2*CH+G; gap=64; ill_h=136; txt_h=40; bot=72
    ph=top_pad+grid_h+gap+ill_h+16+txt_h+bot; top=round((H-ph)/2/8)*8
    x0,y0,x1,y1=put(ui,top,pw,ph,'旅人的行囊'); close_btn(ui,x1,top); d=ImageDraw.Draw(ui)
    y=top+top_pad
    for row in rows:
        n=len(row); sx=375-(n*CW+(n-1)*G)/2
        for i,(tn,lab,c) in enumerate(row):
            cx=sx+i*(CW+G)+CW/2; zero=c==0
            ui.alpha_composite(well(CW,CH,WELL_ZERO if zero else WELL),(round(cx-CW/2),y))
            ic=fitw(C2.TOOL(tn),136)
            if zero: ic=C2.gray(ic,0.5)
            else: paste_c(ui,shadow_of(pad(ic,8),6,0.16),cx+2,y+80+6)
            paste_c(ui,ic,cx,y+80)
            d.text((cx,y+CH-32),lab,font=font(26),fill=(164,154,138) if zero else BROWN,anchor='mm')
            tg=count_tag(c); ui.alpha_composite(tg,(round(cx+CW/2-tg.width-8),y+8))
        y+=CH+G
    y+=gap-G
    # 装扮空状态：一枚半透明蝴蝶结（3D）+ 柔和的落影，一句话
    bow=fith(A2('icon_charm'),112); g=bow.copy(); g.putalpha(bow.getchannel('A').point(lambda v:int(v*0.5)))
    sh=Image.new('RGBA',(200,40),(0,0,0,0)); ImageDraw.Draw(sh).ellipse((40,8,160,32),fill=(120,96,60,60)); sh=sh.filter(ImageFilter.GaussianBlur(6))
    paste_c(ui,sh,375,y+ill_h-16); paste_c(ui,g,375,y+ill_h/2-8)
    y+=ill_h+16
    d.text((375,y+txt_h/2),'还没有装扮',font=font(26,False),fill=BROWN2,anchor='mm')
    return C.finish_frame('bag_island_lite',bg,ui)

REG=os.path.join(HERE,'raw','regions')
REG_CROP={'tide':(150,96,610,400),'meadow':(40,24,680,446),'sky':(40,16,680,438)}
REG_SKY={'meadow':((172,214,232),(246,239,217)),'sky':((186,198,236),(247,236,220))}
def region_window(rid,w,h,lock=False,placeholder=False):
    # 「一扇窗看到那个地区」：圆角风景小图，跟背景一样柔焦、淡雅（轻模糊 + 降饱和 + 罩一层纸色）
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
    # 窗沿：一圈 3 px 浅木线 + 内侧 1 px 高光，像嵌进路牌里
    o=Image.new('RGBA',(w+8,h+8),(0,0,0,0)); od=ImageDraw.Draw(o); od.rounded_rectangle((0,0,w+7,h+7),radius=20,fill=(196,166,118,255) if not lock else (198,190,176,255))
    o.alpha_composite(im,(4,4)); od=ImageDraw.Draw(o); od.rounded_rectangle((4,4,w+3,h+3),radius=16,outline=(255,250,236,90),width=1)
    if placeholder:
        f=font(20,False); tw=od.textlength('占位',font=f)
        od.rounded_rectangle((w-tw-20,h-26,w+2,h+0),radius=11,fill=(255,250,238,200)); od.text((w-tw/2-9,h-13),'占位',font=f,fill=(140,124,100),anchor='mm')
    return o

def journey_lite():
    bg=C.base('island'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    pw=680; src=A2('sign_plank_clean'); SW,SH_,G=544,176,32
    sign=_three(src,round(src.width*0.16*SH_/src.height*src.height/SH_),SW,SH_) if False else _three(src,round(src.width*0.16),SW,SH_)
    top_pad=104; bot=72; ph=top_pad+3*SH_+2*G+bot; top=round((H-ph)/2/8)*8
    x0,y0,x1,y1=put(ui,top,pw,ph,'旅程册'); close_btn(ui,x1,top); d=ImageDraw.Draw(ui)
    CH=[('tide','潮汐小径','reward_seal_tide',10,1,False,False),('meadow','花粉草甸','reward_seal_meadow',3,0,False,True),('sky','天空回声','reward_seal_sky',0,0,True,True)]
    IW,IH=200,128
    y=top+top_pad
    for rid,name,seal,stars,chal,lock,ph_ in CH:
        s=sign if not lock else C2.gray(sign,1.0,(228,220,204)); cy=y+SH_/2; cx0=375-SW/2
        drop(ui,s,375,cy,blur=6,alpha=0.20,dy=8)
        win=region_window(rid,IW,IH,lock,ph_); ix=cx0+24; ui.alpha_composite(shadow_of(win,4,0.18),(round(ix)+1,round(cy-win.height/2)+3)) if False else None
        ui.alpha_composite(win,(round(ix),round(cy-win.height/2)))
        se=fith(A(seal),64)
        if lock: se=C2.gray(se,0.6)
        drop(ui,se,ix+12,cy-win.height/2+12,blur=3,alpha=0.25,dy=3)
        if lock:
            lk=fith(A2('icon_lock'),64); drop(ui,lk,ix+win.width/2,cy,blur=4,alpha=0.30,dy=4)
        tx=ix+win.width+24
        t=baked_title(name,40)
        if lock: t=C2.gray(t,0.8,(170,160,140))
        ui.alpha_composite(t,(round(tx),round(cy-40-t.height/2)))
        if not lock:
            sf=fith(A('star_full'),32); paste_c(ui,sf,tx+16,cy+8)
            d.text((tx+40,cy+8),'%d/12'%stars,font=font(24),fill=BROWN,anchor='lm')
            px=tx; fy=cy+52; tw=d.textlength('挑战 %d/4'%chal,font=font(24)); w_=round(tw+44)
            d.rounded_rectangle((px,fy-18,px+w_,fy+18),radius=18,outline=(100,168,164),width=2,fill=(236,244,240))
            fx=px+16; d.line((fx,fy-10,fx,fy+10),fill=(58,120,118),width=3); d.polygon([(fx+1,fy-10),(fx+13,fy-6),(fx+1,fy-1)],fill=(58,120,118))
            d.text((px+30,fy),'挑战 %d/4'%chal,font=font(24),fill=TEAL,anchor='lm')
        else:
            d.text((tx,cy+16),'主线解锁后开启',font=font(24,False),fill=(176,166,150),anchor='lm')
        y+=SH_+G
    return C.finish_frame('journey_book_lite',bg,ui)

def side(name,a,b,la,lb,note):
    A_=Image.open(a).convert('RGB'); B_=Image.open(b).convert('RGB'); h=1180
    A_=A_.resize((round(A_.width*h/A_.height),h)); B_=B_.resize((round(B_.width*h/B_.height),h))
    out=Image.new('RGB',(A_.width+B_.width+90,h+190),(246,240,226)); d=ImageDraw.Draw(out)
    d.text((30,24),la,font=font(26),fill=(70,52,34)); d.text((A_.width+60,24),lb,font=font(26),fill=(70,52,34))
    out.paste(A_,(30,70)); out.paste(B_,(A_.width+60,70))
    for k,l in enumerate(note.split('\n')): d.text((30,h+100+k*30),l,font=font(21,False),fill=(70,52,34),anchor='ls')
    p=os.path.join(OUT,name); out.save(p,quality=88,optimize=True); return p
if __name__=='__main__':
    which=os.environ.get('ONLY','bag,journey').split(',')
    if 'bag' in which: bag_lite()
    if 'journey' in which: journey_lite()
    R2=os.path.join(CP,'r2')
    if 'bag' in which: side('compare_bag_island_r2_vs_lite.jpg',os.path.join(R2,'bag_island.png'),os.path.join(OUT,'bag_island_lite.png'),'r2 现版','精简版',
         '去掉：副标题、「道具 / 装扮」小节标签、虚线、底部说明、格子木框、挂衣杆 / 挂钩 / 星点；\n外框去角钉，标题木牌去绳去钉。道具格 160×192（图标 136 px），一层很浅的平底；数量角标 22 px 小胶囊；\n装扮空状态只留半透明蝴蝶结 + 一句话。间距 8 的倍数（16 / 64 / 104），字号三级：标题 46 · 名称 26 · 数字 22。')
    if 'journey' in which: side('compare_journey_book_r2_vs_lite.jpg',os.path.join(R2,'journey_book.png'),os.path.join(OUT,'journey_book_lite.png'),'r2 现版','精简版',
         '去掉：副标题、描述小字、进度圆点、「翻开 ›」、底部合计、书签丝带、底部提示、路牌钉子；外框去角钉，标题木牌去绳去钉。\n每章一扇「地区之窗」：潮汐小径 = 本作小岛 combined_visual_m.glb 实渲；花粉草甸 / 天空回声 = 低多边形占位（图上标「占位」）。\n印记缩到 64 px 压在窗角；章节名 · 主线星数（每章 12 星）· 「挑战 x/4」；未解锁 = 去色 + 加雾 + 金锁。间距 24 / 32 / 104，字号三级：46 · 40 · 24。')
    print('ok')
