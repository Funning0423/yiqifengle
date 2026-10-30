# 生成 system-panels 设计稿的绘制库（PIL）。入口见 build.py / annot.py
import math, json, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.dirname(HERE)
SERIF_B='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'; SERIF_R='/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
BG_ISLAND='/workspace/wechat-game/ui-audit/2026-10-23/b17r12-790d0af/raw/i2_day_02_island.png'
BEFORE_SET='/workspace/wechat-game/ui-audit/2026-10-15/raw/iphone15pro-day-05-settings.png'
BEFORE_HOME='/workspace/wechat-game/ui-audit/2026-10-23/b17r12-790d0af/raw/i2_day_01_home.png'
C=dict(brown='#5A3A1E',brown2='#7A5A3A',ink='#6B4A2E',faint='#A08868',cream='#FFF0CB',face='#F8EDD3',rim='#D9BF8C',rimDark='#B8966A',
       teal='#377F6C',tealBase='#24443C',tealSide='#2E6A5A',ivoryBase='#624B32',ivorySide='#C39A5E',offTrack='#DCCBA8',offTrackIn='#CDB990',knob='#FFF8E6',shade=(16,28,34))
SP=json.load(open(os.path.join(HERE,'params.json')))
def hx(c,a=255):
  if isinstance(c,tuple): return c+(a,) if len(c)==3 else c
  c=c.lstrip('#'); return (int(c[0:2],16),int(c[2:4],16),int(c[4:6],16),a)
def bez(x1,y1,x2,y2,x):
  lo,hi=0.0,1.0
  for _ in range(40):
    m=(lo+hi)/2; xm=3*(1-m)**2*m*x1+3*(1-m)*m*m*x2+m**3
    if xm<x: lo=m
    else: hi=m
  m=(lo+hi)/2; return 3*(1-m)**2*m*y1+3*(1-m)*m*m*y2+m**3
def ease(name,t):
  t=max(0,min(1,t))
  if name=='outCubic': return 1-(1-t)**3
  if name=='inQuad': return t*t
  if name=='emphDecel': return bez(0.05,0.7,0.1,1.0,t)
  if name=='emphAccel': return bez(0.3,0.0,0.8,0.15,t)
  return t
class Cv:
  def __init__(s,W,H,K,bg=None):
    s.W,s.H,s.K=W,H,K; s.im=Image.new('RGBA',(int(W*K),int(H*K)),(0,0,0,0))
    if bg is not None: s.im.alpha_composite(bg.resize(s.im.size,Image.LANCZOS).convert('RGBA'))
  def P(s,v): return int(round(v*s.K))
  def layer(s,rgb=(0,0,0)): return Image.new('RGBA',s.im.size,tuple(rgb)+(0,))
  def comp(s,l,alpha=1.0):
    if alpha<1: l.putalpha(l.getchannel('A').point(lambda v:int(v*alpha)))
    s.im.alpha_composite(l)
  def rr(s,d,x,y,w,h,r,fill): d.rounded_rectangle([s.P(x),s.P(y),s.P(x+w),s.P(y+h)],radius=s.P(r),fill=fill)
  def font(s,size,bold=True): return ImageFont.truetype(SERIF_B if bold else SERIF_R,max(1,s.P(size)),index=2)
  def text(s,d,cx,cy,txt,size,fill,bold=True,anchor='mm',spacing=0):
    f=s.font(size,bold)
    if spacing:
      ws=[d.textlength(ch,font=f) for ch in txt]; tot=sum(ws)+s.P(spacing)*(len(txt)-1); x=s.P(cx)-tot/2 if anchor[0]=='m' else s.P(cx)
      for ch,w in zip(txt,ws): d.text((x,s.P(cy)),ch,font=f,fill=fill,anchor='l'+anchor[1]); x+=w+s.P(spacing)
    else: d.text((s.P(cx),s.P(cy)),txt,font=f,fill=fill,anchor=anchor)
  def out(s,scale=2): return s.im.resize((int(s.W*scale),int(s.H*scale)),Image.LANCZOS)
