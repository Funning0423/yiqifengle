"""场景切换「风云擦除」设计稿：关键帧序列 + 短动效。python3 transitions.py [--video]"""
from kit import *
import sys,subprocess,shutil
OUT=HERE+'../transitions/'
W,H=390,844
# 时长（秒）：盖上 OUT、最短停留 HOLD（加载更久就继续停，3 s 后出现三点风纹）、揭开 IN
OUT_S,HOLD_S,IN_S=0.45,1.10,0.55
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def bgimg(spec,k):
  v=spec[k]
  if callable(v):return v()
  return cover_bg(v,W,H)
def frame(spec,t,cache):
  A=cache.setdefault('A',bgimg(spec,'A'));B=cache.setdefault('B',bgimg(spec,'B'))
  night=spec.get('night',False);hold=spec.get('hold',HOLD_S);T1=OUT_S;T2=OUT_S+hold;T3=T2+IN_S
  c=(A if t<T2 else B).copy()
  if t<T1:lead,trail=ease(t/OUT_S),0
  elif t<T2:lead,trail=1,0
  elif t<T3:lead,trail=1.2,ease((t-T2)/IN_S)*1.2
  else:return c
  if spec.get('nocover'):return c
  m=wipe_mask(W,H,lead if t<T1 else 1.2,trail)
  cl=cache.setdefault('cl',cloud_layer(W,H,night));c.paste(cl,(0,0),m)
  # 停留期内容：3D 载具 + 目的地木牌（仅在完全盖住后出现，揭开时先淡出）
  if spec.get('vehicle') or spec.get('name'):
    a=ease((t-T1+0.05)/0.3) if t<T2 else 1-ease((t-T2)/0.2)
    if a>0.01:
      layer=Image.new('RGBA',c.size)
      if spec.get('vehicle'):
        vs=200*S;v=cache.setdefault('veh',img(HERE+'../render/%s.png'%spec['vehicle']).resize((vs,vs),Image.LANCZOS))
        dx=int((t-T1)*22*S);dy=int(math.sin(t*2.6)*5*S)   # 随风右漂 22pt/s，上下浮动 5pt
        gx=W*S//2-vs//2+dx-20*S;gy=int(330*S)-vs//2+dy
        sh=Image.new('RGBA',(vs,vs//7));ImageDraw.Draw(sh).ellipse((vs*.3,0,vs*.7,vs//7),fill=(60,40,20,60) if not night else (0,0,0,90));sh=sh.filter(ImageFilter.GaussianBlur(8*S))
        layer.alpha_composite(sh,(gx,gy+int(vs*.47)));layer.alpha_composite(v,(gx,gy))
      if spec.get('name'):
        p=plank(spec['name'],176,54,22,(0.85,0.85,0.92) if night else None);layer.alpha_composite(p,(W*S//2-p.width//2,int(470*S)-p.height//2))
      if spec.get('loading') and t>T1+0.2:  # 加载超过 3 s 才出现的三点风纹（这里为演示提前显示）
        d=ImageDraw.Draw(layer)
        for i in range(3):
          ph=(t*2-i*.25)%1;al=int(255*(0.35+0.65*max(0,math.sin(ph*math.pi))));x=W*S//2+(i-1)*14*S;y=int(516*S)
          d.ellipse((x-3*S,y-3*S,x+3*S,y+3*S),fill=(150,110,70,al) if not night else (255,220,160,al))
      r,g,b,al=layer.split();layer.putalpha(al.point(lambda v:int(v*a)));c.alpha_composite(layer)
  return c
def arrival(c,t,name,night=False):
  """到达木牌：不盖屏，木牌从 y=96 下落 12pt 淡入 0.3 s，停 1.6 s，上移淡出 0.3 s。"""
  if t<0 or t>2.2:return c
  a=ease(t/0.3) if t<0.3 else (1 if t<1.9 else 1-ease((t-1.9)/0.3));dy=(1-a)*-12
  p=plank(name,176,54,22,(0.85,0.85,0.92) if night else None);r,g,b,al=p.split();p.putalpha(al.point(lambda v:int(v*a)))
  c=c.copy();c.alpha_composite(p,(W*S//2-p.width//2,int((126+dy)*S)-p.height//2));return c
def ending_bg():
  from ending import ending;return ending()[0]
SPECS={
 'TR1':dict(title='TR1 小岛 L4 结算「下一关」→ 帆船出发（小岛→花粉草甸）',A=R7+'L4_result.png',B=R7+'tr5_8.png',vehicle='sailboat',name='花粉草甸',loading=True,
   before=[(R7+'L4_result.png','L4 结算 点「下一关」'),(R7+'tr5_3.png','0.25 s 纯黑盖屏'),(R7+'tr5_8.png','0.35 s 揭开：码头')]),
 'TR3':dict(title='TR3 草原 L8 结算「下一关」→ 热气球起飞（草甸→天空之城）',A=R7+'L8_result.png',B=R7+'T9_13.png',vehicle='balloon',name='天空之城',
   before=[(R7+'L8_result.png','L8 结算'),(R7+'T9_4.png','纯黑盖屏'),(R7+'T9_13.png','气球升空')]),
 'TR3n':dict(title='TR3 夜间版',A=B05+'b05_10_ch1_result.png',B=R7+'T9_22.png',vehicle='balloon',name='天空之城',night=True,before=[]),
 'TR8':dict(title='TR8 暂停「离开棋盘/主页」→ 小岛（任何场景回家）',A=R7+'LB_lakeDay_pause.png',B=R7+'D02_island.png',hold=0.5,
   before=[(R7+'LB_lakeDay_pause.png','暂停面板'),(R7+'T5_4.png','纯黑 0.4 s（HOME_FADE）'),(R7+'D02_island.png','小岛')]),
 'TR9':dict(title='TR9 L18 通关 → 结局（湖畔→结局）',A=R7+'L15_result.png',B=ending_bg,vehicle='chime',hold=1.2,
   before=[(R7+'L15_result.png','L18 结算（示意，用 L15 结算图代替）'),(R7+'L16_start.png','现状：无结局，回小岛/下一关（示意图为 L16）')]),
}
def keyframes(key):
  sp=SPECS[key];hold=sp.get('hold',HOLD_S);ts=[0,OUT_S*0.5,OUT_S+0.35,OUT_S+hold,OUT_S+hold+IN_S*0.5,OUT_S+hold+IN_S]
  labels=['0 起点','%.2f 云从左下盖入'%ts[1],'%.2f 盖满：载具+木牌'%ts[2],'%.2f 揭开开始'%ts[3],'%.2f 云向右上散开'%ts[4],'%.2f 终点'%ts[5]]
  cache={};fr=[frame(sp,t,cache) for t in ts]
  return sp,fr,labels
def strip(title,frames,labels,path,k=0.5):
  w,h=int(W*k),int(H*k);s=Image.new('RGB',(16+len(frames)*(w+12),h+80),(244,240,232));d=ImageDraw.Draw(s)
  d.text((16,10),title,font=ImageFont.truetype(FB,16,index=2),fill=(40,32,24));f=ImageFont.truetype(FB,12,index=2)
  for i,(fr,lb) in enumerate(zip(frames,labels)):
    x=16+i*(w+12);s.paste(fr.convert('RGB').resize((w,h),Image.LANCZOS),(x,40));d.text((x,h+48),lb,font=f,fill=(60,50,40))
  s.save(path)
def video(key,fps=30):
  sp=SPECS[key];hold=sp.get('hold',HOLD_S);T=0.4+OUT_S+hold+IN_S+0.6;tmp='/tmp/tr_'+key;shutil.rmtree(tmp,ignore_errors=True);os.makedirs(tmp)
  cache={}
  for i in range(int(T*fps)):
    t=i/fps-0.4;fr=frame(sp,max(0,t),cache)
    fr.convert('RGB').resize((W,H),Image.LANCZOS).save('%s/%04d.png'%(tmp,i))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(fps),'-i',tmp+'/%04d.png','-c:v','libx264','-pix_fmt','yuv420p','-crf','23',OUT+key+'.mp4'],check=True);shutil.rmtree(tmp)
if __name__=='__main__':
  os.makedirs(OUT,exist_ok=True)
  for k in SPECS:
    sp,fr,lb=keyframes(k);strip('设计：'+sp['title'],fr,lb,OUT+k+'_keyframes.png')
    if sp['before']:strip('现状：'+sp['title'],[cover_bg(p,W,H) for p,_ in sp['before']],[l for _,l in sp['before']],OUT+k+'_before.png')
  # TR6 到达木牌（天空之城→气球→风铃湖畔：长镜头不盖屏，只在落地时给木牌）
  base=cover_bg(R7+'lk13_30.png',W,H);fr=[arrival(base,t,'风铃湖畔') for t in (0,0.15,0.5,1.9,2.05,2.3)]
  strip('设计：TR6 天空之城→热气球→风铃湖畔（长镜头保留，落地时只出到达木牌）',fr,['落地前','0.15 木牌下落淡入','0.5 停留','1.9 开始淡出','2.05 上移淡出','2.3 棋盘界面升起'],OUT+'TR6_keyframes.png')
  strip('现状：TR6 天空之城→湖畔',[cover_bg(R7+p,W,H) for p in ('D_sky_end0.png','b9_16.png','N_lake_14.png','lk13_30.png','N_lake_board.png')],['终镜：空天+两个按钮，可停 80 s','（参考）气球段海面吞篮','夜间降落','落地 ~45 s 无提示','自动进棋盘'],OUT+'TR6_before.png')
  if '--video' in sys.argv:
    for k in ('TR1','TR3n','TR9'):video(k)
