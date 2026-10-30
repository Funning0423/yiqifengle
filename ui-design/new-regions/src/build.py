import os,sys,shutil,subprocess; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from screens import *
def lab(img,txt,size=26):
  f=ImageFont.truetype(SERIF_B,size,index=2); w,h=img.size; o=Image.new('RGBA',(w,h+size+20),(250,244,232,255)); o.alpha_composite(img,(0,size+20)); ImageDraw.Draw(o).text((w//2,10),txt,font=f,fill=(60,40,20),anchor='mt'); return o
def row(imgs,gap=24):
  H=max(i.height for i in imgs); o=Image.new('RGBA',(sum(i.width for i in imgs)+gap*(len(imgs)+1),H+2*gap),(250,244,232,255)); x=gap
  for i in imgs: o.alpha_composite(i,(x,gap)); x+=i.width+gap
  return o
def save(img,name): img.convert('RGB').save(os.path.join(OUT,name),optimize=True); print(name,img.size,flush=True)
SIZES=[(320,568),(360,780),(375,667),(390,844),(402,874),(414,896),(430,932)]
def old_journey(W=390,H=844,K=4,n=4):
  # 现状示意：按 IslandPanels.openJourney 的 750 设计 px 换算（÷1.923）：卡 283×92、间距 17、页眉 54
  cv=Cv(W,H,K,island_bg(W,H)); shade(cv,1); k=1/1.923; ph=(104+n*176+(n-1)*32+72)*k; pw=600*k; x=(W-pw)/2; y=max(16,(H-ph)/2)
  panel(cv,x,y,pw,ph); l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,W/2,y+30,'旅程册',20,hx(C['brown'])); cv.comp(l)
  regs=REG[:n]
  for i,r in enumerate(regs):
    cy=y+(104+i*208+88)*k; cx0=W/2-272*k
    l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,cx0,cy-46+3,544*k,92,14,hx('#B8966A')); cv.rr(d,cx0,cy-46,544*k,92,14,hx('#E9D3A6')); cv.comp(l)
    img(cv,art('region_'+r['id']),cx0+12+54,cy,108,71); img(cv,sealp(r['id'],'x'),cx0+18,cy-30,33,37)
    l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,cx0+136,cy-20,r['name'],16,hx(C['brown']),anchor='lm'); cv.text(d,cx0+136,cy+4,'★ 12/12',12,hx(C['ink']),bold=False,anchor='lm'); cv.text(d,cx0+136,cy+26,'挑战 4/4',12,hx(C['teal']),anchor='lm'); cv.comp(l)
  if y+ph>H-8:
    l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,W/2,H-24,'↑ 6 张卡总高 %d pt，超出屏幕'%ph,13,hx('#D2553A')); cv.comp(l)
  return cv
J=journey(K=4).out(2); save(J,'journey_390.png')
save(row([lab(old_journey(K=3).out(2),'现状：4 张大卡（450 pt 高）'),lab(old_journey(K=3,n=6).out(2),'若直接加到 6 张：约 620 pt，挤满屏且 568 高放不下'),lab(J,'新：焦点卡 + 5 行紧凑行，整页 520 pt（不随地区数增长）')]),'compare_journey.png')
CH=chapter(K=4).out(2); save(CH,'chapter_coast_390.png')
E=ending(K=4).out(2); save(E,'ending_390.png')
save(row([lab(ending(K=4,old=True).out(2),'现状：4 枚印章'),lab(E,'新：6 枚印章（雪山未得为空白章）')]),'compare_ending.png')
for nm,fn in (('journey',lambda W,H:journey(W,H,K=2)),('chapter',lambda W,H:chapter(W,H,K=2))):
  save(row([lab(fn(W,H).out(1),f'{W}×{H}',18) for W,H in SIZES],16),f'sizes_7_{nm}.png')
