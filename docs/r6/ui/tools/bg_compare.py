# 湖畔背景：本次离线渲染（游戏机位）/ 引擎参考图 / 模拟器截图 三联
from PIL import Image,ImageDraw,ImageFont
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',20,index=2)
R='/workspace/yiqifengle/work/art-r5-scene-backlog/handoff/workspace-snapshot/art/regions/lakeside/ENGINE_COLOR_REFERENCE/engine_cam_r5h3/ref_390x844_graded.png'
it=[('r6 离线渲染（白天）','/workspace/r6/work/lake_day_final.png'),('r6 离线渲染（夜间）','/workspace/r6/work/lake_night_final.png'),('引擎参考 r5h3',R),('模拟器截图 r5','/workspace/yiqifengle/previews/Voice-bot/r5-lakeside-fill/after_fix_day_390x844.png')]
w,h=360,779; S=Image.new('RGB',(20+len(it)*(w+20),h+110),(250,246,236)); d=ImageDraw.Draw(S)
d.text((20,12),'湖畔棋盘背景对照：机位一致；sample.py 结果 5/11 点通过（FAIL），差异主要在远水与桥栏',font=F,fill=(63,94,99))
for i,(n,p) in enumerate(it):
    im=Image.open(p).convert('RGB').resize((w,h),Image.LANCZOS); x=20+i*(w+20); S.paste(im,(x,80)); d.text((x,50),n,font=F,fill=(99,63,33))
S.save('/workspace/r6/out/bg_lakeside_compare.jpg',quality=88); print('ok')
