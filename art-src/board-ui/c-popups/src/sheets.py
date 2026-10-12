# kit_sheet.png (built ONLY from slices/ to prove the 9-slice/3-slice cuts work), chest_sheet.png, compare/*.jpg
import sys, os, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from ui_kit import *
from ui_kit import _three
OUT=sys.argv[1] if len(sys.argv)>1 else '..'; SL=os.path.join(OUT,'slices'); CMP=os.path.join(OUT,'compare'); os.makedirs(CMP,exist_ok=True)
def SLc(n): return Image.open(os.path.join(SL,n+'.png')).convert('RGBA')
PM='/workspace/yiqifengle/previews/pm-audit'; T9R='/workspace/yiqifengle/work/grokbot/ui-props/renders'
BG=(246,240,226); INK=(70,52,34)
def head(d,x,y,t,s=30): d.text((x,y),t,font=font(s),fill=INK)
# ---------------- kit sheet ----------------
def kit():
    im=Image.new('RGBA',(1500,1460),BG+(255,)); d=ImageDraw.Draw(im)
    head(d,30,20,'(c) 统一弹窗框与通用控件 —— 全部由 slices/ 里的切图拼出（验证九宫格 / 三宫格）',32)
    fr=SLc('panel_frame_9s'); ins=(92,92,92,92)
    for i,(w,h) in enumerate(((300,260),(420,380),(560,520))):
        x=30+sum((300,420)[:i])+40*i; p=nine(fr,ins,w,h,1.0); im.alpha_composite(p,(x,80))
        d.text((x+w/2,80+h+22),f'{w}×{h}px',font=font(22,False),fill=INK,anchor='mm')
    tp=SLc('title_plank_3s')
    for i,w in enumerate((192,320,460)):
        im.alpha_composite(_three(tp,84,w,tp.height),(30+i*500,690))
    head(d,30,650,'标题木牌（三宫格，左右 84px 固定）',24)
    head(d,30,860,'按钮：常态 / 按下（下沉 3px、暗 6%）/ 不可用（灰化 55%）',24)
    for r,k in enumerate(('primary','secondary')):
        b=_three(SLc('btn_%s_3s'%k),62,360,104); dd=ImageDraw.Draw(b); dd.text((180,49),'主按钮' if k=='primary' else '次按钮',font=font(34),fill=WHITE if k=='primary' else BROWN,anchor='mm')
        y=900+r*130
        im.alpha_composite(b,(30,y))
        pr=ImageEnhance.Brightness(b).enhance(0.94); im.alpha_composite(pr,(420,y+3))
        g=ImageOps.grayscale(b.convert('RGB')).convert('RGBA'); g.putalpha(b.getchannel('A').point(lambda v:int(v*0.55))); im.alpha_composite(g,(810,y))
    im.alpha_composite(SLc('btn_close'),(1220,905)); d.text((1268,1020),'关闭',font=font(22,False),fill=INK,anchor='mm')
    head(d,30,1170,'开关 / 星级 / 图标 / 奖励',24)
    x=30
    for on in (True,False):
        t=SLc('toggle_on' if on else 'toggle_off'); k=SLc('toggle_knob'); c=pad(t,6); kx=6+(t.width-30 if on else 30); paste_c(c,k,kx,6+t.height*0.48)
        im.alpha_composite(c,(x,1220)); x+=c.width+20
    for n in ('star_full','star_empty'): s=fith(SLc(n),110); im.alpha_composite(s,(x,1210)); x+=s.width+10
    for n in ('icon_music','icon_sfx','icon_sun','icon_moon','icon_motion','icon_home','icon_about'):
        s=fith(SLc(n),70); im.alpha_composite(s,(x,1230)); x+=s.width+14
    for n in ('reward_seal_tide','reward_seal_meadow','reward_seal_sky','stamp_claimed'): s=fith(SLc(n),86); im.alpha_composite(s,(x,1210)); x+=s.width+14
    x=30
    for n in ('tile_restart','tile_bag','tile_settings'): s=SLc(n); im.alpha_composite(s,(x,1330-s.height//2+40)); x+=170
    for i in range(6):
        s=SLc('title_%d'%i); im.alpha_composite(s,(x,1330+(i%2)*60)); x+=s.width+10 if i%2 else 0
    im.convert('RGB').save(os.path.join(OUT,'kit_sheet.png'),optimize=True)
# ---------------- chest sheet ----------------
def chest():
    im=Image.new('RGBA',(1500,780),BG+(255,)); d=ImageDraw.Draw(im)
    head(d,30,20,'宝箱：新版 Blender 4.5 低多边形（同一张调色板，(b) v2 焦点灯光）vs 现有 ResultChestGeometry.ts 程序网格',30)
    R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw')
    items=[('chest_current_closed','现状·闭合（同光重渲，示意）'),('chest_current_open','现状·打开'),('chest_body','新版·闭合'),('chest_open','新版·打开 −118°（俯 40°）')]
    for i,(n,lab) in enumerate(items):
        s=crop(Image.open(os.path.join(R,n+'.png')).convert('RGBA')); s=fitw(s,330) if s.width/s.height>330/420 else fith(s,420)
        x=30+i*370; paste_c(im,s,x+170,330); d.text((x+170,600),lab,font=font(24),fill=INK,anchor='mm')
    sz=json.load(open(os.path.join(SL,'sizes.json'))); glb=[r for r in sz if r['file']=='result_chest.glb'][0]['bytes']
    meta=json.load(open(os.path.join(R,'meta.json')))
    d.text((30,660),f"现状：ResultChestGeometry.ts 430,541 B（几何写在脚本里）+ OriginalResultChestPainter.ts 6,058 B + chest-lit.effect 2,469 B",font=font(22,False),fill=INK)
    d.text((30,700),f"新版：result_chest.glb {glb:,} B（Draco，{meta['chest_open']['tris']:,} 三角面，空心箱体 + 内壁 + 箱底 + 金币堆；子节点 chest_lid 原点在铰链，内含 0.5 s 开盖动作 chest_open）；不内嵌贴图，材质槽 M_env_palette_piece",font=font(22,False),fill=INK)
    im.convert('RGB').save(os.path.join(OUT,'chest_sheet.png'),optimize=True)
# ---------------- T9 baseline column (shared) ----------------
def t9col(h):
    col=Image.new('RGBA',(640,h),(236,240,232,255)); d=ImageDraw.Draw(col)
    d.text((20,16),'① T9 实机截图（C0 裁切）',font=font(22),fill=INK)
    c0=Image.open(os.path.join(PM,'C0_island_T9_props_reference.png')).convert('RGBA')
    a=fitw(c0.crop((0,560,584,1010)),600); col.alpha_composite(a,(20,50))
    y=60+a.height+16; d.text((20,y),'② ui-props 原始渲染（同一灯光脚本）',font=font(22),fill=INK); y+=36
    x=20
    for n,hh in (('ui_signpost_with_text',150),('ui_satchel',120),('ui_notebook',120),('ui_compass',120)):
        s=fith(crop(Image.open(os.path.join(T9R,n+'.png')).convert('RGBA')),hh); col.alpha_composite(s,(x,y+150-hh)); x+=s.width+12
    y+=170; d.text((20,y),'③ 同比例摆在一起（沙地，T9 + 新版弹窗件）',font=font(22),fill=INK); y+=36
    g=Image.new('RGBA',(600,250),(235,222,180,255)); x=10
    for s in (fith(crop(Image.open(os.path.join(T9R,'ui_signpost_with_text.png')).convert('RGBA')),130),fith(A('tile_bag'),84),fith(A('btn_close'),60),fith(A('chest_body'),96),fith(A('tile_settings'),84),fith(A('star_full'),60)):
        g.alpha_composite(shadow_of(pad(s,8),6,0.3),(x-8+4,236-s.height-8+6)); g.alpha_composite(s,(x,236-s.height)); x+=s.width+8
    b=_three(Image.open(os.path.join(SL,'btn_primary_3s.png')).convert('RGBA'),62,250,72); ImageDraw.Draw(b).text((125,34),'继续',font=font(26),fill=WHITE,anchor='mm')
    g.alpha_composite(b,(330,20)); col.alpha_composite(g,(20,y)); y+=262
    for i,t in enumerate(('同一张 env_palette_256：浅木 rimL #c9b185 / baseL #baa279（= (b) v2 托盘）','纸 #f3e5c3 / 主按钮青 #3a7876 / 金 #eac777；倒边 bevel 0.012–0.045','木件：T9 灯光（天光 .55 + 太阳 2.35）；宝箱/星/印记：(b) v2 焦点灯光')):
        d.text((20,y+i*26),t,font=font(19,False),fill=INK)
    return col
def compare(name,newimg,cur_list,cur_title,note):
    Hc=1180; out=Image.new('RGBA',(560+30+545+30+640+40,Hc+120),BG+(255,)); d=ImageDraw.Draw(out)
    d.text((20,22),'现状 · '+cur_title,font=font(26),fill=INK); d.text((610,22),'新版 (c) 定稿',font=font(26),fill=INK); d.text((1185,22),'基准：T9 路牌 + 行囊 / 旅程册 / 设置',font=font(26),fill=INK)
    # current: stack list vertically within 560×Hc
    y=70; avail=Hc-(len(cur_list)-1)*14
    for (im,lab) in cur_list:
        im=im.convert('RGBA'); hh=min(avail//len(cur_list), round(im.height*560/im.width)); s=fith(im,hh)
        if s.width>560: s=fitw(s,560)
        out.alpha_composite(s,(20+(560-s.width)//2,y)); 
        if lab: d.text((24,y+s.height-30),lab,font=font(18),fill=(255,255,255),stroke_width=3,stroke_fill=(40,30,20))
        y+=s.height+14
    nw=fith(newimg.convert('RGBA'),Hc); out.alpha_composite(nw,(610,70))
    out.alpha_composite(t9col(Hc),(1185,70))
    d.text((20,Hc+104),note,font=font(21,False),fill=INK,anchor='ls')
    out.convert('RGB').save(os.path.join(CMP,'compare_%s.jpg'%name),quality=88,optimize=True)
def X(n): return Image.open(os.path.join(PM,n))
def anim_keys():
    R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw')
    fr=[(0,'0°'),(3,''),(6,''),(9,'−126° 过冲'),(12,'−114° 回弹'),(15,'−118° 停')]
    im=Image.new('RGBA',(1500,700),BG+(255,)); d=ImageDraw.Draw(im)
    head(d,30,20,'result_chest.glb · 动作 chest_open：0.5 s（30 fps，0–15 帧），只转子节点 chest_lid 的 X 轴，铰链在后上沿',28)
    for i,(f,lab) in enumerate(fr):
        s=crop(Image.open(os.path.join(R,'chest_anim_f%02d.png'%f)).convert('RGBA')); s=scaled(s,min(225/s.width,300/s.height)); x=20+i*245
        s0=s; s=Image.new('RGBA',(s0.width,300),(0,0,0,0)); s.alpha_composite(s0,(0,300-s0.height))
        paste_c(im,s,x+118,250); d.text((x+118,430),'帧 %d · %.2f s'%(f,f/30),font=font(22),fill=INK,anchor='mm')
        if lab: d.text((x+118,462),lab,font=font(20,False),fill=INK,anchor='mm')
    # curve
    import math
    pts=[(0,0),(9,-126),(12,-114),(15,-118)]
    def ang(t):   # same keys, smooth (Bezier auto-clamped approx by cosine segments)
        for (f0,a0),(f1,a1) in zip(pts,pts[1:]):
            if f0<=t<=f1: u=(t-f0)/(f1-f0); u=1-(1-u)**2 if f0==0 else (1-math.cos(math.pi*u))/2; return a0+(a1-a0)*u
        return pts[-1][1]
    X0,Y0,WW,HH=120,500,1300,150; d.rectangle((X0,Y0,X0+WW,Y0+HH),outline=(200,186,160),width=2)
    pl=[(X0+WW*t/15,Y0+HH*(-ang(t))/130) for t in [i/10 for i in range(151)]]; d.line(pl,fill=(58,120,118),width=4)
    for f,a in pts: x=X0+WW*f/15; y=Y0+HH*(-a)/130; d.ellipse((x-7,y-7,x+7,y+7),fill=(234,199,119),outline=INK,width=2); d.text((x,y-18 if f else y+20),'%d°'%a,font=font(18),fill=INK,anchor='mm')
    d.text((30,Y0+HH/2),'角度',font=font(20,False),fill=INK,anchor='lm'); d.text((X0+WW,Y0+HH+24),'0.5 s',font=font(20,False),fill=INK,anchor='rm')
    im.convert('RGB').save(os.path.join(OUT,'chest_anim_keys.png'),optimize=True)
def closeup():
    R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw')
    s=focus_grade(crop(Image.open(os.path.join(R,'chest_open_closeup.png')).convert('RGBA')))
    W_,H_=1100,1100; im=Image.new('RGBA',(W_,H_),(0,0,0,0)); g=Image.new('L',(W_,H_),0)
    import numpy as np
    yy,xx=np.mgrid[0:H_,0:W_]; r=np.hypot((xx-W_/2)/W_,(yy-H_*0.45)/H_); a=np.clip(1-r*1.6,0,1)
    base=np.zeros((H_,W_,3)); c0=np.array([250,240,214]); c1=np.array([214,226,214]); base=c1*(1-a[...,None])+c0*a[...,None]
    bg=Image.fromarray(base.astype('uint8')).convert('RGBA')
    gl=Image.new('RGBA',(W_,H_),(0,0,0,0)); ImageDraw.Draw(gl).ellipse((W_/2-300,H_*0.30,W_/2+300,H_*0.62),fill=(255,226,150,120)); bg.alpha_composite(gl.filter(ImageFilter.GaussianBlur(60)))
    s=fith(s,960) if s.height>960 else s; drop(bg,s,W_/2,H_/2+10,blur=18,alpha=0.30,dy=16)
    p=os.path.join(OUT,'chest_open_closeup.png'); bg.convert('RGB').save(p,optimize=True)
    if os.path.getsize(p)>700_000:
        import subprocess; subprocess.run(['pngquant','--force','--quality','80-95','--speed','1','--output',p,p])
    print('closeup',os.path.getsize(p))
def run():
    kit(); chest(); anim_keys(); closeup()
    O=lambda n: Image.open(os.path.join(OUT,n+'.png'))
    R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw')
    curchest=Image.new('RGBA',(900,420),(230,226,214,255))
    for i,n in enumerate(('chest_current_closed','chest_current_open')):
        s=fith(crop(Image.open(os.path.join(R,n+'.png')).convert('RGBA')),360); curchest.alpha_composite(s,(20+i*450,30))
    compare('pause',O('pause'),[(X('C7_pause_native.jpg'),'C7 实机：暂停只有一行小字，没有面板')],'暂停（实机 C7）','定稿布局不动，只换无钉外框、宽 680。面板：重来（二次确认）/ 行囊 / 设置，音乐 / 音效快捷开关，主按钮「继续」、次按钮「回到小岛」（不再确认）。不留手动提示。')
    compare('pause_restart_confirm',O('pause_restart_confirm'),[(X('C1_restart_modal_native.jpg'),'C1 实机：重来确认')],'重来确认（实机 C1）','精简版：无钉外框、宽 680；重来图标 + 一句「这一局会从头再来」+ 留下 / 重来。')
    compare('settings',O('settings'),[(X('C3_settings_construction_preview_cloud.png'),'C3 云端构图预览（非实机）：海岛小憩')],'设置（C3，非实机）','新版：岛上和关卡共用。音乐音量滑条 / 音效静音开关 / 昼夜 / 减少动态 + 关于·版本「v0.1 · 构建 <git 短 SHA>」（震动这版不放，全局静音不上界面）。精简：去掉分隔线、字体署名行和提示行（海岛小憩改为点小屋弹出）。')
    compare('reward_claim',O('reward_claim'),[(X('C2_result_construction_preview_cloud.png').crop((0,150,780,1100)),'C2 云端预览：结算里的宝箱占位'),(curchest,'现有程序网格宝箱（同光重渲，示意）')],'领取（现状没有领取弹窗）','新版：统一「获得」弹窗：俯 40° 看进开盖宝箱（内壁有厚度、越往里越暗，箱底一堆金币和青石，光从箱口冒出）+ 获得物 + 一句话 +「收下」。宝箱层底边到文字 56px（> 一行 44px）。无珍珠。')
    compare('result_win',O('result_win'),[(X('C2_result_construction_preview_cloud.png'),'C2 云端构图预览（非实机）'),(X('C6_result_web_diag_old.png'),'C6 旧版 web')],'结算·过关（无实机截图）','精简版：3 星（中间大）、分数、步数、「成绩已保存」、宝箱 + 道具（去掉分隔线、「本关奖励」标签和说明小字），主「下一关」/ 次「回小岛」。')
    compare('result_lose',O('result_lose'),[(X('C6_result_web_diag_old.png'),'C6 旧版 web（现状失败页标题为「再走一次」，没有截图）')],'结算·失败（无截图）','精简版：空星、一句话、还差的目标、宝箱灰显（去掉「还差 / 奖励」标签和分隔线），主「再试一次」/ 次「回小岛」。')
if __name__=='__main__': run(); print('ok')
