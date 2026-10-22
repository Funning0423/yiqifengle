# (c) 弹窗与界面定稿：6 张 750×1624 全屏图。python3 compose.py <outdir>
import sys, os, math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from ui_kit import *
OUT=sys.argv[1] if len(sys.argv)>1 else '..'
import subprocess
GIT_SHA=subprocess.run(['git','-C','/workspace/yiqifengle/work/棋盘UI美术bot','rev-parse','--short=7','HEAD'],capture_output=True,text=True).stdout.strip() or 'xxxxxxx'   # 预览用当前 worktree；运行时由构建注入
INP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'inputs')
BOARD=os.environ.get('BOARD_IMG',os.path.join(INP,'board_final_tools.png'))
ISLAND=os.environ.get('ISLAND_IMG','/workspace/yiqifengle/previews/pm-audit/C0_island_T9_props_reference.png')
def base(kind):
    src=Image.open(BOARD if kind=='board' else ISLAND).convert('RGB').resize((W,H),Image.LANCZOS)
    return mask(src)
def put_panel(img,cx,top,w,h,title=None):
    p=panel(w,h); drop(img,p,cx,top+h/2,blur=16,alpha=0.45,dy=16)
    if title:
        tp=title_plank(title); drop(img,tp,cx,top,blur=8,alpha=0.30,dy=8)
    return (cx-w/2,top,cx+w/2,top+h)
LAYER={}   # name -> list of (layer image) for night pass: we keep 'bg' and 'ui' separately
def finish_frame(name,bgimg,ui):
    out=bgimg.copy(); out.alpha_composite(ui); sysui(out)
    LAYER[name]=(bgimg,ui); out.convert('RGB').save(os.path.join(OUT,name+'.png'),optimize=True); return out
def icon_row(ui,d,x,y,icon,label,on=None,ih=58):
    ic=fith(A(icon),ih); paste_c(ui,ic,x+ih/2,y); d.text((x+ih+18,y),label,font=font(32),fill=BROWN,anchor='lm')
