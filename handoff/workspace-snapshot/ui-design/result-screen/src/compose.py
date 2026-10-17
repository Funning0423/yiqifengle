from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance,ImageChops
import math,sys
A='/workspace/wechat-game/yiqifengle/creator-build-project/assets/bundles/board_art/'
S=2;W,H=390*S,844*S
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def F(px,idx=2):return ImageFont.truetype(FB,px*S,index=idx)
def img(p):return Image.open(A+p).convert('RGBA')
def nine(src,w,h,b,scale):
  sw,sh=src.size;bs=int(b*scale);out=Image.new('RGBA',(w,h))
  xs=[(0,b,0,bs),(b,sw-b,bs,w-bs),(sw-b,sw,w-bs,w)];ys=[(0,b,0,bs),(b,sh-b,bs,h-bs),(sh-b,sh,h-bs,h)]
  for x0,x1,X0,X1 in xs:
    for y0,y1,Y0,Y1 in ys:
      if X1>X0 and Y1>Y0:out.paste(src.crop((x0,y0,x1,y1)).resize((X1-X0,Y1-Y0),Image.LANCZOS),(X0,Y0))
  return out
def three(src,w,h,b):
  sw,sh=src.size;k=h/sh;bs=int(b*k);out=Image.new('RGBA',(w,h))
  out.paste(src.crop((0,0,b,sh)).resize((bs,h),Image.LANCZOS),(0,0))
  out.paste(src.crop((b,0,sw-b,sh)).resize((w-2*bs,h),Image.LANCZOS),(bs,0))
  out.paste(src.crop((sw-b,0,sw,sh)).resize((bs,h),Image.LANCZOS),(w-bs,0));return out
def tint(im,night,k=(0.62,0.66,0.82)):
  if not night:return im
  r,g,b,a=im.split();r=r.point(lambda v:int(v*k[0]));g=g.point(lambda v:int(v*k[1]));b=b.point(lambda v:int(v*k[2]));return Image.merge('RGBA',(r,g,b,a))
def text(c,s,cx,y,px,fill,shadow=None,spacing=0):
  d=ImageDraw.Draw(c);f=F(px);w=d.textlength(s,font=f)+spacing*(len(s)-1)*S
  x=cx*S-w/2
  for ch in s:
    if shadow:d.text((x,y*S+2*S),ch,font=f,fill=shadow)
    d.text((x,y*S),ch,font=f,fill=fill);x+=d.textlength(ch,font=f)+spacing*S
def glow(c,cx,cy,r,col,alpha):
  g=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(g)
  for i in range(40,0,-1):
    rr=r*S*i/40;a=int(alpha*(1-i/40)**1.6)
    d.ellipse((cx*S-rr,cy*S-rr,cx*S+rr,cy*S+rr),fill=col+(a,))
  c.alpha_composite(g.filter(ImageFilter.GaussianBlur(6*S)))
def place(c,im,x,y,w=None,h=None,center=False):
  if w and not h:h=int(im.height*w/im.width)
  if h and not w:w=int(im.width*h/im.height)
  im=im.resize((int(w*S),int(h*S)),Image.LANCZOS)
  if center:x-=w/2;y-=h/2
  c.alpha_composite(im,(int(x*S),int(y*S)))
def badge(icon,name,night):
  # 72x88 reward badge: cream round plate + icon + name ribbon
  b=Image.new('RGBA',(84*S,100*S));d=ImageDraw.Draw(b)
  return b
def reward(c,cx,top,icon,label,night,iconw=64):
  glow(c,cx,top+34,40,(255,226,140),110)
  d=ImageDraw.Draw(c)
  d.ellipse(((cx-34)*S,(top+2)*S+6*S,(cx+34)*S,(top+70)*S+6*S),fill=(196,160,108,255) if not night else (160,128,92,255))
  d.ellipse(((cx-34)*S,(top+2)*S,(cx+34)*S,(top+70)*S),fill=(255,248,228,255))
  d.ellipse(((cx-30)*S,(top+6)*S,(cx+30)*S,(top+66)*S),fill=(250,236,204,255))
  place(c,icon,cx,top+34,w=iconw,center=True)
  if label:text(c,label,cx,top+78,13,(90,58,30),shadow=(255,246,226))
