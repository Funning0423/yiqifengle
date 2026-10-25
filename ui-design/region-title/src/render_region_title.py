#!/usr/bin/env python3
"""UI设计部 · 地名开局淡入 (region arrival title) previews. Run from repo root of the worktree:
   python3 ui-design/region-title/src/render_region_title.py   (needs /workspace/wechat-game/ui-audit for backgrounds)"""
import json, os, math, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.dirname(HERE); AUD='/workspace/wechat-game/ui-audit'
OLD='/workspace/wechat-game/work/post-island-ui/ui-design/post-island/transitions'
LAY=json.load(open(os.path.join(HERE,'layout_7sizes.json')))
def ttc(path,lang='SC'):
    for i in range(10):
        try:
            f=ImageFont.truetype(path,10,index=i)
            if lang in f.getname()[0]: return i
        except Exception: break
    return 0
SERIF='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'; SI=ttc(SERIF)
SANS='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'; NI=ttc(SANS)
SANSB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; NBI=ttc(SANSB)
def sans(px,b=False): return ImageFont.truetype(SANSB if b else SANS,int(px),index=NBI if b else NI)
# ---- spec (pt) ----
S=dict(font=24,track=.15,fill_day=(0xFF,0xF8,0xEC),fill_night=(0xE8,0xEE,0xFF),night_alpha=.9,
       shadow_day=(0x5A,0x3A,0x1E),shadow_day_a=.5,shadow_day_blur=4.5,shadow_day_dy=1,tight_day_a=.4,tight_day_blur=1.0,
       glow_night=(0x9C,0xB4,0xF0),glow_night_a=.38,glow_night_blur=7,
       line_w=44,line_gap=7,line_h=1,line_a=.5,inS=.4,holdS=1.2,outS=.4,risePt=6)
def ease_out(t): t=max(0,min(1,t)); return 1-(1-t)**3
def ease_in(t): t=max(0,min(1,t)); return t*t
def state(t):
    """t seconds since show → (alpha 0..1 before night cap, dy pt (+ = below rest))"""
    if t<0: return 0,S['risePt']
    if t<S['inS']: k=ease_out(t/S['inS']); return k,S['risePt']*(1-k)
    if t<S['inS']+S['holdS']: return 1,0
    u=t-S['inS']-S['holdS']
    if u<S['outS']: return 1-ease_in(u/S['outS']),0
    return 0,0
def title_layer(W,H,sc,cx,cy,name,night,alpha=1.,dy=0.,deco=True):
    """RGBA layer W×H px, sc px/pt, (cx,cy) ink-block centre in pt. Rendered 2× and downsampled (anti-aliased)."""
    ss=2; s=sc*ss; f=ImageFont.truetype(SERIF,round(S['font']*s),index=SI)
    adv=[f.getlength(c) for c in name]; tr=S['font']*S['track']*s
    tw=sum(adv)+tr*(len(name)-1); asc=f.getbbox('风')
    gh=asc[3]-asc[1]; lineblk=(S['line_gap']+S['line_h'])*s if deco else 0
    bh=gh+lineblk; x0=cx*s-tw/2; y0=(cy+dy)*s-bh/2-asc[1]
    def glyphs(col):
        L=Image.new('L',(W*ss,H*ss),0); d=ImageDraw.Draw(L); x=x0
        for c,a in zip(name,adv): d.text((x,y0),c,font=f,fill=col); x+=a+tr
        return L
    def line_mask():
        L=Image.new('L',(W*ss,H*ss),0)
        if not deco: return L
        d=ImageDraw.Draw(L); ly=y0+asc[3]+S['line_gap']*s; lw=S['line_w']*s; n=60
        for i in range(n):  # fades out to both ends
            u=(i+.5)/n; a=math.sin(math.pi*u)**1.5
            xa=cx*s-lw/2+lw*i/n; d.rectangle([xa,ly,xa+lw/n+1,ly+S['line_h']*s],fill=int(255*a))
        return L
    G=glyphs(255); Lm=line_mask(); out=Image.new('RGBA',(W*ss,H*ss),(0,0,0,0))
    def comp(mask,rgb,a,blur=0,dyp=0):
        m=mask
        if dyp: m=m.transform(m.size,Image.AFFINE,(1,0,0,0,1,-dyp*s))
        if blur: m=m.filter(ImageFilter.GaussianBlur(blur*s))
        m=m.point(lambda v:int(v*a)); layer=Image.new('RGBA',out.size,rgb+(0,)); layer.putalpha(m)
        return Image.alpha_composite(out,layer)
    if not night:
        out=comp(G,S['shadow_day'],S['shadow_day_a'],S['shadow_day_blur'],S['shadow_day_dy'])
        out=comp(G,S['shadow_day'],S['tight_day_a'],S['tight_day_blur'],.5)
        out=comp(G,S['fill_day'],1); out=comp(Lm,S['fill_day'],S['line_a'])
    else:
        out=comp(G,S['glow_night'],S['glow_night_a'],S['glow_night_blur'])
        out=comp(G,(0x14,0x1C,0x34),.22,1.2,.5)
        out=comp(G,S['fill_night'],S['night_alpha']); out=comp(Lm,S['fill_night'],S['line_a']*S['night_alpha'])
    out=out.resize((W,H),Image.LANCZOS)
    if alpha<1: a=out.getchannel('A').point(lambda v:int(v*alpha)); out.putalpha(a)
    ink=(cx-tw/s/2,cy+dy-bh/s/2,tw/s,bh/s)
    return out,ink
