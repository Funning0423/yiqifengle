from kit import *
from ending import ending,layout,OUT,SCENE
import glob,subprocess,shutil,json
SIZES=[(320,568),(360,780),(375,667),(390,844),(393,852),(414,896),(430,932)]
PR=json.load(open(HERE+'ending_scene_params.json'))
def annot():
  im,L=ending();im=im.resize((390,844),Image.LANCZOS);a=Image.new('RGBA',(390+340,844),(250,247,240,255));a.paste(im,(0,0));d=ImageDraw.Draw(a);f=ImageFont.truetype(FB,12,index=2)
  M=(214,60,40);bx,by,bw,bh=L['btn'];cb=L['chime_box'];gb=L['girl_box']
  boxes=[('机位：湖畔南岸，低机位仰拍 20mm，看向北岸远山\n湖面和远山占画面中段，前景只有一块草地',(4,380,386,640),10),
   ('3D 风铃（LK_windchime.glb ×%.2f）挂在木架横臂末端\n木架 LK_chime_post.glb，在风铃左后方（已去掉立柱中段小木板）。唯一焦点，中心 y≈%d\n摇摆：绕挂点 ±%.0f°，周期 3.2 s（见 ending_sway_keyframes.png）'%(PR['chime_scale'],(cb[1]+cb[3])/2,PR['amp']),cb,120),
   ('标题木牌 title_plank_3s 196×58，「旅程完成」24pt Bold #5A3A1E\n字距 3，奶白投影 #FFFAEC 2pt；中心 y=%.0f（不变）'%L['plank_cy'],(97,L['plank_cy']-29,293,L['plank_cy']+29),260),
   ('四章印章 reward_seal_* 44×44，间距 14，无文字；中心 y=%.0f（不变）'%L['seals_cy'],(97,L['seals_cy']-22,293,L['seals_cy']+22),350),
   ('女孩：游戏角色 glb（chr_b_r5g2…grokbot2），整个人入画\n站在湖边，抬头 %d° 仰望风铃；印章下方、按钮上方\n脚下离按钮 %.0fpt'%(PR['head_up'],by-gb[3]),gb,440),
   ('唯一按钮 btn_primary_3s %d×%d（含 6pt 底厚）\n左右各 %dpt（≥16），下沿离安全区 24pt；「回小岛」20pt Bold #FFFFFF\n按下下沉 4pt；触控区 = 按钮本体 ≥44pt（不变）'%(bw,bh,bx),(bx,by,bx+bw,by+bh),640),]
  for t,(x0,y0,x1,y1),ty in boxes:
    d.rectangle((x0,y0,x1,y1),outline=M,width=1);d.line((x1,(y0+y1)/2,398,ty+8),fill=M,width=1);d.multiline_text((402,ty),t,font=f,fill=(50,40,30),spacing=3)
  d.multiline_text((402,760),'底部 30%% 渐暗 #281A0A 0→24%%（夜 #050814 0→39%%），不加面板。\n夜间：单独夜间光照渲染（冷色弱月光、渐变夜空、无体积雾），\n再轻压 (0.80,0.80,0.92)；风铃周围暖光 #FFCE82 α42%%；\n木牌、按钮、印章走 NightTint (0.80,0.80,0.88)。',font=f,fill=(50,40,30),spacing=3)
  a.convert('RGB').save(OUT+'ending_day_annot.png')