def screen(night,opened,out):
  bg=Image.open('src/iphone15pro-%s-07-board.png'%('night' if night else 'day')).convert('RGBA').resize((W+12,H+26)).crop((6,13,W+6,H+13))
  bg=bg.filter(ImageFilter.GaussianBlur(5*S))
  c=Image.alpha_composite(bg,Image.new('RGBA',(W,H),(5,14,26,150) if night else (14,42,46,100)))
  # panel
  p=tint(nine(img('popup/panel_frame_9s.png'),350*S,628*S,212,0.11),night,(0.78,0.78,0.86))
  sh=Image.new('RGBA',(W,H));sh.paste((0,0,0,110),(24*S,134*S,366*S,752*S));c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12*S)))
  c.alpha_composite(p,(20*S,116*S))
  # inner warm vignette light (no flat fill): soft top light
  pl=tint(three(img('popup/title_plank_3s.png'),168*S,52*S,200),night,(0.85,0.85,0.9))
  c.alpha_composite(pl,(111*S,92*S));text(c,'过关啦',195,99,22,(90,58,30),shadow=(255,250,236),spacing=4)
  st=img('popup/star_full.png')
  for cx,w in((128,54),(195,68),(262,54)):place(c,st,cx,192 if w<60 else 186,w=w,center=True)
  text(c,'1130 分',195,224,38,(74,50,32),shadow=(255,248,230))
  ch=Image.open('chest/chest_v3_%d.png'%(12 if opened else 0)).convert('RGBA')
  if opened:
    rays=img('popup/fx_rays.png');glow(c,195,440,78,(255,214,120),150)
    place(c,rays,195,430,w=300,center=True)
  else: glow(c,195,492,74,(255,222,140),120 if not night else 150)
  
  if opened: place(c,ch,205,462,w=240,center=True)
  else: place(c,ch,203,476,w=220,center=True)
  if opened:
    for cx,ic,n in((119,'r2/tool_tidenet.png',1),(195,'board/tool_windbell.png',2),(271,'r2/icon_charm.png',1)):
      reward(c,cx,300,img(ic),'',night,iconw=54)
      if n>1:
        d=ImageDraw.Draw(c);bx,by=cx+24,300+8
        d.ellipse(((bx-12)*S,(by-12+2)*S,(bx+12)*S,(by+12+2)*S),fill=(176,92,30));d.ellipse(((bx-12)*S,(by-12)*S,(bx+12)*S,(by+12)*S),fill=(232,128,52));d.ellipse(((bx-12)*S,(by-12)*S,(bx+12)*S,(by+12)*S),outline=(255,248,228),width=2*S)
        text(c,'×%d'%n if False else str(n),bx,by-10,14,(255,255,255))
  for x,k,lab,col in((46,'primary','下一关',(255,255,255)),(203,'secondary','回小岛',(74,60,40))):
    b=tint(three(img('popup/btn_%s_3s.png'%k),141*S,62*S,170),night,(0.85,0.85,0.92))
    c.alpha_composite(b,(x*S,662*S));text(c,lab,x+70.5,676,20,col,shadow=(30,70,72) if k=='primary' else (255,255,255))
  c.convert('RGB').save(out)
for n in(0,1):
  for o in(0,1):screen(n,o,'result_%s_%s.png'%('night' if n else 'day','open' if o else 'closed'))

def annot(src,out,night,opened):
  c=Image.open(src).convert('RGBA');o=Image.new('RGBA',c.size);d=ImageDraw.Draw(o);f=ImageFont.truetype(FB,10*S,index=2);M=(224,32,122,255);B=(32,160,224,255)
  def box(x,y,w,h,col=M):d.rectangle((x*S,y*S,(x+w)*S,(y+h)*S),outline=col,width=2)
  def t(x,y,s):
    for i,l in enumerate(s.split('\n')):
      tw=d.textlength(l,font=f);d.rectangle((x*S-2,(y+i*12)*S,x*S+tw+2,(y+i*12+12)*S),fill=(255,255,255,210));d.text((x*S,(y+i*12)*S),l,font=f,fill=M)
  box(0,0,390,47,B);box(0,810,390,34,B);t(4,814,'安全区 bottom 34');t(4,34,'安全区 top 47')
  box(20,116,350,628);t(22,746,'Panel 350×628 @(20,116) panel_frame_9s')
  box(111,92,168,52);t(282,100,'TitlePlank 168×52 · 22pt')
  t(2,160,'Stars 54/68/54');t(2,232,'Score 38pt #4A3220')
  box(85,366,220,220);t(296,600 if not opened else 560,'Chest 热区\n220×220 中心(195,476)')
  if opened: box(85,300,220,76);t(2,330,'Rewards 仅图标 68\n间距76 顶y300\n数量>1 角标Ø24')
  box(46,662,141,62);box(203,662,141,62);t(46,726,'141×62(含底厚6) · 间距16 · y662')
  t(8,52,('夜间' if night else '白天')+' · '+('打开后' if opened else '点击前')+' · 390×844')
  c.alpha_composite(o);c.convert('RGB').save(out)
for n in('day','night'):
  for o in('closed','open'):annot('result_%s_%s.png'%(n,o),'result_%s_%s_annot.png'%(n,o),n=='night',o=='open')