def on(bg,name,night,size,t=None,deco=True):
    w,h=map(int,size.split('x')); L=LAY[size]; im=bg.convert('RGBA').resize((w*2,h*2)) if bg.size!=(w*2,h*2) else bg.convert('RGBA')
    a,dy=(1,0) if t is None else state(t)
    lay,ink=title_layer(w*2,h*2,2,w/2,L['toast']['y'],name,night,a,dy,deco)
    return Image.alpha_composite(im,lay),ink
REG=[('meadow','草原','花粉草甸'),('skycity','天空城','天空之城'),('lakeside','湖畔','风铃湖畔')]
BG={('meadow',0):(AUD+'/2026-10-22/build16-660fb0f/meadow_sky/lk4_meadow_day_ml_board.png','390x844','真机构建截图 build16 L5'),
    ('meadow',1):(AUD+'/2026-10-22/build16-660fb0f/meadow_sky/lk4_meadow_night_ml_board.png','390x844','真机构建截图 build16 L5 夜'),
    ('skycity',0):(AUD+'/2026-10-22/build16-660fb0f/meadow_sky/lk4_sky_day_ml_board.png','390x844','真机构建截图 build16 L9'),
    ('skycity',1):(AUD+'/2026-10-25/build16-fixes-r3/img/raw/sky_night_390x844_board2.png','390x844','截图 build16-fixes r3 L9 夜（「星光」提示排在地名后）'),
    ('lakeside',0):(AUD+'/2026-10-25/build16-fixes-r3/art/raw/l13_day_375x667_board.png','375x667','截图 build16-fixes r3 L13（375×667）'),
    ('lakeside',1):(AUD+'/2026-10-25/build16-fixes-r2/art/kit/raw/l13_night_375x667_board.png','375x667','截图 build16-fixes r2 L13 夜（375×667）')}
# old transition hold frames (TR keyframes, frame column 3 = HOLD with vehicle + plank sign)
def old_frame(tr,col=2):
    """crop frame `col` (0..5) of a 1258×502 TR keyframes sheet (6 frames, 206 px pitch)."""
    im=Image.open(f'{OLD}/{tr}_keyframes.png').convert('RGB'); x0=18+col*206.2
    return im.crop((round(x0)+1,42,round(x0)+194,459))
def nightify(im):
    im=im.convert('RGB'); r,g,b=im.split()
    return Image.merge('RGB',(r.point(lambda v:int(v*.36)),g.point(lambda v:int(v*.42)),b.point(lambda v:int(v*.62+18))))
