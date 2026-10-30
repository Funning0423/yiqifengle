# 9 区域方案：A 紧凑列表 / B 分组折叠 / C 印章格（推荐）；结局 9 印章
import os,sys,shutil,subprocess; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import screens as S0
from screens import *
NOUT=os.path.join(OUT,'nine'); os.makedirs(NOUT,exist_ok=True)
R9=[dict(id='tide',name='潮汐小径',short='潮汐小径',n=4,col='#5FA8C8'),dict(id='meadow',name='花粉草甸',short='花粉草甸',n=4,col='#7DB55A'),
    dict(id='sky',name='天空之城',short='天空之城',sub='天空回声',n=4,col='#8E9FD6'),dict(id='lake',name='风铃湖畔',short='风铃湖畔',n=6,col='#E09A5A'),
    dict(id='coast',name='星光灯塔海岸',short='灯塔海岸',n=9,col='#E2B25A'),dict(id='snow',name='雪山风铃山口',short='雪山山口',n=6,col='#7F98CC'),
    dict(id='rail',name='秋日铁路',short='秋日铁路',n=6,col='#C9773A'),dict(id='cloud',name='黎明云海',short='黎明云海',n=8,col='#E8A0A8'),dict(id='spring',name='温泉谷',short='温泉谷',n=8,col='#6FB8A8')]
# 示例：主线 12、湖畔 6 全通；海岸 3/9；雪山已开 0/6；铁路/云海/温泉谷 开启条件待定 → 远方
EX={'tide':4,'meadow':4,'sky':4,'lake':6,'coast':3,'snow':0,'rail':0,'cloud':0,'spring':0}
ST={'tide':'done','meadow':'done','sky':'done','lake':'done','coast':'progress','snow':'open','rail':'far','cloud':'far','spring':'far'}
DATA_ALL=True  # 方案图按 9 区全部有数据画分段（最坏情况：55 关、9 段）
def seal_of(rid,s): 
  p=art('reward_seal_'+rid) if s not in('far',) else None
  return p if p else art('reward_seal_blank')
def bar9(cv,x,y,w,h,regs,prog):
  l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,x,y+1,w,h,h/2,hx('#CDB990')); cv.rr(d,x,y,w,h,h/2,hx('#E6D7B8')); cv.comp(l)
  tot=sum(r['n'] for r in regs); gap=2; ux=(w-gap*(len(regs)-1))/tot; cx=x
  m=Image.new('L',cv.im.size,0); ImageDraw.Draw(m).rounded_rectangle([cv.P(x),cv.P(y),cv.P(x+w),cv.P(y+h)],radius=cv.P(h/2),fill=255)
  l=cv.layer(); d=ImageDraw.Draw(l); minw=9e9
  for i,r in enumerate(regs):
    sw=ux*r['n']; minw=min(minw,sw); dn=prog.get(r['id'],0)
    if dn: d.rectangle([cv.P(cx),cv.P(y),cv.P(cx+sw*dn/r['n']),cv.P(y+h)],fill=hx(r['col']))
    cx+=sw
    if i<len(regs)-1: d.rectangle([cv.P(cx),cv.P(y-1),cv.P(cx+gap),cv.P(y+h+1)],fill=hx(C['face']))
    cx+=gap
  l.putalpha(Image.composite(l.getchannel('A'),Image.new('L',l.size,0),m)); cv.comp(l); return minw
def frame(W,H,K,ph):
  cv=Cv(W,H,K,island_bg(W,H)); shade(cv,1); pw=min(330,W-40); x=(W-pw)/2; y=(H-ph)/2-6; panel(cv,x,y,pw,ph); return cv,x,y,pw
def header(cv,W,x,y,pw,prog):
  l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,W/2,y+36,'旅程册',22,hx(C['brown']),spacing=6)
  tot=sum(r['n'] for r in R9); cv.text(d,W/2,y+78,f"旅程  {sum(prog.values())} / {tot}",15,hx(C['ink']),spacing=1); cv.comp(l)
  S0.close_btn(cv,x+pw-24,y+24); return bar9(cv,x+24,y+96,pw-48,10,R9,prog)
