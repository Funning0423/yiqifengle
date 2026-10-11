# 每个面板一张「旧版 vs 精简版」：旧版 = src/_old_snap（精简前最后一版），精简版 = 当前输出。python3 compare_old_vs_lite.py <c-popups>
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..'))
from ui_kit import font
from PIL import Image, ImageDraw
SNAP=os.path.join(HERE,'_old_snap'); BG=(246,240,226); INK=(70,52,34)
NT='通用：外框换无钉浅木、标题木牌去绳去钉、宽统一 680；间距 8 的倍数；字号最多三级。'
P=[('','pause','暂停（定稿：只换外框和宽度，布局不动）'),
   ('','pause_restart_confirm','重来确认：文案缩成一句「这一局会从头再来」'),
   ('','settings','设置：去掉分隔线、字体署名行、「轻点灯塔」提示行'),
   ('','reward_claim','领奖：去掉四颗星点装饰；间距 56 / 32 / 64 / 56（宝箱层 → 文字 ≥ 一行）'),
   ('','result_win','过关：去掉分隔线、「本关奖励」标签、宝箱 / 道具下的说明小字'),
   ('','result_lose','差一点点：去掉「步数用完了」大字、「还差 / 奖励」标签、分隔线；合成一句话'),
   ('night','pause_night','夜间 · 暂停'),('night','reward_claim_night','夜间 · 领奖'),('night','result_win_night','夜间 · 过关'),
   ('r2','item_intro_starlight','道具介绍：去掉「新道具」胶囊、条件小字、星点；只留大图 + 道具名 + 两行用途 + 「知道了」'),
   ('r2','bag_island','行囊 · 岛上：同已确认的精简样张'),
   ('r2','bag_level','行囊 · 关卡内：去副标题 / 小节标签 / 说明行 / 格子木框 /「关上」；宝箱每条只放图标、关卡名、「打开」'),
   ('r2','journey_book','旅程册：横幅章节牌 + 地区之窗（印记缩到窗角）+ 章节名 · 星数 ·小旗「挑战 x/4」'),
   ('r2','island_rest_day','海岛小憩 · 白天：改为点小屋弹出；去掉副标题、说明小字和提示卡'),
   ('r2','island_rest_night','海岛小憩 · 夜间：同上，主按钮「迎接晴昼」'),
   ('r2','result_unsaved','还没存上：去掉橙色纸条卡、分隔线、标签；宝箱灰显「存好后就能打开」'),
   ('r2','result_readonly','旅途回顾（只读）：标题改「旅途回顾」（文楷切图）；去掉光芒、成绩卡、胶囊和多行说明'),
   ('r2','board_beacon','灯塔目标格：放到橡果格，暖光提亮一档 + 后续路线淡点')]
made=[]
for sub,n,note in P:
    old=os.path.join(SNAP,sub,n+'.png'); new=os.path.join(CP,sub,n+'.png')
    if not os.path.exists(old): print('skip',n); continue
    A_=Image.open(old).convert('RGB'); B_=Image.open(new).convert('RGB'); h=1100
    A_=A_.resize((round(A_.width*h/A_.height),h)); B_=B_.resize((round(B_.width*h/B_.height),h))
    out=Image.new('RGB',(A_.width+B_.width+90,h+160),BG); d=ImageDraw.Draw(out)
    d.text((30,22),'旧版（精简前）',font=font(26),fill=INK); d.text((A_.width+60,22),'精简版',font=font(26),fill=INK)
    out.paste(A_,(30,66)); out.paste(B_,(A_.width+60,66))
    d.text((30,h+106),note,font=font(21,False),fill=INK,anchor='ls'); d.text((30,h+138),NT,font=font(19,False),fill=(120,96,70),anchor='ls')
    dd=os.path.join(CP,'r2/compare' if sub=='r2' else ('night' if sub=='night' else 'compare')); os.makedirs(dd,exist_ok=True)
    p=os.path.join(dd,'old_vs_lite_%s.jpg'%n); out.save(p,quality=86,optimize=True); made.append((p,os.path.getsize(p)))
for p,b in made: print(b,p)