# ---------------- 暂停 ----------------
def pause():
    bg=base('board'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    pw,ph=PW,800; top=380; x0,y0,x1,y1=put_panel(ui,375,top,pw,ph,'暂停一下'); d=ImageDraw.Draw(ui)   # 定稿：只换无钉外框 + 宽 680，布局不动
    d.text((375,top+92),'01 露珠问候 · 还剩 22 步',font=font(28,False),fill=BROWN2,anchor='mm')
    # 3 tiles
    for i,(t,lab) in enumerate((('tile_restart','重来'),('tile_bag','行囊'),('tile_settings','设置'))):
        cx=375+(i-1)*178; tl=fitw(A(t),150); drop(ui,tl,cx,top+228,blur=6,alpha=0.25,dy=6)
        d.text((cx,top+322),lab,font=font(30),fill=BROWN,anchor='mm')
    divider(d,x0+70,x1-70,top+378)
    # quick toggles
    for i,(ic,lab) in enumerate((('icon_music','音乐'),('icon_sfx','音效'))):
        bx=x0+64+i*278; cy=top+446
        icon_row(ui,d,bx,cy,ic,lab,ih=50); tg=toggle(True,46); paste_c(ui,tg,bx+196,cy)
    # buttons
    b1=button('primary','继续',480,104,'icon_play',36); drop(ui,b1,375,top+580,blur=6,alpha=0.3,dy=7)
    b2=button('secondary','离开棋盘',480,96,'icon_home',32); drop(ui,b2,375,top+700,blur=6,alpha=0.25,dy=6)
    return finish_frame('pause',bg,ui)
def restart_confirm():
    bg=base('board'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    pw,ph=PW,440; top=592; x0,y0,x1,y1=put_panel(ui,375,top,pw,ph,'重来这一关？'); d=ImageDraw.Draw(ui)
    tl=fitw(A('tile_restart'),128); paste_c(ui,tl,375,top+152)
    d.text((375,top+256),'这一局会从头再来',font=font(30,False),fill=BROWN,anchor='mm')
    b1=button('secondary','留下',248,96,None,32); drop(ui,b1,375-136,top+344,blur=6,alpha=0.25,dy=6)
    b2=button('primary','重来',248,96,None,32); drop(ui,b2,375+136,top+344,blur=6,alpha=0.3,dy=6)
    return finish_frame('pause_restart_confirm',bg,ui)
# ---------------- 设置 ----------------
def settings():
    bg=base('island'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    pw,ph=PW,768; top=round((H-768)/2/8)*8; x0,y0,x1,y1=put_panel(ui,375,top,pw,ph,'设置'); d=ImageDraw.Draw(ui)
    cl=fitw(A('btn_close'),80); drop(ui,cl,x1-32,top+24,blur=4,alpha=0.30,dy=4)
    # PM 决定 1/2：音乐 = 音乐音量（GameAudio.setMusicVolume），音效 = 单独静音（新增 sfxMuted）；全局静音不上界面；震动这一版不放
    rows=[('icon_music','音乐',0.4,'slider'),('icon_sfx','音效',True,None),('icon_sun','昼夜',None,'seg'),('icon_motion','减少动态',False,None)]
    y=top+136
    for ic,lab,on,extra in rows:
        icon_row(ui,d,x0+72,y,ic,lab,ih=56)
        if extra=='slider':
            sl=slider(on,236,32); paste_c(ui,sl,x1-178,y)
        elif extra=='seg':
            # segmented 晴昼 | 夜色 (two mini wood pills; selected = teal)
            a=button('primary','晴昼',136,62,'icon_sun',24,0.5); b=button('secondary','夜色',136,62,'icon_moon',24,0.5)
            paste_c(ui,a,x1-260,y); paste_c(ui,b,x1-118,y)
        else:
            tg=toggle(on,56); paste_c(ui,tg,x1-110,y)
        y+=112
    # about（精简：去掉分隔线、字体署名行和提示行；署名移到「关于」二级页）
    y+=24
    ab=fith(A('icon_about'),56); paste_c(ui,ab,x0+100,y+20)
    d.text((x0+144,y),'关于《咦，起风了》',font=font(32),fill=BROWN,anchor='lm')
    d.text((x0+144,y+44),'v0.1 · 构建 '+GIT_SHA,font=font(26,False),fill=BROWN2,anchor='lm')
    return finish_frame('settings',bg,ui)
# ---------------- 奖励领取 ----------------
def rays(size,n=14,col=(255,236,170)):
    im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); c=size/2
    for k in range(n):
        a=2*math.pi*k/n; b=a+math.pi/n*0.55
        d.polygon([(c,c),(c+c*math.cos(a),c+c*math.sin(a)),(c+c*math.cos(b),c+c*math.sin(b))],fill=col+(70,))
    g=Image.new('L',(size,size),0); ImageDraw.Draw(g).ellipse((0,0,size,size),fill=255); g=g.filter(ImageFilter.GaussianBlur(size/8))
    a=Image.composite(im.getchannel('A'),Image.new('L',im.size,0),g); im.putalpha(a)
    glow=Image.new('RGBA',(size,size),(0,0,0,0)); ImageDraw.Draw(glow).ellipse((size*0.28,size*0.28,size*0.72,size*0.72),fill=(255,232,160,170))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size/14))); return im
def item(name,n,h=118,grade=True):
    im=A(name); im=fith(im,h); im=focus_grade(im) if grade else im
    o=pad(im,26); o.alpha_composite(badge(n,22),(o.width-74,o.height-70)); return o
