# r2 对比图：现状（Funning 截图 / 代码模拟 / 「新增」）| 新版 | T9 基准列。python3 sheets2.py <c-popups>
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); sys.argv=[sys.argv[0],CP]
import sheets as SH
from ui_kit import *
R2O=os.path.join(CP,'r2'); CMP=os.path.join(R2O,'compare'); os.makedirs(CMP,exist_ok=True)
CUR=os.path.join(CP,'src/inputs/current_r2'); BG=SH.BG; INK=SH.INK
def placeholder(w,h,lines):
    im=Image.new('RGBA',(w,h),(232,226,212,255)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((10,10,w-10,h-10),radius=24,outline=(180,160,130),width=4)
    y=h/2-len(lines)*26
    for i,t in enumerate(lines): d.text((w/2,y+i*52),t,font=font(40 if i==0 else 26,i==0),fill=INK,anchor='mm')
    return im
def compare(name,news,cur,cur_title,note,new_title='新版（r2）'):
    Hc=1180; nw=[fith(n.convert('RGBA'),Hc) for n in news]; NW=sum(i.width for i in nw)+20*(len(nw)-1)
    out=Image.new('RGBA',(20+560+30+NW+30+640+20,Hc+130),BG+(255,)); d=ImageDraw.Draw(out)
    d.text((20,22),'现状 · '+cur_title,font=font(26),fill=INK); d.text((610,22),new_title,font=font(26),fill=INK); d.text((610+NW+30,22),'基准：T9 路牌 + 行囊 / 旅程册 / 设置',font=font(26),fill=INK)
    c=cur.convert('RGBA'); s=fith(c,Hc)
    if s.width>560: s=fitw(c,560)
    out.alpha_composite(s,(20+(560-s.width)//2,70))
    x=610
    for i in nw: out.alpha_composite(i,(x,70)); x+=i.width+20
    out.alpha_composite(SH.t9col(Hc),(610+NW+30,70))
    for k,line in enumerate(note.split('\n')): d.text((20,Hc+96+k*30),line,font=font(21,False),fill=INK,anchor='ls')
    p=os.path.join(CMP,'compare_%s.jpg'%name); out.convert('RGB').save(p,quality=86,optimize=True)
    q=86
    while os.path.getsize(p)>700_000 and q>60: q-=6; out.convert('RGB').save(p,quality=q,optimize=True)
O=lambda n: Image.open(os.path.join(R2O,n+'.png')); Cu=lambda n: Image.open(os.path.join(CUR,n+'.png'))
NT='精简版（Funning 确认）：一层无钉浅木外框、宽 680；无副标题 / 小节标签 / 虚线 / 小装饰；间距 8 的倍数；字号最多三级。'
compare('item_intro_starlight',[O('item_intro_starlight')],placeholder(560,1180,['新增','现状没有道具介绍弹窗','道具名只在道具栏下方小字里']),'（无）',
 '新增：首次拿到一件道具时弹出。3D 道具大图 + 文楷标题（道具名）+ 两行用途 +「知道了」。去掉「新道具」胶囊、条件小字和星点。\n'+NT,new_title='新版（精简）')
compare('bag_island',[O('bag_island')],Cu('bag_island'),'岛上的旅人的行囊（Funning 截图）',
 '道具格 160×192（3D 图标 136 px）只有一层很浅的平底，数量角标 22 px 小胶囊，0 件整格灰化；三件地区道具是 v2 新模型。「还没有装扮」= 半透明蝴蝶结 + 一句话。\n'+NT,new_title='新版（精简）')
compare('bag_level',[O('bag_level')],Cu('bag_level'),'关卡里打开的行囊（Funning 截图）',
 '盖在 v3.1 棋盘上，没有珍珠。道具格同岛上版；宝箱每条只放宝箱图标、关卡名、「打开」。关闭只用右上角 ×。\n'+NT,new_title='新版（精简）')
compare('journey_book',[O('journey_book')],Cu('journey_book'),'旅程册（Funning 截图）',
 '每章一张横幅路牌：左边一扇「地区之窗」（潮汐 = combined_visual_m.glb 实渲；草甸 / 天空 = 低多边形占位，图上标「占位」），印记缩到 64 px 压在窗角；\n章节名 · 主线星数（每章 12 星）·小旗「挑战 x/4」；天空回声未解锁 = 去色 + 加雾 + 金锁。'+NT,new_title='新版（精简）')
compare('island_rest',[O('island_rest_night'),O('island_rest_day')],Cu('island_rest'),'海岛小憩（Funning 截图，夜间）',
 '改成点小屋时弹出。两扇昼夜小窗（当前那扇金边）+ 主按钮：夜间「迎接晴昼」、白天「看看夜色」（IslandJourneyOverlay.ts）。\n去掉副标题、「天色会慢慢转过去」和提示卡（已经是点小屋打开的，不用再提示）。'+NT,new_title='新版（左：夜间　右：白天）')
compare('result_unsaved',[O('result_unsaved')],placeholder(560,1180,['无截图','代码：结算奶油板','标题「还没存上」','+「返回海岛」「重试保存」']),'还没存上（只有代码）',
 '出现条件：result.unsaved / run.unsaved（存档失败）。星星 + 分数 + 一行「成绩还没存进旅程册」；宝箱灰显「存好后就能打开」；「重试保存」/「返回海岛」。\n'+NT,new_title='新版（精简）')
compare('result_readonly',[O('result_readonly')],placeholder(560,1180,['无截图','代码：error.readonly','标题沿用「再走一次」','说明行「记录保护 · 请返回检查」']),'只读结算（只有代码）',
 '出现条件：error.readonly（记录只读，provider 拒绝写入）。标题「旅途回顾」（文楷切图）；星星 + 分数 + 一行带锁的说明；只有「返回海岛」。\n'+NT,new_title='新版（精简）')
cur=Image.open('/tmp/fang_bb/board_beacon_current.png')
compare('board_beacon',[O('board_beacon'),Image.open('/tmp/fang_bb/board_beacon_typed.png')],cur,'灯塔目标格（代码模拟）',
 '目标格放在橡果格上：暖光提亮一档（外溢更大更亮、格内暖金更浅、中心亮点更白）+ 3D 金色灯座框 + 右上角亮着的小灯塔；\n后面几格的路线用很淡的暖色小点标出（每格中心一颗 + 格间两颗过渡点）。右图：指定图案时灯塔脚下的小圆牌。',new_title='新版（左：任意图案　右：指定橡果）')
# 灯塔近看 + 眯眼测试
from PIL import ImageFilter
srcs=[('现状（代码 2px 描边）','/tmp/fang_bb/board_beacon_current.png'),('新版 · 任意图案',os.path.join(R2O,'board_beacon.png')),('新版 · 指定橡果','/tmp/fang_bb/board_beacon_typed.png'),('新版 + 提示同时出现','/tmp/fang_bb/board_beacon_hint.png')]
cw,chh=420,420; out=Image.new('RGB',(20+4*(cw+20),70+chh+60+300+60),BG); d=ImageDraw.Draw(out)
d.text((20,20),'灯塔目标格近看（1:1）与眯眼测试（整盘缩到 25% + 高斯模糊 2px）',font=font(26),fill=INK)
for k,(lab,pth) in enumerate(srcs):
    im=Image.open(pth).convert('RGB'); x=20+k*(cw+20)
    c=im.crop((375-0.5*82-105+82*1,770-82*1-105-0,375+82*1+105+0.5*82,770-82*1+105)).resize((cw,chh))
    c=im.crop((470-210,690-210,470+210,690+210)); out.paste(c,(x,70))
    d.text((x+cw/2,70+chh+28),lab,font=font(22),fill=INK,anchor='mm')
    sq=im.crop((40,440,710,1100)).resize((168,165)).filter(ImageFilter.GaussianBlur(2)).resize((306,300),Image.NEAREST); out.paste(sq,(x+(cw-306)//2,70+chh+60))
out.save(os.path.join(R2O,'beacon_closeup.png'),optimize=True)
# 橡果格特写：当前目标格（橡果）2x，左：上一版亮度（旧快照），右：提亮一档 + 路线淡点
AC=Image.new('RGB',(20+2*(560+20)+0,70+560+90),BG); d=ImageDraw.Draw(AC)
d.text((20,20),'橡果格特写（2x）：暖光提亮一档；右下方很淡的点 = 后面几格的路线',font=font(26),fill=INK)
new=Image.open(os.path.join(R2O,'board_beacon.png')).convert('RGB').crop((457-140,672-140,457+140,672+140)).resize((560,560),Image.LANCZOS)
old_=Image.open('/tmp/fang_bb/board_beacon_prev.png').convert('RGB').crop((457-140,672-140,457+140,672+140)).resize((560,560),Image.LANCZOS)
AC.paste(old_,(20,70)); AC.paste(new,(600,70))
d.text((20+280,70+560+40),'上一档（同一格，原暖光强度）',font=font(22),fill=INK,anchor='mm'); d.text((600+280,70+560+40),'新版：提亮一档 + 路线淡点',font=font(22),fill=INK,anchor='mm')
AC.save(os.path.join(R2O,'beacon_acorn_closeup.png'),optimize=True); import subprocess; subprocess.run(['pngquant','--force','--quality','80-95','--speed','1','--strip','--output',os.path.join(R2O,'beacon_acorn_closeup.png'),os.path.join(R2O,'beacon_acorn_closeup.png')])
print('ok')
