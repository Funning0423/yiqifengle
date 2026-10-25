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
# v2：背景改为 Blender 实时场景分层渲染（render_ending_scene.py / render_all.sh）：
#   bg = 湖畔场景+木架；chime = 风铃（16 个摇摆相位）；girl = 游戏角色。女孩按屏幕尺寸摆位，游戏里由镜头构图实现。
SCENE=HERE+'../render/ending_scene/'
NIGHT_GRADE=(.42,.48,.72)
def alpha_box(im):
  b=im.split()[3].point(lambda v:255 if v>8 else 0).getbbox();return b
def _grade(im):
  r,g,b,a=im.split();k=NIGHT_GRADE;return Image.merge('RGBA',(r.point(lambda v:int(v*k[0])),g.point(lambda v:int(v*k[1])),b.point(lambda v:int(v*k[2])),a))
_cache={}
def layer(night,name,phase=0):
  key=(night,name,phase)
  if key not in _cache:
    d=SCENE+('night' if night else 'day')+'/'+name+'/'
    _cache[key]=img(d+('still.png' if name!='chime' else 'sway_%03d.png'%phase))
  return _cache[key]
def girl_place(W,H,L,gh_native):
  """女孩框：脚离按钮上沿 ≥16pt，头离印章下沿 ≥12pt；高度取 min(原生高度, 可用间隙)，最小 48pt。"""
  bx,by,bw,bh=L['btn'];top=L['seals_cy']+22+12;bottom=by-16
  h=max(48,min(gh_native,bottom-top));feet=bottom;head=feet-h
  return head,feet,h
def ending(W=390,H=844,night=False,state='normal',phase=0):
  L=layout(W,H)
  bg=layer(night,'bg').copy();ch=layer(night,'chime',phase);bg.alpha_composite(ch)
  cb=alpha_box(ch)  # 风铃在 780×1688 渲染里的像素框
  k=max(W/390,H/844);sw,sh=int(780*k+.5),int(1688*k+.5)
  ccy=(cb[1]+cb[3])/2/2*k
  y0=int(max(0,min(sh-H*S,(ccy-L['chime_cy'])*S)));x0=(sw-W*S)//2
  sc_=bg.resize((sw,sh),Image.LANCZOS).crop((x0,y0,x0+W*S,y0+H*S))
  if night:
    sc_=_grade(sc_);ccx=((cb[0]+cb[2])/2/2*k-x0/S);cy_=ccy-y0/S;R=150*k
    gl=glow(int(R*4*S),int(R*S),(255,206,130),0.42);sc_.alpha_composite(gl,(int(ccx*S-gl.width/2),int(cy_*S-gl.height/2)))
  c=Image.new('RGBA',(W*S,H*S));c.alpha_composite(sc_)
  chime_box=tuple(v/2*k-o for v,o in zip(cb,(x0/S,y0/S,x0/S,y0/S)))
  # 女孩
  gi=layer(night,'girl');gb=alpha_box(gi);gcrop=gi.crop(gb)
  if night:gcrop=_grade(gcrop)
  gh_native=(gb[3]-gb[1])/2*k
  head,feet,gh=girl_place(W,H,L,gh_native)
  sc2=gh/((gb[3]-gb[1])/2);gw=(gb[2]-gb[0])/2*sc2
  gx=W*0.64-gw/2
  g2=gcrop.resize((max(1,int(gw*S)),max(1,int(gh*S))),Image.LANCZOS)
  shd=Image.new('RGBA',(int(gw*1.5*S),int(gh*0.08*S)));ImageDraw.Draw(shd).ellipse((0,0,shd.width,shd.height),fill=(30,40,20,95) if not night else (0,0,0,110))
  shd=shd.filter(ImageFilter.GaussianBlur(3*S));c.alpha_composite(shd,(int((gx-gw*0.45)*S),int((feet-gh*0.05)*S)))
  c.alpha_composite(g2,(int(gx*S),int(head*S)))
  girl_box=(gx,head,gx+gw,feet)
  g=Image.new('L',(1,H*S));[g.putpixel((0,y),int(max(0,(y/(H*S)-.70)/.30)*(60 if not night else 100))) for y in range(H*S)]
  c.alpha_composite(Image.merge('RGBA',[Image.new('L',(W*S,H*S),v) for v in ((40,26,10) if not night else (5,8,20))]+[g.resize((W*S,H*S))]))
  cx=W*S//2
  p=plank('旅程完成',196,58,24,NIGHT_K if night else None);c.alpha_composite(p,(cx-p.width//2,int(L['plank_cy']*S)-p.height//2))
  seals=['tide','meadow','sky','lake'];sz=44*S;gap=14*S;tot=4*sz+3*gap;sx0=cx-tot//2;sy0=int(L['seals_cy']*S)-sz//2
  for i,s_ in enumerate(seals):
    im=img(POP+'reward_seal_%s.png'%s_).resize((sz,sz),Image.LANCZOS)
    if night:im=tint(im,(0.92,0.92,0.96))
    c.alpha_composite(im,(sx0+i*(sz+gap),sy0))
  bx,by,bw,bh=L['btn'];b=button('回小岛',bw,bh,'primary',NIGHT_K if night else None)
  if state=='pressed':by+=4
  c.alpha_composite(b,(bx*S,by*S))
  L=dict(L);L['chime_box']=chime_box;L['girl_box']=girl_box
  return c,L
if __name__=='__main__':
  import os;os.makedirs(OUT,exist_ok=True)
  for n in (0,1):
    im,L=ending(night=bool(n));im.convert('RGB').save(OUT+'ending_%s.png'%('night' if n else 'day'))
  print(L)
