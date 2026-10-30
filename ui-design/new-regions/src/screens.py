# 新地区 UI 设计稿绘制：旅程册（6 地区）、地区页入口、结局 6 印章
import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from render import *
ARTD=os.path.join(OUT,'art')
REG=[dict(id='tide',name='潮汐小径',n=4,col='#5FA8C8'),dict(id='meadow',name='花粉草甸',n=4,col='#7DB55A'),dict(id='sky',name='天空回声',n=4,col='#8E9FD6'),
     dict(id='lake',name='风铃湖畔',n=6,col='#E09A5A'),dict(id='coast',name='海岸',n=9,col='#E2B25A'),dict(id='snow',name='雪山隘口',n=6,col='#7F98CC',nodata=True)]
# 分母与分段只取「已有关卡数据」的地区（雪山无数据 → 27；有数据后自动 33）
DATA=[r for r in REG if not r.get('nodata')]
TOTAL=sum(r['n'] for r in DATA)
DESC={'coast':'沿着海滩捡贝壳，一步步走向灯塔。','snow':'踩着新雪，去山口听风铃。'}
def art(name):
  for p in (os.path.join(HERE,name+'.png'),os.path.join(ARTD,name+'.png'),os.path.join(HERE,name+'_ref.png')):
    if os.path.exists(p): return p
def sealp(rid,state): return art('reward_seal_blank') if state in('far','locked_seal') else art('reward_seal_'+rid)
def img(cv,path,cx,cy,w,h,gray=False,alpha=1.0):
  im=Image.open(path).convert('RGBA').resize((cv.P(w),cv.P(h)),Image.LANCZOS)
  if gray:
    g=im.convert('LA').convert('RGBA'); g.putalpha(im.getchannel('A')); im=Image.blend(g,Image.new('RGBA',im.size,(240,228,204,0)),0.0); im=Image.blend(im,Image.new('RGBA',im.size,(232,220,196,255)),0.35); im.putalpha(g.getchannel('A'))
  if alpha<1: im.putalpha(im.getchannel('A').point(lambda v:int(v*alpha)))
  l=cv.layer(); l.alpha_composite(im,(cv.P(cx-w/2),cv.P(cy-h/2))); cv.comp(l)
def close_btn(cv,bx,by,d=34):
  l=cv.layer(); q=ImageDraw.Draw(l); r=d/2
  q.ellipse([cv.P(bx-r),cv.P(by-r+2.5),cv.P(bx+r),cv.P(by+r+2.5)],fill=hx(C['ivoryBase'])); q.ellipse([cv.P(bx-r),cv.P(by-r),cv.P(bx+r),cv.P(by+r)],fill=hx(C['cream']))
  for s1 in(1,-1): q.line([cv.P(bx-6.5),cv.P(by-6.5*s1),cv.P(bx+6.5),cv.P(by+6.5*s1)],fill=hx(C['brown']),width=cv.P(2.6))
  cv.comp(l)
# 进度模型：每地区 done 数 + 状态
def status(prog):
  """prog: dict id->done；规则见 SPEC §3。返回每地区 state ∈ done/progress/open/locked/far"""
  main=prog['tide']+prog['meadow']+prog['sky']; out={}
  for r in REG:
    i=r['id']; d=prog.get(i,0)
    if i in('tide','meadow','sky'):
      idx=['tide','meadow','sky'].index(i); opened = main>=idx*4
      out[i]='done' if d>=r['n'] else ('progress' if opened and d>0 else ('open' if opened else ('locked' if main>=(idx-1)*4 else 'far')))
    elif i in('lake','coast'):
      out[i]='done' if d>=r['n'] else ('progress' if main>=12 and d>0 else ('open' if main>=12 else ('locked' if main>=8 else 'far')))
    else:
      lk=False if r.get('nodata') else prog.get('lake',0)>=6; out[i]='done' if d>=r['n'] else ('progress' if lk and d>0 else ('open' if lk else ('locked' if main>=12 else 'far')))
  return out
