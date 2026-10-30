# python3 build.py  → 生成 ../ 下全部图与 mp4
import os,sys,subprocess,shutil; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from render import *
def lab(img,txt,size=26):
  f=ImageFont.truetype(SERIF_B,size,index=2); w,h=img.size; o=Image.new('RGBA',(w,h+size+20),(250,244,232,255)); o.alpha_composite(img,(0,size+20)); ImageDraw.Draw(o).text((w//2,10),txt,font=f,fill=(60,40,20),anchor='mt'); return o
def row(imgs,gap=24):
  H=max(i.height for i in imgs); o=Image.new('RGBA',(sum(i.width for i in imgs)+gap*(len(imgs)+1),H+2*gap),(250,244,232,255)); x=gap
  for i in imgs: o.alpha_composite(i,(x,gap)); x+=i.width+gap
  return o
def save(img,name): img.convert('RGB').save(os.path.join(OUT,name),optimize=True); print(name,img.size,flush=True)
SIZES=[(320,568),(360,780),(375,667),(390,844),(402,874),(414,896),(430,932)]
adv=advisory(K=4).out(2); save(adv,'advisory_390.png'); st=settings(K=4).out(2); save(st,'settings_390.png'); up=update(K=4).out(2); save(up,'update_390.png')
save(row([lab(Image.open(BEFORE_HOME).convert('RGBA').resize((780,1688)),'现状：无忠告页，冷启动直接进主页'),lab(adv,'新：冷启动先显示 3.0 s 忠告页')]),'compare_advisory.png')
save(row([lab(Image.open(BEFORE_SET).convert('RGBA').resize((780,1688)),'现状（10-15 截图，测试横幅为当时测试包）'),lab(st,'新：五行统一开关，新增「震动」')]),'compare_settings.png')
save(row([lab(island_bg(390,844).resize((780,1688)),'现状：无更新提示'),lab(up,'新：新版本就绪弹窗')]),'compare_update.png')
for name,fn in (('advisory',lambda W,H:advisory(W,H,K=2)),('settings',lambda W,H:settings(W,H,K=2)),('update',lambda W,H:update(W,H,K=2))):
  save(row([lab(fn(W,H).out(1),f'{W}×{H}',18) for W,H in SIZES],16),f'sizes_7_{name}.png')
tiles=[]
for s,t,k in (('off','关',None),('off_pressed','关 · 按下',None),('on','开',None),('on_pressed','开 · 按下',None),('on','切换中（90 ms）',0.5)):
  cv=Cv(120,70,8); l=cv.layer(); d=ImageDraw.Draw(l); cv.rr(d,0,0,120,70,14,hx(C['face'])); cv.comp(l); toggle(cv,60,35,s,k=k); tiles.append(lab(cv.out(3),t,24))
save(row(tiles),'toggle_states.png')
save(row([lab(settings(K=4).out(2),'默认'),lab(settings(K=4,states={'music':'on','sfx':'off','vibrate':'on_pressed','night':'off','motion':'on'},pressRow=2).out(2),'混合状态 + 「震动」行按下')]),'settings_states.png')
save(row([lab(up,'默认'),lab(update(K=4,pressed=True).out(2),'「重启更新」按下（下沉 3pt）')]),'update_states.png')
save(row([lab(advisory(K=1.5,t=t).out(1),f'{int(t*1000)} ms',16) for t in (0.0,0.15,0.4,1.6,2.7,2.85,3.0)],12),'keyframes_advisory.png')
save(row([lab(settings(K=1.5,p=p).out(1),f'进入 {int(p*320)} ms',16) for p in (0.0,0.25,0.5,1.0)]+[lab(settings(K=1.5,p=p,closing=True).out(1),f'退出 {int((1-p)*180)} ms',16) for p in (0.5,0.0)],12),'keyframes_settings.png')
save(row([lab(update(K=1.5,p=p).out(1),f'进入 {int(p*320)} ms',16) for p in (0.0,0.25,0.5,1.0)]+[lab(update(K=1.5,pressed=True).out(1),'按下 0 ms',16)]+[lab(update(K=1.5,p=p,closing=True).out(1),f'退出 {int((1-p)*180)} ms',16) for p in (0.5,0.0)],12),'keyframes_update.png')
tmp='/tmp/sp_frames'; shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp); n=[0]
def put(img,rep=1):
  for _ in range(rep): img.convert('RGB').save(f'{tmp}/{n[0]:04d}.png'); n[0]+=1
for i in range(99): put(advisory(K=1.5,t=i/30).out(1))
put(island_bg(390,844),15)
for i in range(11): put(settings(K=1.5,p=i/10).out(1))     # 320 ms ≈ 10 帧
put(settings(K=1.5).out(1),12)
put(settings(K=1.5,states={'music':'on','sfx':'on','vibrate':'on_pressed','night':'off','motion':'off'},pressRow=2).out(1),4)
for i in range(6):                                          # 关 180 ms
  class _S: pass
  k=1-ease('outCubic',(i+1)/6); 
  cv=settings(K=1.5,states={'music':'on','sfx':'on','vibrate':'on','night':'off','motion':'off'}); put(cv.out(1)) if False else None
  # 用开关局部重绘
  S=SP['settings']; pw=S['w']; x=(390-pw)/2; y=(844-S['h'])/2+S['dy']; ry=y+S['firstRowY']+2*S['rowH']
  base=settings(K=1.5,states={'music':'on','sfx':'on','vibrate':'off','night':'off','motion':'off'}); toggle(base,x+pw-S['toggleRight']-26,ry,'on',k=k) if k>0.02 else None; put(base.out(1))
put(settings(K=1.5,states={'music':'on','sfx':'on','vibrate':'off','night':'off','motion':'off'}).out(1),15)
for i in range(6): put(settings(K=1.5,p=1-i/5,closing=True,states={'music':'on','sfx':'on','vibrate':'off','night':'off','motion':'off'}).out(1))
put(island_bg(390,844),15)
for i in range(11): put(update(K=1.5,p=i/10).out(1))
put(update(K=1.5).out(1),20); put(update(K=1.5,pressed=True).out(1),5)
for i in range(6): put(update(K=1.5,p=1-i/5,closing=True).out(1))
put(island_bg(390,844),10)
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','30','-i',f'{tmp}/%04d.png','-pix_fmt','yuv420p','-c:v','libx264','-crf','20',os.path.join(OUT,'system_panels_anim.mp4')],check=True); shutil.rmtree(tmp); print('mp4 frames',n[0])
