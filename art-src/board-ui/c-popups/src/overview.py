# 全部面板总览：python3 src/overview.py（在 c-popups 目录下运行），≤ 700 KB
import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from ui_kit import font
from PIL import Image, ImageDraw
L=[('pause.png','暂停'),('pause_restart_confirm.png','重来确认'),('settings.png','设置'),('reward_claim.png','领奖'),('result_win.png','过关啦'),('result_lose.png','差一点点'),
   ('r2/item_intro_starlight.png','道具介绍'),('r2/bag_island.png','行囊 · 岛上'),('r2/bag_level.png','行囊 · 关卡内'),('r2/journey_book.png','旅程册'),('r2/island_rest_day.png','海岛小憩 · 昼'),('r2/island_rest_night.png','海岛小憩 · 夜'),
   ('r2/result_unsaved.png','还没存上'),('r2/result_readonly.png','旅途回顾'),('r2/board_beacon.png','灯塔目标格'),('night/pause_night.png','夜间 · 暂停'),('night/reward_claim_night.png','夜间 · 领奖'),('night/result_win_night.png','夜间 · 过关')]
tw,th=300,650; cols=6; rows=(len(L)+cols-1)//cols
out=Image.new('RGB',(24+cols*(tw+24),80+rows*(th+64)),(246,240,226)); d=ImageDraw.Draw(out)
d.text((24,22),'《咦，起风了》全部面板 · 精简版总览（无钉浅木外框 · 宽 680 · 8 的倍数间距 · 三级字号）',font=font(30),fill=(70,52,34))
for k,(f,lab) in enumerate(L):
    r,c=divmod(k,cols); x=24+c*(tw+24); y=80+r*(th+64)
    out.paste(Image.open(f).convert('RGB').resize((tw,th),Image.LANCZOS),(x,y)); d.text((x+tw/2,y+th+30),lab,font=font(24),fill=(70,52,34),anchor='mm')
q=88
while True:
    out.save('overview_all_panels.jpg',quality=q,optimize=True); s=os.path.getsize('overview_all_panels.jpg')
    if s<690_000 or q<60: break
    q-=6
print(out.size,q,s)