EXAMPLE={'tide':4,'meadow':4,'sky':4,'lake':2,'coast':0,'snow':0}
def bar(cv,x,y,w,h,prog,fill_k=1.0):
  l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,x,y+1,w,h,h/2,hx('#CDB990')); cv.rr(d,x,y,w,h,h/2,hx('#E6D7B8'))
  cv.comp(l)
  # 分段：按关卡数比例；段间 2pt 缝；已完成部分用地区色
  gap=2; ux=(w-gap*(len(DATA)-1))/TOTAL; cx=x; budget=sum(prog.values())*fill_k
  m=Image.new('L',cv.im.size,0); ImageDraw.Draw(m).rounded_rectangle([cv.P(x),cv.P(y),cv.P(x+w),cv.P(y+h)],radius=cv.P(h/2),fill=255)
  l=cv.layer(); d=ImageDraw.Draw(l)
  for r in DATA:
    sw=ux*r['n']; dn=min(prog.get(r['id'],0),r['n']); take=max(0,min(dn,budget)); budget-=dn
    if take>0: d.rectangle([cv.P(cx),cv.P(y),cv.P(cx+sw*take/r['n']),cv.P(y+h)],fill=hx(r['col']))
    cx+=sw
    if r is not DATA[-1]: d.rectangle([cv.P(cx),cv.P(y-1),cv.P(cx+gap),cv.P(y+h+1)],fill=hx(C['face']))
    cx+=gap
  l.putalpha(Image.composite(l.getchannel('A'),Image.new('L',l.size,0),m)); cv.comp(l)
