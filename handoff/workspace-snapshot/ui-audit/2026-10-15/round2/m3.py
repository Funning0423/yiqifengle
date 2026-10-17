exec(open('mk.py').read())
# R3 loading
b=Image.open('raw/p750-loading-2500.png').convert('RGB');a=b.copy();d=ImageDraw.Draw(a)
W,H=a.size
reg=a.crop((0,1235,W,1255)).resize((W,170));a.paste(reg,(0,1262))
x0,x1,y=150,600,1300
d.rounded_rectangle([x0,y,x1,y+12],radius=6,fill=(225,214,190));d.rounded_rectangle([x0,y,x0+int((x1-x0)*0.55),y+12],radius=6,fill=(80,150,140))
t='她在窗前坐下……';ft=f(30);bb=d.textbbox((0,0),t,font=ft);d.text(((W-bb[2])/2,y+36),t,fill=(107,78,46),font=ft)
d2=ImageDraw.Draw(b);d2.rectangle([110,1262,640,1400],outline=(230,30,30),width=5)
pair(b,a,'R3-loading-before-after.png',note='R3 去掉Cocos黑底splash；进度条 0.6W×6px；文字15px #6B4E2E，条下12px；启动图→房间400ms交叉淡化')
# R4 daynight
k1=Image.open('video/key-day-t44.4.png').convert('RGB');k2=Image.open('video/key-day-t44.5.png').convert('RGB')
sz=(375,812);k1s,k2s=k1.resize(sz),k2.resize(sz)
before=Image.new('RGB',(750,812),'white');before.paste(k1s,(0,0));before.paste(k2s,(375,0))
after=Image.new('RGB',(1500,812),'white')
for i,al in enumerate([0,0.33,0.66,1]):after.paste(Image.blend(k1s,k2s,al),(i*375,0))
dd=ImageDraw.Draw(before);dd.text((10,10),'t=44.4s',fill='red',font=f(28));dd.text((385,10),'t=44.5s 一帧跳变',fill='red',font=f(28))
da=ImageDraw.Draw(after)
for i,t in enumerate(['0ms','270ms','530ms','800ms']):da.text((i*375+10,10),t,fill=(20,140,60),font=f(28))
pair(before,after,'R4-daynight-before-after.png',note='R4 昼夜切换：面板关闭后 0.8s ease-in-out 渐变（天空/海水/UI tint 同一曲线）')
