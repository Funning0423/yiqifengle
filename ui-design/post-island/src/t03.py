"""T-03 天空城→热气球→风铃湖畔：落地地名木牌 + 第二次起的「跳过」角标。python3 t03.py"""
from kit import *
from transitions import strip,ease
OUT=HERE+'../t03/'
SIZES=[(320,568),(360,780),(375,667),(390,844),(393,852),(414,896),(430,932)]
NK=(0.85,0.85,0.92)
def safe(W,H):
  notch=H/W>1.9;return dict(top=(47 if notch else 20),bot=(34 if notch else 0),right=0,capsule_bottom=(88 if notch else 64))
# ---- 规格 ----
PLANK=dict(w=176,h=54,px=22,gap_below_capsule=24,drop=12,inS=.3,holdS=2.4,outS=.3)
SKIP=dict(w=76,h=32,touch_w=88,touch_h=48,margin=16,bg=(255,246,226),bg_a=.55,fg=(90,58,30),fg_a=.85,font=14,inS=.4,showAfterS=3.0)
def plank_pos(W,H):
  s=safe(W,H);cy=s['capsule_bottom']+PLANK['gap_below_capsule']+PLANK['h']/2;return W/2,cy
def skip_pos(W,H):
  s=safe(W,H);x1=W-s['right']-SKIP['margin']-(SKIP['touch_w']-SKIP['w'])/2;y1=H-s['bot']-SKIP['margin']-(SKIP['touch_h']-SKIP['h'])/2
  return x1-SKIP['w'],y1-SKIP['h'],x1,y1