# 状态图：行状态（用不同进度构造）
cases=[('未揭晓（远方）',{'tide':4,'meadow':2,'sky':0,'lake':0,'coast':0,'snow':0},'meadow'),
       ('已知未开启（灰章+条件）',{'tide':4,'meadow':4,'sky':2,'lake':0,'coast':0,'snow':0},'sky'),
       ('新开启（红点 · 可前往）',{'tide':4,'meadow':4,'sky':4,'lake':0,'coast':0,'snow':0},'sky'),
       ('进行中（青色进度）',{'tide':4,'meadow':4,'sky':4,'lake':6,'coast':3,'snow':1},'coast'),
       ('全部完成',{'tide':4,'meadow':4,'sky':4,'lake':6,'coast':9,'snow':6},'snow')]
save(row([lab(journey(K=3,prog=p,focus=f).out(1.6),t,20) for t,p,f in cases],16),'states_journey.png')
save(row([lab(chapter(K=3,rid=r,state=s).out(1.6),t,20) for r,s,t in (('snow','locked','未开启'),('coast','open','可前往'),('coast','progress','进行中'),('coast','done','完成'),('coast','open','按下（当帧下沉 3pt）'))][:4]+[lab(chapter(K=3,pressed=True).out(1.6),'按钮按下（当帧）',20)],16),'states_chapter.png')
# 印章对照
cv=Cv(420,150,6); l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,0,0,420,150,18,hx(C['face'])); cv.comp(l)
for i,(p,t) in enumerate(((art('reward_seal_lake'),'湖畔（现有）'),(art('reward_seal_coast'),'海岸（新）'),(art('reward_seal_snow'),'雪山（新）'),(art('reward_seal_blank'),'未得 / 未揭晓'))):
  img(cv,p,60+i*100,62,72,80); l=cv.layer(); d=ImageDraw.Draw(l); cv.text(d,60+i*100,128,t,12,hx(C['brown'])); cv.comp(l)
save(cv.out(2),'seals_compare.png')
# 关键帧
save(row([lab(journey(K=1.5,p=pp,stagger_t=pp*0.32,bar_k=0).out(1),f'{int(pp*320)} ms',16) for pp in (0,0.25,0.5,1.0)]+[lab(journey(K=1.5,stagger_t=1,bar_k=k).out(1),f'进度条 {int(320+k*600)} ms',16) for k in (0.5,1.0)]+[lab(journey(K=1.5,p=0.4,closing=True).out(1),'退出 108 ms',16)],12),'keyframes_journey.png')
save(row([lab(ending(K=1.5,t=t).out(1),f'{int(t*1000)} ms',16) for t in (0,0.12,0.28,0.44,0.64)],12),'keyframes_ending.png')
tmp='/tmp/nr_frames'; shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp); n=[0]
def put(im,rep=1):
  for _ in range(rep): im.convert('RGB').save(f'{tmp}/{n[0]:04d}.png'); n[0]+=1
put(island_bg(390,844),10)
for i in range(11): put(journey(K=1.5,p=i/10,stagger_t=i/10*0.32,bar_k=0).out(1))
for i in range(5): put(journey(K=1.5,stagger_t=0.32+i/30,bar_k=0).out(1))
for i in range(19): put(journey(K=1.5,bar_k=ease('emphDecel',i/18)).out(1))
put(journey(K=1.5).out(1),15); put(journey(K=1.5,pressRow=3).out(1),4)
for i in range(6): put(journey(K=1.5,p=1-i/5,closing=True).out(1))
for i in range(11): put(chapter(K=1.5,p=i/10).out(1))
put(chapter(K=1.5).out(1),20); put(chapter(K=1.5,pressed=True).out(1),5)
for i in range(6): put(chapter(K=1.5,p=1-i/5,closing=True).out(1))
for i in range(25): put(ending(K=1.5,t=i/30).out(1))
put(ending(K=1.5).out(1),30)
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','30','-i',f'{tmp}/%04d.png','-pix_fmt','yuv420p','-c:v','libx264','-crf','20',os.path.join(OUT,'new_regions_anim.mp4')],check=True); shutil.rmtree(tmp); print('mp4',n[0])
