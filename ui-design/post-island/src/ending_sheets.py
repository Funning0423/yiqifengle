from kit import *
from ending import ending,layout,OUT
SIZES=[(320,568),(360,780),(375,667),(390,844),(393,852),(414,896),(430,932)]
def annot():
  im,L=ending();im=im.resize((390,844),Image.LANCZOS);a=Image.new('RGBA',(390+330,844),(250,247,240,255));a.paste(im,(0,0));d=ImageDraw.Draw(a);f=ImageFont.truetype(FB,12,index=2)
  M=(214,60,40)
  bx,by,bw,bh=L['btn'];cs=L['chime'];cy=L['chime_cy']
  boxes=[('3D 风铃 %d×%d（Blender，LK_windchime.glb，3/4 俯视 12°）\n中心 y=%.0f（安全区内 36%%），柔光 r=0.45×宽 #FFDE8C α55%%（夜 70%%），\n接触阴影 #3C2614 α35%%'%(cs,cs,cy),(195-cs/2,cy-cs/2,195+cs/2,cy+cs/2)),
   ('标题木牌 title_plank_3s 196×58，「旅程完成」24pt Bold #5A3A1E\n字距 3，奶白投影 #FFFAEC 2pt；中心 y=%.0f'%L['plank_cy'],(97,L['plank_cy']-29,293,L['plank_cy']+29)),
   ('四章印章 reward_seal_* 44×44，间距 14，无文字\n潮汐/草甸/天空/湖畔；中心 y=%.0f'%L['seals_cy'],(97,L['seals_cy']-22,293,L['seals_cy']+22)),
   ('唯一按钮 btn_primary_3s %d×%d（含 6pt 底厚）\n左右各 %dpt（≥16），下沿离安全区 24pt\n「回小岛」20pt Bold #FFFFFF 投影 #1E4648\n按下下沉 4pt；触控区 = 按钮本体 ≥44pt'%(bw,bh,bx),(bx,by,bx+bw,by+bh)),
   ('背景：湖畔实景（W_lakeDay_0）cover 裁切，\n暖色叠加 #FFD696 α12%%，模糊 1.4pt；\n底部 38%% 渐暗 #281A0A 0→27%%（夜 #050814 0→43%%），不加面板',(4,4,386,120)),]
  for i,(t,(x0,y0,x1,y1)) in enumerate(boxes):
    d.rectangle((x0,y0,x1,y1),outline=M,width=1);ty=[10,150,330,460,640][i];ty=max(ty,0)
    d.line((x1,(y0+y1)/2,398,ty+8),fill=M,width=1);d.multiline_text((402,ty),t,font=f,fill=(50,40,30),spacing=3)
  d.line((0,by+bh+6,bx,by+bh+6),fill=(30,120,200));d.text((4,by+bh+8),'%d'%bx,font=f,fill=(30,120,200))
  d.multiline_text((402,760),'夜间：木牌、按钮、印章走 NightTint (0.80,0.80,0.88)；\n风铃和柔光不乘夜色，保持唯一焦点。\n进入动画见 ../transitions/TR9。',font=f,fill=(50,40,30),spacing=3)
  a.convert('RGB').save(OUT+'ending_day_annot.png')
def sizes():
  ths=[];
  for W,H in SIZES:
    im,L=ending(W,H);im=im.resize((W,H),Image.LANCZOS);d=ImageDraw.Draw(im);bx,by,bw,bh=L['btn']
    ok=bx>=16 and by+bh<=H-L['bot'] and L['seals_cy']+22<by-16 and L['chime_cy']-L['chime']/2>=L['top']
    d.rectangle((bx,by,bx+bw,by+bh),outline=(0,200,90) if ok else (230,30,30),width=2)
    ths.append((W,H,im,ok,bx,by-(L['seals_cy']+22)))
  k=0.62;Wt=sum(int(W*k)+16 for W,_,_,_,_,_ in ths)+16;Ht=int(932*k)+60
  s=Image.new('RGB',(Wt,Ht),(244,240,232));d=ImageDraw.Draw(s);f=ImageFont.truetype(FB,12,index=2);x=16
  for W,H,im,ok,bx,gap in ths:
    t=im.convert('RGB').resize((int(W*k),int(H*k)),Image.LANCZOS);s.paste(t,(x,16));d.text((x,int(932*k)+22),'%d×%d %s\n边距 %d 间隙 %d'%(W,H,'通过' if ok else '不通过',bx,gap),font=f,fill=(40,40,40));x+=t.width+16
  s.save(OUT+'ending_7sizes.png');return [(W,H,ok,bx,gap) for W,H,_,ok,bx,gap in ths]
def before_after():
  b=img(R7+'L15_result.png').resize((390,844));a,_=ending();a=a.resize((390,844),Image.LANCZOS)
  s=Image.new('RGB',(390*2+48,844+56),(244,240,232));d=ImageDraw.Draw(s);f=ImageFont.truetype(FB,18,index=2)
  s.paste(b.convert('RGB'),(16,44));s.paste(a.convert('RGB'),(390+32,44))
  d.text((16,12),'现状：L16 过关后仍是普通结算，回小岛；没有结局',font=ImageFont.truetype(FB,14,index=2),fill=(120,40,30));d.text((390+32,12),'设计：结局画面（白天）',font=f,fill=(30,90,60))
  s.save(OUT+'compare_ending_before_after.png')
if __name__=='__main__':
  from ending import ending as E
  for n in (0,1):
    im,_=E(night=bool(n));im.convert('RGB').save(OUT+'ending_%s.png'%('night' if n else 'day'))
  annot();print(sizes());before_after()
