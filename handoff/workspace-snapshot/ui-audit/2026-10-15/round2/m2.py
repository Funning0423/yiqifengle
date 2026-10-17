exec(open('mk.py').read())
b=Image.open(R1+'p750-day-09-result.png').convert('RGB');a=b.copy();d=ImageDraw.Draw(a)
bg=b.getpixel((90,820))[:3]
# 清空面板内容区 (css 20..355, 300..700)
d.rectangle([42,712,708,1288],fill=bg)
chest=b.crop((64,916,208,1046)).resize((240,216))
# 光晕
for r,al in [(180,(250,236,190)),(140,(252,242,205))]:d.ellipse([375-r,930-r+40,375+r,930+r+40],fill=al)
a.paste(chest,(255,860))
btn(d,155,1090,440,112,'全部领取',40,True)
d.text((205,1214),'宝箱 + 潮汐网 一次收下',fill=(120,90,60),font=f(26))
d.text((85,740),'6 步 · 剩 22 步 · 已保存 · 主线05已开放',fill=(130,100,70),font=f(28))
# 保留原底部按钮
a.paste(b.crop((40,1290,712,1386)),(40,1300))
d2=ImageDraw.Draw(b);d2.rectangle([40,886,712,1282],outline=(230,30,30),width=5);d2.text((60,1210),'两条奖励+3次点击,宝箱偏左',fill=(230,30,30),font=f(26))
pair(b,a,'R2-result-before-after.png',note='R2 结算三段式：星/分 → 居中宝箱 240×216 设计px + “全部领取” 440×112 → 下一关/回小岛；次要信息合并为一行 28px')
