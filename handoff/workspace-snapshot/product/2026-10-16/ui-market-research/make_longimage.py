import json
from PIL import Image,ImageDraw,ImageFont
S=json.load(open("sources.json"))
F="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
import os
if not os.path.exists(F): F="/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
f=lambda s:ImageFont.truetype(F,s)
rows=[
("Monument Valley 纪念碑谷",["monument-valley_03.jpg","monument-valley_05.jpg","monument-valley-2_05.jpg"],"HUD 只有左上一个小圆点(菜单)；整屏=关卡本身。章节标题卡用细字+大面积渐变留白。不单调来自每关换主色。"),
("Sky 光遇",["sky_01.jpg","sky_04.jpg"],"商店截图几乎不露 HUD；画面中心留给角色与暖色光源，光本身就是视觉焦点（HUD 细节截图中未见）。"),
("Alto's Odyssey",["altos-odyssey_01.jpg","altos-odyssey_03.jpg"],"商店图几乎零 UI；丰富感完全靠昼夜/天气的天空渐变。适合借鉴我们的白天/夜间。"),
("Mini Metro",["mini-metro_03.jpg","mini-metro_04.jpg"],"选城/升级弹窗：白底、大字标题、2 个选项图标+短说明，无边框卡片，靠留白分组。"),
("Two Dots",["two-dots_01.jpg","two-dots_04.jpg"],"HUD：顶部一条胶囊(步数+目标)，底角两个小圆钮；中间全是棋盘。色点即配色，UI 本身灰白。"),
("旅行青蛙 旅かえる",["tabikaeru_01.jpg","tabikaeru_03.jpg","tabikaeru_05.jpg"],"主页=场景插画，按钮缩在四角小方块；弹窗：圆角浅蓝面板+1 个主按钮+右上 ×。"),
("Alba (ustwo)",["alba_02.jpg","alba_04.jpg"],"低多边形 3D 竖屏：底部一排 4 个线框图标+中间罗盘，左上菜单；其余全是世界。"),
("Florence",["florence_02.jpg","florence_04.jpg"],"交互区与叙事画面上下分区，进度条是唯一 HUD；纯色块+描边，颜色少但饱和。"),
]
W=1600;PAD=40;H_IMG=620
blocks=[]
for title,fs,note in rows:
  ims=[]
  for fn in fs:
    im=Image.open("images/"+fn).convert("RGB")
    h=H_IMG if im.height>im.width else 420
    im=im.resize((int(im.width*h/im.height),h))
    if im.width>W-2*PAD: im=im.resize((W-2*PAD,int(im.height*(W-2*PAD)/im.width)))
    ims.append((fn,im))
  # wrap rows of images
  lines=[];cur=[];cw=0
  for fn,im in ims:
    if cur and cw+im.width+20>W-2*PAD: lines.append(cur);cur=[];cw=0
    cur.append((fn,im));cw+=im.width+20
  lines.append(cur)
  h=90+sum(max(i.height for _,i in l)+60 for l in lines)+90
  b=Image.new("RGB",(W,h),(250,245,236));d=ImageDraw.Draw(b)
  d.text((PAD,25),title,font=f(40),fill=(60,50,40))
  y=90
  for l in lines:
    x=PAD
    for fn,im in l:
      b.paste(im,(x,y));d.rectangle([x,y,x+im.width,y+im.height],outline=(200,190,175),width=2)
      d.text((x,y+im.height+4),fn,font=f(16),fill=(120,110,100));d.text((x,y+im.height+24),"App Store id"+S[fn]["page"].split("/id")[-1],font=f(16),fill=(120,110,100))
      x+=im.width+20
    y+=max(i.height for _,i in l)+60
  # wrap note
  t="";ty=y
  for ch in note:
    if d.textlength(t+ch,font=f(28))>W-2*PAD: d.text((PAD,ty),t,font=f(28),fill=(160,80,40));ty+=38;t=""
    t+=ch
  d.text((PAD,ty),t,font=f(28),fill=(160,80,40))
  blocks.append(b)
# header + ours
hdr=Image.new("RGB",(W,260),(60,50,40));d=ImageDraw.Draw(hdr)
d.text((PAD,40),"《咦 起风了》UI 布局市场调研 · 简洁游戏对比",font=f(52),fill=(255,240,220))
d.text((PAD,130),"截图均为 Apple App Store 官方商店截图(2026-10-16 下载)，每张下方标注 App Store id，完整链接见 REPORT.md。",font=f(26),fill=(230,215,195))
d.text((PAD,175),"羊了个羊 / 跳一跳：未找到可标注来源的真实截图，未收录。",font=f(26),fill=(255,180,150))
ours=Image.open("/workspace/wechat-game/ui-audit/2026-10-16/result-screen-trace/result-screen-annotated.png").convert("RGB")
ours=ours.resize((W-2*PAD,int(ours.height*(W-2*PAD)/ours.width)))
ob=Image.new("RGB",(W,ours.height+200),(240,232,220));d=ImageDraw.Draw(ob)
d.text((PAD,25),"对照：我们当前结算界面 (379e137/2607de6，ui-audit 已有标注)",font=f(36),fill=(60,50,40))
ob.paste(ours,(PAD,90))
d.text((PAD,ours.height+110),"问题：3 个区块+2 个长按钮+2 个底部按钮 ≈ 9 个元素，焦点分散；竞品结算/弹窗通常 1 焦点 + ≤2 按钮。",font=f(26),fill=(160,80,40))
allb=[hdr]+blocks+[ob]
out=Image.new("RGB",(W,sum(b.height for b in allb)),(255,255,255));y=0
for b in allb: out.paste(b,(0,y));y+=b.height
out.save("ui-market-research-longimage.png",optimize=True);print(out.size)
