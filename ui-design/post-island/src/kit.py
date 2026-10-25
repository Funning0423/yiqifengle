"""共用绘制工具：2x 超采样绘制，保证边缘抗锯齿。"""
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import math,random,os
ROOT='/workspace/wechat-game/work/post-island-ui/'
POP=ROOT+'creator-build-project/assets/bundles/board_art/popup/'
HERE=os.path.dirname(os.path.abspath(__file__))+'/'
R7='/workspace/qifengle/test-reports/20261023T0300_r7-76a0433/shots/'
B05='/workspace/qifengle/test-reports/20261023T0324/shots/'
S=2
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def F(px):return ImageFont.truetype(FB,int(px*S),index=2)
def img(p):return Image.open(p).convert('RGBA')
def three(src,w,h,b):
  sw,sh=src.size;k=h/sh;bs=int(b*k);out=Image.new('RGBA',(w,h))
  out.paste(src.crop((0,0,b,sh)).resize((bs,h),Image.LANCZOS),(0,0))
  out.paste(src.crop((b,0,sw-b,sh)).resize((max(1,w-2*bs),h),Image.LANCZOS),(bs,0))
  out.paste(src.crop((sw-b,0,sw,sh)).resize((bs,h),Image.LANCZOS),(w-bs,0));return out
def tint(im,k):
  r,g,b,a=im.split();return Image.merge('RGBA',(r.point(lambda v:int(v*k[0])),g.point(lambda v:int(v*k[1])),b.point(lambda v:int(v*k[2])),a))
def text(c,s,cx,cy,px,fill,shadow=None,spacing=0):
  d=ImageDraw.Draw(c);f=F(px);w=sum(d.textlength(ch,font=f) for ch in s)+spacing*S*(len(s)-1)
  x=cx*S-w/2;bb=d.textbbox((0,0),'风',font=f);y=cy*S-(bb[1]+bb[3])/2
  for ch in s:
    if shadow:d.text((x,y+2*S),ch,font=f,fill=shadow)
    d.text((x,y),ch,font=f,fill=fill);x+=d.textlength(ch,font=f)+spacing*S
def cover_bg(path,W,H,crop_bottom=0):
  im=img(path);w,h=im.size
  if (w,h)==(390,844):  # 抹掉测试包右下角的「开发预览画面」小字（设计稿不出现测试标记）
    im.paste(im.crop((226,744,390,778)).resize((164,34)),(226,776))
  im=im.crop((0,0,w,h-crop_bottom));w,h=im.size
  k=max(W*S/w,H*S/h);im=im.resize((int(w*k+.5),int(h*k+.5)),Image.LANCZOS)
  x=(im.width-W*S)//2;return im.crop((x,0,x+W*S,H*S))
def plank(name,w=176,h=54,px=22,k=None):
  p=three(img(POP+'title_plank_3s.png'),w*S,h*S,200)
  if k:p=tint(p,k)
  c=Image.new('RGBA',p.size);c.alpha_composite(p)
  # 文字画在木牌中心
  d=ImageDraw.Draw(c);f=F(px);tw=sum(d.textlength(ch,font=f) for ch in name)+3*S*(len(name)-1);x=(c.width-tw)/2
  bb=d.textbbox((0,0),'风',font=f);y=c.height/2-(bb[1]+bb[3])/2-1*S
  for ch in name:
    d.text((x,y+2*S),ch,font=f,fill=(255,250,236,200));d.text((x,y),ch,font=f,fill=(90,58,30,255));x+=d.textlength(ch,font=f)+3*S
  return c
def button(label,w,h=62,kind='primary',k=None):
  b=three(img(POP+'btn_%s_3s.png'%kind),w*S,h*S,170)
  if k:b=tint(b,k)
  c=Image.new('RGBA',b.size);c.alpha_composite(b)
  d=ImageDraw.Draw(c);f=F(20);tw=sum(d.textlength(ch,font=f) for ch in label)+2*S*(len(label)-1);x=(c.width-tw)/2
  bb=d.textbbox((0,0),'风',font=f);y=(h-6)*S/2-(bb[1]+bb[3])/2
  fill,sh=((255,255,255,255),(30,70,72,255)) if kind=='primary' else ((74,60,40,255),(255,255,255,255))
  for ch in label:
    d.text((x,y+2*S),ch,font=f,fill=sh);d.text((x,y),ch,font=f,fill=fill);x+=d.textlength(ch,font=f)+2*S
  return c
def glow(size,r,color,peak):
  g=Image.new('RGBA',(size,size),(0,0,0,0));d=ImageDraw.Draw(g);c=size/2
  d.ellipse((c-r,c-r,c+r,c+r),fill=color+(int(255*peak),));return g.filter(ImageFilter.GaussianBlur(r*0.45))
# ---- 风云擦除（场景切换） ----
random.seed(7)
PUFF=[(random.uniform(0,1),random.uniform(36,70),random.uniform(-26,26)) for _ in range(26)]
def wipe_mask(W,H,lead,trail):
  """lead/trail: 云带前沿/后沿在 0..1 之间的进度（沿风向：左下→右上，倾角 12°）。云边由一串圆形云团组成。"""
  w,h=W*S,H*S;m=Image.new('L',(w,h),0);d=ImageDraw.Draw(m)
  span=w+h*math.tan(math.radians(12))+2*80*S
  def edgex(p):return -80*S+p*span
  a=math.tan(math.radians(12))
  # 主体多边形：x 在 [trail,lead] 之间（随 y 倾斜）
  L=edgex(lead);T=edgex(trail)
  poly=[(T-a*0,0),(L,0),(L-a*h,h),(T-a*h,h)]
  if lead>trail:d.polygon(poly,fill=255)
  for u,r,off in PUFF:  # 前沿云团（凸出）与后沿云团（内凹被填回）
    y=u*h;r*=S
    if lead>trail and lead<1.0:
      x=L-a*y+off*S;d.ellipse((x-r,y-r,x+r,y+r),fill=255)
    if trail>0 and lead>trail:
      x=T-a*y+off*S*0.8;d.ellipse((x-r,y-r,x+r,y+r),fill=0)
  return m.filter(ImageFilter.GaussianBlur(1.2*S))
def cloud_layer(W,H,night):
  w,h=W*S,H*S;c=Image.new('RGBA',(w,h));d=ImageDraw.Draw(c)
  top,bot=((255,246,226),(252,228,186)) if not night else ((40,50,82),(62,70,104))
  for y in range(0,h,4):
    t=y/h;col=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3));d.rectangle((0,y,w,y+4),fill=col+(255,))
  # 低多边形云纹：几道浅色斜面
  rnd=random.Random(3)
  for i in range(9):
    x=rnd.uniform(-.2,1)*w;y=rnd.uniform(0,1)*h;s=rnd.uniform(90,170)*S
    col=(255,252,244,70) if not night else (120,130,170,22)
    d.polygon([(x,y),(x+s,y-s*.25),(x+s*1.6,y+s*.1),(x+s*.5,y+s*.3)],fill=col)
  if night:
    for i in range(40):
      x=rnd.uniform(0,w);y=rnd.uniform(0,h*.8);r=rnd.uniform(1,2.4)*S
      d.ellipse((x-r,y-r,x+r,y+r),fill=(255,226,160,rnd.randint(120,220)))
  return c
