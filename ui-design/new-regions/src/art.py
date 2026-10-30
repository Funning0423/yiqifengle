# 新地区设计图：reward_seal_coast / reward_seal_snow（115×128，同现有印章结构），region_coast / region_snow（208×136 小窗）
# 以及「未揭晓」空白印章。输出到 ../art/（设计稿，非游戏资源；文件名以 draft 结尾）
import math,os
from PIL import Image,ImageDraw,ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__)); ART=os.path.join(os.path.dirname(HERE),'art'); os.makedirs(ART,exist_ok=True)
S=6
def seal(kind):
  W,H=115,128; im=Image.new('RGBA',(W*S,H*S),(0,0,0,0)); d=ImageDraw.Draw(im)
  def E(cx,cy,r,f): d.ellipse([(cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S],fill=f)
  cx,cy=57.5,70
  # 挂环
  d.ellipse([(cx-8)*S,4*S,(cx+8)*S,20*S],outline='#B8862E' if kind!='blank' else '#BFA987',width=4*S)
  if kind=='blank':
    E(cx,cy+3,54,'#C9B48E'); E(cx,cy,54,'#D8C4A0'); E(cx,cy,44,'#E6D7B8'); E(cx,cy,38,'#EFE3C8')
    # 浅浮雕「风」纹：三道弧
    for i,r in enumerate((14,22,30)):
      d.arc([(cx-r)*S,(cy-r*0.6)*S,(cx+r)*S,(cy+r*0.6)*S],200,340,fill='#DCCBA8',width=3*S)
    return im.resize((W,H),Image.LANCZOS)
  # 木环：12 边形分面
  for k,(r,col) in enumerate(((54,'#6E3F1C'),(53,'#8A5228'))):
    pts=[(cx+r*math.cos(math.radians(15+30*i)),cy+3*(k==0)+r*math.sin(math.radians(15+30*i))) for i in range(12)]; d.polygon([(x*S,y*S) for x,y in pts],fill=col)
  for i in range(12):  # 分面明暗
    a0,a1=math.radians(15+30*i),math.radians(45+30*i); f='#9C6233' if math.sin((a0+a1)/2)<0 else '#7C4A22'
    d.polygon([((cx+53*math.cos(a0))*S,(cy+53*math.sin(a0))*S),((cx+53*math.cos(a1))*S,(cy+53*math.sin(a1))*S),((cx+44*math.cos(a1))*S,(cy+44*math.sin(a1))*S),((cx+44*math.cos(a0))*S,(cy+44*math.sin(a0))*S)],fill=f)
  ring={'coast':'#E2B25A','coast_night':'#E2B25A','snow':'#8FA8D8'}[kind]; E(cx,cy,44,ring); E(cx,cy,38,'#FFF6E2')
  m=Image.new('L',im.size,0); ImageDraw.Draw(m).ellipse([(cx-36)*S,(cy-36)*S,(cx+36)*S,(cy+36)*S],fill=255)
  L=Image.new('RGBA',im.size,(0,0,0,0)); q=ImageDraw.Draw(L)
  P=lambda pts:[(x*S,y*S) for x,y in pts]
  if kind=='coast':
    q.rectangle([0,(cy+4)*S,W*S,H*S],fill='#7FC4C8')                       # 海
    q.polygon(P([(cx-40,cy+40),(cx-40,cy+16),(cx-10,cy+10),(cx+40,cy+22),(cx+40,cy+40)]),fill='#F0D49A')  # 沙
    q.polygon(P([(cx-10,cy+10),(cx+40,cy+22),(cx+40,cy+40),(cx+6,cy+40)]),fill='#E2BE7E')
    q.polygon(P([(cx+4,cy+14),(cx+16,cy+14),(cx+13,cy-18),(cx+7,cy-18)]),fill='#FFFFFF')  # 灯塔
    q.polygon(P([(cx+10,cy+14),(cx+16,cy+14),(cx+13,cy-18),(cx+10,cy-18)]),fill='#E6E0D2')
    for yy in (cy+2,cy-10): q.polygon(P([(cx+5.5,yy),(cx+14.5,yy),(cx+14.2,yy+4),(cx+5.8,yy+4)]),fill='#D2553A')
    q.polygon(P([(cx+5,cy-18),(cx+15,cy-18),(cx+10,cy-26)]),fill='#D2553A')
    gl=Image.new('RGBA',im.size,(255,224,140,0)); ImageDraw.Draw(gl).ellipse([(cx-2)*S,(cy-30)*S,(cx+22)*S,(cy-14)*S],fill=(255,224,140,200)); L.alpha_composite(gl.filter(ImageFilter.GaussianBlur(4*S)))
    for i,yy in enumerate((cy+20,cy+28)): q.line(P([(cx-34+i*4,yy),(cx-26+i*4,yy-3),(cx-18+i*4,yy),(cx-10+i*4,yy-3)]),fill='#FFFFFF',width=int(2.2*S))
  elif kind=='coast_night':
    for i in range(30):
      f=i/29; q.rectangle([0,int((cy-40+i*2.7)*S),W*S,int((cy-40+(i+1)*2.7)*S)+1],fill=(int(36+30*f),int(48+40*f),int(96+40*f)))
    q.rectangle([0,(cy+6)*S,W*S,H*S],fill='#1E4A66')
    for sx,sy,r_ in ((cx-24,cy-20,1.6),(cx-12,cy-28,1.2),(cx-28,cy-4,1.0),(cx+26,cy-8,1.2)): q.ellipse(P([(sx-r_,sy-r_),(sx+r_,sy+r_)]),fill='#FFF3C8')
    q.polygon(P([(cx-18,cy-4),(cx-14,cy-12),(cx-20,cy-14)]),fill='#F2E2A8')   # 月牙（低多边形）
    beam=Image.new('RGBA',im.size,(255,214,120,0)); bq=ImageDraw.Draw(beam)
    bq.polygon(P([(cx+10,cy-20),(cx-40,cy-34),(cx-40,cy-12)]),fill=(255,214,120,120)); bq.polygon(P([(cx+10,cy-20),(cx+44,cy-30),(cx+44,cy-16)]),fill=(255,214,120,70))
    L.alpha_composite(beam.filter(ImageFilter.GaussianBlur(1.5*S)))
    q.polygon(P([(cx-40,cy+40),(cx-40,cy+20),(cx-6,cy+12),(cx+40,cy+24),(cx+40,cy+40)]),fill='#3A4A6A')  # 夜里的礁岸
    q.polygon(P([(cx-6,cy+12),(cx+40,cy+24),(cx+40,cy+40),(cx+8,cy+40)]),fill='#2C3A56')
    q.polygon(P([(cx+4,cy+16),(cx+16,cy+16),(cx+13,cy-14),(cx+7,cy-14)]),fill='#E8E2D4'); q.polygon(P([(cx+10,cy+16),(cx+16,cy+16),(cx+13,cy-14),(cx+10,cy-14)]),fill='#BDB6A8')
    for yy in (cy+4,cy-6): q.polygon(P([(cx+5.5,yy),(cx+14.5,yy),(cx+14.2,yy+4),(cx+5.8,yy+4)]),fill='#B84A34')
    q.rectangle(P([(cx+6.5,cy-21),(cx+13.5,cy-14)]),fill='#FFD678'); q.polygon(P([(cx+5,cy-21),(cx+15,cy-21),(cx+10,cy-28)]),fill='#B84A34')
    gl=Image.new('RGBA',im.size,(255,214,120,0)); ImageDraw.Draw(gl).ellipse([(cx-2)*S,(cy-30)*S,(cx+22)*S,(cy-8)*S],fill=(255,214,120,170)); L.alpha_composite(gl.filter(ImageFilter.GaussianBlur(4*S)))
    for i,yy in enumerate((cy+14,cy+22)): q.line(P([(cx+8,yy),(cx+12,yy)]),fill='#FFD678',width=int(1.6*S))  # 水面倒影
    q.line(P([(cx-34,cy+30),(cx-26,cy+27),(cx-18,cy+30)]),fill='#6FA0C0',width=int(2*S))
  else:
    q.rectangle([0,0,W*S,H*S],fill='#D8E4F4')
    q.polygon(P([(cx-40,cy+30),(cx-8,cy-22),(cx+40,cy+30)]),fill='#8C9CC0')      # 山
    q.polygon(P([(cx-8,cy-22),(cx+40,cy+30),(cx+8,cy+30)]),fill='#6F7FA6')
    q.polygon(P([(cx-8,cy-22),(cx-20,cy-2),(cx-12,cy-6),(cx-6,cy+2),(cx+2,cy-6),(cx+8,cy-2)]),fill='#FFFFFF')  # 雪顶
    q.polygon(P([(cx+14,cy+30),(cx+32,cy+8),(cx+48,cy+30)]),fill='#A9B6D4')
    q.rectangle([0,(cy+26)*S,W*S,H*S],fill='#F4F7FC')
    st=(cx+20,cy-20); pts=[]
    for i in range(10):
      r=7 if i%2==0 else 3; a=math.radians(-90+36*i); pts.append((st[0]+r*math.cos(a),st[1]+r*math.sin(a)))
    q.polygon(P(pts),fill='#F2B544')
  im.paste(L,(0,0),Image.composite(L,Image.new('RGBA',im.size,(0,0,0,0)),m).getchannel('A'))
  return im.resize((W,H),Image.LANCZOS)
def window(kind):
  W,H=208,136; im=Image.new('RGBA',(W*S,H*S),(0,0,0,0)); d=ImageDraw.Draw(im); P=lambda pts:[(x*S,y*S) for x,y in pts]
  d.rounded_rectangle([0,0,W*S,H*S],radius=14*S,fill='#D9BF8C')
  L=Image.new('RGBA',im.size,(0,0,0,0)); q=ImageDraw.Draw(L)
  if kind=='coast':
    for i in range(40): f=i/39; q.rectangle([0,int(i*H*0.5*S/40),W*S,int((i+1)*H*0.5*S/40)+1],fill=(int(255-40*f),int(214+10*f),int(160+60*f)))
    q.rectangle([0,int(H*0.5*S),W*S,H*S],fill='#4FA9B8')
    q.polygon(P([(0,H),(0,96),(60,84),(140,100),(208,92),(208,H)]),fill='#F0D49A'); q.polygon(P([(60,84),(140,100),(208,92),(208,H),(90,H)]),fill='#E2BE7E')
    q.polygon(P([(150,98),(166,98),(162,40),(154,40)]),fill='#FFFFFF'); q.polygon(P([(158,98),(166,98),(162,40),(158,40)]),fill='#E6E0D2')
    for yy in (80,60): q.polygon(P([(151,yy),(165,yy),(164.5,yy+6),(151.5,yy+6)]),fill='#D2553A')
    q.polygon(P([(152,40),(164,40),(158,30)]),fill='#D2553A')
    for x0 in (20,60,100): q.line(P([(x0,76),(x0+8,73),(x0+16,76)]),fill='#E8F6F6',width=2*S)
    q.ellipse(P([(34,26),(52,44)]),fill='#FFE7B0')
  else:
    for i in range(40): f=i/39; q.rectangle([0,int(i*H*S/40),W*S,int((i+1)*H*S/40)+1],fill=(int(200+40*f),int(214+28*f),int(240+10*f)))
    q.polygon(P([(-10,110),(70,30),(150,110)]),fill='#8C9CC0'); q.polygon(P([(70,30),(150,110),(90,110)]),fill='#6F7FA6')
    q.polygon(P([(70,30),(52,52),(62,48),(70,58),(80,48),(88,52)]),fill='#FFFFFF')
    q.polygon(P([(100,110),(160,46),(230,110)]),fill='#A3B1D2'); q.polygon(P([(160,46),(146,62),(160,58),(172,62)]),fill='#FFFFFF')
    q.polygon(P([(0,H),(0,104),(80,98),(208,108),(208,H)]),fill='#F4F7FC')
    q.rectangle(P([(118,92),(124,112)]),fill='#8A5A32'); q.polygon(P([(112,92),(130,92),(121,84)]),fill='#C9773A')  # 驿站风铃柱
    for sx,sy in ((30,20),(180,26),(140,14)): q.ellipse(P([(sx-1.5,sy-1.5),(sx+1.5,sy+1.5)]),fill='#FFFFFF')
  m=Image.new('L',im.size,0); ImageDraw.Draw(m).rounded_rectangle([5*S,5*S,(W-5)*S,(H-5)*S],radius=10*S,fill=255)
  im.paste(L,(0,0),m); return im.resize((W,H),Image.LANCZOS)
RAW=os.path.join(ART,'raw'); os.makedirs(RAW,exist_ok=True)
outs={'reward_seal_coast':seal('coast_night'),'reward_seal_coast_day':seal('coast'),'reward_seal_snow':seal('snow'),'region_coast':window('coast'),'region_snow':window('snow'),'reward_seal_blank_ref':seal('blank')}
for k,v in outs.items(): v.save(f'{RAW}/{k}.png')
print('ok')
