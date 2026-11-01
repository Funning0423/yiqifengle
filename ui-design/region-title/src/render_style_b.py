#!/usr/bin/env python3
"""UI设计部 · 备选 B（加深投影 + 极淡暖棕径向暗渐变）对比图、7 尺寸拼图、对比度表。
   对比度：WCAG 相对亮度。文字色 = 字形核心像素（掩膜>80%）合成后均值；背景 = 每个字的外圈（字形膨胀 1–3pt 的环，
   已含投影/渐变的最终画面）亮度第 90 百分位（= 该字周边最亮处）。取各字最小值为“最差”。"""
import os, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import render_region_title as R
OUT=R.OUT; NAME='花粉草甸'
BGD={0:R.BG[('meadow',0)][0],1:R.BG[('meadow',1)][0]}
def lum(a):
    a=a/255.; a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4); return .2126*a[...,0]+.7152*a[...,1]+.0722*a[...,2]
def cr(l1,l2): hi,lo=max(l1,l2),min(l1,l2); return (hi+.05)/(lo+.05)
def bg_for(size,night):
    """390 meadow L5 screenshot, cover-scaled to the size and shifted so its title band (y=184pt, windmill blades) sits on this size's title centre."""
    w,h=map(int,size.split('x')); src=Image.open(BGD[night]).convert('RGB'); k=max(w*2/src.width,h*2/src.height)
    k=max(k,1.0) if False else k; im=src.resize((round(src.width*k),round(src.height*k)),Image.LANCZOS)
    ty=R.LAY[size]['toast']['y']*2; sy=184*2*k; x0=(im.width-w*2)//2; y0=int(round(sy-ty)); y0=max(0,min(im.height-h*2,y0))
    return im.crop((x0,y0,x0+w*2,y0+h*2))
def measure(bg,size,night,style):
    w,h=map(int,size.split('x')); L=R.LAY[size]
    lay,ink,G=R.title_layer(w*2,h*2,2,w/2,L['toast']['y'],NAME,bool(night),style=style,want_mask=True)
    comp=Image.alpha_composite(bg.convert('RGBA'),lay).convert('RGB'); A=np.asarray(comp).astype(float); Lm=lum(A)
    Lraw=lum(np.asarray(bg.convert('RGB')).astype(float))
    g=np.asarray(G).astype(float)/255; core=g>.8
    d2=np.asarray(G.filter(ImageFilter.MaxFilter(5)))>8; d8=np.asarray(G.filter(ImageFilter.MaxFilter(13)))>8; ring=d8&~d2
    x,y,iw,ih=ink; n=len(NAME); res=[]
    for i in range(n):
        xa=int((x+iw*i/n)*2)-4; xb=int((x+iw*(i+1)/n)*2)+4; sl=np.zeros_like(core); sl[:,max(0,xa):xb]=True
        c=core&sl; r=ring&sl
        if c.sum()<10 or r.sum()<10: continue
        lt=lum(A[c].mean(0)[None])[0]; lb=np.percentile(Lm[r],90); lbraw=np.percentile(Lraw[r],90)
        res.append((cr(lt,lb),cr(lt,lbraw),lb,lt))
    worst=min(res,key=lambda t:t[0]); mean=float(np.mean([t[0] for t in res]))
    return comp,dict(worst=round(worst[0],2),mean=round(mean,2),raw_worst=round(min(t[1] for t in res),2))
