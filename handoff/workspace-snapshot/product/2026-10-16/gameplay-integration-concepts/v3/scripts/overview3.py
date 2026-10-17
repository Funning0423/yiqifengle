import os
from PIL import Image, ImageDraw, ImageFont
D=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=[('A_rail_crates','A 秋林铁路·货箱车厢'),('B_snow_starmap','B 雪夜观星台·星图桌'),('C_cloud_terrace','C 云海·崖顶石台'),('D_hill_picnic','D 山丘重逢·坡顶野餐布'),('E_sky_kite','E 备选·云海大风筝')]
W,H=330,587; out=Image.new('RGB',(W*5+60,H+64),(32,28,36)); d=ImageDraw.Draw(out)
f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',20)
for i,(k,t) in enumerate(S):
    x=10+i*(W+10); p=os.path.join(D,k+'.png')
    if os.path.exists(p): out.paste(Image.open(p).convert('RGB').resize((W,H),Image.LANCZOS),(x,10))
    d.text((x+4,H+22),t,fill=(245,235,220),font=f)
q=90; o=os.path.join(D,'overview.jpg')
while True:
    out.save(o,quality=q,optimize=True)
    if os.path.getsize(o)<1.15e6 or q<50: break
    q-=6
print(os.path.getsize(o),q)