def focus(cv,x,y,pw,fH,r,prog):
  ix=x+24; iw=pw-48; fy=y+122; l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,ix,fy+3,iw,fH,16,hx('#D9BF8C')); cv.rr(d,ix,fy,iw,fH,16,hx('#FFF6E2')); cv.comp(l)
  ww=96 if fH<100 else 120; wh=ww*136/208; img(cv,art('region_'+r['id']),ix+12+ww/2,fy+fH/2,ww,wh); img(cv,seal_of(r['id'],'x'),ix+14,fy+14,28,31)
  l=cv.layer(); d=ImageDraw.Draw(l); tx=ix+12+ww+12
  cv.text(d,tx,fy+fH/2-18,r['name'],17 if len(r['name'])>4 else 18,hx(C['brown']),anchor='lm',spacing=0.5)
  if r.get('sub'): cv.text(d,tx,fy+fH/2+2,'章节 · '+r['sub'],12,hx(C['brown2']),bold=False,anchor='lm')
  cv.text(d,tx,fy+fH/2+(20 if r.get('sub') else 8),f"{prog[r['id']]} / {r['n']} 关",13,hx(C['ink']),bold=False,anchor='lm')
  cv.text(d,tx,fy+fH/2+(38 if r.get('sub') else 30),'继续 ›',14,hx(C['teal']),anchor='lm'); cv.comp(l); return fy+fH
def status_txt(r,s,prog):
  return {'done':(f"{r['n']}/{r['n']}",'ink'),'progress':(f"{prog[r['id']]}/{r['n']} ›",'teal'),'open':('可前往 ›','teal'),'locked':('未开启','brown2'),'far':('继续旅行后揭晓','brown2')}[s]
def row(cv,ix,iw,ry,rowH,r,s,prog,label=None,seals=None):
  if seals:
    for k,rid in enumerate(seals): img(cv,seal_of(rid,'x'),ix+14+k*14,ry,26,29)
    tx=ix+14+len(seals)*14+22
  else: img(cv,seal_of(r['id'] if r else 'blank',s),ix+16,ry,28,31,gray=(s=='locked')); tx=ix+40
  l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,tx,ry,label or (r['short'] if s!='far' else '远方'),15,hx(C['brown'] if s not in('far','locked') else C['brown2']),anchor='lm',spacing=0.5)
  t,c=status_txt(r,s,prog) if r else ('','ink'); 
  if label and label.startswith('已走过'): t,c=('展开 ›','teal')
  if label and label.startswith('远方'): t,c=('继续旅行后揭晓','brown2')
  cv.text(d,ix+iw,ry,t,13,hx(C[c]),bold=c=='teal',anchor='rm'); cv.comp(l)
def dashed(cv,ix,iw,yy):
  l=cv.layer(); d=ImageDraw.Draw(l)
  for xx in range(int(ix+40),int(ix+iw),10): d.line([cv.P(xx),cv.P(yy),cv.P(xx+5),cv.P(yy)],fill=hx('#E3CFA6'),width=cv.P(1))
  cv.comp(l)
FOCUS='coast'
# A：所有非焦点 8 行，行高 44
def planA(W=390,H=844,K=3,prog=EX):
  compact=H<700; fH=92 if compact else 112; rowH=44; ph=122+fH+16+8*rowH+20
  cv,x,y,pw=frame(W,H,K,ph); minw=header(cv,W,x,y,pw,prog); yb=focus(cv,x,y,pw,fH,next(r for r in R9 if r['id']==FOCUS),prog)+16; ix=x+24; iw=pw-48
  for i,r in enumerate([r for r in R9 if r['id']!=FOCUS]):
    ry=yb+i*rowH+rowH/2; row(cv,ix,iw,ry,rowH,r,ST[r['id']],prog); dashed(cv,ix,iw,ry+rowH/2) if i<7 else None
  return cv,ph,minw
# B：已完成收一行，远方合并一行
def planB(W=390,H=844,K=3,prog=EX):
  compact=H<700; fH=92 if compact else 112; rowH=44 if compact else 50
  done=[r for r in R9 if ST[r['id']]=='done' and r['id']!=FOCUS]; far=[r for r in R9 if ST[r['id']]=='far']; act=[r for r in R9 if r not in done and r not in far and r['id']!=FOCUS]
  rows=([('done',done)] if done else [])+[('one',r) for r in act]+([('far',far)] if far else []); ph=122+fH+16+len(rows)*rowH+20
  cv,x,y,pw=frame(W,H,K,ph); minw=header(cv,W,x,y,pw,prog); yb=focus(cv,x,y,pw,fH,next(r for r in R9 if r['id']==FOCUS),prog)+16; ix=x+24; iw=pw-48
  for i,(k,v) in enumerate(rows):
    ry=yb+i*rowH+rowH/2
    if k=='done': row(cv,ix,iw,ry,rowH,None,'done',prog,label=f'已走过 · {len(v)} 处',seals=[r['id'] for r in v])
    elif k=='far': row(cv,ix,iw,ry,rowH,None,'far',prog,label=f'远方 · {len(v)} 处')
    else: row(cv,ix,iw,ry,rowH,v,ST[v['id']],prog)
    if i<len(rows)-1: dashed(cv,ix,iw,ry+rowH/2)
  return cv,ph,minw
