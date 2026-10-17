import os
from PIL import Image, ImageDraw, ImageFont
D=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=[('A_rail_crates','A 秋林铁路·货箱车厢'),('B_snow_starmap','B 雪夜观星台·星图桌'),('C_cloud_terrace','C 云海·崖顶石台'),('D_hill_picnic','D 山丘重逢·野餐布'),('E_station_mailwall','E 备选·小站信格柜')]
W,H=360,640; out=Image.new('RGB',(W*5+60,H+70),(30,28,34)); d=ImageDraw.Draw(out)
f=None
for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc']:
    if os.path.exists(p): f=ImageFont.truetype(p,22); break
for i,(k,t) in enumerate(S):
    x=10+i*(W+10); p=os.path.join(D,k+'.png')
    if os.path.exists(p): out.paste(Image.open(p).convert('RGB').resize((W,H),Image.LANCZOS),(x,10))
    d.text((x+4,H+24),t,fill=(240,235,225),font=f)
q=88
while True:
    out.save(os.path.join(D,'overview.jpg'),quality=q)
    if os.path.getsize(os.path.join(D,'overview.jpg'))<1.2e6 or q<40: break
    q-=8