def panel(cv,x,y,w,h,alpha=1.0,scale=1.0):
  cx,cy=x+w/2,y+h/2; w,h=w*scale,h*scale; x,y=cx-w/2,cy-h/2
  l=cv.layer(); d=ImageDraw.Draw(l)
  sh=cv.layer((40,26,14)); ds=ImageDraw.Draw(sh); cv.rr(ds,x,y+10,w,h,26,(40,26,14,90)); l.alpha_composite(sh.filter(ImageFilter.GaussianBlur(cv.P(14))))
  cv.rr(d,x,y+5,w,h,26,hx(C['rimDark'])); cv.rr(d,x,y,w,h,26,hx(C['rim']))
  cv.rr(d,x+8,y+8,w-16,h-16,19,hx('#E9D6AE')); cv.rr(d,x+9,y+10,w-18,h-19,18,hx(C['face']))
  hl=cv.layer((255,252,240)); dh=ImageDraw.Draw(hl); cv.rr(dh,x+14,y+14,w-28,min(h*0.30,90),16,(255,252,240,45)); l.alpha_composite(hl.filter(ImageFilter.GaussianBlur(cv.P(6))))
  cv.comp(l,alpha)
def warm_button(cv,cx,cy,w,h,label,kind='primary',pressed=False,size=18):
  l=cv.layer(); d=ImageDraw.Draw(l); x,y=cx-w/2,cy-h/2; r=h/2*0.78; drop=3 if pressed else 0
  sh=cv.layer((40,26,14)); ds=ImageDraw.Draw(sh); cv.rr(ds,x+2,y+6,w-4,h,r,(40,26,14,70 if pressed else 110)); l.alpha_composite(sh.filter(ImageFilter.GaussianBlur(cv.P(4))))
  base,side,cap,tc=(C['tealBase'],C['tealSide'],C['teal'],C['cream']) if kind=='primary' else (C['ivoryBase'],C['ivorySide'],C['cream'],C['brown'])
  cv.rr(d,x,y+1,w,h+4,r,hx(base)); cv.rr(d,x+1,y+drop,w-2,h+1-drop,r,hx(side)); cv.rr(d,x+2,y+drop,w-4,h-5,r,hx(cap))
  hl=cv.layer((255,255,255)); dh=ImageDraw.Draw(hl); cv.rr(dh,x+8,y+drop+3,w-16,(h-5)*0.38,r*0.6,(255,255,255,60 if kind=='primary' else 120)); l.alpha_composite(hl.filter(ImageFilter.GaussianBlur(cv.P(1.5))))
  cv.text(d,cx,cy-2.5+drop,label,size,hx(tc),spacing=2); cv.comp(l)
def toggle(cv,cx,cy,state='on',k=None):
  T=SP['settings']['toggle']; tw,th=T['track']; kd=T['knob']
  on=state.startswith('on'); pressed=state.endswith('pressed'); k=(1.0 if on else 0.0) if k is None else k
  l=cv.layer(); d=ImageDraw.Draw(l); x,y=cx-tw/2,cy-th/2
  def mix(a,b,t): a,b=hx(a),hx(b); return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(4))
  top=mix(C['offTrack'],C['teal'],k); inn=mix(C['offTrackIn'],C['tealBase'],k)
  if pressed: top=tuple(int(v*0.92) if i<3 else v for i,v in enumerate(top))
  cv.rr(d,x,y,tw,th,th/2,inn); cv.rr(d,x,y+2,tw,th-2,th/2-1,top)
  kw=kd+(T['press_knob_extra'] if pressed else 0); pad=(th-kd)/2; kx=x+pad+(tw-2*pad-kw)*k
  sh=cv.layer((40,26,14)); ds=ImageDraw.Draw(sh); cv.rr(ds,kx,y+pad+2,kw,kd,kd/2,(40,26,14,110)); l.alpha_composite(sh.filter(ImageFilter.GaussianBlur(cv.P(1.6))))
  cv.rr(d,kx,y+pad,kw,kd,kd/2,hx('#E7D3AC')); cv.rr(d,kx,y+pad-0.5,kw,kd-1.5,kd/2,hx(C['knob'])); cv.comp(l)
