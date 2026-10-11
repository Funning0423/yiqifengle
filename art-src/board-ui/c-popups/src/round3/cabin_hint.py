# 小屋提示（不带字）：第一次回岛时小屋窗户 / 门口暖光呼吸 3 次，旁边一个月亮图标气泡；点过一次永不再出现。
# python3 cabin_hint.py <c-popups>  → r3/cabin_hint.png、r3/cabin_hint_keys.png、r3/slices/{cabin_bubble,cabin_glow}.png
import sys, os, math, json, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..'))
from ui_kit import *
OUT=os.path.join(CP,'r3'); SL=os.path.join(OUT,'slices'); os.makedirs(SL,exist_ok=True)
ISL='/workspace/yiqifengle/previews/pm-audit/C0_island_T9_props_reference.png'
# 750×1624 设计坐标（岛画面按 750 宽铺满后的像素；pt = px / 2 × (390/375) 见 INTEGRATION.md）
WIN=[('dormer',(438,652,456,676)),('front',(472,737,502,772))]
DOOR=(435,744,462,808)   # 门口：只给一团柔光（门是木色，不提亮像素本身）
BUBBLE_C=(548,588); TAIL_TO=(486,640)
# ---- 呼吸曲线（秒 → 亮度 0..1）----
T_IN=0.4; BR=[(0.7,0.9)]*3; REST=0.25
def ease(x): return 0.5-0.5*math.cos(math.pi*max(0,min(1,x)))
def intensity(t):
    if t<T_IN: return REST*ease(t/T_IN)
    t-=T_IN; lo=REST
    for up,dn in BR:
        if t<up: return lo+(1-lo)*ease(t/up)
        t-=up
        if t<dn: return 1-(1-REST)*ease(t/dn)
        t-=dn
    return REST
TOTAL=T_IN+sum(a+b for a,b in BR)
_GLASS={}
def glass_mask(base):
    # 只提亮窗玻璃本身（浅奶黄像素），被棕榈叶挡住的部分不亮 → 不会出现「贴在叶子上」的方块
    k=id(base)
    if k in _GLASS: return _GLASS[k]
    import numpy as np
    a=np.asarray(base.convert('RGB')).astype(float); r,g,b=a[...,0],a[...,1],a[...,2]
    lum=0.3*r+0.59*g+0.11*b; m=((lum>150)&(r>=g-6)&(b<g+4)).astype(float)
    box=np.zeros_like(m)
    for n,(x0,y0,x1,y1) in WIN: box[y0:y1,x0:x1]=1
    M=Image.fromarray((m*box*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8)); _GLASS[k]=M; return M
def glow_layer(I,base):
    size=base.size; gm=glass_mask(base)
    core=Image.new('RGBA',size,(255,214,120,0)); core.putalpha(gm.point(lambda v:int(v*1.0*I)))
    bloom=Image.new('RGBA',size,(0,0,0,0)); bd=ImageDraw.Draw(bloom)
    for (x0,y0,x1,y1),k in [(b_,1.0) for n,b_ in WIN]+[(DOOR,0.7)]:
        cx,cy=(x0+x1)/2,(y0+y1)/2; r=max(x1-x0,y1-y0)*1.6
        bd.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(255,190,96,round(255*0.85*I*k)))
    bloom=bloom.filter(ImageFilter.GaussianBlur(18))
    return bloom,core
def apply(base,I):
    from PIL import ImageChops
    bloom,core=glow_layer(I,base)
    out=base.convert('RGB')
    for lay in (bloom,core):
        rgb=Image.composite(lay.convert('RGB'),Image.new('RGB',base.size,(0,0,0)),lay.getchannel('A'))
        out=ImageChops.screen(out,rgb)
    return out.convert('RGBA')
def bubble(s=1.0):
    big=_bubble(s*4); return big.resize((round(big.width/4),round(big.height/4)),Image.LANCZOS)