OLDSRC={('meadow',0):('TR1',2,False,'旧 TR1 停留帧'),('meadow',1):('TR1',2,True,'旧 TR1 停留帧（夜间=压暗示意）'),
        ('skycity',0):('TR3',2,False,'旧 TR3 停留帧'),('skycity',1):('TR3n',2,False,'旧 TR3n 夜间停留帧'),
        ('lakeside',0):('TR6',2,False,'旧 TR6 落地木牌帧'),('lakeside',1):('TR6',2,True,'旧 TR6 落地木牌（夜间=压暗示意）')}
def label(d,xy,txt,px=22,col=(70,50,30),b=False): d.text(xy,txt,font=sans(px,b),fill=col)
def panel(im,h=900):
    im=im.convert('RGB'); return im.resize((round(im.width*h/im.height),h),Image.LANCZOS)
def compare():
    for rid,cn,name in REG:
        cells=[]
        for night in (0,1):
            tr,col,dark,cap=OLDSRC[(rid,night)]; o=old_frame(tr,col); o=nightify(o) if dark else o
            p,sz,src=BG[(rid,night)]; n,_=on(Image.open(p),name,bool(night),sz)
            cells.append((panel(o),cap+'：转场中的地名木牌 + 载具')); cells.append((panel(n),'新：开局淡入「'+name+'」· '+src))
        W=sum(c[0].width for c in cells)+40*5; C=Image.new('RGB',(W,900+170),(246,240,228)); d=ImageDraw.Draw(C)
        label(d,(40,24),f'地名开局淡入 · {cn}「{name}」 前后对比（左：白天，右：夜间；每组 旧 → 新）',34,b=True)
        label(d,(40,70),'新方案底图为真机/网页构建截图，地名为按 SPEC 合成（示意）；旧图取自 post-island transitions 关键帧。',22,(120,100,80))
        x=40
        for i,(c,cap) in enumerate(cells):
            C.paste(c,(x,120)); label(d,(x,1030),cap,19,(90,70,50)); x+=c.width+(60 if i==1 else 40)
        C.save(os.path.join(OUT,f'compare_{rid}.png'))
def annot():
    sz='390x844'; L=LAY[sz]; im,ink=on(Image.open(BG[('meadow',0)][0]),'花粉草甸',False,sz)
    im=im.convert('RGB'); C=Image.new('RGB',(780+700,1688),(246,240,228)); C.paste(im,(0,0)); d=ImageDraw.Draw(C); k=2
    pb=L['plateBottom']; tt=L['trayTop']; cy=L['toast']['y']; x,y,w,h=ink
    red=(214,80,50); blu=(40,110,160)
    d.rectangle([x*k,y*k,(x+w)*k,(y+h)*k],outline=red,width=2)
    for yy,c,t in [(pb,blu,f'信息牌下沿 y={pb:.0f}'),(tt,blu,f'棋盘托盘上沿 y={tt:.0f}'),(cy,red,f'地名中心 y={cy:.0f}（=layout.toast.y，{cy/844*100:.1f}%）'),(47,(120,120,120),'安全区顶 y=47')]:
        d.line([0,yy*k,780,yy*k],fill=c,width=2)
    d.line([32*k,y*k-30,32*k,(y+h)*k+30],fill=red,width=2); d.line([(390-32)*k,y*k-30,(390-32)*k,(y+h)*k+30],fill=red,width=2)
    tx=810; ty=60; f=lambda s,px=26,c=(60,40,25),b=False:(label(d,(tx,ty),s,px,c,b))
    lines=[('标注 · 390×844（pt）',34,True),('',20,False),
      (f'字：Noto Serif SC Bold 子集（宋体系，暖），24pt',24,False),('字间距 0.15em = 3.6pt，单行居中',24,False),
      (f'字块墨迹 ≈ {w:.0f}×{h:.0f}pt（含细线）',24,False),(f'左右余量 {x:.0f}pt ≥ 32pt 参考线',24,False),
      ('细线：44×1pt，字底下 7pt，两端渐隐，α0.5',24,False),('',16,False),
      ('位置：中心 = layout.toast.y',26,True),(f'在信息牌下沿 {pb:.0f} 与托盘上沿 {tt:.0f} 之间',24,False),
      ('与「提示牌」同一槽位 → 不压 HUD、不压棋盘',24,False),('她在屏幕下部（棋盘下方），远离脸和胸口',24,False),('',16,False),
      ('白天',26,True),('  填色 #FFF8EC',24,False),('  投影 #5A3A1E α0.5 模糊 4.5pt 下移 1pt',24,False),('  贴边描影 #5A3A1E α0.4 模糊 1pt',24,False),('',16,False),
      ('夜间',26,True),('  填色 #E8EEFF × 最高 α0.9',24,False),('  外发光 #9CB4F0 α0.38 模糊 7pt',24,False),('  贴边描影 #141C34 α0.22 模糊 1.2pt',24,False),
      ('  颜色随 uiNightWeight 在两套间插值',24,False),('',16,False),
      ('动画：0.4 淡入+上浮6pt(ease-out) / 停 1.2 / 0.4 淡出(ease-in)',24,False),('总 2.0s；不拦截触摸；每区域只显示一次',24,False)]
    for s,px,b in lines: label(d,(tx,ty),s,px,(60,40,25),b); ty+=px+18
    sw=[(S['fill_day'],'#FFF8EC'),(S['shadow_day'],'#5A3A1E'),(S['fill_night'],'#E8EEFF'),(S['glow_night'],'#9CB4F0')]
    ty+=20
    for i,(c,t) in enumerate(sw):
        d.rectangle([tx+i*160,ty,tx+i*160+60,ty+60],fill=c,outline=(150,130,110)); label(d,(tx+i*160,ty+66),t,20)
    C.save(os.path.join(OUT,'annot_390.png'))