def journey(W=390,H=844,K=4,prog=None,p=1.0,closing=False,focus='lake',pressRow=None,bar_k=1.0,stagger_t=None):
  prog=prog or EXAMPLE; st=status(prog); compact=H<700
  cv=Cv(W,H,K,island_bg(W,H)); e,a,scale=popup_k(p,closing); shade(cv,a)
  pw=min(330,W-40); rowH=44 if compact else 50; fH=92 if compact else 112
  ph=122+fH+16+5*rowH+20; x=(W-pw)/2; y=(H-ph)/2-6
  panel(cv,x,y,pw,ph,alpha=a,scale=scale)
  if a<=0.01: return cv
  sub=Cv(W,H,K); l=sub.layer(); d=ImageDraw.Draw(l)
  sub.text(d,W/2,y+36,'旅程册',22,hx(C['brown']),spacing=6)
  done=sum(prog.get(r['id'],0) for r in DATA); sub.text(d,W/2,y+78,f'旅程  {round(done*bar_k)} / {TOTAL}',15,hx(C['ink']),spacing=1); sub.comp(l)
  ix=x+24; iw=pw-48; bar(sub,ix,y+96,iw,10,prog,bar_k)
  close_btn(sub,x+pw-24,y+24)
  def rowalpha(i):
    if stagger_t is None: return 1.0,0
    t=max(0,min(1,(stagger_t-i*0.03)/0.2)); k=ease('outCubic',t); return k,(1-k)*4
  # 焦点卡：当前地区
  fr=next(r for r in REG if r['id']==focus); fy=y+122; ra,dy=rowalpha(0)
  card=Cv(W,H,K); l=card.layer(); d=ImageDraw.Draw(l); card.rr(d,ix,fy+3+dy,iw,fH,16,hx('#D9BF8C')); card.rr(d,ix,fy+dy,iw,fH,16,hx('#FFF6E2')); card.comp(l)
  ww=120 if not compact else 96; wh=ww*136/208
  img(card,art('region_'+fr['id']),ix+12+ww/2,fy+fH/2+dy,ww,wh)
  img(card,sealp(fr['id'],'x'),ix+14,fy+14+dy,30,30*128/115)
  l=card.layer(); d=ImageDraw.Draw(l); tx=ix+12+ww+14
  card.text(d,tx,fy+fH/2-18+dy,fr['name'],18,hx(C['brown']),anchor='lm',spacing=1)
  card.text(d,tx,fy+fH/2+10+dy,f"{prog[fr['id']]} / {fr['n']} 关",14,hx(C['ink']),bold=False,anchor='lm')
  card.text(d,tx,fy+fH/2+32+dy,'继续 ›',14,hx(C['teal']),anchor='lm'); card.comp(l)
  sub.comp(card.im,ra)
  # 其余地区紧凑行
  others=[r for r in REG if r['id']!=focus]; ry0=fy+fH+16
  for i,r in enumerate(others):
    s=st[r['id']]; ry=ry0+i*rowH+rowH/2; ra,dy=rowalpha(i+1); row=Cv(W,H,K); ry+=dy
    if pressRow==i: l=row.layer(); d=ImageDraw.Draw(l); row.rr(d,ix-4,ry-rowH/2+3,iw+8,rowH-6,12,hx('#E9D6AE',170)); row.comp(l)
    sd=32 if not compact else 28
    img(row,sealp(r['id'],'far' if s=='far' else 'x'),ix+18,ry,sd,sd*128/115,gray=(s=='locked'))
    l=row.layer(); d=ImageDraw.Draw(l); tx=ix+44
    name=r['name'] if s!='far' else '远方'
    row.text(d,tx,ry,name,16,hx(C['brown'] if s not in('locked','far') else C['brown2']),anchor='lm',spacing=1)
    rx=ix+iw
    if s=='done':
      row.text(d,rx-24,ry,f"{r['n']}/{r['n']}",14,hx(C['ink']),bold=False,anchor='rm')
      d.ellipse([row.P(rx-18),row.P(ry-9),row.P(rx),row.P(ry+9)],fill=hx(C['teal'])); d.line([row.P(rx-13),row.P(ry),row.P(rx-9.5),row.P(ry+4)],fill=hx(C['cream']),width=row.P(2.2)); d.line([row.P(rx-9.5),row.P(ry+4),row.P(rx-4),row.P(ry-4)],fill=hx(C['cream']),width=row.P(2.2))
    elif s=='progress': row.text(d,rx,ry,f"{prog[r['id']]}/{r['n']}  ›",14,hx(C['teal']),anchor='rm')
    elif s=='open':
      row.text(d,rx,ry,'可前往  ›',14,hx(C['teal']),anchor='rm'); d.ellipse([row.P(tx+row_w(d,row,name)+4),row.P(ry-9),row.P(tx+row_w(d,row,name)+11),row.P(ry-2)],fill=hx('#E2553A'))
    elif s=='locked':
      cond={'coast':'主线 12 后开启','lake':'主线 12 后开启','snow':'湖畔通关后开启'}.get(r['id']) or '主线 %02d 后开启'%(['tide','meadow','sky'].index(r['id'])*4)
      row.text(d,rx,ry,cond,13,hx(C['brown2']),bold=False,anchor='rm')
    else: row.text(d,rx,ry,'继续旅行后揭晓',13,hx(C['brown2']),bold=False,anchor='rm')
    row.comp(l); sub.comp(row.im,ra)
    if i<len(others)-1:
      l=sub.layer(); d=ImageDraw.Draw(l); yy=ry-dy+rowH/2
      for xx in range(int(ix+44),int(ix+iw),10): d.line([sub.P(xx),sub.P(yy),sub.P(xx+5),sub.P(yy)],fill=hx('#E3CFA6'),width=sub.P(1))
      sub.comp(l)
  cv.comp(scaled(sub,sub.im,scale,W/2,y+ph/2),a); return cv
