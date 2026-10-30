# 生成 popup/icon_vibrate.png：低多边形木壳手机 + 两侧暖黄震动弧，配色取自 icon_sfx（木棕 / 奶白面 / 鼓边黄）
import math,os
from PIL import Image,ImageDraw,ImageFilter
S=4; W,H=300,252
im=Image.new('RGBA',(W*S,H*S),(0,0,0,0)); d=ImageDraw.Draw(im)
def P(pts): return [(x*S,y*S) for x,y in pts]
def rot(pts,cx,cy,a):
  c,s=math.cos(a),math.sin(a); return [(cx+(x-cx)*c-(y-cy)*s, cy+(x-cx)*s+(y-cy)*c) for x,y in pts]
def rrect(x0,y0,x1,y1,r,n=4):
  pts=[]
  for cx,cy,a0 in ((x1-r,y0+r,-90),(x1-r,y1-r,0),(x0+r,y1-r,90),(x0+r,y0+r,180)):
    for i in range(n+1): a=math.radians(a0+90*i/n); pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
  return pts
cx,cy,A=150,128,math.radians(-14)
# 阴影侧（厚度）
for poly,col in ((rrect(104,30,206,236,22),'#7A4520'),):
  d.polygon(P(rot([(x+9,y+8) for x,y in poly],cx,cy,A)),fill=col)
d.polygon(P(rot(rrect(100,24,200,228,22),cx,cy,A)),fill='#9A5F2E')        # 外壳
d.polygon(P(rot(rrect(104,26,196,120,18),cx,cy,A)),fill='#B0733C')        # 上半受光面（低多边形分面）
d.polygon(P(rot(rrect(114,46,186,196,8),cx,cy,A)),fill='#E9E4D2')         # 屏幕
d.polygon(P(rot([(114,46),(186,46),(186,120),(114,150)],cx,cy,A)),fill='#F6F3E8')  # 屏幕亮面
d.polygon(P(rot([(140,33),(160,33),(160,38),(140,38)],cx,cy,A)),fill='#5E3416')    # 听筒
d.polygon(P(rot([(143,204),(157,204),(161,212),(150,218),(139,212)],cx,cy,A)),fill='#E8C770')  # 圆键(多边形)
# 震动弧（三段，同鼓边黄 #E8D08A / 暗面 #C9A85A）
for side in (-1,1):
  for k,(r,w) in enumerate(((78,12),(100,10))):
    a0=-28; a1=28
    seg=[]
    for i in range(7):
      a=math.radians(a0+(a1-a0)*i/6)+(0 if side>0 else math.pi)
      seg.append((cx+r*math.cos(a),cy+r*math.sin(a)*1.25))
    d.line(P(seg),fill='#C9A85A',width=(w+4)*S,joint='curve')
    d.line(P([(x,y-2) for x,y in seg]),fill='#F0D98E',width=w*S,joint='curve')
im=im.resize((W,H),Image.LANCZOS); bb=im.getbbox(); im=im.crop((bb[0],0,bb[2],H))
out=os.path.join(os.path.dirname(__file__),'../../../creator-build-project/assets/bundles/board_art/popup/icon_vibrate.png')
im.save(os.path.normpath(out)); print(im.size)