def sizes7():
    cells=[]
    for sz,L in LAY.items():
        w,h=map(int,sz.split('x')); k=2; im=Image.new('RGBA',(w*k,h*k))
        d=ImageDraw.Draw(im)
        for yy in range(h*k): t=yy/(h*k); d.line([0,yy,w*k,yy],fill=(int(178+50*t),int(214+20*t),int(240-30*t),255))
        d.rectangle([0,L['tray']['y']*k+L['tray']['height']*k/2,w*k,h*k],fill=(140,190,110,255))
        sf=L['safe']; d.line([0,sf['top']*k,w*k,sf['top']*k],fill=(150,150,150,255),width=1)
        p=L['pause']; d.ellipse([(p['x']-20)*k,(p['y']-20)*k,(p['x']+20)*k,(p['y']+20)*k],fill=(222,206,170,255),outline=(170,150,110,255),width=3)
        pl=L['plate']; d.rounded_rectangle([(pl['x']-pl['width']/2)*k,(pl['y']-pl['height']/2)*k,(pl['x']+pl['width']/2)*k,(pl['y']+pl['height']/2)*k],12*k,fill=(236,230,212,255),outline=(190,170,130,255),width=4)
        tr=L['tray']; d.rounded_rectangle([(tr['x']-tr['width']/2)*k,(tr['y']-tr['height']/2)*k,(tr['x']+tr['width']/2)*k,(tr['y']+tr['height']/2)*k],10*k,fill=(214,198,160,255),outline=(176,156,116,255),width=4)
        d.line([32*k,0,32*k,h*k],fill=(214,80,50,140),width=1); d.line([(w-32)*k,0,(w-32)*k,h*k],fill=(214,80,50,140),width=1)
        lay,ink=title_layer(w*k,h*k,k,w/2,L['toast']['y'],'风铃湖畔',False)
        im=Image.alpha_composite(im,lay); lay2,_=title_layer(w*k,h*k,k,w/2,L['toast']['y'],'风铃湖畔',True)
        im2=Image.alpha_composite(im.copy(), Image.new('RGBA',im.size,(20,28,60,150))); im2=Image.alpha_composite(Image.alpha_composite(im.copy(),Image.new('RGBA',im.size,(20,28,60,150))),lay2) if False else im2
        # night half: darkened schematic with night title
        base_n=Image.alpha_composite(im.copy(),Image.new('RGBA',im.size,(18,26,58,170)))
        im=im.convert('RGB'); x,y,iw,ih=ink
        gap_top=y-L['plateBottom']; gap_bot=L['trayTop']-(y+ih)
        cells.append((im,f'{sz}\n中心 y={L["toast"]["y"]:.0f}pt ({L["toast"]["y"]/h*100:.0f}%)\n距信息牌 {gap_top:.1f} / 距托盘 {gap_bot:.1f}pt\n左右余量 {x:.0f}pt'))
    H=900; ps=[(panel(c,H),t) for c,t in cells]; W=sum(p.width for p,_ in ps)+30*(len(ps)+1)
    C=Image.new('RGB',(W,H+260),(246,240,228)); d=ImageDraw.Draw(C)
    label(d,(30,20),'7 种尺寸 · 地名位置（示意：按 ui/BoardLayout.ts boardLayout() 实算的 HUD/托盘几何，非截图）',30,b=True)
    x=30
    for p,t in ps:
        C.paste(p,(x,80)); 
        for i,s in enumerate(t.split('\n')): label(d,(x,H+95+i*30),s,20 if i else 24,(70,50,30),i==0)
        x+=p.width+30
    C.save(os.path.join(OUT,'sizes_7.png'))