REWARD_GAPS={}
def reward():
    # 布局按实测 alpha 边界排：宝箱层（光 + 影 + 箱）底边 → 获得物文字 ≥ 1 行字高；文字 → 说明；说明 → 「收下」
    bg=base('board'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    pw=PW; T=0                      # build in panel-local coords first (canvas taller than needed), then place
    lay=Image.new('RGBA',(W,1400),(0,0,0,0))
    CHW=320; ch=fitw(A('chest_open'),CHW); ccy=150+ch.height/2+20      # chest centre (local)
    mouth=ccy+ch.height*0.02                                             # opening sits just above the centre in the new 40° view
    r=rays(480); r=mul(r,K_HALF) if NIGHT else r; lay.alpha_composite(r,(round(375-r.width/2),round(mouth-r.height/2)))
    # soft glow pouring out of the open mouth (behind the lid, in front of rays)
    gl=Image.new('RGBA',(360,260),(0,0,0,0)); ImageDraw.Draw(gl).ellipse((60,60,300,200),fill=(255,226,150,150)); gl=gl.filter(ImageFilter.GaussianBlur(34))
    if NIGHT: gl=mul(gl,K_HALF)
    lay.alpha_composite(gl,(375-180,round(mouth-150)))
    drop(lay,ch,375,ccy,blur=10,alpha=0.35,dy=10)
    its=[('tool_starlight',1),('reward_seal_tide','印'),('tool_windbell',1)]
    pos=[(375-180,118),(375,84),(375+180,118)]
    for (n,c),(x,y) in zip(its,pos):
        if n.startswith('reward_seal'): it=pad(fith(A(n),116),26)
        else: it=item(n,c,108)
        paste_c(lay,shadow_of(pad(it,10),8,0.25),x+3,y+8); paste_c(lay,it,x,y)
    al=lay.getchannel('A').point(lambda v:255 if v>12 else 0); bb=al.getbbox(); top_art,bot_art=bb[1],bb[3]
    d0=ImageDraw.Draw(lay)
    f1=font(32); f2=font(28,False); t1='星光 ×1  ·  潮汐印记  ·  风语铃 ×1'; t2='海风吹开了宝箱，收进行囊吧。'
    LINE=44                                             # one line of the 32 px label (CJK line box ≈ 1.375 em)
    g1=56; g2=32; g3=64; g4=56
    b1=d0.textbbox((0,0),t1,font=f1,anchor='lt'); h1=b1[3]-b1[1]; b2=d0.textbbox((0,0),t2,font=f2,anchor='lt'); h2=b2[3]-b2[1]
    y1=bot_art+g1; y2=y1+h1+g2; BH=104; yb=y2+h2+g3; ph=yb+BH+g4+10
    # place: art starts 40 px inside the panel, panel vertically near centre
    off=66-top_art; ph=ph+off; top=round((H-ph)/2)+30
    x0,y0,x1,y1p=put_panel(ui,375,top,pw,ph,'获得'); d=ImageDraw.Draw(ui)
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).rounded_rectangle((x0+44,y0+44,x1-44,y1p-44),radius=30,fill=255)
    L2=Image.new('RGBA',(W,H),(0,0,0,0)); L2.alpha_composite(lay.crop((0,0,W,min(1400,H-top-off))) if top+off>=0 else lay,(0,top+off))
    L2.putalpha(Image.composite(L2.getchannel('A'),Image.new('L',(W,H),0),m)); ui.alpha_composite(L2)
    Y=lambda v:top+off+v
    d.text((375,Y(y1)-b1[1]),t1,font=f1,fill=BROWN,anchor='mt')
    d.text((375,Y(y2)-b2[1]),t2,font=f2,fill=BROWN2,anchor='mt')
    b=button('primary','收下',420,BH,None,38); drop(ui,b,375,Y(yb)+BH/2,blur=6,alpha=0.3,dy=7)
    REWARD_GAPS.update({'面板顶':top,'面板高':ph,'焦点层(光+影+箱+获得物) 顶':Y(top_art),'焦点层底(含影子与光晕, alpha>12)':Y(bot_art),
        '焦点层底 → 获得物文字顶':g1,'一行字高(32px 字)':LINE,'获得物文字字高':h1,'获得物文字底 → 说明文字顶':g2,'说明文字字高':h2,
        '说明文字底 → 「收下」按钮顶':g3,'按钮高':BH,'按钮底 → 面板底':ph-off-(yb+BH),'面板顶 → 焦点层顶':66,'宝箱显示宽×高':(ch.width,ch.height)})
    import json; json.dump(REWARD_GAPS,open(os.path.join(OUT,'reward_layout.json' if not NIGHT else 'reward_layout_night.json'),'w'),ensure_ascii=False,indent=1)
    return finish_frame('reward_claim',bg,ui)