def row_w(d,cv,txt): return d.textlength(txt,font=cv.font(16))/cv.K+len(txt)*1
# 地区页（入口按钮）
def chapter(W=390,H=844,K=4,rid='coast',state='open',p=1.0,closing=False,pressed=False):
  r=next(x for x in REG if x['id']==rid); cv=Cv(W,H,K,island_bg(W,H)); e,a,scale=popup_k(p,closing); shade(cv,a)
  pw=min(330,W-40); ph=430; x=(W-pw)/2; y=(H-ph)/2-6; panel(cv,x,y,pw,ph,alpha=a,scale=scale)
  sub=Cv(W,H,K); l=sub.layer(); d=ImageDraw.Draw(l); sub.text(d,W/2,y+36,r['name'],22,hx(C['brown']),spacing=6); sub.comp(l); close_btn(sub,x+pw-24,y+24)
  ww=pw-64; wh=ww*136/208; img(sub,art('region_'+rid),W/2,y+70+wh/2,ww,wh,gray=(state=='locked'))
  img(sub,sealp(rid,'x'),x+44,y+76,40,40*128/115,gray=(state=='locked'))
  if state=='locked': img(sub,art('icon_lock'),W/2,y+70+wh/2,34,40)
  l=sub.layer(); d=ImageDraw.Draw(l); ty=y+70+wh+26
  sub.text(d,W/2,ty,DESC.get(rid,''),15,hx(C['ink']),bold=False)
  sub.text(d,W/2,ty+30,{'open':f"共 {r['n']} 关",'progress':f"{EXAMPLE.get(rid,3) or 3} / {r['n']} 关",'done':f"{r['n']} / {r['n']} 关 · 印记已得",'locked':'通关主线 12 后开启' if rid=='coast' else '通关风铃湖畔后开启'}[state],14,hx(C['brown2'] if state=='locked' else C['teal']),bold=state!='locked')
  sub.comp(l)
  by=y+ph-52; label={'open':'前往'+r['name'][:2],'progress':'继续','done':'再访'+r['name'][:2],'locked':'尚未开启'}[state]
  if state=='locked':
    l=sub.layer(); d=ImageDraw.Draw(l); sub.rr(d,W/2-120,by-26+3,240,52,20,hx('#CDB990')); sub.rr(d,W/2-120,by-26,240,52,20,hx('#E6D7B8')); sub.text(d,W/2,by-2,label,17,hx(C['brown2']),spacing=2); sub.comp(l)
  else: warm_button(sub,W/2,by,240,52,label,'primary',pressed=pressed)
  cv.comp(scaled(sub,sub.im,scale,W/2,y+ph/2),a); return cv
# 结局：6 印章
ENDING=os.path.join(HERE,'ending_day.png')
def ending(W=390,H=844,K=4,earned=('tide','meadow','sky','lake','coast'),t=None,old=False):
  base=Image.open(ENDING).convert('RGBA'); cv=Cv(W,H,K,base)
  if old: return cv
  # 抹掉旧 4 印章带：用带上下行的模糊填充（示意合成）
  y0,y1=500,546; band=base.crop((0,int(y0*2)-40,780,int(y1*2)+40)).filter(ImageFilter.GaussianBlur(18)).resize((cv.P(W),cv.P(y1-y0)+cv.P(40/2)*2))
  m=Image.new('L',band.size,0); ImageDraw.Draw(m).rounded_rectangle([cv.P(40),cv.P(4),band.width-cv.P(40),band.height-cv.P(4)],radius=cv.P(20),fill=255); m=m.filter(ImageFilter.GaussianBlur(cv.P(6)))
  cv.im.paste(band,(0,cv.P(y0)-cv.P(20)),m)
  sc=523; n=6; sp=48; d0=40
  for i,r in enumerate(REG):
    cx=W/2+(i-(n-1)/2)*sp; cy=sc+abs(i-(n-1)/2)**2*1.2   # 轻弧：两端下垂 ≈7pt
    k=1.0; dy=0
    if t is not None:
      tt=max(0,min(1,(t-i*0.08)/0.24)); k=tt; dy=(1-ease('outCubic',tt))*-10
      if tt<=0: continue
    got=r['id'] in earned
    sz=d0*(0.9+0.1*ease('outCubic',k)) if t is not None else d0
    img(cv,sealp(r['id'],'x' if got else 'far'),cx,cy+dy,sz,sz*128/115,alpha=(k if got else 0.85*k))
  return cv