def _bubble(s=1.0):
    # 奶油圆泡 + 小尾巴 + 3D 月亮图标（(c) 的 icon_moon，0 新字）
    R=round(44*s); w=2*R+16; tail=round(22*s)
    im=Image.new('RGBA',(w,w+tail),(0,0,0,0)); d=ImageDraw.Draw(im); c=w/2
    d.polygon([(c-12*s,c+R-6*s),(c+4*s,c+R-4*s),(c-20*s,c+R+tail)],fill=(201,177,133,255))
    d.ellipse((c-R,c-R,c+R,c+R),fill=(201,177,133,255))
    d.polygon([(c-9*s,c+R-8*s),(c+1*s,c+R-6*s),(c-16*s,c+R+tail-6*s)],fill=(250,245,232,255))
    d.ellipse((c-R+4*s,c-R+4*s,c+R-4*s,c+R-4*s),fill=(250,245,232,255))
    hl=Image.new('RGBA',im.size,(0,0,0,0)); ImageDraw.Draw(hl).arc((c-R+8*s,c-R+8*s,c+R-8*s,c+R-8*s),200,290,fill=(255,255,255,170),width=round(3*s)); im.alpha_composite(hl)
    mo=fith(A('icon_moon'),round(50*s)); paste_c(im,mo,c,c)
    p_=round(12*s); sh=shadow_of(pad(im,p_),round(5*s),0.28); o=Image.new('RGBA',sh.size,(0,0,0,0)); o.alpha_composite(sh,(round(2*s),round(5*s))); o.alpha_composite(pad(im,p_)); return o
