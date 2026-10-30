# 进游戏的图：RGBA → ≤128 色调色板 PNG（PIL FASTOCTREE，保留 alpha），写 art/<正式名>.png 和 art/quant_table.json
import os,json,io
from PIL import Image,ImageDraw,ImageFont
HERE=os.path.dirname(os.path.abspath(__file__)); ART=os.path.join(os.path.dirname(HERE),'art'); RAW=os.path.join(ART,'raw')
PLAN={'reward_seal_coast':96,'reward_seal_coast_day':96,'reward_seal_snow':96,'region_coast':128,'region_snow':128}
rows=[]
for name,n in PLAN.items():
  src=Image.open(f'{RAW}/{name}.png').convert('RGBA'); b=io.BytesIO(); src.save(b,'PNG',optimize=True); before=b.tell()
  q=src.quantize(colors=n,method=Image.Quantize.FASTOCTREE,dither=(Image.Dither.FLOYDSTEINBERG if name.startswith('region_') else Image.Dither.NONE)); q.save(f'{ART}/{name}.png',optimize=True)
  rows.append(dict(file=name+'.png',size=list(src.size),colors=n,before_B=before,after_B=os.path.getsize(f'{ART}/{name}.png')))
json.dump(rows,open(f'{ART}/quant_table.json','w'),indent=1,ensure_ascii=False)
# 放大对比：每张 原图 | 量化 各 4 倍
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',20,index=2); tiles=[]
for r in rows:
  a=Image.open(f"{RAW}/{r['file']}").convert('RGBA'); b=Image.open(f"{ART}/{r['file']}").convert('RGBA'); z=4
  t=Image.new('RGBA',(a.width*z*2+30,a.height*z+40),(240,230,210,255)); t.alpha_composite(a.resize((a.width*z,a.height*z),Image.NEAREST),(0,40)); t.alpha_composite(b.resize((a.width*z,a.height*z),Image.NEAREST),(a.width*z+30,40))
  ImageDraw.Draw(t).text((4,6),f"{r['file']}  原 {r['before_B']/1024:.1f} KB  |  {r['colors']} 色 {r['after_B']/1024:.1f} KB",font=F,fill=(60,40,20)); tiles.append(t)
W=max(t.width for t in tiles); H=sum(t.height+20 for t in tiles); o=Image.new('RGB',(W,H),(250,244,232)); y=0
for t in tiles: o.paste(t.convert('RGB'),(0,y)); y+=t.height+20
o.save(os.path.join(os.path.dirname(HERE),'quant_zoom_compare.png'),optimize=True)
for r in rows: print(r)