def keyframes_and_mp4():
    ts=[0,.13,.27,.4,1.0,1.6,1.73,1.87,2.0]
    rows=[]
    for night,(p,sz,_) in ((0,BG[('meadow',0)]),(1,BG[('meadow',1)])):
        bg=Image.open(p); w,h=map(int,sz.split('x')); row=[]
        for t in ts:
            im,_=on(bg,'花粉草甸',bool(night),sz,t); row.append(im.crop((0,40*2,w*2,260*2)).convert('RGB'))
        rows.append(row)
    cw=rows[0][0].width//2; ch=rows[0][0].height//2
    C=Image.new('RGB',(30+len(ts)*(cw+16),100+2*(ch+60)),(246,240,228)); d=ImageDraw.Draw(C)
    label(d,(30,20),'动画关键帧 · 总 2.0s：0–0.4 淡入+上浮 6pt（ease-out cubic） · 0.4–1.6 停留 · 1.6–2.0 淡出（ease-in quad）；上排白天，下排夜间（L5 截图顶部裁切）',24,b=True)
    for r,row in enumerate(rows):
        for i,(t,im) in enumerate(zip(ts,row)):
            a,dy=state(t); x=30+i*(cw+16); y=80+r*(ch+60)
            C.paste(im.resize((cw,ch),Image.LANCZOS),(x,y)); label(d,(x,y+ch+6),f't={t:.2f}s α={a*(.9 if r else 1):.2f} dy={dy:.1f}',17)
    C.save(os.path.join(OUT,'keyframes.png'))
    tmp='/tmp/rt_frames'; shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp)
    bgs=[Image.open(BG[('meadow',0)][0]),Image.open(BG[('meadow',1)][0])]; fps=30; n=int(2.6*fps)
    for i in range(n):
        t=i/fps-.3; frame=Image.new('RGB',(780,844),(0,0,0))
        for j,bg in enumerate(bgs):
            im,_=on(bg,'花粉草甸',bool(j),'390x844',t); frame.paste(im.convert('RGB').resize((390,844),Image.LANCZOS),(j*390,0))
        frame.save(f'{tmp}/f{i:03d}.png')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(fps),'-i',f'{tmp}/f%03d.png','-pix_fmt','yuv420p','-vcodec','libx264','-crf','20',os.path.join(OUT,'region_title_anim.mp4')],check=True)
    shutil.rmtree(tmp)
if __name__=='__main__':
    compare(); annot(); sizes7(); keyframes_and_mp4()
    m=S; json.dump(S,open(os.path.join(OUT,'spec_params.json'),'w'),ensure_ascii=False,indent=1)
