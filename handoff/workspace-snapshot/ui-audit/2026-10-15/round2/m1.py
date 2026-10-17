exec(open('mk.py').read())
b=Image.open('raw/p750-home-room.png').convert('RGB');a=b.copy();d=ImageDraw.Draw(a)
# 覆盖原引导文字区域（y≈711 css）
reg=a.crop((0,1380,750,1420)).resize((750,90));a.paste(reg,(0,1390))
btn(d,199,1360,352,112,'出门',44,True)
d.text((235,1300),'也可以向左轻拖看看门口 ›',fill=(255,255,255),font=f(24))
d2=ImageDraw.Draw(b);d2.rectangle([230,1418,520,1478],outline=(230,30,30),width=5);d2.text((180,1490),'只能拖动找门→点门把→24s过场',fill=(230,30,30),font=f(26))
# 跳过按钮示意
btn(d,750-32-128,200,128,64,'跳过 ›',26)
d.text((420,280),'过场中显示，可点区 64×44pt',fill=(255,255,255),font=f(22))
pair(b,a,'R1-home-exit-before-after.png',note='R1 房间底部加主页风格“出门”按钮 352×112 设计px（176×56 CSS），中心 y=H−safe.bottom−72；过场右上“跳过 ›”')