# ---------------- 结算 ----------------
def stars(ui,cy,filled):
    for i in range(3):
        big=i==1; h=170 if big else 132; x=375+(i-1)*170; y=cy-(26 if big else 0)
        st=fith(A('star_full' if i<filled else 'star_empty'),h)
        if i>=filled:
            a=st.getchannel('A').point(lambda v:int(v*0.75)); st=ImageEnhance.Brightness(st).enhance(0.92); st.putalpha(a)
        drop(ui,st,x,y,blur=6,alpha=0.30 if i<filled else 0.15,dy=6)
def result(win):
    # 精简：无分隔线、无小节标签；正文 28 · 数字 64/40；间距 8 的倍数
    bg=base('board'); ui=Image.new('RGBA',(W,H),(0,0,0,0))
    ph=1008 if win else 920; top=round((H-ph)/2/8)*8
    pw=PW; x0,y0,x1,y1=put_panel(ui,375,top,pw,ph,'过关啦' if win else '差一点点'); d=ImageDraw.Draw(ui)
    stars(ui,top+184,3 if win else 0)
    if win:
        d.text((375,top+336),'630 分',font=font(64),fill=BROWN,anchor='mm')
        hg=fith(A('icon_moves'),48); tl='用了 18 步 · 剩余 4 步'; tw=d.textlength(tl,font=font(28,False)); lx=375-(tw+56)/2
        paste_c(ui,hg,lx+24,top+416); d.text((lx+56,top+416),tl,font=font(28,False),fill=BROWN,anchor='lm')
        tag='成绩已保存'; tw=d.textlength(tag,font=font(28,False)); d.rounded_rectangle((375-tw/2-24,top+448,375+tw/2+24,top+496),radius=24,fill=(224,238,232),outline=(100,168,164),width=2)
        d.text((375,top+472),tag,font=font(28,False),fill=TEAL,anchor='mm')
        ch=fitw(A('chest_body'),176); drop(ui,ch,375-104,top+600,blur=7,alpha=0.3,dy=8)
        st=item('tool_starlight',1,104); paste_c(ui,st,375+112,top+600)
        b1=button('primary','下一关',480,104,None,36); drop(ui,b1,375,top+776,blur=6,alpha=0.3,dy=8)
        b2=button('secondary','回小岛',320,88,'icon_home',30); drop(ui,b2,375,top+896,blur=5,alpha=0.25,dy=5)
    else:
        d.text((375,top+336),'步数用完了，换个顺序试试？',font=font(28,False),fill=BROWN,anchor='mm')
        for i,(n,c) in enumerate((('piece_strawberry',3),('obstacle_moss',1))):
            cx=375-112+i*224; ic=fith(focus_grade(A(n)),96); paste_c(ui,ic,cx-32,top+440)
            d.text((cx+24,top+440),'×%d'%c,font=font(40),fill=BROWN,anchor='lm')
        ch=fitw(A('chest_body'),144); g=ImageOps.grayscale(ch.convert('RGB')).convert('RGBA'); g=Image.blend(g,Image.new('RGBA',g.size,(214,206,186,255)),0.35); g.putalpha(ch.getchannel('A').point(lambda v:int(v*0.6)))
        tl='过关后可以打开'; tw=d.textlength(tl,font=font(28,False)); lx=375-(g.width+24+tw)/2
        paste_c(ui,g,lx+g.width/2,top+568); d.text((lx+g.width+24,top+568),tl,font=font(28,False),fill=BROWN2,anchor='lm')
        b1=button('primary','再试一次',480,104,'icon_play',36); drop(ui,b1,375,top+688,blur=6,alpha=0.3,dy=8)
        b2=button('secondary','回小岛',320,88,'icon_home',30); drop(ui,b2,375,top+808,blur=5,alpha=0.25,dy=5)
    return finish_frame('result_win' if win else 'result_lose',bg,ui)
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True)
    pause(); restart_confirm(); settings(); reward(); result(True); result(False)
    import pickle
    for k,(b,u) in LAYER.items():
        os.makedirs('/tmp/cpop/layers',exist_ok=True); b.save('/tmp/cpop/layers/%s_bg.png'%k); u.save('/tmp/cpop/layers/%s_ui.png'%k)
    print('ok')
