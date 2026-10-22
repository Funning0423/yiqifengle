# 睡莲叶盖三态 + 与现有障碍（苔藓/根须/贝壳盖）对比：彩色 1x、灰度、放在湖畔格子上
from PIL import Image,ImageDraw,ImageFont,ImageOps
F=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',s,index=2)
R='/workspace/r6/board/rawall/'
items=[('睡莲·满(2层)','obstacle_lily_full'),('睡莲·受击(1层)','obstacle_lily_hit'),('睡莲·清除','obstacle_lily_clear'),('苔藓(草原)','obstacle_moss'),('根须(草原)','obstacle_roots'),('贝壳盖(天空)','obstacle_shell_2')]
C=200; S=Image.new('RGB',(40+len(items)*(C+20),80+2*(C+60)),(250,246,236)); d=ImageDraw.Draw(S)
d.text((20,16),'湖畔专属障碍「睡莲叶盖」三态 · 与其它区域障碍对比（上：彩色，下：灰度）',font=F(22),fill=(63,94,99))
for i,(lb,n) in enumerate(items):
    t=Image.open(R+('tile_a_lake' if i<3 else 'tile_a')+'.png').convert('RGBA').resize((C,C)); o=Image.open(R+n+'.png').convert('RGBA').resize((C,C)); t.alpha_composite(o)
    x=20+i*(C+20); bg=Image.new('RGBA',(C,C),(78,149,146,255)); bg.alpha_composite(t)
    S.paste(bg.convert('RGB'),(x,90)); S.paste(ImageOps.grayscale(bg.convert('RGB')).convert('RGB'),(x,90+C+60)); d.text((x,90+C+8),lb,font=F(18),fill=(99,63,33))
S.save('/workspace/r6/out/obstacle_lily_states.png'); print('ok')
# v2：睡莲 vs 叶子棋子（彩色 / 灰度 / 眯眼），都放在湖畔格子上，按游戏里的显示比例（棋子 192² 对应 171 px/格）
from PIL import ImageFilter
def cell(n,piece=False):
    t=Image.open(R+'tile_a_lake.png').convert('RGBA').resize((C,C)); o=Image.open(R+n+'.png').convert('RGBA')
    if piece: o=o.resize((round(C*192/171),)*2); bg=Image.new('RGBA',(o.width,o.height),(0,0,0,0)); x=(o.width-C)//2; bg.paste(t,(x,x)); bg.alpha_composite(o); bg=bg.crop((x,x,x+C,x+C))
    else: bg=t.copy(); bg.alpha_composite(o.resize((C,C)))
    b=Image.new('RGBA',(C,C),(180,201,182,255)); b.alpha_composite(bg); return b.convert('RGB')
pairs=[('睡莲·满','obstacle_lily_full',False),('睡莲·受击','obstacle_lily_hit',False),('叶子棋子','piece_leaf',True)]
modes=[('彩色',lambda im:im),('灰度',lambda im:ImageOps.grayscale(im).convert('RGB')),('眯眼',lambda im:im.resize((C//4,C//4),Image.LANCZOS).filter(ImageFilter.GaussianBlur(2)).resize((C,C)))]
S=Image.new('RGB',(40+len(modes)*(3*C+40),80+C+50),(250,246,236)); d=ImageDraw.Draw(S)
d.text((20,16),'睡莲叶盖 vs 叶子棋子：彩色 / 灰度 / 眯眼（睡莲压低明度、偏橄榄蓝绿、扁平贴格 + 浅水圈 + 高光弧）',font=F(20),fill=(63,94,99))
for j,(mn,fn) in enumerate(modes):
    for i,(lb,n,pc) in enumerate(pairs):
        x=20+j*(3*C+40)+i*C; S.paste(fn(cell(n,pc)),(x,80)); d.text((x+6,80+C+8),f'{mn}·{lb}',font=F(15),fill=(99,63,33))
S.save('/workspace/r6/out/lily_vs_leaf.png')
import numpy as np
for lb,n,pc in pairs:
    g=np.asarray(ImageOps.grayscale(cell(n,pc))).astype(float); print(lb,'灰度均值',g[40:160,40:160].mean().round(1))
