import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from endfix import *
from PIL import ImageFont
OUTD=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); NOUT=os.path.join(OUTD,'nine')
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',26,index=2)
def lab(im,t):
  o=Image.new('RGB',(im.width,im.height+46),(250,244,232)); o.paste(im.convert('RGB'),(0,46)); ImageDraw.Draw(o).text((im.width//2,8),t,font=F,fill=(60,40,20),anchor='mt'); return o
def row(ims,g=20):
  H=max(i.height for i in ims); o=Image.new('RGB',(sum(i.width for i in ims)+g*(len(ims)+1),H+2*g),(250,244,232)); x=g
  for i in ims: o.paste(i,(x,g)); x+=i.width+g
  return o
s390,_=ending9(390,844,'S'); s320,_=ending9(320,568,'S')
s390.convert('RGB').save(f'{NOUT}/ending9_390.png'); s320.convert('RGB').save(f'{NOUT}/ending9_320x568.png')
p390,_=ending9(390,844,'P'); p320,_=ending9(320,568,'P')
old=Image.open(f'{NOUT}/ending9_390.old.png') if os.path.exists(f'{NOUT}/ending9_390.old.png') else None
z=lambda im,box:im.crop(box).resize(((box[2]-box[0])*2,(box[3]-box[1])*2),Image.LANCZOS)
box=(100,960,700,1240)
row([lab(old,'改前（模糊底板）'),lab(p390,'试 1：圆角纸带（避开柱子后偏右）'),lab(s390,'试 2：无底板 + 小软投影（推荐）')]).save(f'{NOUT}/ending9_fix_compare.png')
row([lab(z(old,box),'改前 放大'),lab(z(p390,box),'纸带 放大'),lab(z(s390,box),'投影 放大')]).save(f'{NOUT}/ending9_fix_zoom.png')
row([lab(p320,'纸带 · 320×568'),lab(s320,'投影 · 320×568')]).save(f'{NOUT}/ending9_fix_320.png')
row([lab(ending9(390,844,'S',t=t)[0].resize((390,844)),f'{int(t*1000)} ms') for t in (0,0.15,0.3,0.5,0.75)]).save(f'{NOUT}/ending9_keyframes.png')
e6,_=ending6(); e6.convert('RGB').save(f'{OUTD}/ending_390.png')
old6=Image.open(f'{OUTD}/ending_390.old.png')
row([lab(old6,'6 枚版 改前（同样的模糊底板）'),lab(e6,'6 枚版 改后')]).save(f'{OUTD}/ending6_fix_compare.png')
row([lab(Image.open('/workspace/wechat-game/work/post-island-ui/ui-design/post-island/ending/ending_day.png'),'现状：4 枚印章'),lab(e6,'新：6 枚印章（雪山未得为空白章）')]).save(f'{OUTD}/compare_ending.png')
row([lab(ending6(t=t)[0].resize((390,844)),f'{int(t*1000)} ms') for t in (0,0.12,0.28,0.44,0.64)]).save(f'{OUTD}/keyframes_ending.png')
print('ok')
