from PIL import Image, ImageDraw, ImageFont
import sys,os
D=os.path.dirname(os.path.abspath(__file__))+'/../frames/'
F=lambda s: ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',s)
W,H=402,874; G=10; LW=170; TH=110; HH=60
rows=[('C','只移棕榈','2936c30'),('A2','招牌放大0.85+移位+补腿','3e6b7df')]
cols=[('far','day','远景 · 白天'),('far','night','远景 · 夜间'),('close','day','近景 · 白天'),('close','night','近景 · 夜间')]
SW=LW+4*W+5*G; SH=TH+HH+2*H+3*G
im=Image.new('RGB',(SW,SH),(24,24,28)); d=ImageDraw.Draw(im)
d.text((G,14),'首页招牌候选 C / A2（palm2：棕榈在东侧草地 [2.0,0.04,6.6]，yaw 180，scale 0.65）',font=F(30),fill='white')
d.text((G,60),'402×874 整屏未裁切 · 同一镜头 IslandRail far=restore(1) / close=0.46 · Blender 离线预览，非 Cocos 实机',font=F(24),fill=(255,200,120))
for j,(_,_,lab) in enumerate(cols): d.text((LW+G+j*(W+G)+W//2,TH+HH//2),lab,font=F(32),fill='white',anchor='mm')
for i,(k,desc,sha) in enumerate(rows):
  y=TH+HH+G+i*(H+G)
  d.text((LW//2,y+H//2-50),k,font=F(90),fill='white',anchor='mm')
  d.multiline_text((LW//2,y+H//2+50),desc.replace('+','\n+')+'\n'+sha,font=F(20),fill=(210,210,210),anchor='mm',align='center')
  for j,(v,t,_) in enumerate(cols):
    x=LW+G+j*(W+G); im.paste(Image.open(D+f'{k}_{v}_{t}_402x874.png').convert('RGB'),(x,y))
    d.text((x+8,y+6),f'{k} {v} {t}',font=F(22),fill='white',stroke_width=3,stroke_fill='black')
im.save(sys.argv[1],optimize=True); print(im.size,os.path.getsize(sys.argv[1]))
