# first-screen composite + formal a-loading frames on 运镜bot's base.
# Coordinates are 750x1624 design px; runtime maps them with the same cover transform as the base:
#   s=max(W/750,H/1624); dx=(W-750s)/2; dy=(H-1624s)/2; screen=(x*s+dx, y*s+dy)
import os, io, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops
class gen:  # ribbon constants copied from gen.py (gen.py needs the 25 MB font file to import)
    BL=480; BH=44; AMP=5.0; LAM=135.0
    @staticmethod
    def ribbon_y(x): return gen.BH/2 + gen.AMP*math.sin(2*math.pi*x/gen.LAM)
A='/workspace/yiqifengle/previews/棋盘UI美术bot/a-loading'; O=A+'/first-screen'; S=A+'/slices'
BASE_FS='/workspace/yiqifengle/previews/运镜bot/loading-base/loading_base_final_fs50k.jpg'
BASE='/workspace/yiqifengle/previews/运镜bot/loading-base/loading_base_final.jpg'
W,H=750,1624
LOGO_S=0.78; TITLE_S=0.92
logo=Image.open(S+'/logo.png').convert('RGBA'); logo=logo.resize((round(logo.width*LOGO_S),round(logo.height*LOGO_S)),Image.LANCZOS)
title=Image.open(S+'/title.png').convert('RGBA'); title=title.resize((round(title.width*TITLE_S),round(title.height*TITLE_S)),Image.LANCZOS)
track=Image.open(S+'/bar_track.png').convert('RGBA'); fill=Image.open(S+'/bar_fill.png').convert('RGBA'); pin=Image.open(S+'/pinwheel.png').convert('RGBA')
LOGO_C=(375+round(18*LOGO_S),340); TITLE_C=(375,452); BAR_CY=round(0.796*H)   # 1293
BX=(W-track.width)//2; BY=BAR_CY-track.height//2; PAD=8
def box(im,c): return (round(c[0]-im.width/2),round(c[1]-im.height/2))
LB=box(logo,LOGO_C); TB=box(title,TITLE_C)
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',28,index=2)
TIPS={0:'风从海上来……',50:'她在窗前坐下……',100:'灯塔小屋准备好了'}; TIP_Y=BY+70
def overlay(im):
    im.alpha_composite(logo,LB); im.alpha_composite(title,TB); im.alpha_composite(track,(BX,BY)); return im
def frame(base,p=None,angle=0,tip=True):
    im=overlay(Image.open(base).convert('RGBA'))
    if p is not None:
        L=gen.BL; fx=PAD+round(L*p/100)
        im.alpha_composite(fill.crop((0,0,fx,fill.height)),(BX,BY))
        hx=BX+fx; hy=BY+gen.ribbon_y(L*p/100); pr=pin.rotate(angle,resample=Image.BICUBIC)
        im.alpha_composite(pr,(round(hx-pr.width/2),round(hy-pr.height/2)))
        if tip:
            d=ImageDraw.Draw(im); t=TIPS[p]; w=d.textlength(t,font=font)
            d.text(((W-w)/2+1,TIP_Y+1),t,font=font,fill=(255,250,238,180)); d.text(((W-w)/2,TIP_Y),t,font=font,fill=(63,94,99,255))
    return im.convert('RGB')
def jpg_under(im,limit,path):
    for q in range(92,60,-1):
        b=io.BytesIO(); im.save(b,'JPEG',quality=q,optimize=True,progressive=True,subsampling=2)
        if b.tell()<limit: open(path,'wb').write(b.getvalue()); return q,b.tell()
# 1) first-screen composite: base + logo + title + empty track (no fill, no pinwheel, no tip)
fs=frame(BASE_FS,None)
q,nb=jpg_under(fs,60000,O+'/first_screen_composite.jpg')
# 2) formal loading-layer frames on the formal base
for p,a in [(0,0),(50,35),(100,70)]:
    frame(BASE,p,a).save(O+f'/loading_final_{p:03d}.png',optimize=True)
# 3) comparison: previous placeholder frames vs new
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; bf=ImageFont.truetype(FB,30,index=2)
th=lambda p: Image.open(p).convert('RGB').resize((375,812),Image.LANCZOS)
cmp=Image.new('RGB',(375*4+100,812*2+170),(250,246,236)); d=ImageDraw.Draw(cmp)
d.text((20,14),'上：之前的定稿（占位底图，标志 y=316）　下：正式底图 loading_base_final.jpg + 新坐标（标志收进标题带）',font=bf,fill=(63,94,99))
cols=[('first-screen 首帧',None)]+[(f'{p}%',p) for p in (0,50,100)]
for k,(lab,p) in enumerate(cols):
    x=20+k*395
    old=th(A+'/splash_option_same_image.jpg') if p is None else th(A+f'/loading_final_{p:03d}.png')
    new=th(O+'/first_screen_composite.jpg') if p is None else th(O+f'/loading_final_{p:03d}.png')
    d.text((x,66),lab,font=bf,fill=(99,63,33)); cmp.paste(old,(x,110)); cmp.paste(new,(x,110+812+40))