def inter(a,b):return not (a[2]<=b[0] or b[2]<=a[0] or a[3]<=b[1] or b[3]<=a[1])
def sizes():
  ths=[];res=[]
  for W,H in SIZES:
    im,L=ending(W,H);im=im.resize((W,H),Image.LANCZOS);d=ImageDraw.Draw(im);bx,by,bw,bh=L['btn'];gb=L['girl_box'];cb=L['chime_box']
    btn=(bx,by,bx+bw,by+bh);seal=(97*W/390,L['seals_cy']-22,W-97*W/390,L['seals_cy']+22);plk=(W/2-98,L['plank_cy']-29,W/2+98,L['plank_cy']+29)
    checks={'按钮离边≥16':bx>=16,'按钮在安全区内':by+bh<=H-L['bot'],'女孩完整入画':gb[0]>=0 and gb[2]<=W and gb[1]>=0 and gb[3]<=H,
      '女孩不压按钮/木牌':not(inter(gb,btn) or inter(gb,plk)),'女孩头顶离印章≥12':gb[1]-seal[3]>=12-1e-6,'风铃完整且不压木牌':cb[1]>=L['top'] and cb[3]<=L['plank_cy']-29 and cb[0]>=0 and cb[2]<=W}
    ok=all(checks.values())
    for bxx,col in ((btn,(0,200,90)),(gb,(255,170,0)),(cb,(0,150,255))):d.rectangle(bxx,outline=col if ok else (230,30,30),width=2)
    ths.append((W,H,im,ok,[k for k,v in checks.items() if not v]));res.append((W,H,ok,round(bx),round(by-gb[3]),round(gb[1]-(L['seals_cy']+22)),[k for k,v in checks.items() if not v]))
  k=0.62;Wt=sum(int(W*k)+16 for W,*_ in ths)+16;Ht=int(932*k)+76
  s=Image.new('RGB',(Wt,Ht),(244,240,232));d=ImageDraw.Draw(s);f=ImageFont.truetype(FB,12,index=2);x=16
  for (W,H,im,ok,bad),r in zip(ths,res):
    t=im.convert('RGB').resize((int(W*k),int(H*k)),Image.LANCZOS);s.paste(t,(x,16))
    d.text((x,int(932*k)+22),'%d×%d %s\n按钮离边 %d\n女孩脚→按钮 %d\n印章→女孩头 %d'%(W,H,'通过' if ok else '不通过:'+','.join(bad),r[3],r[4],r[5]),font=f,fill=(40,40,40));x+=t.width+16
  d.text((16,Ht-14),'绿=按钮  橙=女孩  蓝=风铃（框线变红 = 有检查不通过）',font=f,fill=(90,90,90))
  s.save(OUT+'ending_7sizes.png');return res
def compare():
  s=Image.new('RGB',(16+4*(390+16),844+56),(244,240,232));d=ImageDraw.Draw(s);f=ImageFont.truetype(FB,15,index=2)
  ims=[('/tmp/eb/v20_day.png','修改前 v2.0 白天'),(OUT+'ending_day.png','修改后 v2.1 白天'),('/tmp/eb/v20_night.png','修改前 v2.0 夜间'),(OUT+'ending_night.png','修改后 v2.1 夜间')]
  for i,(p,t) in enumerate(ims):
    x=16+i*406;s.paste(Image.open(p).convert('RGB').resize((390,844),Image.LANCZOS),(x,44));d.text((x,14),t,font=f,fill=(30,90,60) if '修改后' in t else (120,40,30))
  s.save(OUT+'compare_ending_v20_v21.png')
def sway():
  fr=sorted(glob.glob(SCENE+'day/chime/sway_*.png'))
  if not fr:print('no sway frames');return
  tmp='/tmp/sway_comp';shutil.rmtree(tmp,ignore_errors=True);os.makedirs(tmp)
  comps=[]
  for i,p in enumerate(fr):
    im,_=ending(phase=i);im=im.convert('RGB').resize((390,844),Image.LANCZOS);im.save('%s/%03d.png'%(tmp,i));comps.append(im)
  n=len(fr);idx=[0,n//4,n//2,3*n//4];lab=['0 s 居中 0°','0.8 s 最右 +4°','1.6 s 回中 0°','2.4 s 最左 −4°']
  w,h=195,422;s=Image.new('RGB',(16+4*(w*2//1+12),h*2//1+120),(244,240,232));d=ImageDraw.Draw(s);f=ImageFont.truetype(FB,13,index=2)
  d.text((16,10),'风铃摇摆关键帧：绕横臂挂点摆动，振幅 ±4°（左右）＋ ±1.4°（前后），周期 3.2 s，正弦缓动，循环',font=ImageFont.truetype(FB,15,index=2),fill=(40,32,24))
  for j,(i,l) in enumerate(zip(idx,lab)):
    x=16+j*(w*2+12);crop=comps[i].crop((90,110,300,532)).resize((w*2//2*2//2*1,h),Image.LANCZOS) if False else comps[i].crop((95,120,290,542)).resize((w*2,h*2),Image.LANCZOS)
    s.paste(crop,(x,40));d.text((x,h*2+48),l+'（裁切放大 2×）',font=f,fill=(60,50,40))
  s.save(OUT+'ending_sway_keyframes.png')
  # 一个周期 n 帧 → 3.2 s；用 minterpolate 补到 30fps，循环 3 遍
  subprocess.run(['ffmpeg','-y','-loglevel','error','-stream_loop','2','-framerate',str(n/3.2),'-i',tmp+'/%03d.png','-vf','minterpolate=fps=30:mi_mode=blend','-c:v','libx264','-pix_fmt','yuv420p','-crf','22',OUT+'ending_sway.mp4'],check=True)
if __name__=='__main__':
  import sys
  for n in (0,1):
    im,_=ending(night=bool(n));im.convert('RGB').save(OUT+'ending_%s.png'%('night' if n else 'day'))
  annot();print(sizes());compare()
  if '--sway' in sys.argv:sway()
