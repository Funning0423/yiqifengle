from PIL import Image,ImageDraw,ImageFont
import sys
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',28) if __import__('os').path.exists('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc') else ImageFont.load_default()
k=2  # 375x812 pt -> 750x1624
def ui(im):
  d=ImageDraw.Draw(im,'RGBA')
  def R(x0,y0,x1,y1,c,l):d.rectangle([x0*k,y0*k,x1*k,y1*k],fill=c+(70,),outline=c+(255,),width=3);d.text((x0*k+6,y0*k+4),l,fill=(255,255,255),font=F)
  d.ellipse([(38-22)*k,(67-22)*k,(38+22)*k,(67+22)*k],fill=(160,60,200,90),outline=(160,60,200),width=3)
  R(80.5,96,294.5,156,(160,60,200),'标题牌 96–156')
  R(10.6,212,364.4,588,(160,60,200),'棋盘 212–588')
  R(30,666,345,730,(160,60,200),'道具栏')
  d.rectangle([0,156*k,750,212*k],outline=(255,220,0),width=3)
  return im
for t,f in ((4,120),(8,240),(12,360),(15,450)):
  a=ui(Image.open(f'out/before_f{f:04d}.png').convert('RGB'));b=ui(Image.open(f'out/after_f{f:04d}.png').convert('RGB'))
  s=Image.new('RGB',(1520,1700),'white');s.paste(a,(0,70));s.paste(b,(770,70));d=ImageDraw.Draw(s)
  d.text((10,10),f'改前 v7.6 (aabd8a2)  t={t}s',fill='black',font=F);d.text((780,10),f'改后 v7.7  t={t}s  黄框=可见带 156–212',fill='black',font=F)
  s.save(f'out/before_after_t{t:02d}s.png')
