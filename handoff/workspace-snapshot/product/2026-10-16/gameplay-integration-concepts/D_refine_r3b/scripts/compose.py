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
P='D_refine_r3b'
main=grade(Image.open('raw_main.png').convert('RGB')); main.save(P+'_concept_720x1280.png'); main.save(P+'_concept_720x1280.jpg',quality=88)
grade(Image.open('raw_mask.png').convert('RGB')).save(P+'_mask_720x1280.jpg',quality=84)
subprocess.run(['python3','scripts/annotate.py',P+'_concept_720x1280.png','cells.json','_cells_tmp.png','D_refine_r3b'],check=True)
im=Image.open('_cells_tmp.png').convert('RGB'); d=ImageDraw.Draw(im)
cells=json.load(open('cells.json')); bot=max(max(p[1] for p in c['corners']) for c in cells); top=min(min(p[1] for p in c['corners']) for c in cells)
d.line((0,bot,720,bot),fill=(255,220,80),width=2); d.line((0,top,720,top),fill=(255,220,80),width=2)
label(d,(14,bot+6),'棋盘下沿距底 %d px（%.1f%%），以下为前景带'%(round(1280-bot),(1280-bot)/12.8),20,(255,220,80))
label(d,(14,top-34),'棋盘上沿距顶 %d px（%.1f%%）= 地标区'%(round(top),top/12.8),20,(255,220,80))
im.save(P+'_cells_720x1280.jpg',quality=84); os.remove('_cells_tmp.png')
# 四联对比 v3 D / r2 / r3 / r3b
ims=[('v3 D（原版）','../v3/D_hill_picnic.png'),('D_refine_r2','../D_refine_r2/D_refine_r2_concept_720x1280.png'),('D_refine_r3','../D_refine_r3/D_refine_r3_concept_720x1280.png'),('D_refine_r3b（本版）',None)]
c=Image.new('RGB',(2920,1360),(30,28,36)); d=ImageDraw.Draw(c)
for k,(t,f) in enumerate(ims):
    c.paste(main if f is None else Image.open(f).convert('RGB'),(10+k*730,70)); label(d,(20+k*730,14),t,30,(255,220,120) if f is None else (255,255,255))
c=c.resize((c.width//2,c.height//2),Image.LANCZOS); c.save(P+'_vs_v3_r2_r3.jpg',quality=84)
# 近景：翻折角 + 围巾
names=[('fold','②右上柔软弯角：圆弧、厚度、奶白背面、柔影'),('scarf','⑤立体棋子：叠成厚堆的围巾、斜靠信封、斜立风筝、高罐')]
q=Image.new('RGB',(1450,800),(30,28,36)); d=ImageDraw.Draw(q)
for k,(nm,t) in enumerate(names):
    x=10+k*720; q.paste(grade(Image.open(f'raw_close_{nm}.png').convert('RGB')),(x,70)); label(d,(x+6,16),t,24)
q.save(P+'_closeup_fold_scarf.jpg',quality=86)
for f in sorted(os.listdir('.')):
    if f.endswith('.jpg'): print(f,os.path.getsize(f))