def icon(cv,path,cx,cy,h):
  im=Image.open(os.path.join(HERE,path)).convert('RGBA'); s=cv.P(h)/im.height; im=im.resize((max(1,int(im.width*s)),cv.P(h)),Image.LANCZOS)
  l=cv.layer(); l.alpha_composite(im,(cv.P(cx)-im.width//2,cv.P(cy)-im.height//2)); cv.comp(l)
def icon_vibrate(cv,cx,cy,h):
  # 占位图标：美术需补 popup/icon_vibrate.png（同 icon_sfx 风格）
  l=cv.layer(); d=ImageDraw.Draw(l); w=h*0.52; x,y=cx-w/2,cy-h*0.42
  cv.rr(d,x,y+1.5,w,h*0.84,5,hx('#8A5A32')); cv.rr(d,x,y,w,h*0.84,5,hx('#C9773A')); cv.rr(d,x+3,y+4,w-6,h*0.84-10,2.5,hx('#FFF0CB'))
  for sgn in(-1,1):
    for i,rad in enumerate((h*0.42,h*0.58)):
      bx=cx+sgn*rad*0.62; d.arc([cv.P(bx-4),cv.P(cy-6-i*2),cv.P(bx+4),cv.P(cy+6+i*2)],start=(-60 if sgn>0 else 120),end=(60 if sgn>0 else 240),fill=hx('#7A5030'),width=cv.P(2))
  cv.comp(l)
_bgc={}
def island_bg(W,H):
  if (W,H) in _bgc: return _bgc[(W,H)]
  im=Image.open(BG_ISLAND).convert('RGBA'); sc=max(W/im.width,H/im.height); im=im.resize((int(im.width*sc)+1,int(im.height*sc)+1),Image.LANCZOS)
  ox,oy=(im.width-W)//2,(im.height-H)//2; _bgc[(W,H)]=im.crop((ox,oy,ox+W,oy+H)); return _bgc[(W,H)]
def shade(cv,a): cv.comp(Image.new('RGBA',cv.im.size,C['shade']+(int(255*SP['motion']['shade_alpha']*a),)))
def popup_k(p,closing):
  e=ease('emphAccel',1-p) if closing else ease('emphDecel',p)
  a=(1-e) if closing else min(1,p*SP['motion']['popupEnter_ms']/SP['motion']['popupEnter_alpha_ms'])
  return e,a,((1-0.04*e) if closing else 0.92+0.08*e)
def scaled(sub,im,scale,cx0,cy0):
  if abs(scale-1)<1e-3: return im
  big=im.resize((int(im.width*scale),int(im.height*scale)),Image.LANCZOS); o=Image.new('RGBA',im.size)
  o.alpha_composite(big,(int(sub.P(cx0)*(1-scale)),int(sub.P(cy0)*(1-scale)))); return o
# ---------- 1 健康游戏忠告 ----------
def advisory(W=390,H=844,K=4,t=None):
  A=SP['advisory']; cv=Cv(W,H,K); g=Image.new('RGBA',(1,256)); a0,b0=hx(A['bgTop']),hx(A['bgBottom'])
  for i in range(256): g.putpixel((0,i),tuple(int(a0[j]+(b0[j]-a0[j])*i/255) for j in range(4)))
  cv.im.alpha_composite(g.resize(cv.im.size))
  l=cv.layer(hx(A['glow'])[:3]); d=ImageDraw.Draw(l); r=W*0.9; cx,cy=W/2,H*0.30
  d.ellipse([cv.P(cx-r),cv.P(cy-r),cv.P(cx+r),cv.P(cy+r)],fill=hx(A['glow'],110)); cv.comp(l.filter(ImageFilter.GaussianBlur(cv.P(70))))
  l=cv.layer(); d=ImageDraw.Draw(l)
  p1=[(0,H*0.83),(W*0.18,H*0.79),(W*0.36,H*0.815),(W*0.58,H*0.775),(W*0.8,H*0.805),(W,H*0.785),(W,H),(0,H)]
  p2=[(0,H*0.875),(W*0.25,H*0.85),(W*0.5,H*0.872),(W*0.74,H*0.846),(W,H*0.868),(W,H),(0,H)]
  d.polygon([(cv.P(a),cv.P(b)) for a,b in p1],fill=hx(A['hill1']))
  for i in range(len(p1)-3):
    a,b=p1[i],p1[i+1]; d.polygon([(cv.P(a[0]),cv.P(a[1])),(cv.P(b[0]),cv.P(b[1])),(cv.P((a[0]+b[0])/2),cv.P(H*0.86))],fill=hx(A['hill1f']))
  d.polygon([(cv.P(a),cv.P(b)) for a,b in p2],fill=hx(A['hill2'])); cv.comp(l)
  tA=1.0; rise=0
  if t is not None:
    fi,fo,T=A['fadeIn_ms']/1000,A['fadeOut_ms']/1000,A['total_ms']/1000
    tA=ease('outCubic',t/fi) if t<fi else (1-ease('inQuad',(t-(T-fo))/fo) if t>T-fo else 1); rise=(1-ease('outCubic',min(1,t/fi)))*A['rise_pt']
  l=cv.layer(); d=ImageDraw.Draw(l); y0=A['titleY']+rise
  cv.text(d,W/2,y0,'健康游戏忠告',A['titleSize'],hx(C['brown']),spacing=A['titleTracking'])
  d.line([cv.P(W/2-A['ruleW']/2),cv.P(y0+A['ruleGap']),cv.P(W/2+A['ruleW']/2),cv.P(y0+A['ruleGap'])],fill=hx(C['rim']),width=max(1,cv.P(1.5)))
  d.ellipse([cv.P(W/2-3),cv.P(y0+A['ruleGap']-3),cv.P(W/2+3),cv.P(y0+A['ruleGap']+3)],fill=hx(C['ivorySide']))
  for i,line in enumerate(A['lines']): cv.text(d,W/2,y0+A['firstLineDy']+i*A['lineH'],line,A['bodySize'],hx(C['ink']),bold=False,spacing=A['bodyTracking'])
  fy=H-A['footBottom']
  for i,line in enumerate(A['footer']): cv.text(d,W/2,fy+i*A['footLineH'],line,A['footSize'],hx(C['ink']),bold=False)
  cv.comp(l,tA)
  if t is not None and A['skipAfter_ms']/1000<=t<(A['total_ms']-A['fadeOut_ms'])/1000:
    l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,W/2,H-A['hintBottom'],'轻点继续',12,hx(C['ink'],int(255*min(1,(t-A['skipAfter_ms']/1000)/0.3)*0.8)),bold=False); cv.comp(l)
  return cv
# ---------- 2 设置 ----------
def settings(W=390,H=844,K=4,p=1.0,closing=False,states=None,pressRow=None):
  S=SP['settings']; cv=Cv(W,H,K,island_bg(W,H)); e,a,scale=popup_k(p,closing)
  shade(cv,a); pw=min(S['w'],W-2*S['minMargin']); ph=S['h']; x=(W-pw)/2; y=(H-ph)/2+S['dy']
  panel(cv,x,y,pw,ph,alpha=a,scale=scale)
  if a<=0.01: return cv
  sub=Cv(W,H,K); l=sub.layer(); d=ImageDraw.Draw(l); sub.text(d,W/2,y+S['titleY'],'设置',S['titleSize'],hx(C['brown']),spacing=6); sub.comp(l)
  st=states or {'music':'on','sfx':'on','vibrate':'on','night':'off','motion':'off'}
  for i,r in enumerate(S['rows']):
    ry=y+S['firstRowY']+i*S['rowH']+(S['groupGap'] if i>=3 else 0)
    if i==3:
      l=sub.layer(); d=ImageDraw.Draw(l); dy_=ry-S['rowH']/2-S['groupGap']/2
      for xx in range(int(x+40),int(x+pw-40),12): d.line([sub.P(xx),sub.P(dy_),sub.P(xx+6),sub.P(dy_)],fill=hx(C['rim']),width=sub.P(1.5))
      sub.comp(l)
    if pressRow==i: l=sub.layer(); d=ImageDraw.Draw(l); sub.rr(d,x+20,ry-S['rowH']/2+3,pw-40,S['rowH']-6,14,hx('#E9D6AE',150)); sub.comp(l)
    icon(sub,'icon_'+r['icon']+'.png',x+S['iconX'],ry,S['iconH'])
    l=sub.layer(); d=ImageDraw.Draw(l); sub.text(d,x+S['labelX'],ry,r['label'],S['labelSize'],hx(C['brown']),anchor='lm',spacing=1); sub.comp(l)
    toggle(sub,x+pw-S['toggleRight']-S['toggle']['track'][0]/2,ry,st[r['key']])
  l=sub.layer(); d=ImageDraw.Draw(l); sub.text(d,W/2,y+ph-S['footBottom'],'关于《咦，起风了》  ·  v0.1 ›',S['footSize'],hx(C['brown2']),bold=False)
  bx,by=x+pw-S['closeInset'],y+S['closeInset']; q_=S['closeD']/2
  d.ellipse([sub.P(bx-q_),sub.P(by-q_+2.5),sub.P(bx+q_),sub.P(by+q_+2.5)],fill=hx(C['ivoryBase'])); d.ellipse([sub.P(bx-q_),sub.P(by-q_),sub.P(bx+q_),sub.P(by+q_)],fill=hx(C['cream']))
  for s1 in(1,-1): d.line([sub.P(bx-6.5),sub.P(by-6.5*s1),sub.P(bx+6.5),sub.P(by+6.5*s1)],fill=hx(C['brown']),width=sub.P(2.6))
  sub.comp(l); cv.comp(scaled(sub,sub.im,scale,W/2,y+ph/2),a); return cv
# ---------- 3 版本更新 ----------
def update(W=390,H=844,K=4,p=1.0,closing=False,pressed=False):
  U=SP['update']; cv=Cv(W,H,K,island_bg(W,H)); e,a,scale=popup_k(p,closing)
  shade(cv,a); pw=min(U['w'],W-2*U['minMargin']); ph=U['h']; x=(W-pw)/2; y=(H-ph)/2+U['dy']
  panel(cv,x,y,pw,ph,alpha=a,scale=scale)
  if a<=0.01: return cv
  sub=Cv(W,H,K); l=sub.layer(); d=ImageDraw.Draw(l); gx,gy=W/2,y+U['emblemY']
  gl=sub.layer((255,220,140)); dg=ImageDraw.Draw(gl); R=U['emblemGlow']; dg.ellipse([sub.P(gx-R),sub.P(gy-R),sub.P(gx+R),sub.P(gy+R)],fill=hx('#FFDC8C',150)); l.alpha_composite(gl.filter(ImageFilter.GaussianBlur(sub.P(12))))
  for i,c in enumerate(['#E88034','#377F6C','#F2B544','#C9773A']):
    ang=math.radians(i*90+20); L=U['emblemR']; a1=ang+math.radians(52)
    d.polygon([(sub.P(gx),sub.P(gy)),(sub.P(gx+L*math.cos(ang)),sub.P(gy+L*math.sin(ang))),(sub.P(gx+L*0.62*math.cos(a1)),sub.P(gy+L*0.62*math.sin(a1)))],fill=hx(c))
  d.ellipse([sub.P(gx-4),sub.P(gy-4),sub.P(gx+4),sub.P(gy+4)],fill=hx(C['cream']))
  sub.text(d,W/2,y+U['titleY'],U['title'],U['titleSize'],hx(C['brown']),spacing=2); sub.text(d,W/2,y+U['bodyY'],U['body'],U['bodySize'],hx(C['ink']),bold=False); sub.comp(l)
  warm_button(sub,W/2,y+U['btnY'],min(U['btnW'],pw-48),U['btnH'],U['btn'],'primary',pressed=pressed)
  l=sub.layer(); d=ImageDraw.Draw(l); sub.text(d,W/2,y+U['laterY'],U['later'],U['laterSize'],hx(C['brown2']),bold=False); sub.comp(l)
  cv.comp(scaled(sub,sub.im,scale,W/2,y+ph/2),a); return cv
