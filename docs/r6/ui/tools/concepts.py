# 后续场景概念卡（纯 2D 色板示意，不是正式资产）+ 五场景色板总览与 ΔE
import json,math,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
F=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',s,index=2)
def hx(h):h=h.lstrip('#');return tuple(int(h[i:i+2],16) for i in (0,2,4))
def lab(rgb):
    c=np.asarray(rgb,float)/255; c=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
    X=c@np.array([[0.4124,0.2126,0.0193],[0.3576,0.7152,0.1192],[0.1805,0.0722,0.9505]]); X=X/np.array([0.95047,1,1.08883])
    f=np.where(X>0.008856,np.cbrt(X),7.787*X+16/116); return np.array([116*f[1]-16,500*(f[0]-f[1]),200*(f[1]-f[2])])
def lum(c):
    c=np.asarray(hx(c),float)/255; c=np.where(c<=0.03928,c/12.92,((c+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b): la,lb=sorted([lum(a),lum(b)]); return (lb+0.05)/(la+0.05)
P=json.load(open('/workspace/r6/tools/palettes.json'))
def card(key):
    p=P[key]; W,H=1200,900; S=Image.new('RGB',(W,H),hx(p['bg_bot'])); d=ImageDraw.Draw(S)
    for y in range(H):  # 背景渐变
        t=y/H; a,b=hx(p['bg_top']),hx(p['bg_bot']); d.line([(0,y),(560,y)],fill=tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3)))
    d.rectangle([560,0,W,H],fill=(250,246,236))
    # 棋盘
    x0,y0,c=60,230,62; tw=7*c+44
    d.rounded_rectangle([x0-6,y0+8,x0+tw+6,y0+tw+20],28,fill=hx(p['tray_shadow']))
    d.rounded_rectangle([x0,y0,x0+tw,y0+tw],26,fill=hx(p['tray'])); d.rounded_rectangle([x0+6,y0+6,x0+tw-6,y0+tw-10],22,outline=hx(p['tray_hi']),width=3)
    d.rounded_rectangle([x0+18,y0+18,x0+tw-18,y0+tw-18],12,fill=hx(p['tray_floor']))
    for r in range(7):
        for q in range(7):
            X,Y=x0+22+q*c,y0+22+r*c; d.rounded_rectangle([X+3,Y+3,X+c-3,Y+c-3],10,fill=hx(p['tile_a'] if (r+q)%2==0 else p['tile_b']))
    rng=np.random.default_rng(3); pc=['#d83a3a','#3f6fc4','#4f9a3c','#f2f0e8','#b9803e','#7fcfc3']
    for r in range(7):
        for q in range(7):
            X,Y=x0+22+q*c+c//2,y0+22+r*c+c//2
            if [r,q] in p['obs_cells']:   # v2：障碍画成贴格的扁平覆盖层（不是圆形棋子），压低明度 + 浅色边圈
                d.rounded_rectangle([X-c//2+5,Y-c//2+5,X+c//2-5,Y+c//2-5],9,fill=hx(p['obs']),outline=hx(p['obs_edge']),width=3); d.ellipse([X-5,Y-5,X+5,Y+5],fill=hx(p['obs_accent']))
            else: col=hx(pc[rng.integers(6)]); d.ellipse([X-18,Y-18,X+18,Y+18],fill=col); d.ellipse([X-10,Y-14,X-2,Y-6],fill=tuple(min(255,v+70) for v in col))
    # HUD
    d.rounded_rectangle([130,80,430,190],22,fill=hx(p['hud_edge'])); d.rounded_rectangle([138,86,422,180],18,fill=hx(p['hud']))
    d.text((280,100),p['level_title'],font=F(22),fill=hx(p['hud_text']),anchor='mt'); d.text((280,140),'目标 ● 12   ◆ 16    步数 35',font=F(20),fill=hx(p['hud_text']),anchor='mt')
    d.text((20,16),p['name'],font=F(34),fill=hx(p['hud_text']) if lum(p['bg_top'])>0.3 else (250,246,236))
    # 面板
    px,py=600,40; d.rounded_rectangle([px,py,px+560,py+300],26,fill=hx(p['panel_edge'])); d.rounded_rectangle([px+8,py+8,px+552,py+292],20,fill=hx(p['panel']))
    d.text((px+280,py+40),p['panel_title'],font=F(30),fill=hx(p['panel_text']),anchor='mt')
    d.text((px+280,py+100),'★ ★ ☆',font=F(44),fill=hx(p['accent']),anchor='mt')
    d.rounded_rectangle([px+170,py+200,px+390,py+262],30,fill=hx(p['btn'])); d.text((px+280,py+231),'继续',font=F(26),fill=hx(p['btn_text']),anchor='mm')
    # 色值
    y=370; d.text((600,y),'色值（hex）',font=F(22),fill=(63,94,99)); y+=34
    for k in ['tray','tray_floor','tile_a','tile_b','obs','accent','hud','hud_text','panel','panel_text','btn']:
        d.rectangle([600,y,630,y+22],fill=hx(p[k]),outline=(120,110,100)); d.text((640,y),f'{k:<11} {p[k]}',font=F(17),fill=(70,60,50)); y+=27
    d.text((900,404),'对比度',font=F(20),fill=(63,94,99))
    d.text((900,434),f"HUD 字 {cr(p['hud'],p['hud_text']):.1f}:1\n面板字 {cr(p['panel'],p['panel_text']):.1f}:1\n按钮字 {cr(p['btn'],p['btn_text']):.1f}:1",font=F(17),fill=(70,60,50))
    yy=720; d.text((600,yy),'专属机制：'+p['mech_name'],font=F(22),fill=(99,63,33)); 
    for i,l in enumerate(p['mech_rules']): d.text((600,yy+34+i*26),'· '+l,font=F(16),fill=(70,60,50))
    S.save(f'/workspace/r6/out/concepts/concept_{key}.png')
for k in P:
    if not P[k].get('existing'): card(k)
# 总览
keys=list(P); W=1400; S=Image.new('RGB',(W,140+len(keys)*120+40*len(keys)+120),(250,246,236)); d=ImageDraw.Draw(S)
d.text((20,20),'五场景棋盘色板总览（托盘 / 托盘底 / 格子A / 格子B / 障碍 / 强调 / 背景上 / 背景下）',font=F(26),fill=(63,94,99))
cols=['tray','tray_floor','tile_a','tile_b','obs','accent','bg_top','bg_bot']
for i,k in enumerate(keys):
    y=80+i*120; d.text((20,y+40),P[k]['name'],font=F(22),fill=(99,63,33))
    for j,c in enumerate(cols): d.rectangle([300+j*130,y,300+j*130+120,y+90],fill=hx(P[k][c])); d.text((300+j*130,y+94),P[k][c],font=F(14),fill=(90,80,70))
y=80+len(keys)*120+10; d.text((20,y),'托盘 ΔE / 格子(A,B 平均) ΔE（CIELAB 76；≥10 视为一眼可分）',font=F(20),fill=(63,94,99)); y+=34
res=[]
for a in range(len(keys)):
    for b in range(a+1,len(keys)):
        A,B=P[keys[a]],P[keys[b]]; t=np.linalg.norm(lab(hx(A['tray']))-lab(hx(B['tray'])))
        g=np.linalg.norm((lab(hx(A['tile_a']))+lab(hx(A['tile_b'])))/2-(lab(hx(B['tile_a']))+lab(hx(B['tile_b'])))/2)
        res.append((A['name'],B['name'],round(float(t),1),round(float(g),1)))
for i,(a,b,t,g) in enumerate(res): d.text((20+(i%2)*690,y+(i//2)*28),f'{a} ↔ {b}：托盘 {t} / 格子 {g}',font=F(17),fill=(70,60,50))
S=S.crop((0,0,W,y+(len(res)//2+1)*28+20)); S.save('/workspace/r6/out/concepts/palette_overview_5_scenes.png')
json.dump(res,open('/workspace/r6/out/concepts/palette_overview_dE.json','w'),ensure_ascii=False,indent=1)
for r in res: print(r)