cmp.save(O+'/compare_old_vs_new.jpg',quality=86,optimize=True)
# 4) 16:9 crop check: visible window y 145..1479 (cover on 9:16 crops ~145 design px top/bottom)
CT=round((1624-750*16/9)/2); CB=1624-CT
fsI=Image.open(O+'/first_screen_composite.jpg').convert('RGB'); l0=Image.open(O+'/loading_final_000.png').convert('RGB')
l0n=frame(BASE,0,0,tip=False)   # handover frame: loading layer at 0% before the tip appears
def crop(im): return im.crop((0,CT,W,CB))
diff=ImageChops.difference(fsI,l0n); dn=np.asarray(diff).astype(float).max(2)
amp=Image.fromarray(np.clip(dn*6,0,255).astype(np.uint8)).convert('RGB')
def guides(im,y0):
    g=im.copy(); dd=ImageDraw.Draw(g,'RGBA')
    # capsule band on a 16:9 phone (375x667pt, status 20pt): capsule y 26-58pt -> design y = 145 + pt/0.5
    dd.rectangle((562,145+52-y0,736,145+116-y0),outline=(220,60,60,255),width=3); dd.text((420,145+60-y0),'胶囊',font=bf,fill=(220,60,60,255))
    for yy,c,lab in [(0.18*H,(40,120,200),'18%'),(0.32*H,(40,120,200),'32%'),(0.796*H,(200,120,40),'79.6%')]:
        dd.line((0,yy-y0,W,yy-y0),fill=c+(200,),width=2); dd.text((6,yy-y0-30),lab,font=bf,fill=c+(255,))
    return g
chk=Image.new('RGB',(W*3+80,(CB-CT)+150),(250,246,236)); d=ImageDraw.Draw(chk)
d.text((20,14),f'16:9 裁切检查（cover 后可见设计区 y {CT}–{CB}，上下各裁 {CT}px）',font=bf,fill=(63,94,99))
for k,(im,lab) in enumerate([(guides(crop(fsI),CT),'① first-screen 首帧（fs50k 合成）'),(guides(crop(l0n),CT),'② 场景加载层 0%（正式底图，交接帧）'),(crop(amp),'③ 差异×6：只有风车（加载层新增）+压缩噪声')]):
    x=20+k*(W+20); chk.paste(im,(x,120)); d.text((x,70),lab,font=bf,fill=(99,63,33))
chk.save(O+'/crop_16x9_check.png',optimize=True)
# metrics
def vis_bbox(im,off):
    a=np.asarray(im.getchannel('A'))>8; ys,xs=np.where(a); return [int(xs.min()+off[0]),int(ys.min()+off[1]),int(xs.max()+off[0]+1),int(ys.max()+off[1]+1)]
lb=vis_bbox(logo,LB); tb=vis_bbox(title,TB); kb=vis_bbox(track,(BX,BY))
ov=np.asarray(ImageChops.difference(crop(fsI),crop(l0n))).astype(float)
rep=dict(first_screen=dict(file='first_screen_composite.jpg',size=[W,H],bytes=nb,jpeg_quality=q),
  logo=dict(scale=LOGO_S,size=list(logo.size),center=list(LOGO_C),topleft=list(LB),visible_bbox=lb,visible_pct=[round(lb[1]/H*100,1),round(lb[3]/H*100,1)]),
  title=dict(scale=TITLE_S,size=list(title.size),center=list(TITLE_C),topleft=list(TB),visible_bbox=tb,visible_pct=[round(tb[1]/H*100,1),round(tb[3]/H*100,1)]),
  bar_track=dict(size=list(track.size),topleft=[BX,BY],center_y=BAR_CY,center_pct=round(BAR_CY/H*100,1),visible_bbox=kb),
  tip_text=dict(top_y=TIP_Y,pct=round((TIP_Y+40)/H*100,1)),
  crop_16x9=dict(visible_y=[CT,CB],handover_mean_abs_diff=round(float(ov.mean()),2),handover_p99_diff=float(np.percentile(ov,99))),
  loading_frames={f'loading_final_{p:03d}.png':os.path.getsize(O+f'/loading_final_{p:03d}.png') for p in (0,50,100)})
json.dump(rep,open(O+'/coords.json','w'),ensure_ascii=False,indent=1); print(json.dumps(rep,ensure_ascii=False))