def skip_badge(a,night=False):
  w,h=SKIP['w']*S,SKIP['h']*S;c=Image.new('RGBA',(w,h));d=ImageDraw.Draw(c)
  bg=SKIP['bg'] if not night else (40,48,76)
  d.rounded_rectangle((0,0,w-1,h-1),radius=h//2,fill=bg+(int(255*SKIP['bg_a']*a),))
  fg=SKIP['fg'] if not night else (255,236,200);f=F(SKIP['font'])
  t='跳过';tw=d.textlength(t,font=f);bb=d.textbbox((0,0),'跳',font=f);y=h/2-(bb[1]+bb[3])/2
  x=(w-tw-10*S)/2;d.text((x,y),t,font=f,fill=fg+(int(255*SKIP['fg_a']*a),))
  cx=x+tw+6*S;cy=h/2  # 双箭头 »
  for o in (0,5*S):d.line([(cx+o,cy-4*S),(cx+o+4*S,cy),(cx+o,cy+4*S)],fill=fg+(int(255*SKIP['fg_a']*a),),width=int(1.6*S))
  return c
def compose(bgp,W,H,plank_t=None,skip_a=0,night=False,annot=False):
  c=cover_bg(bgp,W,H)
  if skip_a>0:
    x0,y0,x1,y1=skip_pos(W,H);c.alpha_composite(skip_badge(skip_a,night),(int(x0*S),int(y0*S)))
  if plank_t is not None:
    P=PLANK;t=plank_t;T=P['inS']+P['holdS']+P['outS']
    if 0<=t<=T:
      a=ease(t/P['inS']) if t<P['inS'] else (1 if t<P['inS']+P['holdS'] else 1-ease((t-P['inS']-P['holdS'])/P['outS']))
      dy=-(1-a)*P['drop'] if t<P['inS']+P['holdS'] else -(1-a)*P['drop']
      p=plank('风铃湖畔',P['w'],P['h'],P['px'],NK if night else None);r,g,b,al=p.split();p.putalpha(al.point(lambda v:int(v*a)))
      cx,cy=plank_pos(W,H);c.alpha_composite(p,(int(cx*S-p.width/2),int((cy+dy)*S-p.height/2)))
  return c
R7_=R7
DAY=[(R7_+'lk13_18.png',None,.35,'飞行 3.0 s 跳过淡入'),
     (R7_+'lk13_21.7.png',None,1,'飞行中 角标常驻'),
     (R7_+'lk13_23.png',None,.5,'触地前 1 s 角标淡出'),
     (R7_+'lk13_30.png',0.15,0,'触地+1.8 s 木牌淡入'),
     (R7_+'lk13_30.png',1.5,0,'停留 2.4 s'),
     (R7_+'lk13_30.png',2.85,0,'+4.65 s 上移淡出')]
NIGHT=[(R7_+'N_lake_10.png',None,1,'夜间飞行：角标'),(R7_+'N_lake_30.png',None,0,'触地'),(R7_+'N_lake_40.png',0.2,0,'篮门开：木牌淡入'),(R7_+'N_lake_40.png',1.5,0,'停留'),(R7_+'N_lake_45.png',None,0,'木牌已收'),(R7_+'N_lake_board.png',None,0,'进棋盘')]
def keyframes():
  for name,seq,night in (('T03_keyframes_day.png',DAY,False),('T03_keyframes_night.png',NIGHT,True)):
    fr=[compose(p,390,844,pt,sa,night) for p,pt,sa,_ in seq];strip('设计：T-03 天空之城→热气球→风铃湖畔（%s）'%('夜间' if night else '白天'),fr,[l for *_,l in seq],OUT+name)
  strip('现状：T-03（同一组截图，无木牌、无跳过）',[cover_bg(p,390,844) for p,*_ in DAY[::2]+[NIGHT[-1]]],['飞行','触地前','落地，无地名','进棋盘'],OUT+'T03_before.png')
def compare():
  a=compose(R7_+'lk13_30.png',390,844,1.5);b=cover_bg(R7_+'lk13_30.png',390,844)
  c=compose(R7_+'lk13_21.7.png',390,844,None,1);d0=cover_bg(R7_+'lk13_21.7.png',390,844)
  s=Image.new('RGB',(16+4*406,844+56),(244,240,232));d=ImageDraw.Draw(s);f=ImageFont.truetype(FB,15,index=2)
  for i,(im,t) in enumerate([(d0,'现状 飞行'),(c,'设计 飞行（第二次起）'),(b,'现状 落地'),(a,'设计 落地')]):
    x=16+i*406;s.paste(im.convert('RGB').resize((390,844),Image.LANCZOS),(x,44));d.text((x,14),t,font=f,fill=(30,90,60) if '设计' in t else (120,40,30))
  s.save(OUT+'T03_compare_before_after.png')
def annot():
  im=compose(R7_+'lk13_30.png',390,844,1.5,1).resize((390,844),Image.LANCZOS)   # 标注图把两者画在一起（实际不会同时出现）
  a=Image.new('RGBA',(390+340,844),(250,247,240,255));a.paste(im,(0,0));d=ImageDraw.Draw(a);f=ImageFont.truetype(FB,12,index=2);M=(214,60,40)
  cx,cy=plank_pos(390,844);pb=(cx-88,cy-27,cx+88,cy+27);x0,y0,x1,y1=skip_pos(390,844);tw,th=SKIP['touch_w'],SKIP['touch_h']
  tb=((x0+x1)/2-tw/2,(y0+y1)/2-th/2,(x0+x1)/2+tw/2,(y0+y1)/2+th/2)
  d.rectangle(pb,outline=M);d.line((pb[2],cy,398,40),fill=M);d.multiline_text((402,32),'地名木牌（与 WindWipe 停留木牌同一规格）\ntitle_plank_3s 176×54，「风铃湖畔」22pt Bold #5A3A1E，字距 3\n奶白投影 #FFFAEC 2pt；夜间乘 NightTint (0.85,0.85,0.92)\n中心 y = 胶囊下沿 + 24 + 27（390×844：%d）\n出现：触地 +1.8 s（篮门打开）\n下落 12pt + 淡入 0.3 s → 停 2.4 s → 上移 12pt 淡出 0.3 s\n不吞触摸，不加面板'%cy,font=f,fill=(50,40,30),spacing=3)
  d.rectangle((x0,y0,x1,y1),outline=M);d.rectangle(tb,outline=(30,120,200));d.line((x0,y0,398,560),fill=M)
  d.multiline_text((402,520),'「跳过」角标（只在第二次及以后观看出现）\n胶囊 76×32，圆角 16；底 #FFF6E2 α55%%（夜 #28304C α55%%）\n「跳过」14pt Bold #5A3A1E α85%% + 双箭头 »（1.6pt 线）\n触控区 88×48（蓝框）≥44pt\n离右边/安全区下沿各 16pt（触控区外沿）\n出现：盖屏揭开、飞行开始后 3.0 s，0.4 s 淡入\n消失：触地前 1 s 淡出；落地后不能跳\n点按：缩到 0.94 再回弹 0.12 s，随后 WindWipe 盖屏\n→ 直接摆到「她已上岸」状态并进 L13 棋盘\n不放文字说明，不弹确认',font=f,fill=(50,40,30),spacing=3)
  a.convert('RGB').save(OUT+'T03_annot.png')
def sizes():
  k=0.62;ths=[];res=[]
  for W,H in SIZES:
    im=compose(R7_+'lk13_30.png',W,H,1.5,1).resize((W,H),Image.LANCZOS);d=ImageDraw.Draw(im);s=safe(W,H)
    cx,cy=plank_pos(W,H);pb=(cx-88,cy-27,cx+88,cy+27);x0,y0,x1,y1=skip_pos(W,H)
    tb=((x0+x1)/2-SKIP['touch_w']/2,(y0+y1)/2-SKIP['touch_h']/2,(x0+x1)/2+SKIP['touch_w']/2,(y0+y1)/2+SKIP['touch_h']/2)
    ok=pb[1]>=s['capsule_bottom']+16 and pb[0]>=16 and W-tb[2]>=16 and H-s['bot']-tb[3]>=16-1e-6 and SKIP['touch_h']>=44
    for b_,col in ((pb,(0,200,90)),(tb,(0,150,255))):d.rectangle(b_,outline=col if ok else (230,30,30),width=2)
    ths.append(im);res.append((W,H,ok,round(W-tb[2]),round(H-s['bot']-tb[3]),round(pb[1]-s['capsule_bottom'])))
  Wt=sum(int(W*k)+16 for W,_ in SIZES)+16;s_=Image.new('RGB',(Wt,int(932*k)+70),(244,240,232));d=ImageDraw.Draw(s_);f=ImageFont.truetype(FB,12,index=2);x=16
  for im,r in zip(ths,res):
    t=im.convert('RGB').resize((int(r[0]*k),int(r[1]*k)),Image.LANCZOS);s_.paste(t,(x,16))
    d.text((x,int(932*k)+22),'%d×%d %s\n角标离右 %d 离底 %d\n木牌离胶囊 %d'%(r[0],r[1],'通过' if r[2] else '不通过',r[3],r[4],r[5]),font=f,fill=(40,40,40));x+=t.width+16
  s_.save(OUT+'T03_7sizes.png');return res
if __name__=='__main__':
  os.makedirs(OUT,exist_ok=True);keyframes();compare();annot();print(sizes())