SIZES=list(R.LAY.keys())
def main():
    table=[]; sheets={}
    for night in (0,1):
        for style in ('A','B'):
            row=[]
            for sz in SIZES:
                bg=bg_for(sz,night); comp,m=measure(bg,sz,night,style); row.append((sz,comp))
                table.append(dict(size=sz,mode='夜间' if night else '白天',style=style,**m))
            sheets[(night,style)]=row
    json.dump(table,open(os.path.join(OUT,'contrast_AB.json'),'w'),ensure_ascii=False,indent=1)
    # contrast table image + md
    md=['| 尺寸 | 模式 | A 最差 | A 均值 | B 最差 | B 均值 |','|---|---|---|---|---|---|']
    for sz in SIZES:
        for mo in ('白天','夜间'):
            a=[t for t in table if t['size']==sz and t['mode']==mo and t['style']=='A'][0]; b=[t for t in table if t['size']==sz and t['mode']==mo and t['style']=='B'][0]
            md.append(f"| {sz} | {mo} | {a['worst']} | {a['mean']} | {b['worst']} | {b['mean']} |")
    open(os.path.join(OUT,'contrast_AB.md'),'w').write('\n'.join(md)+'\n')
    C=Image.new('RGB',(1300,140+len(md)*44),(246,240,228)); d=ImageDraw.Draw(C)
    R.label(d,(30,20),'对比度（WCAG）· 花粉草甸 · 字形核心 vs 每字外圈 1–3pt 最亮 10%（含投影/渐变后的最终画面）',26,b=True)
    R.label(d,(30,62),'底图：L5 真机截图（风车叶 + 白云）对齐到各尺寸地名位置（示意）；标准 ≥ 3:1',20,(120,100,80))
    for i,line in enumerate(md):
        if i==1: continue
        cells=[c.strip() for c in line.strip('|').split('|')]; y=110+(i if i==0 else i-1)*44
        for j,c in enumerate(cells):
            col=(60,40,25)
            try:
                v=float(c); col=(190,50,30) if v<3 else (40,120,60)
            except: pass
            R.label(d,(30+j*205,y),c,22,col,i==0)
    C.save(os.path.join(OUT,'contrast_AB.png'))
    # AB compare at 390 day + zoom
    sz='390x844'; bg=bg_for(sz,0)
    a,ma=measure(bg,sz,0,'A'); b,mb=measure(bg,sz,0,'B')
    cy=int(R.LAY[sz]['toast']['y']*2); box=(780//2-210,cy-90,780//2+210,cy+90)
    za=a.crop(box).resize((1260,540),Image.LANCZOS); zb=b.crop(box).resize((1260,540),Image.LANCZOS)
    W=60+780*2+60; C=Image.new('RGB',(max(W,1320),140+1688+60+2*600+40),(246,240,228)); d=ImageDraw.Draw(C)
    R.label(d,(30,20),'白天 · 花粉草甸 · 方案 A（现行） vs 备选 B（加深投影 + 极淡暖棕径向暗渐变，无底板）',30,b=True)
    R.label(d,(30,64),f'底图 build16 L5 390×844 真机截图，地名合成（示意）。对比度（最差字）：A {ma["worst"]}:1 → B {mb["worst"]}:1；无效果原底 {ma["raw_worst"]}:1',22,(120,100,80))
    C.paste(a,(30,120)); C.paste(b,(30+780+60,120))
    R.label(d,(30,120+1688+8),'A',30,(60,40,25),True); R.label(d,(30+840,120+1688+8),'B',30,(60,40,25),True)
    y=120+1688+60
    for lab,z in (('A 放大 3×',za),('B 放大 3×',zb)):
        C.paste(z,(30,y)); R.label(d,(1300,y+10),lab,26,(60,40,25),True) if False else R.label(d,(40,y+8),lab,26,(255,255,255),True); y+=600
    C.save(os.path.join(OUT,'compare_AB_meadow_day.png'))
    # B 7 sizes day + night
    rows=[sheets[(0,'B')],sheets[(1,'B')]]; H=760
    ps=[[(sz,R.panel(c,H)) for sz,c in r] for r in rows]; W=sum(p.width for _,p in ps[0])+30*8
    C=Image.new('RGB',(W,90+2*(H+70)),(246,240,228)); d=ImageDraw.Draw(C)
    R.label(d,(30,20),'备选 B · 7 尺寸（上：白天，下：夜间（B 夜间：去掉淡蓝外发光，改深蓝径向暗渐变 + 深蓝贴边描影））· 底图为 L5 截图对齐到各尺寸地名位置（示意）',24,b=True)
    for r,row in enumerate(ps):
        x=30
        for sz,p in row:
            y=70+r*(H+70); C.paste(p,(x,y)); m=[t for t in table if t['size']==sz and t['style']=='B' and t['mode']==('夜间' if r else '白天')][0]
            R.label(d,(x,y+H+8),f'{sz}  最差 {m["worst"]}:1',20,(60,40,25)); x+=p.width+30
    C.save(os.path.join(OUT,'sizes_7_B.png'))
    print('\n'.join(md))
if __name__=='__main__': main()
