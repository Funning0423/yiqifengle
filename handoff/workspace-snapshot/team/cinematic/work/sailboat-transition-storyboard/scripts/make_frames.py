# Rough storyboard frames (PIL). Inputs: island final render (exit-cam-check renders) + meadow pose render (meadow-pose-check alt_x-4).
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D=sys.argv[1]; ISL=sys.argv[2]; MEA=sys.argv[3]
W,H=540,1174
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',26); f2=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',20)
def boat(d,x,y,s=1.0):
  d.polygon([(x-40*s,y),(x+40*s,y),(x+28*s,y+16*s),(x-28*s,y+16*s)],fill=(120,70,40))
  d.line([(x,y),(x,y-70*s)],fill=(60,40,20),width=max(2,int(4*s)))
  d.polygon([(x+3*s,y-68*s),(x+3*s,y-8*s),(x+40*s,y-8*s)],fill=(250,248,235))
  d.ellipse([x-8*s,y-22*s,x+2*s,y-8*s],fill=(240,220,200))  # her
def arrow(d,a,b,col=(255,80,60)):
  d.line([a,b],fill=col,width=6); import math
  ang=math.atan2(b[1]-a[1],b[0]-a[0]); L=22
  d.polygon([b,(b[0]-L*math.cos(ang-0.4),b[1]-L*math.sin(ang-0.4)),(b[0]-L*math.cos(ang+0.4),b[1]-L*math.sin(ang+0.4))],fill=col)
def cap(img,title,lines):
  d=ImageDraw.Draw(img); d.rectangle([0,0,W,118],fill=(0,0,0,160)); d.text((16,10),title,font=F,fill='white')
  for i,l in enumerate(lines): d.text((16,48+i*28),l,font=f2,fill=(255,235,180))
  # UI safe line NDC y=-0.5
  d.line([(0,int(H*0.75)),(W,int(H*0.75))],fill=(255,0,255),width=2); d.text((W-190,int(H*0.75)+4),'NDC y=-0.5',font=f2,fill=(255,0,255))
  return img
isl=Image.open(ISL).convert('RGB').resize((W,H)); mea=Image.open(MEA).convert('RGB').resize((W,H))
out=[]
# S1 hold
a=isl.copy(); d=ImageDraw.Draw(a); boat(d,330,820,0.6); cap(a,'S1 0.0–0.4s 出门终帧 hold',['= 海岛终帧位姿（不动）','小帆船停在岸边；她走到船边','0.3s 起可点击跳过']); out.append(a)
# S2 boat leaves, camera tilt toward sea (crop lower-right & zoom out feeling)
b=isl.crop((60,300,540,1174)).resize((W,H)); d=ImageDraw.Draw(b); boat(d,330,880,1.0); arrow(d,(330,960),(430,1080)); arrow(d,(270,300),(270,420),(80,200,255))
cap(b,'S2 0.4–1.6s 起航',['镜头保持她右侧，下摇+后拉 ~8m','帆船离岸向画面下方/海面','目标=船，FOV 42→45']); out.append(b)
# S3 sea crossing + cloud wipe
c=Image.new('RGB',(W,H),(40,140,160)); d=ImageDraw.Draw(c)
for i in range(0,H,40): d.line([(0,i+300),(W,i+290)],fill=(55,160,175),width=3)
boat(d,270,700,1.3); cl=Image.new('RGBA',(W,H),(0,0,0,0)); dc=ImageDraw.Draw(cl)
for x,y,r in [(-40,380,170),(120,330,150),(330,400,190),(520,360,160),(60,520,140),(420,560,150)]: dc.ellipse([x-r,y-r*0.6,x+r,y+r*0.6],fill=(255,255,255,215))
c.paste(Image.alpha_composite(c.convert('RGBA'),cl.filter(ImageFilter.GaussianBlur(6))).convert('RGB')); d=ImageDraw.Draw(c); arrow(d,(560,420),(380,420),(255,255,255))
cap(c,'S3 1.6–3.0s 渡海 + 云层擦屏',['俯视 3/4 跟船（右侧），只有海和船','2.4–2.8s 云层横扫满屏 → 切换场景','（海岛→草甸 bundle 在云后切）']); out.append(c)
# S4 arrive meadow shore, low
dd=mea.crop((100,500,540,1174)).resize((W,H)); d=ImageDraw.Draw(dd); boat(d,260,900,1.1); arrow(d,(260,1000),(260,1060),(80,200,255))
cap(dd,'S4 3.0–4.2s 靠岸草甸',['云散开，低机位在河岸/岸边','船靠岸，她下船踩上 spawn','镜头开始升起后拉']); out.append(dd)
# S5 settle meadow pose
e=mea.copy(); d=ImageDraw.Draw(e); boat(d,330,780,0.4); arrow(d,(270,1000),(270,700),(80,200,255))
cap(e,'S5 4.2–5.2s 升到草甸位姿 settle',['终点 = pos(-4,24,62) target(0.3151,3.4577,-0.6059)','FOV 45，ease-out 0.6s，速度≤7 m/s','跳过也落在这一帧']); out.append(e)
for i,im in enumerate(out): im.save(f'{D}/frames/S{i+1}.png')
sheet=Image.new('RGB',(W*5//2+40,H//2+20),'white')
for i,im in enumerate(out): sheet.paste(im.resize((W//2,H//2)),(8+i*(W//2+8),10))
sheet.save(f'{D}/frames/contact_sheet.png'); print('ok')
