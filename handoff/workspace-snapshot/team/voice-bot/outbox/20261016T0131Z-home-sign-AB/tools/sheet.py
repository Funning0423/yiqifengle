from PIL import Image,ImageDraw,ImageFont
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',22,index=2)
for view in ['far','close']:
  for res in ['402x874','600x800']:
    ims=[Image.open(f'fin/{v}_{view}_{res}.png') for v in ['cur','A','B']]; w,h=ims[0].size; g=12; top=40
    S=Image.new('RGB',(3*w+4*g,h+top+g+26),(30,30,30)); d=ImageDraw.Draw(S)
    for i,(im,lab) in enumerate(zip(ims,['现状 b14067c','候选 A（招牌放大）','候选 B（深色底板）'])):
        x=g+i*(w+g); S.paste(im,(x,top)); d.text((x,8),lab,font=F,fill=(255,255,255))
    d.text((g,top+h+4),f'{view} · {res} · 离线预览（Blender Cycles，游戏同一镜头），非 Cocos 实机；每格为未裁切整屏',font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',16,index=2),fill=(200,200,200))
    S.save(f'fin/compare_{view}_{res}.png')