if __name__=='__main__':
    base=Image.open(ISL).convert('RGBA').resize((W,H),Image.LANCZOS)
    # 效果图：峰值那一帧 + 气泡
    fx=apply(base,1.0); b=bubble(); paste_c(fx,b,BUBBLE_C[0],BUBBLE_C[1]+8); sysui(fx)
    fx.convert('RGB').save(os.path.join(OUT,'cabin_hint.png'),optimize=True)
    subprocess.run(['pngquant','--force','--quality','80-95','--speed','1','--strip','--output',os.path.join(OUT,'cabin_hint.png'),os.path.join(OUT,'cabin_hint.png')])
    # 关键帧示意
    BG=(246,240,226); INK=(70,52,34); KW=1500
    sheet=Image.new('RGB',(KW,1120),BG); d=ImageDraw.Draw(sheet)
    d.text((40,28),'小屋提示 · 呼吸亮度关键帧（第一次回岛触发；点过小屋一次后永不再出现）',font=font(30),fill=INK)
    gx0,gy0,gw,gh=110,120,1320,360; tmax=6.0
    d.rectangle((gx0,gy0,gx0+gw,gy0+gh),outline=(200,184,150),width=2)
    for k in range(0,7):
        x=gx0+gw*k/tmax; d.line((x,gy0,x,gy0+gh),fill=(228,218,196)); d.text((x,gy0+gh+22),'%d s'%k,font=font(22,False),fill=INK,anchor='mm')
    for v in (0,0.25,0.5,0.75,1.0):
        y=gy0+gh-gh*v; d.line((gx0,y,gx0+gw,y),fill=(228,218,196)); d.text((gx0-14,y),'%.2f'%v,font=font(20,False),fill=INK,anchor='rm')
    pts=[(gx0+gw*t/tmax,gy0+gh-gh*intensity(t)) for t in [i/200*tmax for i in range(201)]]
    d.line(pts,fill=(214,140,50),width=5)
    # 气泡透明度
    def bub(t): return ease(t/0.4) if t<0.4 else 1.0
    d.line([(gx0+gw*t/tmax,gy0+gh-gh*bub(t)) for t in [i/200*tmax for i in range(201)]],fill=(58,120,118),width=3)
    marks=[(0,''),(T_IN,'0.4 进入常亮 0.25'),(T_IN+0.7,'1.1 峰'),(T_IN+1.6,'2.0'),(T_IN+2.3,'2.7 峰'),(T_IN+3.2,'3.6'),(T_IN+3.9,'4.3 峰'),(TOTAL,'%.1f 停在 0.25'%TOTAL)]
    for t,l in marks:
        x=gx0+gw*t/tmax; y=gy0+gh-gh*intensity(t); d.ellipse((x-6,y-6,x+6,y+6),fill=(214,140,50)); d.text((x,y-22 if intensity(t)>0.5 else y+24),l,font=font(18,False),fill=INK,anchor='mm')
    d.text((gx0,gy0+gh+56),'橙线 = 窗户 / 门口暖光亮度（screen 叠加，峰值 1.0、常亮 0.25）；青线 = 气泡透明度（0.4 s 淡入后常驻，±4 px 上下浮动，周期 2.4 s）',font=font(21,False),fill=INK)
    d.text((gx0,gy0+gh+88),'曲线：每次呼吸 = 上升 0.7 s + 回落 0.9 s，都用 easeInOutSine；共 3 次，到 %.1f s 结束，之后停在 0.25 常亮，直到玩家点小屋。'%TOTAL,font=font(21,False),fill=INK)
    d.text((gx0,gy0+gh+120),'点击后：暖光 0.3 s 淡到 0；气泡 0.25 s 先放大到 1.15 再缩到 0；写存档标记，以后永不再出现。',font=font(21,False),fill=INK)
    # 五个时刻的近景
    crop=(380,560,600,830); fw,fh=264,324
    for k,(t,l) in enumerate(((0.0,'0 s'),(T_IN,'0.4 s'),(T_IN+0.7,'1.1 s 峰'),(T_IN+1.15,'1.55 s 回落'),(TOTAL,'%.1f s 常亮'%TOTAL))):
        f=apply(base.crop(crop),intensity(t)) if False else None
        full=apply(base,intensity(t))
        if t>=0.2:
            bb=bubble(); bb.putalpha(bb.getchannel('A').point(lambda v:int(v*bub(t)))); paste_c(full,bb,BUBBLE_C[0],BUBBLE_C[1]+8)
        f=full.crop(crop).resize((fw,fh),Image.LANCZOS)
        x=40+k*(fw+28); sheet.paste(f.convert('RGB'),(x,640)); d.text((x+fw/2,640+fh+28),l+' · 亮度 %.2f'%intensity(t),font=font(22),fill=INK,anchor='mm')
    sheet.save(os.path.join(OUT,'cabin_hint_keys.png'),optimize=True)
    subprocess.run(['pngquant','--force','--quality','80-95','--speed','1','--strip','--output',os.path.join(OUT,'cabin_hint_keys.png'),os.path.join(OUT,'cabin_hint_keys.png')])
    # 切图
    rows=[]
    def save(im,name,note):
        p=os.path.join(SL,name+'.png'); im.save(p); subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p])
        rows.append(dict(file=name+'.png',w=im.width,h=im.height,bytes=os.path.getsize(p),note=note))
    save(bubble(),'cabin_bubble','月亮图标气泡（含柔影），显示 1:1 @750 设计宽；尾巴朝左下指向小屋')
    g=Image.new('RGBA',(96,96),(0,0,0,0)); ImageDraw.Draw(g).ellipse((16,16,80,80),fill=(255,214,130,255)); g=g.filter(ImageFilter.GaussianBlur(12))
    save(g,'cabin_glow','窗户 / 门口暖光：叠加用柔光斑（Sprite 用 additive / screen 混合），每个窗口一个，按窗口大小缩放')
    json.dump(dict(rows=rows,windows={n:b for n,b in WIN},bubble_center=BUBBLE_C,curve=dict(fade_in=T_IN,breaths=[dict(up=a,down=b) for a,b in BR],rest=REST,total=TOTAL,ease='easeInOutSine')),open(os.path.join(SL,'cabin_hint.json'),'w'),ensure_ascii=False,indent=1)
    print(rows,TOTAL)
