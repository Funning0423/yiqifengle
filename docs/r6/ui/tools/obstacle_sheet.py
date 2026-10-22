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
