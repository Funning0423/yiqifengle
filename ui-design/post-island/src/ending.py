"""结局画面设计稿。python3 ending.py → ../ending/*.png"""
from kit import *
OUT=HERE+'../ending/'
NIGHT_K=(0.80,0.80,0.88)
def safe(W,H):  # 和 BoardLayout.boardSafeInsets 一致的近似：刘海屏顶 47/底 34，非刘海屏顶 20/底 0
  notch=H/W>1.9;return (47 if notch else 20),(34 if notch else 0)
def layout(W,H):
  top,bot=safe(W,H)
  btn_w=min(240,W-2*24);btn_h=62
  btn_y=H-bot-24-btn_h                     # 按钮上沿
  usable=btn_y-top
  chime=int(min(W*0.62,usable*0.42))        # 3D 风铃（唯一焦点）
  chime_cy=top+usable*0.36
  plank_cy=chime_cy+chime*0.5+44
  seals_cy=plank_cy+64
  return dict(top=top,bot=bot,btn=(int((W-btn_w)/2),int(btn_y),btn_w,btn_h),chime=chime,chime_cy=chime_cy,plank_cy=plank_cy,seals_cy=seals_cy)
def ending(W=390,H=844,night=False,state='normal'):
  L=layout(W,H)
  bg=cover_bg(R7+'W_lakeDay_0.png',W,H,crop_bottom=110)   # 去掉截图底部的旧按钮
  # 调色：白天暖金色傍晚感；夜间深蓝+暖光
  ov=Image.new('RGBA',bg.size,(255,214,150,30) if not night else (18,26,58,150));bg.alpha_composite(ov)
  bg=bg.filter(ImageFilter.GaussianBlur(1.4*S))          # 轻微景深，背景不抢焦点
  c=Image.new('RGBA',(W*S,H*S));c.alpha_composite(bg)
  # 底部柔和渐暗（不做面板），保证按钮读得清
  g=Image.new('L',(1,H*S));[g.putpixel((0,y),int(max(0,(y/(H*S)-.62)/.38)*(70 if not night else 110))) for y in range(H*S)]
  c.alpha_composite(Image.merge('RGBA',[Image.new('L',(W*S,H*S),v) for v in ((40,26,10) if not night else (5,8,20))]+[g.resize((W*S,H*S))]))
  cs=L['chime']*S;cx=W*S//2;cy=int(L['chime_cy']*S)
  gl=glow(int(cs*1.6),int(cs*0.45),(255,222,140),0.55 if not night else 0.7);c.alpha_composite(gl,(cx-gl.width//2,cy-gl.height//2))
  ch=img(HERE+'../render/chime.png').resize((cs,cs),Image.LANCZOS)
  sh=Image.new('RGBA',(cs,cs//6));ImageDraw.Draw(sh).ellipse((cs*.28,0,cs*.72,cs//6),fill=(60,38,20,90));sh=sh.filter(ImageFilter.GaussianBlur(10*S))
  c.alpha_composite(sh,(cx-cs//2+int(cs*.04),cy+int(cs*.46)))
  c.alpha_composite(ch,(cx-cs//2,cy-cs//2))
  p=plank('旅程完成',196,58,24,NIGHT_K if night else None);c.alpha_composite(p,(cx-p.width//2,int(L['plank_cy']*S)-p.height//2))
  # 四章印章：一路收集到的纪念，不写字
  seals=['tide','meadow','sky','lake'];sz=44*S;gap=14*S;tot=4*sz+3*gap;x0=cx-tot//2;y0=int(L['seals_cy']*S)-sz//2
  for i,s in enumerate(seals):
    im=img(POP+'reward_seal_%s.png'%s).resize((sz,sz),Image.LANCZOS)
    if night:im=tint(im,(0.92,0.92,0.96))
    c.alpha_composite(im,(x0+i*(sz+gap),y0))
  bx,by,bw,bh=L['btn'];b=button('回小岛',bw,bh,'primary',NIGHT_K if night else None)
  if state=='pressed':  # 按下：下沉 4pt
    by+=4
  c.alpha_composite(b,(bx*S,by*S))
  return c,L
if __name__=='__main__':
  import os;os.makedirs(OUT,exist_ok=True)
  for n in (0,1):
    im,L=ending(night=bool(n));im.convert('RGB').save(OUT+'ending_%s.png'%('night' if n else 'day'))
  print(L)
