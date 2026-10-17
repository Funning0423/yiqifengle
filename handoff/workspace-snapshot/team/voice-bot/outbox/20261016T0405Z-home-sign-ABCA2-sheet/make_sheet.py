from PIL import Image, ImageDraw, ImageFont
import sys,os
O='/workspace/wechat-game/team/voice-bot/outbox/'
AB=O+'20261016T0131Z-home-sign-AB/frames/'; CA=O+'20261016T0155Z-home-sign-C-A2/frames/'
F=lambda s: ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',s)
W,H=402,874; G=10; LW=170; TH=110; HH=60
rows=[('A','招牌放大',lambda v,t: AB+f'A_{v}_402x874.png' if t=='day' else None),
      ('B','深色底板',lambda v,t: AB+f'B_{v}_402x874.png' if t=='day' else None),
      ('C','只移棕榈',lambda v,t: CA+f'C_{v}_{t}_402x874.png'),
      ('A2','放大+移位+补腿',lambda v,t: CA+f'A2_{v}_{t}_402x874.png')]
cols=[('far','day','远景 · 白天'),('far','night','远景 · 夜间'),('close','day','近景 · 白天'),('close','night','近景 · 夜间')]
SW=LW+4*W+5*G; SH=TH+HH+4*H+5*G
im=Image.new('RGB',(SW,SH),(24,24,28)); d=ImageDraw.Draw(im)
d.text((G,14),'首页招牌候选 A / B / C / A2 对照（402×874 整屏，未裁切，同一镜头；Blender 离线预览，非 Cocos 实机）',font=F(30),fill='white')
d.text((G,60),'镜头：IslandRail far=restore(1)，close=restore(0)/0.46 最近停靠。A、B 没有夜间渲染（灰格）',font=F(24),fill=(255,200,120))
for j,(_,_,lab) in enumerate(cols):
  x=LW+G+j*(W+G); d.text((x+W//2,TH+HH//2),lab,font=F(32),fill='white',anchor='mm')
for i,(k,desc,fn) in enumerate(rows):
  y=TH+HH+G+i*(H+G)
  d.text((LW//2,y+H//2-40),k,font=F(90),fill='white',anchor='mm')
  d.text((LW//2,y+H//2+40),desc,font=F(20),fill=(210,210,210),anchor='mm')
  for j,(v,t,_) in enumerate(cols):
    x=LW+G+j*(W+G); p=fn(v,t)
    if p: im.paste(Image.open(p).convert('RGB'),(x,y))
    else:
      d.rectangle([x,y,x+W-1,y+H-1],fill=(60,60,66)); d.text((x+W//2,y+H//2),'未渲染\n（渲染环境已不在）',font=F(28),fill=(170,170,170),anchor='mm',align='center')
    d.text((x+8,y+6),f'{k} {v} {t}',font=F(22),fill='white',stroke_width=3,stroke_fill='black')
im.save(sys.argv[1],optimize=True); print(im.size,os.path.getsize(sys.argv[1]))
