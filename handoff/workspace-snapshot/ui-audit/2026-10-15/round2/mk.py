from PIL import Image,ImageDraw,ImageFont
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def f(s):return ImageFont.truetype(FB,s)
R1='../raw/'
def pair(b,a,out,tb='修改前',ta='修改后（示意）',note=''):
  W=b.width+a.width+30;H=max(b.height,a.height)+90+(50 if note else 0)
  S=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(S)
  d.text((10,20),tb,fill=(200,30,30),font=f(40));d.text((b.width+40,20),ta,fill=(20,140,60),font=f(40))
  S.paste(b,(0,80));S.paste(a,(b.width+30,80))
  if note:d.text((10,H-45),note,fill='black',font=f(28))
  S.save('mockups/'+out)
def btn(d,x,y,w,h,txt,fs=34,primary=False):
  # 主页风格：奶油底 + 深棕描边 + 底部厚度投影
  face=(60,120,110) if primary else (247,238,215); edge=(110,78,45); tc=(255,255,255) if primary else (90,60,30)
  d.rounded_rectangle([x,y+8,x+w,y+h+8],radius=h//2,fill=(120,88,55))
  d.rounded_rectangle([x,y,x+w,y+h],radius=h//2,fill=face,outline=edge,width=4)
  ft=f(fs);bb=d.textbbox((0,0),txt,font=ft);d.text((x+(w-bb[2])/2,y+(h-bb[3])/2-4),txt,fill=tc,font=ft)
