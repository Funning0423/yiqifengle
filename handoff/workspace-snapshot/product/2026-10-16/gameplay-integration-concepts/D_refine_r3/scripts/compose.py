import os,json,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageEnhance,ImageFilter
D=os.path.dirname(os.path.abspath(__file__))+'/..'; os.chdir(D)
F=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',s,index=2)
def grade(im):
    im=ImageEnhance.Color(im).enhance(1.32); im=ImageEnhance.Contrast(im).enhance(1.07)
    w,h=im.size; m=Image.new('L',(w,h),0); ImageDraw.Draw(m).ellipse((-w*.3,-h*.15,w*1.3,h*1.15),fill=255)
    m=m.filter(ImageFilter.GaussianBlur(140)); return Image.composite(im,ImageEnhance.Brightness(im).enhance(0.84),m)
def label(d,xy,t,s=26,fill=(255,255,255)):
    x,y=xy; d.text((x+2,y+2),t,font=F(s),fill=(0,0,0)); d.text((x,y),t,font=F(s),fill=fill)
P='D_refine_r3'
main=grade(Image.open('raw_main.png').convert('RGB')); main.save(P+'_concept_720x1280.png'); main.save(P+'_concept_720x1280.jpg',quality=88)
grade(Image.open('raw_mask.png').convert('RGB')).save(P+'_mask_720x1280.jpg',quality=84)
subprocess.run(['python3','scripts/annotate.py',P+'_concept_720x1280.png','cells.json','_cells_tmp.png','D_refine_r3'],check=True)
im=Image.open('_cells_tmp.png').convert('RGB'); d=ImageDraw.Draw(im)
cells=json.load(open('cells.json')); bot=max(max(p[1] for p in c['corners']) for c in cells); top=min(min(p[1] for p in c['corners']) for c in cells)
d.line((0,bot,720,bot),fill=(255,220,80),width=2); d.line((0,top,720,top),fill=(255,220,80),width=2)
label(d,(14,bot+6),'棋盘下沿距底 %d px（%.1f%%），以下为前景带'%(round(1280-bot),(1280-bot)/12.8),20,(255,220,80))
label(d,(14,top-34),'棋盘上沿距顶 %d px（%.1f%%）= 地标区'%(round(top),top/12.8),20,(255,220,80))
im.save(P+'_cells_720x1280.jpg',quality=84); os.remove('_cells_tmp.png')
# 对比
old=Image.open('../D_refine_r2/D_refine_r2_concept_720x1280.png').convert('RGB')
c=Image.new('RGB',(1460,1360),(30,28,36)); d=ImageDraw.Draw(c); c.paste(old,(10,70)); c.paste(main,(730,70))
label(d,(20,14),'D_refine_r2（上一轮）',30); label(d,(740,14),'D_refine_r3（本轮）',30,(255,220,120))
c=c.resize((c.width*2//3,c.height*2//3),Image.LANCZOS); c.save(P+'_vs_r2.jpg',quality=84)
# 近景验收
names=[('fold','①翻折角+右侧布边褶皱（格内平整）'),('bottom','①下布边起伏/流苏 + 草花压边'),('jar','⑤罐子发光芯：近看是圆的'),('tree','⑥坡顶后方地形连续（远山墙）'),('basket','⑥篮子/右下角草花，无穿模悬空')]
q=Image.new('RGB',(2170,1560),(30,28,36)); d=ImageDraw.Draw(q)
for k,(nm,t) in enumerate(names):
    x=10+(k%3)*720; y=60+(k//3)*780; q.paste(grade(Image.open(f'raw_close_{nm}.png').convert('RGB')),(x,y)); label(d,(x+6,y-48),t,26)
x=10+2*720; y=60+780; d.rectangle((x,y,x+710,y+720),fill=(44,40,52))
for k,l in enumerate(open('scripts/qa_short.txt').read().splitlines()): label(d,(x+20,y+20+k*40),l,24)
q=q.resize((q.width//2,q.height//2),Image.LANCZOS); q.save(P+'_closeup_QA.jpg',quality=86)
for f in sorted(os.listdir('.')):
    if f.endswith('.jpg'): print(f,os.path.getsize(f))