# C：焦点卡 + 3×3 印章格（9 区全在，焦点区在格中描边）
def planC(W=390,H=844,K=3,prog=EX,st=None,pressed=None):
  st=st or ST; compact=H<700; fH=92 if compact else 112; th=64 if compact else 76; gap=8
  ph=122+fH+16+3*th+2*gap+20; cv,x,y,pw=frame(W,H,K,ph); minw=header(cv,W,x,y,pw,prog)
  yb=focus(cv,x,y,pw,fH,next(r for r in R9 if r['id']==FOCUS),prog)+16; ix=x+24; iw=pw-48; tw=(iw-2*gap)/3
  for i,r in enumerate(R9):
    cx=ix+(i%3)*(tw+gap); cy=yb+(i//3)*(th+gap); s=st[r['id']]
    l=cv.layer(); d=ImageDraw.Draw(l)
    fill='#EFE2C4' if pressed==i else ('#FBF3E0' if s!='far' else '#F3E9D2')
    cv.rr(d,cx,cy,tw,th,12,hx(fill))
    if r['id']==FOCUS: d.rounded_rectangle([cv.P(cx),cv.P(cy),cv.P(cx+tw),cv.P(cy+th)],radius=cv.P(12),outline=hx(C['teal']),width=cv.P(2))
    cv.comp(l)
    sd=28 if compact else 32; img(cv,seal_of(r['id'],s),cx+tw/2,cy+(18 if compact else 21),sd,sd*128/115,gray=(s=='locked'),alpha=(0.8 if s=='far' else 1))
    l=cv.layer(); d=ImageDraw.Draw(l); ny=cy+th-(26 if compact else 30)
    cv.text(d,cx+tw/2,ny,r['short'] if s!='far' else '远方',12.5,hx(C['brown'] if s not in('far','locked') else C['brown2']),spacing=0.5)
    t={'done':f"{r['n']}/{r['n']} ✓",'progress':f"{prog[r['id']]}/{r['n']}",'open':'可前往','locked':'未开启','far':'· · ·'}[s]
    cv.text(d,cx+tw/2,ny+(14 if compact else 16),t,11,hx(C['teal'] if s in('progress','open') else (C['ink'] if s=='done' else C['brown2'])),bold=s in('progress','open'))
    if s=='open': d.ellipse([cv.P(cx+tw-14),cv.P(cy+6),cv.P(cx+tw-7),cv.P(cy+13)],fill=hx('#E2553A'))
    cv.comp(l)
  return cv,ph,minw
def ending9(W=390,H=844,K=3,earned=('tide','meadow','sky','lake','coast'),layout='two',t=None):
  base=Image.open(S0.ENDING).convert('RGBA')
  if W!=390: cw=int(780*W/390); base=base.crop(((780-cw)//2,0,(780-cw)//2+cw,1688)).resize((780,1688))
  cv=Cv(W,H,K,base)
  y0,y1=500,546; band=base.crop((0,int(y0*2)-40,780,int(y1*2)+40)).filter(ImageFilter.GaussianBlur(18)).resize((cv.P(W),cv.P(y1-y0)+cv.P(20)*2))
  m=Image.new('L',band.size,0); ImageDraw.Draw(m).rounded_rectangle([cv.P(40),cv.P(4),band.width-cv.P(40),band.height-cv.P(4)],radius=cv.P(20),fill=255); m=m.filter(ImageFilter.GaussianBlur(cv.P(6))); cv.im.paste(band,(0,cv.P(y0)-cv.P(20)),m)
  pos=[]
  if layout=='two':  # 5 + 4，Ø36，间距 44；第二排错半格、下移 40，形成两串风铃
    for i in range(9):
      if i<5: pos.append((W/2+(i-2)*44,516+abs(i-2)**2*1.0,36))
      else: j=i-5; pos.append((W/2+(j-1.5)*44,556+abs(j-1.5)**2*1.0,36))
  elif layout=='one': 
    for i in range(9): pos.append((W/2+(i-4)*31,522+abs(i-4)**2*0.6,28))
  else:
    for i in range(9): a=math.radians(-60+i*15); pos.append((W/2+130*math.sin(a),470+130*(1-math.cos(a))*1.0+40,32))
  for i,(r,(px,py,dd)) in enumerate(zip(R9,pos)):
    got=r['id'] in earned; k=1
    if t is not None:
      k=max(0,min(1,(t-i*0.06)/0.24))
      if k<=0: continue
    img(cv,seal_of(r['id'],'x' if got else 'far'),px,py-(1-ease('outCubic',k))*10,dd,dd*128/115,alpha=(1 if got else 0.6)*k)
  return cv
