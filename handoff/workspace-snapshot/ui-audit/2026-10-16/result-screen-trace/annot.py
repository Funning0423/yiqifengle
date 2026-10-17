from PIL import Image,ImageDraw,ImageFont
F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
f=lambda s:ImageFont.truetype(F,s)
b=Image.open('build05-home-2607de6/testpkg/web_level1_won.png').convert('RGB')
W=b.width+760;c=Image.new('RGB',(W,b.height),(250,246,238));c.paste(b,(0,0));d=ImageDraw.Draw(c)
R=(225,30,30);O=(240,130,0);Y=(200,160,0)
marks=[('1',R,(56,880,214,1022),'高'),('2',R,(44,868,704,1252),'高'),('3',O,(44,1262,706,1362),'中')]
for n,col,bx,sev in marks:
  d.rectangle(bx,outline=col,width=6);x,y=(bx[2]-40,bx[1]) if n=='2' else (bx[0],bx[1])
  d.ellipse((x-6,y-30,x+48,y+24),fill=col);d.text((x+21,y-3),n,fill='white',font=f(34),anchor='mm')
# ghost target positions
d.rectangle((255,860,495,1076),outline=(30,140,60),width=4);d.text((375,1070),'目标：宝箱居中 ≥240×216',fill=(30,140,60),font=f(22),anchor='mb')
x0=b.width+30;y=40
def t(s,sz=26,col=(60,40,20),dy=None):
  global y
  for line in s.split('\n'):
    d.text((x0,y),line,fill=col,font=f(sz));y+=(dy or int(sz*1.45))
t('结算界面问题（379e137 / 2607de6 同样）',32,(30,30,30));y+=10
t('① 高 · 宝箱太小、贴左',28,R)
t('现状：72×65 宝箱挤在 96px 左栏，\n“打开宝箱”文字在右侧。\n改法：宝箱单独作为主视觉，水平居中、\n放大到 ≥240×216，后面加 fx_rays 光晕；\n下方一个居中按钮“全部领取”220×56。',23);y+=12
t('② 高 · 两条长按钮，图标贴左',28,R)
t('现状：「打开宝箱」「领取地区道具」\n是两条 335×96 长条，要分两次领。\n改法：地区道具做成图标卡\n（约 120×140，图标在上、名字在下，\n放在宝箱下方，可并排）；“全部领取”\n一次收下，获得面板只点一次“收下”。',23);y+=12
t('③ 中 · 底部按钮风格不统一',28,O)
t('现状：「下一关」深绿实心、「回小岛」\n浅灰描边，底板被缩到 0.45，厚度单薄。\n改法：两个都换成主页（行囊/旅程册）\n那种 3D 木牌按钮：同高 56、artScale 0.6、\n底部投影 ≥4px；下一关主色、回小岛次色，\n只靠颜色区分主次，不换造型。',23);y+=18
t('来源：2026-10-15 issues.md #1 #2 #9、round2 R2',22,(90,90,90))
t('①② 已在 PR #55（ui/audit-fix-20261015，',22,(90,90,90))
t('5575c78 / 16d7ca1）做过，未合入本链；',22,(90,90,90))
t('③ 没有人做过。',22,(90,90,90))
c.save('result-screen-trace/result-screen-annotated.png');print(c.size)
