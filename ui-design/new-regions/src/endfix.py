# 结局印章修订：去掉模糊底板。方案 P=圆角纸带底板（同「旅程完成」木牌风格）；方案 S=无底板 + 每枚小软投影（推荐）
import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image,ImageDraw,ImageFilter
import endbase
from screens import art, hx
import nine
R9=nine.R9; R6=['tide','meadow','sky','lake','coast','snow']
SC=2  # 输出 @2x
def seal_img(rid,got,d):
  p=art('reward_seal_'+rid) if got else art('reward_seal_blank')
  im=Image.open(p).convert('RGBA'); h=int(d*128/115*SC); return im.resize((int(d*SC),h),Image.LANCZOS)
def put_seal(c,im,cx,cy,shadow=True,alpha=1.0):
  x,y=int(cx*SC-im.width/2),int(cy*SC-im.height/2)
  if shadow:
    a=im.getchannel('A').point(lambda v:int(v*0.42)); sh=Image.new('RGBA',im.size,(44,28,14,0)); sh.putalpha(a)
    pad=12; big=Image.new('RGBA',(im.width+2*pad,im.height+2*pad),(44,28,14,0)); big.alpha_composite(sh,(pad,pad)); big=big.filter(ImageFilter.GaussianBlur(2.2*SC))
    c.alpha_composite(big,(x-pad,y-pad+int(2.5*SC)))
  if alpha<1: im=im.copy(); im.putalpha(im.getchannel('A').point(lambda v:int(v*alpha)))
  c.alpha_composite(im,(x,y))
def paper(c,x0,y0,x1,y1):
  # 圆角纸带：外框 #D9BF8C、底厚 3pt #B8966A、面 #F6EAD0，r14，硬边（4 倍超采样）
  K=4; w,h=int((x1-x0)*SC*K),int((y1-y0)*SC*K)+3*SC*K
  im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im); r=14*SC*K
  d.rounded_rectangle([0,3*SC*K,w-1,h-1],radius=r,fill=hx('#B8966A')); d.rounded_rectangle([0,0,w-1,h-3*SC*K-1],radius=r,fill=hx('#D9BF8C'))
  d.rounded_rectangle([3*SC*K,3*SC*K,w-1-3*SC*K,h-6*SC*K-1],radius=r-3*SC*K,fill=hx('#F6EAD0'))
  im=im.resize((w//K,h//K),Image.LANCZOS); c.alpha_composite(im,(int(x0*SC),int(y0*SC)))
def geo9(H,L):
  """标准：Ø36 间距 44 排距 40，第一排在原 seals_cy；矮屏（H≤600）：Ø30 间距 36 排距 32，第一排上移到木牌下 49pt"""
  if H<=600: return dict(d=30,sp=36,gap=32,y=L['plank_cy']+49)
  return dict(d=36,sp=44,gap=40,y=L['seals_cy'])
def positions9(W,L,cx=None,g=None):
  cx=W/2 if cx is None else cx; y=g['y']; sp=g['sp']; out=[]
  for i in range(9):
    if i<5: out.append((cx+(i-2)*sp,y+abs(i-2)**2*1.0))
    else: j=i-5; out.append((cx+(j-1.5)*sp,y+g['gap']+abs(j-1.5)**2*1.0))
  return out
def ending9(W=390,H=844,mode='S',earned=('tide','meadow','sky','lake','coast'),t=None):
  _,L0=endbase.base(W,H,extra=0); g=geo9(H,L0)
  # 女孩头顶 = 第二排印章下沿 + 8pt（原规则是印章下沿 +12，这里按两排实际下沿推）
  extra=max(0,(g['y']+g['gap']+g['d']*0.56+14)-(L0['seals_cy']+34))
  im,L=endbase.base(W,H,extra=round(extra,1)); c=im.copy(); cx=None
  if mode=='P':
    # 纸带必须避开风铃柱：柱右缘约在 chime_box 左侧 −20pt 处；纸带右移到柱右 10pt 起
    pw=4*g['sp']+g['d']+28; pole_r=L['chime_box'][0]-20; x0=min(max(20,pole_r+10),W-20-pw); x1=x0+pw; cx=(x0+x1)/2
    paper(c,x0,g['y']-g['d']*0.7,x1,g['y']+g['gap']+g['d']*0.75)
  for i,(r,(px,py)) in enumerate(zip(R9,positions9(W,L,cx,g))):
    k=1.0; dy=0
    if t is not None:
      k=max(0,min(1,(t-i*0.06)/0.24)); dy=-(1-(1-(1-k)**3))*10
      if k<=0: continue
    got=r['id'] in earned; put_seal(c,seal_img(r['id'],got,g['d']),px,py+dy,shadow=(mode=='S'),alpha=k)
  return c,L
def ending6(W=390,H=844,earned=('tide','meadow','sky','lake','coast'),t=None):
  im,L=endbase.base(W,H,extra=0); c=im.copy(); n=6
  for i,rid in enumerate(R6):
    k=1.0;dy=0
    if t is not None:
      k=max(0,min(1,(t-i*0.08)/0.24)); dy=-(1-(1-(1-k)**3))*10
      if k<=0: continue
    put_seal(c,seal_img(rid,rid in earned,40),W/2+(i-(n-1)/2)*48,L['seals_cy']+abs(i-(n-1)/2)**2*1.2+dy,alpha=k)
  return c,L
