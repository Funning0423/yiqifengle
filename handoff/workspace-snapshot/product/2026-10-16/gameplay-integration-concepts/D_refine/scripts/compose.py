import os,sys
from PIL import Image,ImageDraw,ImageFont,ImageEnhance,ImageFilter
D=os.path.dirname(os.path.abspath(__file__))+'/..'; os.chdir(D)
F=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',s)
def grade(im):
    im=ImageEnhance.Color(im).enhance(1.22); im=ImageEnhance.Contrast(im).enhance(1.06)
    w,h=im.size; m=Image.new('L',(w,h),0); ImageDraw.Draw(m).ellipse((-w*.3,-h*.15,w*1.3,h*1.15),fill=255)
    m=m.filter(ImageFilter.GaussianBlur(140)); return Image.composite(im,ImageEnhance.Brightness(im).enhance(0.82),m)
main=grade(Image.open('raw_D_refine.png').convert('RGB')); main.save('D_refine.png'); main.save('D_refine.jpg',quality=88)
def label(d,xy,t,s=26,fill=(255,255,255)):
    x,y=xy; d.text((x+2,y+2),t,font=F(s),fill=(0,0,0)); d.text((x,y),t,font=F(s),fill=fill)
# FX sheet
T=[('0.00s','按下·三连锁定 光环亮起'),('0.12s','鼓起 1.18× 光环最亮'),('0.32s','收缩 0.55× 种子+萤火虫爆出'),('0.70s','上飘淡出·新子落入(再0.2s,全程≈0.9s)')]
box=(300,330,720,1130); W=box[2]-box[0]; H=box[3]-box[1]
sh=Image.new('RGB',(W*4+50,H+120),(34,30,40)); d=ImageDraw.Draw(sh)
for k,(t,desc) in enumerate(T):
    f=grade(Image.open(f'raw_fx_f{k}.png').convert('RGB')).crop(box); x=10+k*(W+10); sh.paste(f,(x,70))
    label(d,(x+8,8),f'F{k+1}  {t}',30,(255,220,120)); label(d,(x+8,H+78),desc,20)
sh=sh.resize((sh.width*3//4,sh.height*3//4),Image.LANCZOS); sh.save('D_refine_fx_clear.jpg',quality=86)
# compare
v3=Image.open('../v3/D_hill_picnic.png').convert('RGB').resize((720,1280))
c=Image.new('RGB',(1460,1360),(30,28,36)); d=ImageDraw.Draw(c); c.paste(v3,(10,70)); c.paste(main,(730,70))
label(d,(20,14),'v3 D 山丘重逢（原版）',30); label(d,(740,14),'D_refine 精细版',30,(255,220,120))
c=c.resize((c.width*2//3,c.height*2//3),Image.LANCZOS); c.save('D_refine_vs_v3.jpg',quality=86)
# closeup QA
a=Image.open('raw_closeup_basket.png').convert('RGB'); b=Image.open('raw_closeup_topleft.png').convert('RGB')
q=Image.new('RGB',(1450,800),(30,28,36)); d=ImageDraw.Draw(q); q.paste(a,(10,70)); q.paste(b,(720,70))
label(d,(20,14),'近景A：右下篮子压角/草花压边',24); label(d,(730,14),'近景B：左上布边/树下鞋+信封',24)
q=q.resize((q.width*3//4,q.height*3//4),Image.LANCZOS); q.save('D_refine_closeup_QA.jpg',quality=88)
for f in ['D_refine_fx_clear.jpg','D_refine_vs_v3.jpg','D_refine_closeup_QA.jpg','D_refine.jpg']: print(f,os.path.getsize(f))
